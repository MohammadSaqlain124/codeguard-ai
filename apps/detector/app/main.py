import logging
import time
from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel, Field

from app.normalise import normalise, size
from app.parsing import parse_source
from app.prefilter import label_counts, rank
from app.units import compare_unit_sets, extract_units

# Bumped whenever the analysis changes in a way that moves scores. Every
# DetectionResult stores it, so an old result stays explainable later.
DETECTOR_VERSION = "0.3.0"

# The API caps uploads at 256 KB, so anything larger than this is a bug
# on the calling side rather than a real submission.
MAX_SOURCE_CHARS = 256 * 1024
MAX_CANDIDATES = 50

# Of the candidates we are handed, how many earn the expensive treatment.
MAX_DEEP_CANDIDATES = 10

# A match smaller than this is not evidence whatever it scores: two
# one-line functions resemble each other because they are one line long.
MIN_SPAN_NODES = 10

# Keep a response readable by a person reviewing it.
MAX_SPANS_PER_MATCH = 20

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


def millis_since(started: float) -> float:
    return round((time.perf_counter() - started) * 1000, 3)


@app.get("/health")
def health():
    return {"ok": True, "version": DETECTOR_VERSION}


@app.post("/analyze", response_model=AnalyzeResponse, response_model_exclude_none=True)
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
        spans = [
            Span(aStart=m.a_start, aEnd=m.a_end, bStart=m.b_start, bEnd=m.b_end)
            for m in outcome.matches
            if m.nodes_a >= MIN_SPAN_NODES and m.nodes_b >= MIN_SPAN_NODES
        ]
        matches.append(
            Match(
                submissionId=submission_id,
                similarity=outcome.similarity,
                spans=spans[:MAX_SPANS_PER_MATCH],
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
