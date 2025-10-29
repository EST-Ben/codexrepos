"""Runtime settings for the diagnostics server."""
from __future__ import annotations

import os
from pathlib import Path

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/tmp/uploads")).resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
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
