"""Rules engine that clamps recommendations to machine limits."""
from __future__ import annotations

from typing import Any, Dict, Iterable, Mapping, Tuple

from server.machines import MachineProfile

ExperienceLevel = str


class RulesEngine:
    """Clamp suggested parameters so they respect machine capabilities."""

    EXPERIENCE_SETTINGS: Mapping[ExperienceLevel, Mapping[str, Any]] = {
        "Beginner": {
            "allowed": {"nozzle_temp", "bed_temp", "print_speed", "fan_speed", "flow_rate"},
            "max_factor": 0.85,
            "note": "Beginner mode limits adjustments to core temperature and speed controls.",
        },
        "Intermediate": {
            "allowed": {
                "nozzle_temp",
                "bed_temp",
                "print_speed",
                "travel_speed",
                "accel",
                "fan_speed",
                "flow_rate",
                "retraction_distance",
            },
            "max_factor": 0.95,
            "note": "Intermediate mode unlocks motion controls with moderate guard rails.",
        },
        "Advanced": {
            "allowed": "*",
            "max_factor": 1.0,
            "note": "Advanced mode exposes all tunables within machine limits.",
        },
    }

    def clamp_to_machine(
        self,
        machine: MachineProfile,
        parameters: Mapping[str, Any],
        experience: ExperienceLevel = "Intermediate",
    ) -> Dict[str, Any]:
        settings = self.EXPERIENCE_SETTINGS.get(experience, self.EXPERIENCE_SETTINGS["Intermediate"])
        allowed = settings["allowed"]
        max_factor = settings["max_factor"]
        clamped: Dict[str, Any] = {}
        hidden: set[str] = set()
        clamped_flag = False
        explanations = [settings["note"]]

        for key, value in parameters.items():
            if allowed != "*" and key not in allowed:
                hidden.add(key)
                continue
            min_bound, max_bound = self._bounds_for(machine, key)
            effective_max = max_bound
            if isinstance(max_bound, (int, float)) and max_factor < 1.0:
                effective_max = max_bound * max_factor
            new_value = value
            if isinstance(new_value, (int, float)):
                if min_bound is not None and new_value < min_bound:
                    new_value = min_bound
                    clamped_flag = True
                    explanations.append(f"Raised {key} to machine minimum {min_bound}.")
                if effective_max is not None and new_value > effective_max:
                    new_value = effective_max
                    clamped_flag = True
                    explanations.append(f"Reduced {key} to {effective_max} based on limits.")
                if isinstance(new_value, float):
                    new_value = round(new_value, 3)
            clamped[key] = new_value

        return {
            "parameters": clamped,
            "hidden_parameters": sorted(hidden),
            "experience_level": experience,
            "clamped_to_machine_limits": clamped_flag,
            "explanations": explanations,
        }

    def _bounds_for(self, machine: MachineProfile, key: str) -> Tuple[float | None, float | None]:
        safe = machine.get("safe_speed_ranges") or {}
        presets = machine.get("material_presets") or {}

        if key == "nozzle_temp":
            min_v = self._min_from_presets(presets, "nozzle_c")
            return min_v, self._to_float(machine.get("max_nozzle_temp_c"))
        if key == "bed_temp":
            min_v = self._min_from_presets(presets, "bed_c")
            return min_v, self._to_float(machine.get("max_bed_temp_c"))
        if key == "print_speed":
            return self._range_from_safe(safe, "print")
        if key == "travel_speed":
            return self._range_from_safe(safe, "travel")
        if key == "accel":
            return self._range_from_safe(safe, "accel")
        if key == "jerk":
            return self._range_from_safe(safe, "jerk")
        if key == "fan_speed":
            return 0.0, 100.0
        if key == "flow_rate":
            return 80.0, 120.0
        if key == "retraction_distance":
            return 0.2, 8.0
        if key == "spindle_rpm":
            rng = machine.get("spindle_rpm_range") or []
            return self._range_from_list(rng)
        if key == "feed_rate":
            max_feed = self._to_float(machine.get("max_feed_mm_min"))
            return 100.0, max_feed
        if key == "doc":
            return 0.1, self._doc_limit(machine)
        if key == "stepover":
            return 1.0, 60.0
        return None, None

    def _doc_limit(self, machine: MachineProfile) -> float:
        rigidity = str(machine.get("rigidity_class") or "hobby").lower()
        limits = {
            "hobby": 2.0,
            "hobby_pro": 3.0,
            "light_industrial": 5.0,
            "industrial": 8.0,
        }
        return limits.get(rigidity, 3.0)

    def _range_from_safe(self, safe: Mapping[str, Iterable[float]], key: str) -> Tuple[float | None, float | None]:
        values = safe.get(key)
        if isinstance(values, list) and values:
            return self._to_float(values[0]), self._to_float(values[-1])
        return None, None

    def _range_from_list(self, values: Iterable[float]) -> Tuple[float | None, float | None]:
        data = list(values)
        if not data:
            return None, None
        return self._to_float(data[0]), self._to_float(data[-1])

    def _min_from_presets(self, presets: Mapping[str, Dict[str, Any]], key: str) -> float | None:
        mins = []
        for preset in presets.values():
            values = preset.get(key)
            if isinstance(values, list) and values:
                mins.append(self._to_float(values[0]))
        if mins:
            return min(mins)
        return None

    def _to_float(self, value: Any) -> float | None:
        if isinstance(value, (int, float)):
            return float(value)
        return None


__all__ = ["RulesEngine"]
