"""Pydantic models shared between the API layers and inference utilities."""
from __future__ import annotations

from typing import Dict, List, Literal, Optional, Tuple

from pydantic import BaseModel, Field


class AnalyzeRequestMeta(BaseModel):
    """Metadata submitted alongside an uploaded print image."""

    machine_id: str = Field(..., description="Machine id or alias")
    experience: str = Field(..., description="User experience level")
    material: Optional[str] = Field(default=None, description="Material code, e.g., PLA")
    base_profile: Optional[Dict[str, float]] = Field(
        default=None, description="Optional slicer profile overrides"
    )
    app_version: Optional[str] = Field(default=None, description="Client application version")


class Prediction(BaseModel):
    """Single issue prediction returned by the classifier."""

    issue_id: str
    confidence: float = Field(ge=0.0, le=1.0)


class BoundingBox(BaseModel):
    """Normalized bounding box describing a localized defect."""

    issue_id: str
    confidence: float = Field(ge=0.0, le=1.0)
    x: float = Field(ge=0.0, le=1.0)
    y: float = Field(ge=0.0, le=1.0)
    width: float = Field(gt=0.0, le=1.0)
    height: float = Field(gt=0.0, le=1.0)


class HeatmapPayload(BaseModel):
    """Serializable heatmap overlay rendered on the client."""

    encoding: Literal["svg"] = "svg"
    width: int = 256
    height: int = 256
    data_url: str


class LocalizationPayload(BaseModel):
    """Container for bounding boxes and a coarse heatmap overlay."""

    boxes: List[BoundingBox] = Field(default_factory=list)
    heatmap: Optional[HeatmapPayload] = None


class SuggestionChange(BaseModel):
    """Describes a slicer parameter adjustment for a specific issue."""

    param: str
    delta: Optional[float] = None
    unit: Optional[str] = None
    new_target: Optional[float] = None
    range_hint: Optional[Tuple[float, float]] = None


class Suggestion(BaseModel):
    """Recommendation generated from rules for an individual issue."""

    issue_id: str
    changes: List[SuggestionChange]
    why: str
    risk: str
    confidence: float
    beginner_note: Optional[str] = None
    advanced_note: Optional[str] = None
    clamped_to_machine_limits: Optional[bool] = False


class AppliedClamp(BaseModel):
    """Result of clamping rule outputs to machine-safe values."""

    parameters: Dict[str, float]
    hidden_parameters: List[str]
    experience_level: str
    clamped_to_machine_limits: bool
    explanations: List[str]


class AnalyzeResponse(BaseModel):
    """Primary payload returned from POST /api/analyze."""

    image_id: str
    version: str
    machine: Dict[str, Optional[str]]
    experience: str
    material: Optional[str] = None
    predictions: List[Prediction]
    explanations: List[Dict[str, object]]
    localization: LocalizationPayload
    capability_notes: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    suggestions: List[Suggestion]
    slicer_profile_diff: Dict[str, object]
    applied: AppliedClamp
    low_confidence: bool = False


__all__ = [
    "AnalyzeRequestMeta",
    "AnalyzeResponse",
    "AppliedClamp",
    "BoundingBox",
    "HeatmapPayload",
    "LocalizationPayload",
    "Prediction",
    "Suggestion",
    "SuggestionChange",
]
