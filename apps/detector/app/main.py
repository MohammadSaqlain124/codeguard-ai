import logging
import time
from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel, Field

from app.parsing import parse_source

# Bumped whenever the analysis changes in a way that moves scores. Every
# DetectionResult stores it, so an old result stays explainable later.
DETECTOR_VERSION = "0.2.0"

# The API caps uploads at 256 KB, so anything larger than this is a bug
# on the calling side rather than a real submission.
MAX_SOURCE_CHARS = 256 * 1024
MAX_CANDIDATES = 50

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
    matches: list[Match] = Field(default_factory=list)
    durationMs: float


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

    result = parse_source(request.language, request.source)
    elapsed = round((time.perf_counter() - started) * 1000, 3)

    # File 062 replaces compared=False with the real tree comparison
    return AnalyzeResponse(
        detectorVersion=DETECTOR_VERSION,
        parsed=result.ok,
        parseError=result.error,
        nodeCount=result.node_count,
        compared=False,
        durationMs=elapsed,
    )
