"""Runtime settings for the diagnostics server."""
from __future__ import annotations

import os
import tempfile
from pathlib import Path


def _default_upload_dir() -> Path:
    """Return a cross-platform upload directory."""
    if os.name == "nt":  # Windows prefers a predictable root for temp files.
        return Path("C:/tmp/uploads")
    return Path(tempfile.gettempdir()) / "uploads"


def _compute_upload_dir() -> Path:
    override = os.getenv("UPLOAD_DIR")
    if override:
        return Path(override).expanduser()
    return _default_upload_dir()


UPLOAD_DIR = _compute_upload_dir()
try:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
except OSError as exc:  # pragma: no cover - misconfigured environment
    raise RuntimeError(f"Unable to create upload directory '{UPLOAD_DIR}': {exc}") from exc

UPLOAD_DIR = UPLOAD_DIR.resolve()
MODEL_PATH = Path(os.getenv("MODEL_PATH", "./server/models/best.pt")).resolve()
INFERENCE_MODE = os.getenv("INFERENCE_MODE", "stub")  # "stub" | "torch"

MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(12 * 1024 * 1024)))
RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", "30"))
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))

__all__ = [
    "UPLOAD_DIR",
    "MODEL_PATH",
    "INFERENCE_MODE",
    "MAX_UPLOAD_BYTES",
    "RATE_LIMIT_REQUESTS",
    "RATE_LIMIT_WINDOW_SECONDS",
]
