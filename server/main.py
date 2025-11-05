"""FastAPI entrypoint for the diagnostics service."""
from __future__ import annotations

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware

try:
    from .settings import settings
    from .observability import attach_instrumentation, init_logging
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

    from settings import settings  # type: ignore
    from observability import attach_instrumentation, init_logging  # type: ignore
    from app.routers import (  # type: ignore
        analyze as analyze_router,
        analyze_image as analyze_image_router,
        export as export_router,
        machines as machines_router,
    )
    from services import INFERENCE_ENGINE, LOCALIZATION_ENGINE  # type: ignore  # noqa: E402  pylint: disable=wrong-import-position

app = FastAPI(title="3D Diagnostics API", version="0.1.0")

# ---- Rate limiting ----
_rate_limit = (
    f"{settings.RATE_LIMIT_REQUESTS}/{settings.RATE_LIMIT_WINDOW_SECONDS} seconds"
)
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[_rate_limit],
)
app.state.limiter = limiter


@app.middleware("http")
async def _apply_limits(request: Request, call_next):
    """Apply global request rate limits."""
    try:
        return await limiter.limit(_rate_limit)(call_next)(request)
    except RateLimitExceeded as exc:  # pragma: no cover - handled as HTTP error
        raise HTTPException(status_code=429, detail="Rate limit exceeded") from exc


class UploadSizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject uploads larger than the configured cap."""

    def __init__(self, app, max_mb: int):
        super().__init__(app)
        self.max_bytes = max_mb * 1024 * 1024

    async def dispatch(self, request: Request, call_next):
        cl = request.headers.get("content-length")
        if cl and cl.isdigit() and int(cl) > self.max_bytes:
            raise HTTPException(status_code=413, detail="Payload too large")
        return await call_next(request)


app.add_middleware(UploadSizeLimitMiddleware, max_mb=settings.UPLOAD_MAX_MB)

init_logging()
attach_instrumentation(app)

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


@app.get("/health", tags=["ops"])
def health() -> dict[str, object]:
    """Simple readiness probe."""
    mode = getattr(settings, "INFERENCE_MODE", "stub")
    return {
        "status": "ok",
        "mode": mode,
        "stub_inference": mode in {"stub", "linear"},
    }


# Mount routers under /api for the mobile app and tests.
app.include_router(machines_router.router, prefix="/api")
# Register the multipart analyzer before the legacy shim to ensure POST /api/analyze
# hits the UploadFile flow instead of the 410 placeholder in analyze_router.
app.include_router(analyze_image_router.router, prefix="/api")
app.include_router(analyze_router.router, prefix="/api")
app.include_router(export_router.router, prefix="/api")

# Re-export singleton services for tests/patching convenience

__all__ = ["app", "INFERENCE_ENGINE", "LOCALIZATION_ENGINE"]
