# ---- build stage ----
FROM python:3.11-slim-bookworm AS build

# venv in a fixed location so the runtime stage can copy it wholesale
ENV VIRTUAL_ENV=/opt/venv
RUN python -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

WORKDIR /app

# copied alone so the install layer caches independently of source changes
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# ---- runtime stage ----
FROM python:3.11-slim-bookworm AS runtime

ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN useradd --create-home --uid 1000 appuser

WORKDIR /app

COPY --from=build $VIRTUAL_ENV $VIRTUAL_ENV
COPY app ./app

USER appuser

EXPOSE 8000

# --timeout-graceful-shutdown caps how long uvicorn waits for requests that
# are still running when SIGTERM arrives. Without it uvicorn waits with no
# limit, and analyze is a sync def, so it runs in anyio's threadpool where a
# running analysis cannot be cancelled at all. Docker's grace period was then
# the only bound, and that ends in SIGKILL.
#
# 30 seconds because the api gives up on this service at DETECTOR_TIMEOUT_MS,
# which defaults to 30000. An analysis still running past that has no caller
# left listening, so there is nothing to protect by waiting longer.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--timeout-graceful-shutdown", "30"]
