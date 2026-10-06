import logging
import os
import secrets
import time
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.features import FEATURE_NAMES, extract_features
from app.normalise import normalise, size
from app.parsing import parse_source
from app.prefilter import label_counts, rank
from app.units import compare_unit_sets, extract_units

# Bumped whenever the analysis changes in a way that moves scores. Every
# DetectionResult stores it, so an old result stays explainable later.
DETECTOR_VERSION = "0.4.0"

# Bumped only when a feature is added, removed or redefined. A stored
# baseline records this, so a baseline built on an older set is never
# compared against measurements from a newer one.
FEATURE_SET_VERSION = 1

# The API caps uploads at 256 KB, so anything larger than this is a bug
# on the calling side rather than a real submission.
MAX_SOURCE_CHARS = 256 * 1024
MAX_CANDIDATES = 50

# Shared secret the API sends with every call. Nothing public is meant to
# reach this service, so one token is the right weight: it stops anything
# else on the host from submitting work or reading back scores.
#
# Read once at import, and the service refuses to start without it. A
# security control that quietly turns itself off when misconfigured is
# worse than no control, because nobody finds out.
DETECTOR_TOKEN = os.environ.get("DETECTOR_TOKEN", "")
if len(DETECTOR_TOKEN) < 32:
    raise RuntimeError(
        "DETECTOR_TOKEN must be set to at least 32 characters. "
        "It lives in infra/.env and docker compose passes it in."
    )

# The largest honest request is one source plus fifty candidates at 256 KB
# each, which is about 13 MB before JSON escaping. 16 MB leaves room for the
# escaping and for nothing else.
MAX_BODY_BYTES = 16 * 1024 * 1024

# Of the candidates we are handed, how many earn the expensive treatment.
MAX_DEEP_CANDIDATES = 10

# A match smaller than this is not evidence whatever it scores: two
# one-line functions resemble each other because they are one line long.
MIN_SPAN_NODES = 10

# Keep a response readable by a person reviewing it.
MAX_SPANS_PER_MATCH = 20

# A weak match is not evidence either. Without this, an unrelated pair at
# 0.49 still produces line ranges that read like a finding.
MIN_SPAN_SIMILARITY = 0.7

log = logging.getLogger("detector")

app = FastAPI(title="CodeGuard Detector", version=DETECTOR_VERSION)


# The field names below are camelCase on purpose, not by accident. They
# mirror the JSON the Node API sends, so what arrives maps straight onto
# these models with nothing in between to get out of step.
class CandidateSource(BaseModel):
    submissionId: str
    source: str = Field(max_length=MAX_SOURCE_CHARS)


class AnalyzeRequest(BaseModel):
    submissionId: str
    language: Literal["python", "java"]
    source: str = Field(max_length=MAX_SOURCE_CHARS)
    candidates: list[CandidateSource] = Field(default_factory=list, max_length=MAX_CANDIDATES)


class Span(BaseModel):
    aStart: int = Field(ge=1)
    aEnd: int = Field(ge=1)
    bStart: int = Field(ge=1)
    bEnd: int = Field(ge=1)


class Match(BaseModel):
    submissionId: str
    similarity: float = Field(ge=0, le=1)
    spans: list[Span] = Field(default_factory=list)


class AnalyzeResponse(BaseModel):
    detectorVersion: str
    parsed: bool
    parseError: str | None = None
    nodeCount: int | None = None
    # False means no comparison was attempted, so an empty match list is
    # "we did not look", not "we looked and found nothing".
    compared: bool
    # How many candidates were compared properly, which is usually fewer
    # than we were sent.
    candidatesCompared: int
    matches: list[Match] = Field(default_factory=list)
    durationMs: float


class FeaturesRequest(BaseModel):
    submissionId: str
    language: Literal["python", "java"]
    source: str = Field(max_length=MAX_SOURCE_CHARS)


class FeaturesResponse(BaseModel):
    detectorVersion: str
    featureSetVersion: int
    parsed: bool
    parseError: str | None = None
    nodeCount: int | None = None
    lineCount: int | None = None
    # A null value means the feature did not apply to this file, which is
    # not the same as a measurement of zero. The caller must keep that
    # difference or it will build a baseline out of absences.
    features: dict[str, float | None] = Field(default_factory=dict)
    durationMs: float


def millis_since(started: float) -> float:
    return round((time.perf_counter() - started) * 1000, 3)


def spans_for(unit_matches) -> list[Span]:
    """Only the matches big enough and strong enough to show a person."""
    kept = [
        m
        for m in unit_matches
        if m.nodes_a >= MIN_SPAN_NODES
        and m.nodes_b >= MIN_SPAN_NODES
        and m.similarity >= MIN_SPAN_SIMILARITY
    ]
    # strongest first, so capping the list drops the weakest evidence
    kept.sort(key=lambda m: m.similarity, reverse=True)
    return [
        Span(aStart=m.a_start, aEnd=m.a_end, bStart=m.b_start, bEnd=m.b_end)
        for m in kept[:MAX_SPANS_PER_MATCH]
    ]


