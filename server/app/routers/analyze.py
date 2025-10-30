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
"""Diagnostics analyze endpoint."""
from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from server.machines import MachineProfile, resolve_machine

from ..ml.pipeline import DiagnosticPipeline
from ..rules import RulesEngine

router = APIRouter(tags=["analyze"])


class AnalyzeRequest(BaseModel):
    machine: str = Field(..., description="Machine id, alias, or fuzzy name")
    material: str = Field("PLA", description="Material code")
    issues: List[str] = Field(default_factory=list, description="Observed issues")
    experience: str = Field("Intermediate", regex="^(Beginner|Intermediate|Advanced)$")
    payload: Dict[str, Any] = Field(default_factory=dict)


@router.post("/analyze")
def analyze(payload: AnalyzeRequest):
    try:
        machine: MachineProfile = resolve_machine(payload.machine)
    except KeyError as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    request_payload = {
        "material": payload.material,
        "issues": payload.issues,
    }
    request_payload.update(payload.payload)

    pipeline = DiagnosticPipeline()
    prediction = pipeline.predict(request_payload, machine)

    engine = RulesEngine()
    applied = engine.clamp_to_machine(machine, prediction.parameter_targets, payload.experience)

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
        "capability_notes": prediction.capability_notes,
    }
