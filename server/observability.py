import logging
import sys
import time

import structlog
from fastapi import FastAPI, Request
from prometheus_fastapi_instrumentator import Instrumentator


def init_logging() -> None:
    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.add_log_level,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        logger_factory=structlog.stdlib.LoggerFactory(),
    )
    logging.basicConfig(stream=sys.stdout, level=logging.INFO)


def attach_instrumentation(app: FastAPI) -> None:
    Instrumentator().instrument(app).expose(app, endpoint="/metrics")

    @app.middleware("http")
    async def _latency(request: Request, call_next):
        start = time.perf_counter()
        resp = await call_next(request)
        dur_ms = (time.perf_counter() - start) * 1000
        structlog.get_logger("request").info(
            "req",
            path=request.url.path,
            method=request.method,
            status=resp.status_code,
            duration_ms=round(dur_ms, 2),
        )
        return resp
