"""Multipart /api/analyze endpoint."""
from __future__ import annotations

import json
import shutil
import uuid
from pathlib import Path
from typing import Dict, List, TYPE_CHECKING

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from server import settings
from server.app.routers.analyze import (
    RESPONSE_VERSION,
    _stringify_explanations,
    load_pipeline_cls,
)
from server.machines import resolve_machine
from server.models.api import AnalyzeRequestMeta
from server.rules import RulesEngine

if TYPE_CHECKING:  # pragma: no cover - hints only
    from server.app.ml.pipeline import DiagnosticPipeline, ImageAnalysisResult

router = APIRouter(tags=["analyze-image"])


_PIPELINE: "DiagnosticPipeline" | None = None


def _get_pipeline() -> "DiagnosticPipeline":
    global _PIPELINE
    if _PIPELINE is None:
        PipelineCls = load_pipeline_cls()
        _PIPELINE = PipelineCls()
    return _PIPELINE


def _summarise_predictions(analysis: "ImageAnalysisResult") -> List[Dict[str, object]]:
    return [
        {"issue_id": prediction.issue_id, "confidence": float(prediction.confidence)}
        for prediction in analysis.predictions
    ]


@router.post("/analyze")
async def analyze_image_route(
    image: UploadFile = File(...),
    meta: str = Form(..., description="JSON metadata: machine_id, material, experience, base_profile"),
) -> Dict[str, object]:
    try:
        meta_payload = json.loads(meta or "{}")
    except json.JSONDecodeError as exc:  # pragma: no cover - client error
        raise HTTPException(status_code=400, detail=f"Invalid meta JSON: {exc}") from exc

    try:
        meta_model = AnalyzeRequestMeta.model_validate(meta_payload)
    except Exception as exc:  # pragma: no cover - delegated to validation
        raise HTTPException(status_code=400, detail=f"Invalid meta payload: {exc}") from exc

    try:
        machine = resolve_machine(meta_model.machine_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    suffix = Path(image.filename or "upload.jpg").suffix or ".jpg"
    image_id = uuid.uuid4().hex
    temp_path = settings.UPLOAD_DIR / f"{image_id}{suffix}"

    try:
        with temp_path.open("wb") as buffer:
            image.file.seek(0)
            shutil.copyfileobj(image.file, buffer)

        if temp_path.stat().st_size > settings.MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Uploaded file exceeds size limit")

        pipeline = _get_pipeline()
        analysis = pipeline.predict_image(temp_path, machine, meta_model.material)

        predictions = _summarise_predictions(analysis)

        rules_engine = RulesEngine()
        applied = rules_engine.clamp_to_machine(
            machine, analysis.parameter_targets, meta_model.experience
        )

        analysis_explanations = getattr(analysis, "explanations", None)
        explanations = []
        explanations.extend(_stringify_explanations(applied.get("explanations")))
        explanations.extend(_stringify_explanations(analysis_explanations))

        localization = {
            "boxes": [box.model_dump() for box in analysis.boxes],
            "heatmap": getattr(analysis.heatmap, "data_url", analysis.heatmap)
            if analysis.heatmap
            else None,
        }

        slicer_diff = getattr(analysis, "slicer_profile_diff", None)
        suggestions = getattr(analysis, "suggestions", [])

        low_confidence = not predictions or predictions[0]["confidence"] < 0.5

        return {
            "image_id": image_id,
            "version": RESPONSE_VERSION,
            "machine": {
                "id": machine.get("id"),
                "brand": machine.get("brand"),
                "model": machine.get("model"),
            },
            "experience": meta_model.experience,
            "material": meta_model.material,
            "predictions": predictions,
            "explanations": explanations,
            "localization": localization,
            "capability_notes": analysis.capability_notes,
            "recommendations": analysis.recommendations,
            "suggestions": suggestions,
            "slicer_profile_diff": slicer_diff,
            "applied": applied,
            "parameter_targets": analysis.parameter_targets,
            "low_confidence": low_confidence,
        }
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=f"Failed to process image: {exc}") from exc
    finally:
        try:
            if temp_path.exists():
                temp_path.unlink()
        except FileNotFoundError:
            pass
        except OSError:
            pass
