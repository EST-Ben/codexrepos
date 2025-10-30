"""FastAPI application entry point for diagnostics analysis."""
from __future__ import annotations

import json
import time
import uuid
from collections import deque
from pathlib import Path
from typing import Deque

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse

from server.inference import InferenceEngine
from server.machines import reload_registry, resolve_machine
from server.models.api import AnalyzeRequestMeta, AnalyzeResponse, Prediction
from server.rules import suggest
from server.settings import (
    MAX_UPLOAD_BYTES,
    RATE_LIMIT_REQUESTS,
    RATE_LIMIT_WINDOW_SECONDS,
    UPLOAD_DIR,
)
from server.slicer import diff as slicer_diff

try:  # pragma: no cover - optional import during refactor
    from server.app.routers import export, machines
except ModuleNotFoundError:  # pragma: no cover - compatibility
    export = machines = None  # type: ignore

app = FastAPI(title="Diagnostics AI", version="0.2.0")

INFERENCE_ENGINE = InferenceEngine()
_RATE_LIMIT_BUCKET: Deque[float] = deque()


@app.on_event("startup")
def _startup() -> None:
    reload_registry()


def _enforce_rate_limit() -> None:
    now = time.monotonic()
    window_start = now - RATE_LIMIT_WINDOW_SECONDS
    while _RATE_LIMIT_BUCKET and _RATE_LIMIT_BUCKET[0] < window_start:
        _RATE_LIMIT_BUCKET.popleft()
    if len(_RATE_LIMIT_BUCKET) >= RATE_LIMIT_REQUESTS:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded")
    _RATE_LIMIT_BUCKET.append(now)


async def _store_upload(image: UploadFile, image_id: str) -> Path:
    extension = Path(image.filename or "upload.jpg").suffix or ".jpg"
    destination = (UPLOAD_DIR / f"{image_id}{extension}").resolve()
    size = 0
    chunk_size = 1024 * 1024
    with destination.open("wb") as buffer:
        while True:
            chunk = await image.read(chunk_size)
            if not chunk:
                break
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                buffer.close()
                destination.unlink(missing_ok=True)
                raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Image too large")
            buffer.write(chunk)
    await image.close()
    return destination


if machines is not None:
    app.include_router(machines.router, prefix="/api")
if export is not None:
    app.include_router(export.router, prefix="/api")


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze(image: UploadFile = File(...), meta: str = Form(...)) -> AnalyzeResponse:
    _enforce_rate_limit()
    try:
        meta_payload = json.loads(meta)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid meta JSON: {exc}") from exc

    request_meta = AnalyzeRequestMeta(**meta_payload)
    try:
        resolve_machine(request_meta.machine_id)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    image_id = uuid.uuid4().hex
    image_path = await _store_upload(image, image_id)

    predictions, explanations = INFERENCE_ENGINE.predict(image_path)
    suggestions, low_confidence = suggest(predictions, request_meta)

    slicer_profile_diff = slicer_diff.apply(
        suggestions,
        base_profile=request_meta.base_profile or {},
        slicer="generic",
    )

    response = AnalyzeResponse(
        predictions=[Prediction(issue_id=p.issue_id, confidence=p.confidence) for p in predictions],
        explanations=explanations,
        suggestions=suggestions,
        slicer_profile_diff=slicer_profile_diff,
        image_id=image_id,
        version="ai-alpha-1",
        low_confidence=low_confidence,
    )
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(_, exc: HTTPException) -> JSONResponse:  # pragma: no cover - simple wrapper
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


__all__ = ["app"]
