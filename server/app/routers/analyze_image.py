"""Multipart /api/analyze endpoint."""
from __future__ import annotations

import json
import shutil
import uuid
from pathlib import Path
from typing import TYPE_CHECKING, Dict, List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from server import settings
from server.app.routers.analyze import load_pipeline_cls
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


def _build_localization(
    analysis: "ImageAnalysisResult",
) -> Optional[Dict[str, object]]:
    payload: Dict[str, object] = {}

    if analysis.boxes:
        payload["boxes"] = [
            {
                "issue_id": box.issue_id,
                "x": float(box.x),
                "y": float(box.y),
                "width": float(box.width),
                "height": float(box.height),
                "confidence": float(box.confidence),
            }
            for box in analysis.boxes
        ]

    if analysis.heatmap:
        payload["heatmap"] = {"data_url": analysis.heatmap}

    return payload or None


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
        clamp_summary = rules_engine.clamp_to_machine(
            machine, analysis.parameter_targets, meta_model.experience
        )
        if isinstance(clamp_summary, dict):
            applied_parameters = clamp_summary.get("parameters", {})
            explanations = clamp_summary.get("explanations", [])
        else:  # pragma: no cover - defensive guard
            applied_parameters = {}
            explanations = []

        localization = _build_localization(analysis)

        slicer_diff = {
            "diff": {key: float(value) for key, value in analysis.parameter_targets.items()}
        }

        response: Dict[str, object] = {
            "image_id": image_id,
            "predictions": predictions,
            "recommendations": analysis.recommendations,
            "capability_notes": analysis.capability_notes,
            "slicer_profile_diff": slicer_diff,
            "explanations": explanations,
            "applied": {key: float(value) for key, value in applied_parameters.items()},
            "meta": {
                "machine": {
                    "id": machine.get("id"),
                    "brand": machine.get("brand"),
                    "model": machine.get("model"),
                },
                "experience": meta_model.experience,
                "material": meta_model.material,
            },
        }

        if localization:
            response["localization"] = localization

        return response
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
