"""Translate predictions into machine-aware suggestions."""
from __future__ import annotations

from typing import Dict, Iterable, List, Tuple

from server.machines import MachineProfile, resolve_machine
from server.models.api import AnalyzeRequestMeta, Prediction, Suggestion, SuggestionChange

from .clamp import RulesEngine


class SuggestionPlanner:
    """Plan parameter suggestions based on predictions and machine metadata."""

    def __init__(self, meta: AnalyzeRequestMeta) -> None:
        self.meta = meta
        self.machine: MachineProfile = resolve_machine(meta.machine_id)
        self.material = (meta.material or "PLA").upper()
        self.experience = meta.experience or "Intermediate"
        self.supports = self.machine.get("supports") or {}
        self.motion = str(self.machine.get("motion_system") or "BedSlinger")
        self.enclosed = bool(self.machine.get("enclosed"))
        self.engine = RulesEngine()
        self._baseline_cache: Dict[str, float] | None = None

    # ------------------------------------------------------------------
    def plan(self, predictions: Iterable[Prediction]) -> Tuple[List[Suggestion], bool]:
        items = list(predictions)
        low_confidence = bool(items) and all(pred.confidence < 0.5 for pred in items)
        if not items:
            low_confidence = True

        if low_confidence:
            fallback = Prediction(issue_id="general_tuning", confidence=0.45)
            suggestions = [self._general_best_practice(fallback)]
            return suggestions, True

        suggestions: List[Suggestion] = []
        for prediction in items:
            handler = self._handler_for_issue(prediction.issue_id)
            suggestion = handler(prediction)
            suggestions.append(suggestion)
        return suggestions, low_confidence

    # ------------------------------------------------------------------
    def _handler_for_issue(self, issue_id: str):
        issue_id = issue_id.lower()
        if "string" in issue_id:
            return self._stringing
        if "under" in issue_id:
            return self._under_extrusion
        if "ring" in issue_id:
            return self._ringing
        if "peel" in issue_id:
            return self._resin_peel
        if "chatter" in issue_id:
            return self._cnc_chatter
        return self._general_best_practice

    # ------------------------------------------------------------------
    def _stringing(self, prediction: Prediction) -> Suggestion:
        baseline = self._baseline()
        supports_drying = bool(self.supports.get("ams"))
        adjustments = [
            {
                "param": "nozzle_temp",
                "target": baseline["nozzle_temp"] - 10.0,
                "unit": "C",
                "range_hint": (-15.0, -5.0),
                "requires_clamp": True,
            },
            {
                "param": "retraction_distance",
                "target": baseline["retraction_distance"] + 1.0,
                "unit": "mm",
                "range_hint": (0.5, 1.5),
                "requires_clamp": True,
            },
            {
                "param": "travel_speed",
                "target": baseline["travel_speed"] + 10.0,
                "unit": "mm/s",
                "range_hint": (5.0, 20.0),
                "requires_clamp": True,
            },
            {
                "param": "drying_recommendation",
                "target": 1 if not supports_drying else 0,
                "requires_clamp": False,
            },
        ]
        beginner_note = "Run a retraction test cube after lowering temperatures to confirm improvements."
        advanced_note = "Consider pressure advance or linear advance tuning if your slicer supports it."
        why = "Stringing detected; reducing nozzle temperature and increasing retraction fights ooze."
        if not supports_drying:
            why += " Include filament drying to remove absorbed moisture."
        return self._build_suggestion(
            prediction,
            adjustments,
            risk="medium",
            why=why,
            beginner_note=beginner_note,
            advanced_note=advanced_note,
        )

    def _under_extrusion(self, prediction: Prediction) -> Suggestion:
        baseline = self._baseline()
        idex = bool(self.supports.get("idex")) or self.motion == "IDEX"
        adjustments = [
            {
                "param": "nozzle_temp",
                "target": baseline["nozzle_temp"] + 8.0,
                "unit": "C",
                "range_hint": (5.0, 10.0),
                "requires_clamp": True,
            },
            {
                "param": "print_speed",
                "target": baseline["print_speed"] * 0.85,
                "unit": "mm/s",
                "range_hint": (-20.0, -10.0),
                "requires_clamp": True,
            },
            {
                "param": "flow_rate",
                "target": 103.0,
                "unit": "%",
                "range_hint": (2.0, 5.0),
                "requires_clamp": True,
            },
        ]
        beginner_note = "Verify extruder gears are clean before increasing temperatures or flow."
        advanced_note = (
            "Run an extrusion multiplier calibration and inspect hotend for partial clogs."
        )
        if idex:
            advanced_note += " Calibrate both toolheads to avoid mismatch between extruders."
        why = "Under-extrusion cues suggest raising melt capacity and slowing print speed for consistency."
        return self._build_suggestion(
            prediction,
            adjustments,
            risk="medium",
            why=why,
            beginner_note=beginner_note,
            advanced_note=advanced_note,
        )

    def _ringing(self, prediction: Prediction) -> Suggestion:
        baseline = self._baseline()
        is_bedslinger = self.motion == "BedSlinger"
        accel_scale = 0.6 if is_bedslinger else 0.8
        jerk_scale = 0.65 if is_bedslinger else 0.85
        adjustments = [
            {
                "param": "accel",
                "target": baseline["accel"] * accel_scale,
                "unit": "mm/s^2",
                "range_hint": (-3000.0, -500.0),
                "requires_clamp": True,
            },
            {
                "param": "jerk",
                "target": baseline["jerk"] * jerk_scale,
                "unit": "mm/s",
                "range_hint": (-8.0, -2.0),
                "requires_clamp": True,
            },
            {
                "param": "print_speed",
                "target": baseline["print_speed"] * 0.9,
                "unit": "mm/s",
                "range_hint": (-15.0, -5.0),
                "requires_clamp": True,
            },
        ]
        why = "Ghosting is mitigated by reducing accelerations and jerk, scaled to the motion system."
        if self.supports.get("input_shaping"):
            why += " Input shaping allows recovering speed after vibrations are controlled."
        beginner_note = "Tighten belts before lowering acceleration to keep motion crisp."
        advanced_note = "Capture resonance data with input shaping or accelerometer tools if available."
        return self._build_suggestion(
            prediction,
            adjustments,
            risk="low",
            why=why,
            beginner_note=beginner_note,
            advanced_note=advanced_note,
        )

    def _resin_peel(self, prediction: Prediction) -> Suggestion:
        baseline = self._baseline_resin()
        adjustments = [
            {
                "param": "lift_speed",
                "target": baseline["lift_speed"] * 0.85,
                "unit": "mm/min",
                "range_hint": (-20.0, -5.0),
                "requires_clamp": True,
            },
            {
                "param": "exposure_time",
                "target": baseline["exposure_time"] * 1.1,
                "unit": "s",
                "range_hint": (5.0, 15.0),
                "requires_clamp": True,
            },
        ]
        why = "Peel artifacts benefit from slower lifts and slightly longer exposures to ensure adhesion."
        beginner_note = "Check vat film tension before adjusting lift speeds."
        advanced_note = "Balance exposure increases with resin manufacturer's recommended maximums."
        return self._build_suggestion(
            prediction,
            adjustments,
            risk="medium",
            why=why,
            beginner_note=beginner_note,
            advanced_note=advanced_note,
        )

    def _cnc_chatter(self, prediction: Prediction) -> Suggestion:
        baseline = self._baseline_cnc()
        adjustments = [
            {
                "param": "feed_rate",
                "target": baseline["feed_rate"] * 0.8,
                "unit": "mm/min",
                "range_hint": (-25.0, -10.0),
                "requires_clamp": True,
            },
            {
                "param": "doc",
                "target": baseline["doc"] * 0.7,
                "unit": "mm",
                "range_hint": (-2.0, -0.5),
                "requires_clamp": True,
            },
            {
                "param": "spindle_rpm",
                "target": baseline["spindle_rpm"] * 1.05,
                "unit": "rpm",
                "range_hint": (5.0, 10.0),
                "requires_clamp": True,
            },
        ]
        why = "Reducing feed and depth of cut while slightly increasing spindle RPM mitigates chatter."
        beginner_note = "Ensure tool stick-out is minimized before cutting more slowly."
        advanced_note = "Dial in adaptive clearing strategies to maintain consistent chip load."
        return self._build_suggestion(
            prediction,
            adjustments,
            risk="medium",
            why=why,
            beginner_note=beginner_note,
            advanced_note=advanced_note,
        )

    def _general_best_practice(self, prediction: Prediction) -> Suggestion:
        baseline = self._baseline()
        adjustments = [
            {
                "param": "nozzle_temp",
                "target": baseline.get("nozzle_temp"),
                "unit": "C",
                "range_hint": (0.0, 0.0),
                "requires_clamp": True,
            },
            {
                "param": "bed_temp",
                "target": baseline.get("bed_temp"),
                "unit": "C",
                "range_hint": (0.0, 0.0),
                "requires_clamp": True,
            },
        ] if "nozzle_temp" in baseline else []
        why = "Providing general tuning baselines because the model returned low confidence."
        beginner_note = "Re-run calibration prints (flow cube, temperature tower) to gather more data."
        advanced_note = "Capture higher-resolution photos and include notes about materials for better results."
        return self._build_suggestion(
            prediction,
            adjustments,
            risk="low",
            why=why,
            beginner_note=beginner_note,
            advanced_note=advanced_note,
        )

    # ------------------------------------------------------------------
    def _baseline(self) -> Dict[str, float]:
        if self._baseline_cache is not None:
            return self._baseline_cache
        machine_type = self.machine.get("type")
        if machine_type in {"MSLA", "SLA"}:
            self._baseline_cache = self._baseline_resin()
        elif machine_type in {"CNC_Router", "CNC_Mill"}:
            self._baseline_cache = self._baseline_cnc()
        else:
            self._baseline_cache = self._baseline_fdm()
        return self._baseline_cache

    def _baseline_fdm(self) -> Dict[str, float]:
        presets = self.machine.get("material_presets") or {}
        preset = presets.get(self.material) or presets.get("PLA") or {}

        def midpoint(values, fallback: float) -> float:
            if isinstance(values, list) and values:
                return float(sum(values) / len(values))
            return fallback

        nozzle = midpoint(preset.get("nozzle_c"), 210.0)
        bed = midpoint(preset.get("bed_c"), 60.0)
        fan = midpoint(preset.get("fan_pct"), 70.0)
        motion = self.motion
        supports = self.supports
        enclosed = self.enclosed

        print_speed = 120.0 if motion in {"CoreXY", "H-Bot"} else 90.0
        travel_speed = 150.0 if motion in {"CoreXY", "H-Bot"} else 120.0
        accel = 5000.0 if supports.get("input_shaping") else 3000.0
        jerk = 12.0 if motion in {"CoreXY", "H-Bot"} else 8.0
        retraction = 0.8 if supports.get("ams") else 0.6
        if enclosed and self.material == "ABS":
            bed = min(bed + 10.0, float(self.machine.get("max_bed_temp_c") or bed))
            fan = min(fan, 15.0)
        return {
            "nozzle_temp": float(nozzle),
            "bed_temp": float(bed),
            "print_speed": float(print_speed),
            "travel_speed": float(travel_speed),
            "accel": float(accel),
            "jerk": float(jerk),
            "fan_speed": float(fan),
            "flow_rate": 100.0,
            "retraction_distance": float(retraction),
        }

    def _baseline_resin(self) -> Dict[str, float]:
        exposure = 2.0
        if self.material.startswith("RESIN"):
            exposure = 2.3
        return {
            "exposure_time": exposure,
            "lift_speed": 60.0,
        }

    def _baseline_cnc(self) -> Dict[str, float]:
        spindle_range = self.machine.get("spindle_rpm_range") or [8000, 18000]
        spindle = float(sum(spindle_range) / len(spindle_range))
        max_feed = self.machine.get("max_feed_mm_min") or 6000
        feed = float(max_feed) * 0.7 if max_feed else 3000.0
        doc = 2.0
        rigidity = str(self.machine.get("rigidity_class") or "hobby").lower()
        if "industrial" in rigidity:
            doc = 4.0
        elif "light" in rigidity:
            doc = 3.0
        stepover = 40.0
        return {
            "spindle_rpm": float(spindle),
            "feed_rate": float(feed),
            "doc": float(doc),
            "stepover": float(stepover),
        }

    # ------------------------------------------------------------------
    def _build_suggestion(
        self,
        prediction: Prediction,
        adjustments: List[Dict[str, object]],
        *,
        risk: str,
        why: str,
        beginner_note: str,
        advanced_note: str,
    ) -> Suggestion:
        clamp_inputs = {
            change["param"]: change["target"]
            for change in adjustments
            if change.get("requires_clamp") and change.get("target") is not None
        }
        applied = self.engine.clamp_to_machine(self.machine, clamp_inputs, self.experience)
        clamped_values = applied["parameters"]
        clamped_flag = bool(applied["clamped_to_machine_limits"])
        explanations = applied.get("explanations", [])

        changes: List[SuggestionChange] = []
        for change in adjustments:
            param = change["param"]
            requires_clamp = change.get("requires_clamp", False)
            if requires_clamp and param not in clamped_values:
                continue
            target_value = clamped_values.get(param) if requires_clamp else change.get("target")
            if target_value is None:
                continue
            range_hint = change.get("range_hint")
            if isinstance(range_hint, tuple):
                hint = range_hint
            elif isinstance(range_hint, list) and len(range_hint) == 2:
                hint = (float(range_hint[0]), float(range_hint[1]))
            else:
                hint = None
            delta = None
            baseline = self._baseline().get(param)
            if baseline is not None and isinstance(target_value, (int, float)):
                delta = round(float(target_value) - float(baseline), 3)
            changes.append(
                SuggestionChange(
                    param=param,
                    new_target=float(target_value) if isinstance(target_value, (int, float)) else target_value,
                    unit=change.get("unit"),
                    delta=delta,
                    range_hint=hint,
                )
            )

        explanation_suffix = " " + " ".join(explanations[1:]) if len(explanations) > 1 else ""
        return Suggestion(
            issue_id=prediction.issue_id,
            changes=changes,
            why=why + explanation_suffix,
            risk=risk,
            confidence=prediction.confidence,
            beginner_note=beginner_note,
            advanced_note=advanced_note,
            clamped_to_machine_limits=clamped_flag,
        )


def suggest(predictions: Iterable[Prediction], meta: AnalyzeRequestMeta) -> Tuple[List[Suggestion], bool]:
    """Public helper that returns suggestions and low confidence flag."""
    planner = SuggestionPlanner(meta)
    return planner.plan(predictions)


__all__ = ["SuggestionPlanner", "suggest"]
