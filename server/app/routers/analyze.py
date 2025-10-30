# server/app/routers/analyze.py
"""Diagnostics analyze endpoints (legacy shim + JSON-only route).

- Multipart /api/analyze lives in server.main.
- This module keeps a 410 GONE shim for the old /analyze path.
- It also exposes a JSON-only /analyze-json route for internal/testing use.
"""
from __future__ import annotations

from typing import Any, Dict, List, Literal
import importlib

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from server.machines import MachineProfile, resolve_machine

router = APIRouter(tags=["analyze"])


def _load_pipeline_cls():
    try:
        from server.inference.pipeline import DiagnosticPipeline  # type: ignore
        return DiagnosticPipeline
    except Exception as e_infer:
        try:
            from server.ml.pipeline import DiagnosticPipeline  # type: ignore
            return DiagnosticPipeline
        except Exception as e_ml:
            msg = (
                "Could not import DiagnosticPipeline. "
                "Tried 'server.inference.pipeline' and 'server.ml.pipeline'.\n"
                f"inference error: {type(e_infer).__name__}: {e_infer}\n"
                f"ml error: {type(e_ml).__name__}: {e_ml}\n"
                "Ensure the file exists and __init__.py marks packages."
            )
            raise HTTPException(status_code=500, detail=msg)


def _load_rules_engine():
    e_pkg = e_mod = None
    try:
        mod = importlib.import_module("server.rules")
        if hasattr(mod, "RulesEngine"):
            return getattr(mod, "RulesEngine")
    except Exception as exc:
        e_pkg = exc

    try:
        mod = importlib.import_module("server.rules.engine")
        if hasattr(mod, "RulesEngine"):
            return getattr(mod, "RulesEngine")
    except Exception as exc:
        e_mod = exc

    msg = (
        "Could not import RulesEngine.\n"
        "Tried 'server.rules' and 'server.rules.engine'.\n"
        f"package error: {type(e_pkg).__name__ if e_pkg else 'None'}: {e_pkg}\n"
        f"module error: {type(e_mod).__name__ if e_mod else 'None'}: {e_mod}\n"
        "Ensure server/rules/__init__.py re-exports RulesEngine or server/rules/engine.py defines it."
    )
    raise HTTPException(status_code=500, detail=msg)


@router.post("/analyze")
def deprecated_analyze() -> None:  # pragma: no cover
    """Historical location for analyze. Multipart moved to server.main."""
    raise HTTPException(status_code=410, detail="/api/analyze moved to server.main")


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

    DiagnosticPipeline = _load_pipeline_cls()
    RulesEngine = _load_rules_engine()

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
