"""Machine registry endpoints."""
from __future__ import annotations

from fastapi import APIRouter

from server.machines import machine_summaries

router = APIRouter(tags=["machines"])


@router.get("/machines")
def list_machines():
    """Return lightweight machine summaries for selectors."""
    return machine_summaries()
