"""
Unit tests for the parts of train_codebert.py that do not need torch.

The training loop itself cannot be tested without a GPU, so everything around
it is tested here against values worked out by hand. Run with:

    python -m pytest ml/test_train_codebert.py -q
    python ml/test_train_codebert.py          # works without pytest too
"""

import math

from train_codebert import (
    apply_temperature,
    check_splits,
    expected_calibration_error,
    fit_temperature,
    pool,
    windows,
)


def test_windows_short_input_is_one_window():
    assert windows(list(range(10)), max_tokens=512) == [list(range(10))]


def test_windows_empty_input_is_one_empty_window():
    # a file that tokenises to nothing must still produce one item, or the
    # file silently disappears from the dataset
    assert windows([]) == [[]]


def test_windows_respect_the_special_token_budget():
    body = 512 - 2
    out = windows(list(range(2000)), max_tokens=512, stride=256)
    assert all(len(w) <= body for w in out)
    assert len(out[0]) == body


def test_windows_cover_every_token():
    ids = list(range(1000))
    seen = set()
    for window in windows(ids, max_tokens=130, stride=64):
        seen.update(window)
    assert seen == set(ids)


def test_windows_overlap_by_the_stride():
    out = windows(list(range(400)), max_tokens=102, stride=50)
    # window body is 100, stride 50, so consecutive windows share 50 tokens
    assert out[0][50:] == out[1][:50]


def test_windows_reject_bad_arguments():
    for kwargs in ({"max_tokens": 2}, {"stride": 0}, {"stride": 10_000}):
        try:
            windows([1, 2, 3], **kwargs)
        except ValueError:
            continue
        raise AssertionError(f"should have raised for {kwargs}")


def test_pool_max_is_the_default_behaviour():
    assert pool([0.1, 0.9, 0.2]) == 0.9


def test_pool_mean():
    assert abs(pool([0.0, 1.0], "mean") - 0.5) < 1e-12


def test_pool_rejects_unknown():
    try:
        pool([0.5], "median")
    except ValueError:
        return
    raise AssertionError("should have raised")


def test_apply_temperature_matches_the_sigmoid():
    for gap in (-8.0, -1.0, 0.0, 0.5, 3.0):
        assert abs(apply_temperature(gap, 1.0) - 1 / (1 + math.exp(-gap))) < 1e-12


def test_apply_temperature_is_stable_at_the_extremes():
    # the naive form overflows here; these must not raise and must saturate
    assert apply_temperature(1000.0, 1.0) == 1.0
    assert apply_temperature(-1000.0, 1.0) < 1e-300


def test_apply_temperature_softens_confidence():
    hot = apply_temperature(4.0, 1.0)
    cool = apply_temperature(4.0, 4.0)
    assert 0.5 < cool < hot


def test_fit_temperature_sharpens_when_the_model_is_underconfident():
    # small but correctly signed gaps: dividing by a small T raises confidence
    gaps = [0.3] * 20 + [-0.3] * 20
    labels = [1] * 20 + [0] * 20
    assert fit_temperature(gaps, labels) < 1.0


def test_fit_temperature_softens_when_the_model_is_overconfident():
    # huge gaps that are wrong a quarter of the time: confidence must come down
    gaps = [6.0] * 15 + [-6.0] * 5 + [-6.0] * 15 + [6.0] * 5
    labels = [1] * 20 + [0] * 20
    assert fit_temperature(gaps, labels) > 1.0


def test_fit_temperature_minimises_the_likelihood_it_claims_to():
    gaps = [2.0, -1.0, 0.5, -3.0, 1.5]
    labels = [1, 0, 1, 0, 0]

    def nll(temperature):
        total = 0.0
        for gap, label in zip(gaps, labels, strict=True):
            p = 1 / (1 + math.exp(-gap / temperature))
            p = min(max(p, 1e-15), 1 - 1e-15)
            total -= math.log(p) if label == 1 else math.log(1 - p)
        return total

    chosen = fit_temperature(gaps, labels)
    # nothing on a fine grid around the choice should beat it
    for candidate in (chosen * 0.8, chosen * 1.25, 1.0, 3.0):
        assert nll(chosen) <= nll(candidate) + 1e-9


def test_fit_temperature_handles_no_data():
    assert fit_temperature([], []) == 1.0


def test_calibration_error_is_zero_when_confidence_matches_reality():
    # ten items at 0.9 confidence, nine of them correct
    probs = [0.9] * 10
    labels = [1] * 9 + [0]
    assert expected_calibration_error(probs, labels) < 1e-9


def test_calibration_error_is_one_when_confidently_wrong():
    probs = [1.0] * 10
    labels = [0] * 10
    assert abs(expected_calibration_error(probs, labels) - 1.0) < 1e-9


def test_calibration_error_counts_underconfidence_too():
    # confidence 0.1 against accuracy 0.9. Without the absolute value this
    # comes out negative and silently cancels real error elsewhere.
    probs = [0.1] * 10
    labels = [1] * 9 + [0]
    assert abs(expected_calibration_error(probs, labels) - 0.8) < 1e-9


def test_calibration_error_handles_no_data():
    assert math.isnan(expected_calibration_error([], []))


def _row(rid, label, origin, grade="human", host=None):
    row = {"id": rid, "label": label, "origin": origin, "grade": grade}
    if host:
        row["host"] = host
    return row


def test_check_splits_accepts_a_clean_split():
    train = [_row(1, "human", "a"), _row(2, "ai", "b", "grade1_raw")]
    val = [_row(3, "human", "c"), _row(4, "ai", "d", "grade1_raw")]
    test = [_row(5, "human", "e"), _row(6, "ai", "f", "grade1_raw")]
    assert check_splits(train, val, test) == []


def test_check_splits_catches_a_single_class_split():
    train = [_row(1, "human", "a"), _row(2, "ai", "b", "grade1_raw")]
    val = [_row(3, "human", "c")]
    test = [_row(5, "human", "e"), _row(6, "ai", "f", "grade1_raw")]
    problems = check_splits(train, val, test)
    assert any("only the human class" in p for p in problems)


def test_check_splits_catches_an_empty_split():
    train = [_row(1, "human", "a"), _row(2, "ai", "b", "grade1_raw")]
    assert any("empty" in p for p in check_splits(train, [], train))


def test_check_splits_catches_a_source_file_in_two_splits():
    # the exact leak that matters: one origin feeding train and test
    train = [_row(1, "human", "shared"), _row(2, "ai", "b", "grade1_raw")]
    val = [_row(3, "human", "c"), _row(4, "ai", "d", "grade1_raw")]
    test = [_row(5, "ai", "shared", "grade1_raw"), _row(6, "human", "f")]
    problems = check_splits(train, val, test)
    assert any("more than one" in p for p in problems)


def test_check_splits_catches_a_grade3_host_leaking():
    # host sits in train as human, and inside a grade-3 item in test
    train = [_row(1, "human", "host.py"), _row(2, "ai", "b", "grade1_raw")]
    val = [_row(3, "human", "c"), _row(4, "ai", "d", "grade1_raw")]
    test = [_row(5, "ai", "donor", "grade3_mixed", host="host.py"),
            _row(6, "human", "f")]
    problems = check_splits(train, val, test)
    assert any("more than one" in p for p in problems)


def main():
    passed = failed = 0
    for name, fn in sorted(globals().items()):
        if not name.startswith("test_") or not callable(fn):
            continue
        try:
            fn()
            passed += 1
        except Exception as exc:
            failed += 1
            print(f"FAIL {name}: {type(exc).__name__}: {exc}")
    print(f"\n{passed} passed, {failed} failed")
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    main()
