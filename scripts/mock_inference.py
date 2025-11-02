"""Emit deterministic diagnostics predictions for demo environments."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict

import os
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from server.app.ml.pipeline import DiagnosticPipeline
from server.app.rules import RulesEngine
from server.machines import MachineProfile, resolve_machine


def _load_extra_payload(source: str | None) -> Dict[str, Any]:
    if not source:
        return {}
    if source.startswith("@"):
        path = Path(source[1:]).expanduser().resolve()
        return json.loads(path.read_text())
    try:
        return json.loads(source)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Failed to decode payload JSON: {exc}") from exc


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("machine", help="Machine id or alias to resolve")
    parser.add_argument(
        "--material",
        default="PLA",
        help="Material code used for inference (default: PLA)",
    )
    parser.add_argument(
        "--experience",
        default="Intermediate",
        help="Experience level used for clamping recommendations",
    )
    parser.add_argument(
        "--issues",
        nargs="*",
        default=[],
        help="Optional list of observed print issues",
    )
    parser.add_argument(
        "--payload",
        help="Additional JSON payload inline or @/path/to/file.json",
    )

    args = parser.parse_args()

    try:
        machine: MachineProfile = resolve_machine(args.machine)
    except KeyError as exc:
        raise SystemExit(str(exc)) from exc

    payload: Dict[str, Any] = {
        "material": args.material,
        "issues": args.issues,
    }
    payload.update(_load_extra_payload(args.payload))

    pipeline = DiagnosticPipeline()
    prediction = pipeline.predict(payload, machine)

    engine = RulesEngine()
    applied_summary = engine.clamp_to_machine(
        machine, prediction.parameter_targets, args.experience
    )

    if isinstance(applied_summary, dict):
        applied_parameters = applied_summary.get("parameters", {})
        explanations = applied_summary.get("explanations", [])
    else:  # pragma: no cover - defensive
        applied_parameters = {}
        explanations = []

    output = {
        "meta": {
            "machine": {
                "id": machine.get("id"),
                "brand": machine.get("brand"),
                "model": machine.get("model"),
            },
            "experience": args.experience,
            "material": args.material,
        },
        "predictions": [
            {"issue_id": prediction.issue, "confidence": float(prediction.confidence)}
        ],
        "recommendations": prediction.recommendations,
        "capability_notes": prediction.capability_notes,
        "slicer_profile_diff": {
            "diff": {key: float(value) for key, value in prediction.parameter_targets.items()}
        },
        "applied": {key: float(value) for key, value in applied_parameters.items()},
        "explanations": explanations,
    }

    print(json.dumps(output, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
