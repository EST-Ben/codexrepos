"""Utilities to convert suggestions into slicer profile diffs."""
from __future__ import annotations

from typing import Dict, Iterable, Mapping, Optional

from server.models.api import Suggestion


def apply(
    suggestions: Iterable[Suggestion],
    *,
    base_profile: Optional[Mapping[str, float]] = None,
    slicer: str = "generic",
) -> Dict[str, object]:
    """Convert a list of suggestions into a slicer-friendly diff mapping."""
    parameters: Dict[str, Dict[str, object]] = {}
    base_profile = base_profile or {}

    for suggestion in suggestions:
        for change in suggestion.changes:
            param = change.param
            target_value = change.new_target
            if target_value is None and change.delta is not None:
                base_value = base_profile.get(param)
                if isinstance(base_value, (int, float)):
                    target_value = float(base_value) + float(change.delta)
            entry: Dict[str, object] = {}
            if target_value is not None:
                entry["value"] = round(float(target_value), 4)
            elif change.delta is not None:
                entry["delta"] = round(float(change.delta), 4)
            if change.unit:
                entry["unit"] = change.unit
            if change.range_hint:
                entry["range_hint"] = change.range_hint
            if suggestion.clamped_to_machine_limits:
                entry["clamped"] = True
            parameters[param] = entry

    return {"slicer": slicer, "parameters": parameters}


__all__ = ["apply"]
