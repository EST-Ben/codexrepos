# server/app/routers/analyze.py
"""Diagnostics analyze endpoints (legacy shim + JSON-only route).

- Multipart /api/analyze lives in :mod:`server.app.routers.analyze_image`.
- This module keeps a 410 GONE shim for the old /analyze path.
- It also exposes a JSON-only /analyze-json route for internal/testing use.
"""
from __future__ import annotations

from typing import Any, Dict, List, Literal, Type
import importlib

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from server.machines import MachineProfile, resolve_machine

router = APIRouter(tags=["analyze"])

_PIPELINE_CANDIDATES = (
    "server.inference.pipeline",
    "server.ml.pipeline",
    "server.app.ml.pipeline",
)
_pipeline_cls: Type[Any] | None = None
_rules_engine_cls: Type[Any] | None = None


def load_pipeline_cls() -> Type[Any]:
    """Dynamically resolve the diagnostics pipeline implementation."""
    global _pipeline_cls
    if _pipeline_cls is not None:
        return _pipeline_cls

    errors: List[str] = []
    for path in _PIPELINE_CANDIDATES:
        try:
            module = importlib.import_module(path)
            pipeline_cls = getattr(module, "DiagnosticPipeline")
            _pipeline_cls = pipeline_cls
            return pipeline_cls
        except Exception as exc:  # pragma: no cover - defensive reporting
            errors.append(f"{path}: {type(exc).__name__}: {exc}")

    detail = (
        "Could not import DiagnosticPipeline. Tried: "
        + ", ".join(_PIPELINE_CANDIDATES)
        + (".\n" + "\n".join(errors) if errors else "")
    )
    raise HTTPException(status_code=500, detail=detail)


def load_rules_engine() -> Type[Any]:
    """Import the rules engine with a helpful failure message."""
    global _rules_engine_cls
    if _rules_engine_cls is not None:
        return _rules_engine_cls

    try:
        from server.app.rules import RulesEngine
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=f"Could not import RulesEngine: {exc}") from exc

    _rules_engine_cls = RulesEngine
    return RulesEngine


@router.post("/analyze")
def deprecated_analyze() -> None:  # pragma: no cover
    """Historical location for analyze. Multipart now lives in analyze_image router."""
    raise HTTPException(status_code=410, detail="Use POST /api/analyze (multipart) via analyze-image router")


class AnalyzeRequest(BaseModel):
    machine: str = Field(..., description="Machine id, alias, or fuzzy name")
    material: str = Field("PLA", description="Material code")
    issues: List[str] = Field(default_factory=list, description="Observed issues")
    experience: Literal["Beginner", "Intermediate", "Advanced"] = "Intermediate"
    payload: Dict[str, Any] = Field(
        default_factory=dict,
        description="Extra pipeline inputs (e.g., extracted cues/metrics)",
    )


@router.post("/analyze-json")
def analyze_json(payload: AnalyzeRequest):
    # Resolve machine
    try:
        machine: MachineProfile = resolve_machine(payload.machine)
    except KeyError as exc:  # pragma: no cover
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    # Prepare pipeline input
    request_payload: Dict[str, Any] = {
        "material": payload.material,
        "issues": payload.issues,
        **payload.payload,
    }

    DiagnosticPipeline = load_pipeline_cls()
    RulesEngine = load_rules_engine()

    pipeline = DiagnosticPipeline()
    prediction = pipeline.predict(request_payload, machine)

    engine = RulesEngine()
    applied = engine.clamp_to_machine(
        machine, prediction.parameter_targets, payload.experience
    )

    return {
        "machine": {
            "id": machine.get("id"),
            "brand": machine.get("brand"),
            "model": machine.get("model"),
        },
        "issue": prediction.issue,
        "confidence": prediction.confidence,
        "recommendations": prediction.recommendations,
        "parameter_targets": prediction.parameter_targets,
        "applied": applied,
        "capability_notes": getattr(prediction, "capability_notes", []),
    }
