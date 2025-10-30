# server/app/routers/analyze_image.py
from typing import Literal
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from server.machines import MachineProfile, resolve_machine
from ..ml.pipeline import DiagnosticPipeline  # you’ll adapt this to handle images
from ..rules import RulesEngine

router = APIRouter(tags=["analyze"])

@router.post("/analyze/image")
async def analyze_image(
    machine: str = Form(...),
    material: str = Form("PLA"),
    experience: Literal["Beginner", "Intermediate", "Advanced"] = Form("Intermediate"),
    image: UploadFile = File(...),
):
    try:
        m: MachineProfile = resolve_machine(machine)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    img_bytes = await image.read()

    # TODO: call your vision model here (local or hosted) to detect issues
    # e.g., prediction = VisionModel.predict(img_bytes, material)
    # For now, stub:
    prediction = DiagnosticPipeline().predict_from_image(img_bytes, m, material)

    applied = RulesEngine().clamp_to_machine(m, prediction.parameter_targets, experience)
    return {
        "machine": {"id": m.get("id"), "brand": m.get("brand"), "model": m.get("model")},
        "issue": prediction.issue,
        "confidence": prediction.confidence,
        "recommendations": prediction.recommendations,
        "parameter_targets": prediction.parameter_targets,
        "applied": applied,
        "capability_notes": prediction.capability_notes,
    }
