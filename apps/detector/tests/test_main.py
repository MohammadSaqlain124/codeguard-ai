"""The HTTP contract the Node API depends on.

Everything else in this suite tests a module in isolation. This file tests
the two endpoints as the other half of the system actually sees them, which
is the cross-language contract that has been checked by hand until now.
"""
from fastapi.testclient import TestClient

from app.features import FEATURE_NAMES
from app.main import (
    DETECTOR_VERSION,
    FEATURE_SET_VERSION,
    MAX_BODY_BYTES,
    MAX_CANDIDATES,
    MAX_DEEP_CANDIDATES,
    MAX_SOURCE_CHARS,
    MIN_SPAN_NODES,
    app,
)
from tests.conftest import (
    JAVA_SIMPLE,
    PY_BROKEN,
    PY_NO_FUNCTIONS,
    PY_ORIGINAL,
    PY_RENAMED,
    PY_TWO_FUNCTIONS,
    TEST_TOKEN,
)

client = TestClient(app)

# every real endpoint needs the shared secret; /health deliberately does not
AUTH = {"x-detector-token": TEST_TOKEN}


def analyze(source, candidates=(), language="python", submission="s1"):
    return client.post(
        "/analyze",
        headers=AUTH,
        json={
            "submissionId": submission,
            "language": language,
            "source": source,
            "candidates": [
                {"submissionId": f"c{i}", "source": text}
                for i, text in enumerate(candidates)
            ],
        },
    )


def features(source, language="python"):
    return client.post(
        "/features",
        headers=AUTH,
        json={"submissionId": "s1", "language": language, "source": source},
    )


# ---------------------------------------------------------------- health ---

def test_health_reports_the_version():
    body = client.get("/health").json()
    assert body == {"ok": True, "version": DETECTOR_VERSION}


# --------------------------------------------------------------- analyze ---

def test_no_candidates_means_we_did_not_look():
    body = analyze(PY_ORIGINAL).json()
    assert body["parsed"] is True
    # compared False is the difference between "found nothing" and "did not look"
    assert body["compared"] is False
    assert body["candidatesCompared"] == 0
    assert body["matches"] == []


def test_an_identical_candidate_scores_one():
    body = analyze(PY_ORIGINAL, [PY_ORIGINAL]).json()
    assert body["compared"] is True
    assert body["candidatesCompared"] == 1
    assert body["matches"][0]["similarity"] == 1.0
    assert body["matches"][0]["submissionId"] == "c0"


def test_a_renamed_candidate_also_scores_one():
    body = analyze(PY_ORIGINAL, [PY_RENAMED]).json()
    assert body["matches"][0]["similarity"] == 1.0


def test_matches_come_back_strongest_first():
    body = analyze(PY_ORIGINAL, [PY_NO_FUNCTIONS, PY_RENAMED]).json()
    scores = [m["similarity"] for m in body["matches"]]
    assert scores == sorted(scores, reverse=True)


def test_unparsable_source_is_reported_not_scored():
    body = analyze(PY_BROKEN, [PY_ORIGINAL]).json()
    assert body["parsed"] is False
    assert "does not parse" in body["parseError"]
    assert body["compared"] is False
    assert body["candidatesCompared"] == 0
    # still a 200: a broken submission is an answer, not a server error
    assert analyze(PY_BROKEN).status_code == 200


def test_an_unparsable_candidate_is_simply_not_a_candidate():
    body = analyze(PY_ORIGINAL, [PY_BROKEN, PY_RENAMED]).json()
    assert body["compared"] is True
    # one of the two was dropped, and the good one still scored
    assert body["candidatesCompared"] == 1
    assert body["matches"][0]["similarity"] == 1.0


def test_every_candidate_unparsable_means_nothing_to_compare():
    body = analyze(PY_ORIGINAL, [PY_BROKEN]).json()
    assert body["parsed"] is True
    assert body["compared"] is False
    assert body["matches"] == []


