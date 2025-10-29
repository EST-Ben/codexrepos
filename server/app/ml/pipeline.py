"""Deterministic diagnostics pipeline stub."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Mapping

from server.machines import MachineProfile


@dataclass
class Prediction:
    issue: str
    confidence: float
    recommendations: List[str]
    parameter_targets: Dict[str, float]
    capability_notes: List[str]


class DiagnosticPipeline:
    """Simple heuristic-based predictor used until a model is trained."""

    def predict(self, payload: Mapping[str, Any], machine: MachineProfile) -> Prediction:
        issue = self._resolve_issue(payload.get("issues", []))
        material = str(payload.get("material") or "PLA").upper()
        capability_notes: List[str] = []

        if machine.get("type") == "FDM":
            parameter_targets, recs, notes = self._predict_fdm(material, issue, machine)
        elif machine.get("type") in {"MSLA", "SLA"}:
            parameter_targets, recs, notes = self._predict_msla(material, issue, machine)
        else:
            parameter_targets, recs, notes = self._predict_cnc(material, issue, machine)

        capability_notes.extend(notes)
        recommendations = recs
        confidence = 0.75 if issue != "general_tuning" else 0.6

        return Prediction(
            issue=issue,
            confidence=confidence,
            recommendations=recommendations,
            parameter_targets=parameter_targets,
            capability_notes=capability_notes,
        )

    # --- helpers -----------------------------------------------------------------

    def _resolve_issue(self, issues: Iterable[str]) -> str:
        for item in issues:
            if item:
                return str(item)
        return "general_tuning"

    def _predict_fdm(
        self, material: str, issue: str, machine: MachineProfile
    ) -> tuple[Dict[str, float], List[str], List[str]]:
        presets = machine.get("material_presets") or {}
        preset = presets.get(material) or presets.get("PLA") or {}
        capability_notes: List[str] = []

        def midpoint(values: List[float], fallback: float) -> float:
            if isinstance(values, list) and values:
                return float(sum(values) / len(values))
            return fallback

        nozzle = midpoint(preset.get("nozzle_c"), 210.0)
        bed = midpoint(preset.get("bed_c"), 60.0)
        fan_range = preset.get("fan_pct")
        fan = midpoint(fan_range, 70.0)

        motion = str(machine.get("motion_system") or "BedSlinger")
        supports = machine.get("supports") or {}
        enclosed = bool(machine.get("enclosed"))

        print_speed = 120.0 if motion in {"CoreXY", "H-Bot"} else 90.0
        travel_speed = 150.0 if motion in {"CoreXY", "H-Bot"} else 120.0
        accel = 5000.0 if supports.get("input_shaping") else 3000.0
        jerk = 12.0 if motion in {"CoreXY", "H-Bot"} else 8.0

        capability_notes.append(f"Motion system: {motion}")
        if supports.get("input_shaping"):
            capability_notes.append("Input shaping allows higher acceleration targets.")
        if enclosed:
            capability_notes.append("Enclosure enables stable ambient temperatures.")

        if material == "ABS" and enclosed:
            bed = min(bed + 10, (machine.get("max_bed_temp_c") or bed))
            fan = min(fan, 15.0)
            capability_notes.append("ABS on enclosed printers supports higher bed temps and low fan.")

        recommendations = [
            "Verify belts and rails are tensioned before applying aggressive speed changes.",
            "Re-run auto bed levelling after major temperature changes.",
        ]

        if "ringing" in issue.lower():
            if motion == "BedSlinger":
                accel *= 0.6
                jerk *= 0.7
                recommendations.append("Reduce acceleration on bedslingers to minimize ringing.")
            else:
                accel *= 0.85
                recommendations.append("CoreXY machines handle ringing with moderate accel reductions.")
        if "underextrusion" in issue.lower():
            recommendations.append("Check filament path friction and consider a slight flow increase.")

        parameter_targets = {
            "nozzle_temp": float(nozzle),
            "bed_temp": float(bed),
            "print_speed": float(print_speed),
            "travel_speed": float(travel_speed),
            "accel": float(accel),
            "jerk": float(jerk),
            "fan_speed": float(fan),
            "flow_rate": 100.0,
            "retraction_distance": 0.8 if supports.get("ams") else 0.6,
        }

        return parameter_targets, recommendations, capability_notes

    def _predict_msla(
        self, material: str, issue: str, machine: MachineProfile
    ) -> tuple[Dict[str, float], List[str], List[str]]:
        exposure = 2.5 if material.startswith("RESIN") else 2.0
        lift_speed = 60.0
        recommendations = [
            "Ensure the vat film is clean before printing.",
            "Agitate resin vats periodically to maintain consistency.",
        ]
        if "peel" in issue.lower():
            lift_speed *= 0.8
            recommendations.append("Slow the lift speed to reduce peel forces.")
        capability_notes = ["Resin printer assumes mid-volume MSLA profile."]
        parameter_targets = {
            "exposure_time": exposure,
            "lift_speed": lift_speed,
        }
        return parameter_targets, recommendations, capability_notes

    def _predict_cnc(
        self, material: str, issue: str, machine: MachineProfile
    ) -> tuple[Dict[str, float], List[str], List[str]]:
        rigidity = str(machine.get("rigidity_class") or "hobby")
        spindle_range = machine.get("spindle_rpm_range") or [8000, 18000]
        spindle = float(sum(spindle_range) / len(spindle_range))
        feed_rate = min(float(machine.get("max_feed_mm_min") or 6000), spindle * 0.5)
        doc = 2.0 if "industrial" in rigidity else 1.2
        stepover = 40.0
        recommendations = [
            "Check workholding rigidity before increasing DOC.",
            "Use climb milling for finishing passes when possible.",
        ]
        if "chatter" in issue.lower():
            feed_rate *= 0.8
            doc *= 0.7
            recommendations.append("Reduce feed and DOC to mitigate chatter.")
        capability_notes = [f"Rigidity class: {rigidity}"]
        parameter_targets = {
            "spindle_rpm": spindle,
            "feed_rate": feed_rate,
            "doc": doc,
            "stepover": stepover,
        }
        return parameter_targets, recommendations, capability_notes
