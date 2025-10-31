# server/app/routers/analyze_image.py
from __future__ import annotations

"""Multipart analyze endpoint implementation."""

import json
import shutil
import tempfile
from pathlib import Path
from typing import Any, Dict, Iterable, Mapping, MutableMapping

from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from server import settings
from server.machines import resolve_machine
from .analyze import load_pipeline_cls, load_rules_engine

router = APIRouter(tags=["analyze-image"])


def _extract(prediction: Any, key: str, default: Any) -> Any:
    if isinstance(prediction, Mapping):
        return prediction.get(key, default)
    return getattr(prediction, key, default)


def _coerce_dict(value: Any) -> Dict[str, Any]:
    if isinstance(value, MutableMapping):
        return dict(value)
    if isinstance(value, Mapping):
        return dict(value)
    return {}


def _coerce_list(value: Any) -> Iterable[Any]:
    if isinstance(value, (list, tuple)):
        return list(value)
    if value is None:
        return []
    return [value]


def _run_image_pipeline(
    pipeline: Any,
    image_path: Path,
    machine: Dict[str, Any],
    meta: Dict[str, Any],
) -> Any:
    errors: list[str] = []

    if hasattr(pipeline, "predict_image"):
        try:
            return pipeline.predict_image(str(image_path), meta)
        except TypeError:
            try:
                return pipeline.predict_image(str(image_path))
            except Exception as exc:  # pragma: no cover - defensive path
                errors.append(f"predict_image: {exc}")
        except Exception as exc:  # pragma: no cover - defensive path
            errors.append(f"predict_image: {exc}")

    if hasattr(pipeline, "predict_from_image"):
        data = image_path.read_bytes()
        material = str(meta.get("material") or "PLA")
        try:
            return pipeline.predict_from_image(data, machine, material)
        except TypeError:
            try:
                return pipeline.predict_from_image(data, meta)
            except Exception as exc:  # pragma: no cover - defensive path
                errors.append(f"predict_from_image: {exc}")
        except Exception as exc:  # pragma: no cover - defensive path
            errors.append(f"predict_from_image: {exc}")

    detail = "Image pipeline is not compatible with the expected interface."
    if errors:
        detail += " Attempts: " + "; ".join(errors)
    raise HTTPException(status_code=500, detail=detail)


@router.post("/analyze")
async def analyze_image_route(
    image: UploadFile = File(...),
    meta: str = Form(..., description="JSON string with machine_id, material, experience, etc."),
):
    try:
        meta_obj: Dict[str, Any] = json.loads(meta or "{}")
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid meta JSON: {exc}") from exc

    machine_id = str(
        meta_obj.get("machine_id")
        or meta_obj.get("machine")
        or ""
    ).strip()
    if not machine_id:
        raise HTTPException(status_code=400, detail="meta.machine_id is required")

    experience = str(meta_obj.get("experience") or "Intermediate")
    material = str(meta_obj.get("material") or "PLA")
    app_version = str(meta_obj.get("app_version") or "dev")

    try:
        machine = resolve_machine(machine_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    suffix = Path(image.filename or "upload.jpg").suffix or ".jpg"
    tmp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            "wb", suffix=suffix, dir=settings.UPLOAD_DIR, delete=False
        ) as tmp_file:
            tmp_path = Path(tmp_file.name)
            image.file.seek(0)
            shutil.copyfileobj(image.file, tmp_file)

        PipelineCls = load_pipeline_cls()
        pipeline = PipelineCls()
        meta_payload = {
            **meta_obj,
            "machine": machine,
            "material": material,
            "experience": experience,
        }
        prediction = _run_image_pipeline(pipeline, tmp_path, machine, meta_payload)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to process image: {exc}") from exc
    finally:
        if tmp_path is not None:
            try:
                tmp_path.unlink()
            except FileNotFoundError:
                pass
            except OSError:
                pass

    RulesEngine = load_rules_engine()
    engine = RulesEngine()
    parameter_targets = _coerce_dict(_extract(prediction, "parameter_targets", {}))
    applied = engine.clamp_to_machine(machine, parameter_targets, experience)

    recommendations = list(_coerce_list(_extract(prediction, "recommendations", [])))
    capability_notes = list(_coerce_list(_extract(prediction, "capability_notes", [])))
    predictions = _extract(prediction, "predictions", None)
    confidence = _extract(prediction, "confidence", None)
    issue = _extract(prediction, "issue", None)

    return {
        "machine": {
            "id": machine.get("id"),
            "brand": machine.get("brand"),
            "model": machine.get("model"),
        },
        "issue": issue,
        "confidence": confidence,
        "recommendations": recommendations,
        "parameter_targets": parameter_targets,
        "applied": applied,
        "capability_notes": capability_notes,
        "predictions": predictions,
        "material": material,
        "experience": experience,
        "version": app_version,
    }
