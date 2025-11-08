"""Profile export endpoints."""
from __future__ import annotations

from typing import Dict, Literal, Mapping

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

SlicerName = Literal["cura", "prusaslicer", "bambu", "orca"]

SLICER_KEY_MAP: Mapping[str, Mapping[str, str]] = {
    "cura": {
        "nozzle_temp": "material_print_temperature",
        "bed_temp": "material_bed_temperature",
        "print_speed": "speed_print",
        "travel_speed": "speed_travel",
        "accel": "acceleration_print",
        "jerk": "jerk_print",
        "flow_rate": "material_flow",
        "fan_speed": "cool_fan_speed",
        "retraction_distance": "retraction_amount",
    },
    "prusaslicer": {
        "nozzle_temp": "temperature",
        "bed_temp": "bed_temperature",
        "print_speed": "perimeter_speed",
        "travel_speed": "travel_speed",
        "accel": "perimeter_acceleration",
        "jerk": "perimeter_jerk",
        "fan_speed": "fan_speed",
        "retraction_distance": "retract_length",
    },
    "bambu": {
        "nozzle_temp": "nozzle_temperature",
        "bed_temp": "bed_temperature",
        "print_speed": "print_speed",
        "travel_speed": "travel_speed",
        "accel": "max_acceleration",
        "jerk": "max_jerk",
        "fan_speed": "cooling_fan_speed",
        "flow_rate": "flow_ratio",
        "retraction_distance": "retraction_distance",
    },
    "orca": {
        "nozzle_temp": "nozzle_temperature",
        "bed_temp": "build_plate_temperature",
        "print_speed": "default_printing_speed",
        "travel_speed": "default_travel_speed",
        "accel": "default_acceleration",
        "jerk": "default_jerk",
        "fan_speed": "fan_speed",
        "flow_rate": "flow_ratio",
        "retraction_distance": "retraction_length",
    },
}


class ExportProfileRequest(BaseModel):
    slicer: SlicerName
    changes: Dict[str, float | int | str]
    base_profile: Dict[str, float | int | str] | None = Field(default=None)


router = APIRouter(tags=["export"])


def _render_markdown(slicer: str, diff: Dict[str, float | int | str], base_profile: Dict[str, float | int | str] | None) -> str:
    lines = [f"# {slicer.title()} profile diff", ""]
    if not diff:
        lines.append("No parameter changes were required.")
        return "\n".join(lines)

    for key in sorted(diff.keys()):
        value = diff[key]
        base_value = None
        if base_profile:
            base_value = base_profile.get(key)

        if base_value is None:
            lines.append(f"- **{key}** → {value}")
        else:
            lines.append(f"- **{key}**: {base_value} → {value}")

    return "\n".join(lines)


@router.post("/export-profile")
def export_profile(payload: ExportProfileRequest) -> Dict[str, object]:
    mapping = SLICER_KEY_MAP.get(payload.slicer)
    if not mapping:
        raise HTTPException(status_code=400, detail=f"Unsupported slicer '{payload.slicer}'")

    diff: Dict[str, float | int | str] = {}
    for key, value in payload.changes.items():
        target_key = mapping.get(key, key)
        base_value = payload.base_profile.get(target_key) if payload.base_profile else None
        if base_value != value:
            diff[target_key] = value

    markdown = _render_markdown(payload.slicer, diff, payload.base_profile)

    return {
        "slicer": payload.slicer,
        "diff": diff,
        "markdown": markdown,
    }