def test_parse_error_is_absent_when_the_source_is_clean():
    # response_model_exclude_none, so an optional field that is None does
    # not appear at all rather than appearing as null
    body = analyze(PY_ORIGINAL).json()
    assert "parseError" not in body


def test_the_deep_candidate_cap_is_respected():
    many = [PY_RENAMED] * (MAX_DEEP_CANDIDATES + 2)
    body = analyze(PY_ORIGINAL, many).json()
    assert body["compared"] is True
    assert body["candidatesCompared"] <= MAX_DEEP_CANDIDATES


def test_spans_are_returned_for_a_real_match():
    body = analyze(PY_ORIGINAL, [PY_RENAMED]).json()
    spans = body["matches"][0]["spans"]
    assert spans, "an identical function should produce at least one span"
    for span in spans:
        assert span["aStart"] >= 1
        assert span["aEnd"] >= span["aStart"]
        assert span["bEnd"] >= span["bStart"]


def test_a_tiny_match_produces_no_spans():
    # below MIN_SPAN_NODES a match is not evidence whatever it scores, so
    # the line ranges are withheld even though the score stands
    tiny = "x = 1\n"
    body = analyze(tiny, [tiny]).json()
    assert body["matches"][0]["similarity"] == 1.0
    assert body["matches"][0]["spans"] == []


def test_java_is_accepted():
    body = analyze(JAVA_SIMPLE, [JAVA_SIMPLE], language="java").json()
    assert body["parsed"] is True
    assert body["matches"][0]["similarity"] == 1.0


def test_an_unknown_language_is_rejected_by_validation():
    assert analyze(PY_ORIGINAL, language="rust").status_code == 422


