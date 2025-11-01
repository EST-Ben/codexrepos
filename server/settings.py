"""Runtime settings for the diagnostics server."""
from __future__ import annotations

import os
import tempfile
from pathlib import Path


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


ENVIRONMENT = os.getenv("ENVIRONMENT", "development").strip().lower()
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

MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(12 * 1024 * 1024)))
RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", "30"))
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))

__all__ = [
    "ENVIRONMENT",
    "ALLOWED_CORS_ORIGINS",
    "UPLOAD_DIR",
    "MODEL_PATH",
    "ONNX_MODEL_PATH",
    "LINEAR_MODEL_PATH",
    "INFERENCE_MODE",
    "MAX_UPLOAD_BYTES",
    "RATE_LIMIT_REQUESTS",
    "RATE_LIMIT_WINDOW_SECONDS",
]
