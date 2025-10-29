"""Historical location for the analyze endpoint.

The multipart implementation now lives in :mod:`server.main`. This module is kept
so older imports fail loudly during refactors.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.post("/analyze")
def deprecated_analyze():  # pragma: no cover - compatibility shim
    raise HTTPException(status_code=410, detail="/api/analyze moved to server.main")
