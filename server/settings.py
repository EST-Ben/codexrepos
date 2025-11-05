"""Runtime settings for the diagnostics server."""
from __future__ import annotations

import math
import os
import tempfile
from pathlib import Path
from types import SimpleNamespace


def _default_upload_dir() -> Path:
    """Return a cross-platform upload directory."""
    return Path(tempfile.gettempdir()) / "uploads"


def _compute_upload_dir() -> Path:
    override = os.getenv("UPLOAD_DIR")
    if override:
        return Path(override).expanduser()
    return _default_upload_dir()


def _comma_separated_list(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


ENV = os.getenv("ENV", os.getenv("ENVIRONMENT", "development")).strip().lower()
ENVIRONMENT = os.getenv("ENVIRONMENT", ENV).strip().lower()
ALLOWED_CORS_ORIGINS = _comma_separated_list(os.getenv("ALLOWED_ORIGINS"))

UPLOAD_DIR = _compute_upload_dir()
try:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
except OSError as exc:  # pragma: no cover - misconfigured environment
    raise RuntimeError(f"Unable to create upload directory '{UPLOAD_DIR}': {exc}") from exc

UPLOAD_DIR = UPLOAD_DIR.resolve()
MODEL_PATH = Path(os.getenv("MODEL_PATH", "./server/models/best.pt")).resolve()
ONNX_MODEL_PATH = Path(os.getenv("ONNX_MODEL_PATH", "./server/models/best.onnx")).resolve()
LINEAR_MODEL_PATH = Path(
    os.getenv("LINEAR_MODEL_PATH", "./server/models/issues_linear_model.json")
).resolve()
INFERENCE_MODE = os.getenv("INFERENCE_MODE", "linear")  # "linear" | "torch" | "onnx"

UPLOAD_MAX_MB = int(os.getenv("UPLOAD_MAX_MB", "10"))
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(UPLOAD_MAX_MB * 1024 * 1024)))
if MAX_UPLOAD_BYTES < UPLOAD_MAX_MB * 1024 * 1024:
    MAX_UPLOAD_BYTES = UPLOAD_MAX_MB * 1024 * 1024
else:
    UPLOAD_MAX_MB = max(UPLOAD_MAX_MB, math.ceil(MAX_UPLOAD_BYTES / (1024 * 1024)))

RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", "30"))
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))

settings = SimpleNamespace(
    ENV=ENV,
    ENVIRONMENT=ENVIRONMENT,
    ALLOWED_ORIGINS=ALLOWED_CORS_ORIGINS,
    ALLOWED_CORS_ORIGINS=ALLOWED_CORS_ORIGINS,
    UPLOAD_DIR=UPLOAD_DIR,
    MODEL_PATH=MODEL_PATH,
    ONNX_MODEL_PATH=ONNX_MODEL_PATH,
    LINEAR_MODEL_PATH=LINEAR_MODEL_PATH,
    INFERENCE_MODE=INFERENCE_MODE,
    UPLOAD_MAX_MB=UPLOAD_MAX_MB,
    MAX_UPLOAD_BYTES=MAX_UPLOAD_BYTES,
    RATE_LIMIT_REQUESTS=RATE_LIMIT_REQUESTS,
    RATE_LIMIT_WINDOW_SECONDS=RATE_LIMIT_WINDOW_SECONDS,
)

__all__ = [
    "ENV",
    "ENVIRONMENT",
    "ALLOWED_CORS_ORIGINS",
    "UPLOAD_DIR",
    "MODEL_PATH",
    "ONNX_MODEL_PATH",
    "LINEAR_MODEL_PATH",
    "INFERENCE_MODE",
    "UPLOAD_MAX_MB",
    "MAX_UPLOAD_BYTES",
    "RATE_LIMIT_REQUESTS",
    "RATE_LIMIT_WINDOW_SECONDS",
    "settings",
]
