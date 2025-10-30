from typing import Dict, List, Optional, Tuple

from pydantic import BaseModel, Field


class AnalyzeRequestMeta(BaseModel):
    machine_id: str
    experience: str
    material: Optional[str] = None
    base_profile: Optional[Dict] = None
    app_version: Optional[str] = None


class Prediction(BaseModel):
    issue_id: str
    confidence: float = Field(ge=0, le=1)


class SuggestionChange(BaseModel):
    param: str
    delta: Optional[float] = None
    unit: Optional[str] = None
    new_target: Optional[float] = None
    range_hint: Optional[Tuple[float, float]] = None


class Suggestion(BaseModel):
    issue_id: str
    changes: List[SuggestionChange]
    why: str
    risk: str
    confidence: float
    beginner_note: Optional[str] = None
    advanced_note: Optional[str] = None
    clamped_to_machine_limits: Optional[bool] = False


class AnalyzeResponse(BaseModel):
    predictions: List[Prediction]
    explanations: List[Dict]
    suggestions: List[Suggestion]
    slicer_profile_diff: Dict
    image_id: str
    version: str
    low_confidence: Optional[bool] = False