def test_an_oversized_source_is_rejected():
    too_big = "x = 1\n" * (MAX_SOURCE_CHARS // 6 + 10)
    assert len(too_big) > MAX_SOURCE_CHARS
    assert analyze(too_big).status_code == 422


def test_too_many_candidates_are_rejected():
    assert analyze(PY_ORIGINAL, [PY_ORIGINAL] * (MAX_CANDIDATES + 1)).status_code == 422


def test_analyze_reports_its_version_and_cost():
    body = analyze(PY_ORIGINAL).json()
    assert body["detectorVersion"] == DETECTOR_VERSION
    assert body["durationMs"] >= 0
    assert body["nodeCount"] > MIN_SPAN_NODES


# -------------------------------------------------------------- features ---

def test_features_returns_every_declared_name():
    body = features(PY_ORIGINAL).json()
    assert list(body["features"]) == list(FEATURE_NAMES)


def test_features_reports_both_versions():
    body = features(PY_ORIGINAL).json()
    assert body["detectorVersion"] == DETECTOR_VERSION
    assert body["featureSetVersion"] == FEATURE_SET_VERSION


def test_features_reports_the_line_count():
    # File 072's minimum anchor size is written against this number
    body = features(PY_TWO_FUNCTIONS).json()
    assert body["lineCount"] == len(PY_TWO_FUNCTIONS.splitlines())


def test_an_unmeasurable_feature_never_arrives_as_zero():
    # The contract that matters, and the one thing that would be wrong:
    # a file with no loops must not report for_loop_ratio 0. Whether the
    # key is absent or explicitly null is the serialiser's business, and
    # the Node side treats both as "not measured".
    body = features(PY_NO_FUNCTIONS).json()
    for name in ("for_loop_ratio", "avg_function_lines", "avg_params_per_function"):
        value = body["features"].get(name, None)
        assert value is None, f"{name} came back as {value!r} rather than absent or null"


def test_a_measured_zero_is_kept():
    # there were loops and none were for loops, which is a real measurement
    body = features("while True:\n    break\n").json()
    assert body["features"]["for_loop_ratio"] == 0.0


def test_features_on_unparsable_source_measures_nothing():
    body = features(PY_BROKEN).json()
    assert body["parsed"] is False
    assert "does not parse" in body["parseError"]
    assert body["features"] == {}
    assert features(PY_BROKEN).status_code == 200


def test_features_rejects_an_unknown_language():
    assert features(PY_ORIGINAL, language="rust").status_code == 422


def test_features_rejects_an_oversized_source():
    too_big = "x = 1\n" * (MAX_SOURCE_CHARS // 6 + 10)
    assert features(too_big).status_code == 422


def test_features_of_the_same_file_is_deterministic():
    first = features(PY_ORIGINAL).json()["features"]
    second = features(PY_ORIGINAL).json()["features"]
    assert first == second


def test_the_final_order_is_the_exact_score_not_the_cheap_one():
    # The prefilter ranks by label bag, which ignores shape. This candidate
    # has the same labels as the target in a different nesting, so the cheap
    # score calls it a perfect match (1.0) while the real score is 0.85.
    # Without the final sort it would be presented above the exact copy.
    target = "def f():\n    if a:\n        b()\n    c()\n"
    exact_copy = target
    same_bag_different_shape = "def f():\n    if a:\n        b()\n        c()\n"

    body = analyze(target, [exact_copy, same_bag_different_shape]).json()
    scores = [m["similarity"] for m in body["matches"]]

    assert scores == sorted(scores, reverse=True)
    assert scores[0] == 1.0
    assert scores[-1] < 1.0


# ------------------------------------------------------------------ auth ---

def test_health_needs_no_token():
    # docker compose health-checks this, and it reveals only ok and version
    assert client.get("/health").status_code == 200


def test_analyze_without_a_token_is_refused():
    r = client.post(
        "/analyze",
        json={"submissionId": "s", "language": "python", "source": PY_ORIGINAL},
    )
    assert r.status_code == 401
    assert "token" in r.json()["detail"].lower()


def test_features_without_a_token_is_refused():
    r = client.post(
        "/features",
        json={"submissionId": "s", "language": "python", "source": PY_ORIGINAL},
    )
    assert r.status_code == 401


def test_a_wrong_token_is_refused():
    r = client.post(
        "/analyze",
        headers={"x-detector-token": "x" * len(TEST_TOKEN)},
        json={"submissionId": "s", "language": "python", "source": PY_ORIGINAL},
    )
    assert r.status_code == 401


def test_a_token_of_the_wrong_length_is_refused():
    # compare_digest is constant time for equal lengths and still returns
    # false for unequal ones, so a short guess must not be accepted
    r = client.post(
        "/analyze",
        headers={"x-detector-token": TEST_TOKEN[:-1]},
        json={"submissionId": "s", "language": "python", "source": PY_ORIGINAL},
    )
    assert r.status_code == 401


def test_a_non_ascii_token_is_a_401_not_a_500():
    # Header values travel as bytes and starlette decodes them as latin-1,
    # so the handler really can be handed a non-ascii string. compare_digest
    # on str raises on exactly that, which would turn a bad token into a 500,
    # so the comparison is done on bytes. Sent as raw bytes here because an
    # http client will not encode a non-ascii str into a header at all.
    r = client.post(
        "/analyze",
        headers={"x-detector-token": "tokén".encode("latin-1") + b"x" * 40},
        json={"submissionId": "s", "language": "python", "source": PY_ORIGINAL},
    )
    assert r.status_code == 401


def test_auth_runs_before_validation():
    # an unauthenticated caller must not be told whether its payload was
    # valid, so a bad language with no token is still a 401 and not a 422
    r = client.post(
        "/analyze",
        json={"submissionId": "s", "language": "rust", "source": PY_ORIGINAL},
    )
    assert r.status_code == 401


# ------------------------------------------------------------ body limit ---

def test_an_oversized_body_is_refused_before_it_is_read():
    big = b"x" * (MAX_BODY_BYTES + 1024)
    r = client.post(
        "/analyze",
        content=big,
        headers={**AUTH, "content-type": "application/json"},
    )
    assert r.status_code == 413
    assert str(MAX_BODY_BYTES) in r.json()["detail"]


def test_a_normal_body_passes_the_limit():
    assert analyze(PY_ORIGINAL).status_code == 200
