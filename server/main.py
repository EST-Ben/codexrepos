"""FastAPI entrypoint for the diagnostics service."""
from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from . import settings
    from .app.routers import (
        analyze as analyze_router,
        analyze_image as analyze_image_router,
        export as export_router,
        machines as machines_router,
    )
    from .services import INFERENCE_ENGINE, LOCALIZATION_ENGINE  # noqa: E402  pylint: disable=wrong-import-position
except ImportError:  # pragma: no cover
    import sys
    from pathlib import Path

    package_dir = Path(__file__).resolve().parent
    parent_dir = package_dir.parent
    if str(parent_dir) not in sys.path:
        sys.path.append(str(parent_dir))

    import settings  # type: ignore
    from app.routers import (  # type: ignore
        analyze as analyze_router,
        analyze_image as analyze_image_router,
        export as export_router,
        machines as machines_router,
    )
    from services import INFERENCE_ENGINE, LOCALIZATION_ENGINE  # type: ignore  # noqa: E402  pylint: disable=wrong-import-position

app = FastAPI(title="3D Diagnostics API", version="0.1.0")

# Configure CORS differently for production vs development.
def _resolve_cors_origins() -> list[str]:
    if settings.ENVIRONMENT != "production":
        return ["*"]
    if not settings.ALLOWED_CORS_ORIGINS:
        raise RuntimeError(
            "ALLOWED_ORIGINS must be set when ENVIRONMENT=production"
        )
    return settings.ALLOWED_CORS_ORIGINS


app.add_middleware(
    CORSMiddleware,
    allow_origins=_resolve_cors_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)


@app.get("/health")
def health() -> dict[str, str]:
    """Simple readiness probe."""
    return {"status": "ok", "mode": os.getenv("INFERENCE_MODE", "stub")}


# Mount routers under /api for the mobile app and tests.
app.include_router(machines_router.router, prefix="/api")
# Register the multipart analyzer before the legacy shim to ensure POST /api/analyze
# hits the UploadFile flow instead of the 410 placeholder in analyze_router.
app.include_router(analyze_image_router.router, prefix="/api")
app.include_router(analyze_router.router, prefix="/api")
app.include_router(export_router.router, prefix="/api")

# Re-export singleton services for tests/patching convenience

__all__ = ["app", "INFERENCE_ENGINE", "LOCALIZATION_ENGINE"]