def require_token(
    x_detector_token: Annotated[str | None, Header()] = None,
) -> None:
    """Rejects a call that does not carry the shared secret.

    compare_digest rather than ==, so how long the check takes does not
    leak how much of the token was correct. Compared as bytes, because the
    string form of compare_digest refuses anything outside ascii and a
    stray header should be a 401 rather than a 500.
    """
    supplied = (x_detector_token or "").encode("utf-8")
    expected = DETECTOR_TOKEN.encode("utf-8")
    if not secrets.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Invalid or missing detector token")


@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    """Refuses an oversized request before its body is read into memory.

    Pydantic caps every field, but only once the whole body has been
    buffered, so a huge POST costs the memory before anything rejects it.
    Checking the declared length first is what makes that cheap. A chunked
    request declares no length, and for those the field caps are still the
    backstop.
    """
    declared = request.headers.get("content-length")
    if declared is not None and declared.isdigit() and int(declared) > MAX_BODY_BYTES:
        return JSONResponse(
            status_code=413,
            content={"detail": f"Request body may not exceed {MAX_BODY_BYTES} bytes"},
        )
    return await call_next(request)


# deliberately open: docker compose health-checks this with no token, and it
# reveals only that the process is up and which version it is
@app.get("/health")
def health():
    return {"ok": True, "version": DETECTOR_VERSION}


@app.post(
    "/analyze",
    response_model=AnalyzeResponse,
    response_model_exclude_none=True,
    dependencies=[Depends(require_token)],
)
def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    started = time.perf_counter()
    log.info(
        "analyze %s, language %s, %d candidates",
        request.submissionId,
        request.language,
        len(request.candidates),
    )

    parsed = parse_source(request.language, request.source)
    if not parsed.ok:
        # nothing else can be trusted once the tree is built around errors
        return AnalyzeResponse(
            detectorVersion=DETECTOR_VERSION,
            parsed=False,
            parseError=parsed.error,
            nodeCount=parsed.node_count,
            compared=False,
            candidatesCompared=0,
            durationMs=millis_since(started),
        )

    target = normalise(parsed.root)
    target_units = extract_units(target, request.language)
    target_size = size(target)
    target_labels = label_counts(target)

    # a candidate that will not parse is simply not a candidate
    others = []
    unparsable = 0
    for candidate in request.candidates:
        result = parse_source(request.language, candidate.source)
        if not result.ok:
            unparsable += 1
            continue
        tree = normalise(result.root)
        others.append(
            (
                candidate.submissionId,
                extract_units(tree, request.language),
                size(tree),
                label_counts(tree),
            )
        )

    # the cheap score decides who is worth the expensive one
    chosen = rank(target_labels, [other[3] for other in others], MAX_DEEP_CANDIDATES)

    matches = []
    for index in chosen:
        submission_id, units, tree_size, _ = others[index]
        outcome = compare_unit_sets(target_units, units, target_size, tree_size)
        matches.append(
            Match(
                submissionId=submission_id,
                similarity=outcome.similarity,
                spans=spans_for(outcome.matches),
            )
        )

    matches.sort(key=lambda m: m.similarity, reverse=True)

    log.info(
        "analyzed %s: %d units, %d of %d candidates compared, %d unparsable",
        request.submissionId,
        len(target_units),
        len(matches),
        len(request.candidates),
        unparsable,
    )

    return AnalyzeResponse(
        detectorVersion=DETECTOR_VERSION,
        parsed=True,
        # the raw named-node count, the same meaning it had in File 060
        nodeCount=parsed.node_count,
        compared=len(others) > 0,
        candidatesCompared=len(matches),
        matches=matches,
        durationMs=millis_since(started),
    )


@app.post(
    "/features",
    response_model=FeaturesResponse,
    response_model_exclude_none=True,
    dependencies=[Depends(require_token)],
)
def features(request: FeaturesRequest) -> FeaturesResponse:
    started = time.perf_counter()
    log.info("features %s, language %s", request.submissionId, request.language)

    parsed = parse_source(request.language, request.source)
    if not parsed.ok:
        # function boundaries and comment positions are both unreliable in a
        # tree built around errors, so there is nothing honest to measure
        return FeaturesResponse(
            detectorVersion=DETECTOR_VERSION,
            featureSetVersion=FEATURE_SET_VERSION,
            parsed=False,
            parseError=parsed.error,
            nodeCount=parsed.node_count,
            durationMs=millis_since(started),
        )

    # the same bytes parse_source handed tree-sitter, so the node offsets
    # features.py slices with point at the right characters
    values = extract_features(parsed.root, request.source.encode("utf-8"))

    return FeaturesResponse(
        detectorVersion=DETECTOR_VERSION,
        featureSetVersion=FEATURE_SET_VERSION,
        parsed=True,
        nodeCount=parsed.node_count,
        lineCount=len(request.source.splitlines()),
        # rebuilt in the canonical order, which also fails loudly if
        # features.py ever stops producing one of the declared names
        features={name: values[name] for name in FEATURE_NAMES},
        durationMs=millis_since(started),
    )
