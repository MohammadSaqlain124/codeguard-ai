import time

from fastapi import FastAPI

app = FastAPI(
    title="CodeGuard AI Detector",
    description="AST, stylometry and AI-content analysis for submitted source code",
    version="0.1.0",
)

# monotonic, not time.time(), so a system clock change can't make uptime negative
_started_at = time.monotonic()


@app.get("/health")
def health():
    return {"status": "ok", "uptime": round(time.monotonic() - _started_at, 3)}
