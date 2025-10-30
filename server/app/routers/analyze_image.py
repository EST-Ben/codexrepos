# server/app/routers/analyze_image.py
from __future__ import annotations

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from typing import Optional

from server.rules import RulesEngine  # ✅ absolute import to avoid shadowing
from server.machines import resolve_machine

router = APIRouter(tags=["analyze-image"])

# If you keep this router, mount with prefix="/api" in main.py or
# just rely on the top-level /api/analyze in main.py (your choice).

class AnalyzeImageMeta(BaseModel):
    machine_id: str
    experience: str = "Intermediate"
    material: str = "PLA"
    app_version: Optional[str] = None


@router.post("/analyze-image")
async def analyze_image_route(
    image: UploadFile = File(...),
    meta: str = Form(...),
):
    # You can forward to main’s handler if you prefer a single codepath,
    # or implement a lighter alternative here.
    raise HTTPException(status_code=501, detail="Use POST /api/analyze (multipart) at server.main")
