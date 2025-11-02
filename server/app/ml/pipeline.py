"""Diagnostics pipeline powered by lightweight ML models.

The pipeline now favours real model execution when available while retaining a
pure-Python linear fallback so development and tests continue to operate
without heavyweight dependencies.  When ``INFERENCE_MODE`` is set to ``torch``
or ``onnx`` the corresponding runtime is used; otherwise the shipped linear
classifier (trained on handcrafted defect descriptors) is loaded from
``server/models/issues_linear_model.json``.

The output contract matches the Stage 1/2 requirements: ranked issues,
localisation hints, slicer parameter targets, human readable recommendations,
and capability notes derived from the target machine profile.
"""
from __future__ import annotations

import base64
import io
import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Dict, Iterable, List, Mapping, Sequence, Tuple

import numpy as np
from PIL import Image, ImageFilter, ImageOps

from server import settings
from server.machines import MachineProfile
from server.models.api import BoundingBox, Prediction as ApiPrediction

Prediction = ApiPrediction

# ---------------------------------------------------------------------------
# Model metadata
# ---------------------------------------------------------------------------

ISSUE_LABELS: Tuple[str, ...] = (
    "stringing",
    "under_extrusion",
    "over_extrusion",
    "ringing",
    "z_wobble",
    "layer_shift",
    "elephants_foot",
    "warping",
    "poor_adhesion",
    "blobs",
    "overheating",
    "cooling_artifacts",
    "wet_filament",
    "dimensional_error",
)

MATERIAL_BASELINES: Dict[str, Dict[str, float]] = {
    "PLA": {"nozzle_temp": 210.0, "bed_temp": 60.0, "fan_speed": 80.0},
    "PETG": {"nozzle_temp": 235.0, "bed_temp": 80.0, "fan_speed": 40.0},
    "ABS": {"nozzle_temp": 240.0, "bed_temp": 100.0, "fan_speed": 10.0},
    "ASA": {"nozzle_temp": 245.0, "bed_temp": 105.0, "fan_speed": 15.0},
    "TPU": {"nozzle_temp": 225.0, "bed_temp": 55.0, "fan_speed": 60.0},
}

ISSUE_PARAM_DELTAS: Dict[str, Dict[str, float]] = {
    "stringing": {
        "nozzle_temp": -8.0,
        "fan_speed": 12.0,
        "retraction_distance": 0.2,
        "travel_speed": 10.0,
    },
    "under_extrusion": {
        "flow_rate": 8.0,
        "nozzle_temp": 6.0,
        "print_speed": -15.0,
    },
    "over_extrusion": {
        "flow_rate": -6.0,
        "retraction_distance": -0.1,
    },
    "ringing": {
        "accel": -1200.0,
        "jerk": -2.0,
        "print_speed": -10.0,
    },
    "layer_shift": {
        "accel": -800.0,
        "travel_speed": -15.0,
    },
    "warping": {
        "bed_temp": 8.0,
        "fan_speed": -25.0,
    },
    "poor_adhesion": {
        "bed_temp": 6.0,
        "print_speed": -8.0,
        "flow_rate": 3.0,
    },
    "overheating": {
        "fan_speed": 20.0,
        "print_speed": -12.0,
    },
    "wet_filament": {
        "fan_speed": 5.0,
        "nozzle_temp": -4.0,
    },
    "dimensional_error": {
        "flow_rate": -4.0,
        "print_speed": -10.0,
        "jerk": -1.0,
    },
}

ISSUE_RECOMMENDATIONS: Dict[str, List[str]] = {
    "stringing": [
        "Dry the filament thoroughly or store it with desiccant.",
        "Increase retraction distance and speed in small increments.",
        "Lower the nozzle temperature by 5–10°C if layer adhesion remains acceptable.",
    ],
    "under_extrusion": [
        "Inspect the drive gears for debris or worn teeth.",
        "Verify filament diameter and update the slicer profile if needed.",
        "Raise nozzle temperature in 5°C increments to improve melt flow.",
    ],
    "over_extrusion": [
        "Calibrate the extruder steps/mm or flow multiplier.",
        "Lower the flow rate slightly and watch for gaps between perimeters.",
    ],
    "ringing": [
        "Tighten belts and check that idlers spin freely.",
        "Reduce acceleration and jerk to damp oscillations.",
        "Enable input shaping or pressure advance if your firmware supports it.",
    ],
    "layer_shift": [
        "Inspect the gantry for binding or missed steps.",
        "Reduce travel speed and acceleration while diagnosing the issue.",
    ],
    "warping": [
        "Use a brim or raft to hold down sharp corners.",
        "Increase bed temperature and reduce part cooling for the first layers.",
    ],
    "poor_adhesion": [
        "Re-level the bed and ensure the first layer is squished evenly.",
        "Clean the build surface with isopropyl alcohol or an approved solvent.",
    ],
    "overheating": [
        "Increase part cooling and shorten layer times with slower speeds.",
        "Add a short dwell between layers on tall, thin sections.",
    ],
    "wet_filament": [
        "Dry the filament in a dehydrator before printing.",
        "Store filament spools in an airtight container with desiccant.",
    ],
    "dimensional_error": [
        "Calibrate X/Y steps per mm with a test cube.",
        "Slow down external perimeters for better dimensional accuracy.",
    ],
}

DEFAULT_RECOMMENDATIONS = [
    "Verify belts, rails, and lead screws are lubricated and tensioned correctly.",
    "Apply slicer changes gradually and keep notes between test prints.",
]

# ---------------------------------------------------------------------------
# Data containers
# ---------------------------------------------------------------------------


@dataclass
class SingleIssueResult:
    issue: str
    confidence: float
    parameter_targets: Dict[str, float]
    recommendations: List[str]
    capability_notes: List[str]


@dataclass
class ImageAnalysisResult:
    predictions: List[ApiPrediction]
    boxes: List[BoundingBox]
    heatmap: str | None
    parameter_targets: Dict[str, float]
    recommendations: List[str]
    capability_notes: List[str]

    @property
    def top_issue(self) -> str | None:
        return self.predictions[0].issue_id if self.predictions else None


# ---------------------------------------------------------------------------
# Classifier backends
# ---------------------------------------------------------------------------


class _BaseClassifier:
    """Shared interface for classifier adapters."""

    def predict(
        self, image_array: np.ndarray, feature_vector: np.ndarray
    ) -> Tuple[np.ndarray, Tuple[str, ...]]:
        raise NotImplementedError


class _LinearClassifier(_BaseClassifier):
    """Loads a lightweight linear model stored as JSON weights."""

    def __init__(self, weight_path: Path) -> None:
        self._weight_path = weight_path

    @staticmethod
    @lru_cache(maxsize=4)
    def _load(weight_path: Path) -> Tuple[np.ndarray, np.ndarray, Tuple[str, ...]]:
        if not weight_path.exists():  # pragma: no cover - configuration error
            raise RuntimeError(
                f"Linear model weights not found at '{weight_path}'. Set LINEAR_MODEL_PATH to a valid file."
            )
        data = json.loads(weight_path.read_text())
        labels = tuple(data.get("labels", ISSUE_LABELS))
        weights = np.asarray(data["weights"], dtype=np.float32)
        bias = np.asarray(data.get("bias", [0.0] * len(labels)), dtype=np.float32)
        if weights.shape[0] != len(labels):  # pragma: no cover - data error
            raise RuntimeError(
                f"Weight matrix rows ({weights.shape[0]}) do not match label count ({len(labels)})."
            )
        return weights, bias, labels

    def predict(
        self, _image_array: np.ndarray, feature_vector: np.ndarray
    ) -> Tuple[np.ndarray, Tuple[str, ...]]:
        weights, bias, labels = self._load(self._weight_path)
        logits = feature_vector @ weights.T + bias
        probs = 1.0 / (1.0 + np.exp(-logits))
        return probs.astype(np.float32), labels


class _TorchClassifier(_BaseClassifier):  # pragma: no cover - optional dependency
    def __init__(self, model_path: Path) -> None:
        try:
            import torch
        except ImportError as exc:  # pragma: no cover - env specific
            raise RuntimeError("INFERENCE_MODE=torch requires the 'torch' package") from exc

        if not model_path.exists():
            raise RuntimeError(f"Torch model not found at '{model_path}'.")

        self._torch = torch
        self._device = torch.device("cpu")
        self._model = torch.jit.load(str(model_path), map_location=self._device)
        self._model.eval()
        class_names = getattr(self._model, "class_names", None)
        if class_names:
            self._labels = tuple(class_names)
        else:
            self._labels = ISSUE_LABELS

    def predict(
        self, image_array: np.ndarray, _feature_vector: np.ndarray
    ) -> Tuple[np.ndarray, Tuple[str, ...]]:
        torch = self._torch
        tensor = torch.from_numpy(image_array.transpose(2, 0, 1)).unsqueeze(0).float()
        with torch.inference_mode():
            outputs = self._model(tensor)
        if isinstance(outputs, (list, tuple)):
            logits = outputs[0]
        else:
            logits = outputs
        logits = logits.detach().cpu().numpy().astype(np.float32)
        if logits.ndim == 2:
            logits = logits[0]
        probs = 1.0 / (1.0 + np.exp(-logits))
        return probs, self._labels


class _OnnxClassifier(_BaseClassifier):  # pragma: no cover - optional dependency
    def __init__(self, model_path: Path) -> None:
        try:
            import onnxruntime as ort
        except ImportError as exc:
            raise RuntimeError("INFERENCE_MODE=onnx requires the 'onnxruntime' package") from exc

        if not model_path.exists():
            raise RuntimeError(f"ONNX model not found at '{model_path}'.")

        self._session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
        meta = self._session.get_modelmeta().custom_metadata_map or {}
        labels = meta.get("class_names") or ",".join(ISSUE_LABELS)
        self._labels = tuple(label for label in labels.split(",") if label) or ISSUE_LABELS
        self._input_name = self._session.get_inputs()[0].name
        self._output_name = self._session.get_outputs()[0].name

    def predict(
        self, image_array: np.ndarray, _feature_vector: np.ndarray
    ) -> Tuple[np.ndarray, Tuple[str, ...]]:
        array = image_array.transpose(2, 0, 1)[np.newaxis, ...].astype(np.float32)
        outputs = self._session.run([self._output_name], {self._input_name: array})
        logits = outputs[0]
        if logits.ndim == 2:
            logits = logits[0]
        probs = 1.0 / (1.0 + np.exp(-logits))
        return probs.astype(np.float32), self._labels


def _resolve_classifier() -> _BaseClassifier:
    mode = settings.INFERENCE_MODE.lower().strip()
    if mode == "torch":
        return _TorchClassifier(settings.MODEL_PATH)
    if mode == "onnx":
        model_path = getattr(settings, "ONNX_MODEL_PATH", settings.MODEL_PATH)
        return _OnnxClassifier(model_path)
    weight_path = getattr(settings, "LINEAR_MODEL_PATH", Path("./server/models/issues_linear_model.json"))
    return _LinearClassifier(weight_path)


# ---------------------------------------------------------------------------
# Pipeline implementation
# ---------------------------------------------------------------------------


class DiagnosticPipeline:
    """Realistic diagnostics pipeline supporting multiple inference backends."""

    def __init__(self) -> None:
        self._classifier = _resolve_classifier()

    def predict(self, payload: Mapping[str, object], machine: MachineProfile) -> SingleIssueResult:
        material = str(payload.get("material") or "PLA").upper()
        issue = self._resolve_issue(payload.get("issues", []))
        parameter_targets, recommendations, capability_notes = self._build_plan(
            machine, material, issue
        )
        confidence = 0.82 if issue != "general_tuning" else 0.6
        return SingleIssueResult(
            issue=issue,
            confidence=confidence,
            parameter_targets=parameter_targets,
            recommendations=recommendations,
            capability_notes=capability_notes,
        )

    def predict_image(
        self, image_path: Path, machine: MachineProfile, material: str | None = None
    ) -> ImageAnalysisResult:
        material_code = str(material or "PLA").upper()
        with Image.open(image_path) as source:
            image = source.convert("RGB")
            image_array = np.asarray(image, dtype=np.float32) / 255.0

        feature_vector, activation_map = self._extract_features(image_array)
        probs, labels = self._classifier.predict(image_array, feature_vector)

        predictions = self._build_predictions(probs, labels, machine)
        top_issue = predictions[0].issue_id if predictions else "general_tuning"

        boxes = self._build_boxes(activation_map, predictions)
        heatmap = self._build_heatmap(activation_map) if boxes else None

        parameter_targets, recommendations, capability_notes = self._build_plan(
            machine, material_code, top_issue
        )

        if len(predictions) > 1 and (predictions[1].confidence + 0.05) >= predictions[0].confidence:
            recommendations = self._merge_recommendations(recommendations, predictions[1].issue_id)

        return ImageAnalysisResult(
            predictions=predictions,
            boxes=boxes,
            heatmap=heatmap,
            parameter_targets=parameter_targets,
            recommendations=recommendations,
            capability_notes=capability_notes,
        )

    # ------------------------------------------------------------------
    # Prediction helpers
    # ------------------------------------------------------------------

    def _resolve_issue(self, issues: Iterable[str]) -> str:
        for item in issues:
            if item:
                return str(item)
        return "general_tuning"

    def _build_predictions(
        self,
        probs: np.ndarray,
        labels: Sequence[str],
        machine: MachineProfile,
    ) -> List[ApiPrediction]:
        if probs.size != len(labels):  # pragma: no cover - misconfigured model
            raise RuntimeError(
                f"Classifier output size {probs.size} does not match number of labels {len(labels)}"
            )

        scores: List[Tuple[str, float]] = []
        motion = str(machine.get("motion_system") or "").lower()
        enclosed = bool(machine.get("enclosed"))

        for label, score in zip(labels, probs):
            adjusted = float(score)
            if "bowden" in motion and label == "stringing":
                adjusted = min(0.995, adjusted + 0.08)
            if enclosed and label in {"warping", "overheating"}:
                adjusted = min(0.995, adjusted + 0.05)
            scores.append((label, round(adjusted, 3)))

        scores.sort(key=lambda item: item[1], reverse=True)
        predictions = [ApiPrediction(issue_id=label, confidence=score) for label, score in scores[:5]]
        return predictions

    # ------------------------------------------------------------------
    # Feature extraction & localisation
    # ------------------------------------------------------------------

    def _extract_features(self, image_array: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        gray = image_array.mean(axis=2)

        grad_x = np.abs(np.diff(gray, axis=1, prepend=gray[:, :1]))
        grad_y = np.abs(np.diff(gray, axis=0, prepend=gray[:1, :]))
        grad = np.sqrt(grad_x**2 + grad_y**2)
        grad_norm = grad / (grad.max() + 1e-8)

        bright_ratio = float(np.mean(gray > 0.7))
        dark_ratio = float(np.mean(gray < 0.3))
        mean_intensity = float(gray.mean())
        intensity_std = float(gray.std())
        texture_variance = float(grad_norm.std())
        edge_density = float(np.mean(grad_norm > 0.35))

        hsv = self._rgb_to_hsv(image_array)
        saturation_mean = float(hsv[:, :, 1].mean())
        warmth = float((image_array[:, :, 0] - image_array[:, :, 2]).mean())
        center_focus = self._center_focus(gray)

        feature_vector = np.array(
            [
                mean_intensity,
                intensity_std,
                edge_density,
                bright_ratio,
                dark_ratio,
                saturation_mean,
                warmth,
                center_focus,
                texture_variance,
            ],
            dtype=np.float32,
        )
        return feature_vector, grad_norm

    def _center_focus(self, gray: np.ndarray) -> float:
        height, width = gray.shape
        margin_y = max(1, height // 4)
        margin_x = max(1, width // 4)
        center = gray[margin_y : height - margin_y, margin_x : width - margin_x]
        if center.size == 0:
            return 0.0
        outer_mask = np.ones_like(gray, dtype=bool)
        outer_mask[margin_y : height - margin_y, margin_x : width - margin_x] = False
        outer_values = gray[outer_mask]
        if outer_values.size == 0:
            return 0.0
        return float(center.mean() - outer_values.mean())

    def _rgb_to_hsv(self, image_array: np.ndarray) -> np.ndarray:
        r, g, b = np.moveaxis(image_array, -1, 0)
        maxc = np.max(image_array, axis=2)
        minc = np.min(image_array, axis=2)
        v = maxc
        s = np.zeros_like(maxc)
        mask = maxc != 0
        s[mask] = (maxc - minc)[mask] / maxc[mask]

        h = np.zeros_like(maxc)
        delta = maxc - minc
        mask_r = maxc == r
        mask_g = maxc == g
        mask_b = maxc == b
        h[mask_r] = ((g - b)[mask_r] / (delta[mask_r] + 1e-8)) % 6
        h[mask_g] = ((b - r)[mask_g] / (delta[mask_g] + 1e-8)) + 2
        h[mask_b] = ((r - g)[mask_b] / (delta[mask_b] + 1e-8)) + 4
        h *= 60.0 / 360.0
        hsv = np.stack([h, s, v], axis=2)
        return hsv

    def _build_boxes(
        self, activation_map: np.ndarray, predictions: Sequence[ApiPrediction]
    ) -> List[BoundingBox]:
        if not predictions:
            return []

        heat = activation_map.copy()
        height, width = heat.shape
        if height < 4 or width < 4:
            return []

        window_h = max(16, height // 4)
        window_w = max(16, width // 4)
        stride_y = max(4, window_h // 6)
        stride_x = max(4, window_w // 6)

        boxes: List[BoundingBox] = []
        for prediction in predictions[:3]:
            integral = heat.cumsum(axis=0).cumsum(axis=1)
            best_score = -1.0
            best_coords = None
            for y in range(0, height - window_h + 1, stride_y):
                y1 = y + window_h - 1
                for x in range(0, width - window_w + 1, stride_x):
                    x1 = x + window_w - 1
                    score = self._window_sum(integral, x, y, x1, y1)
                    if score > best_score:
                        best_score = score
                        best_coords = (x, y, x1, y1)
            if not best_coords:
                break
            x0, y0, x1, y1 = best_coords
            width_norm = (x1 - x0 + 1) / width
            height_norm = (y1 - y0 + 1) / height
            x_norm = x0 / width
            y_norm = y0 / height
            boxes.append(
                BoundingBox(
                    issue_id=prediction.issue_id,
                    confidence=float(min(0.99, max(0.1, best_score / (window_h * window_w)))),
                    x=round(x_norm, 3),
                    y=round(y_norm, 3),
                    width=round(width_norm, 3),
                    height=round(height_norm, 3),
                )
            )
            heat[y0 : y1 + 1, x0 : x1 + 1] *= 0.25
        return boxes

    def _window_sum(self, integral: np.ndarray, x0: int, y0: int, x1: int, y1: int) -> float:
        top_left = integral[y0 - 1, x0 - 1] if y0 > 0 and x0 > 0 else 0.0
        top_right = integral[y0 - 1, x1] if y0 > 0 else 0.0
        bottom_left = integral[y1, x0 - 1] if x0 > 0 else 0.0
        bottom_right = integral[y1, x1]
        return float(bottom_right - top_right - bottom_left + top_left)

    def _build_heatmap(self, activation_map: np.ndarray) -> str:
        heat = np.clip(activation_map, 0.0, 1.0)
        image = Image.fromarray(np.uint8(heat * 255), mode="L")
        blur_radius = max(2, min(image.size) // 40)
        image = image.filter(ImageFilter.GaussianBlur(radius=blur_radius))
        image = ImageOps.autocontrast(image)
        coloured = ImageOps.colorize(image, black="#000000", white="#ff5500")
        alpha = image.point(lambda value: int(value * 0.9))
        heat_rgba = Image.merge("RGBA", (*coloured.split(), alpha))
        buffer = io.BytesIO()
        heat_rgba.save(buffer, format="PNG")
        return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")

    # ------------------------------------------------------------------
    # Parameter planning helpers
    # ------------------------------------------------------------------

    def _build_plan(
        self, machine: MachineProfile, material: str, issue: str
    ) -> Tuple[Dict[str, float], List[str], List[str]]:
        material_defaults = MATERIAL_BASELINES.get(material, MATERIAL_BASELINES["PLA"])
        presets = machine.get("material_presets") or {}
        preset = (
            presets.get(material)
            or presets.get(material.lower())
            or presets.get(material.upper())
            or presets.get("PLA")
            or {}
        )

        nozzle = self._mean(preset.get("nozzle_c"), material_defaults["nozzle_temp"])
        bed = self._mean(preset.get("bed_c"), material_defaults["bed_temp"])
        fan = self._mean(preset.get("fan_pct"), material_defaults["fan_speed"])

        supports = machine.get("supports") or {}
        motion = str(machine.get("motion_system") or "Bedslinger")
        enclosed = bool(machine.get("enclosed"))

        base_targets: Dict[str, float] = {
            "nozzle_temp": nozzle,
            "bed_temp": bed,
            "fan_speed": fan,
            "flow_rate": 100.0,
            "retraction_distance": 0.6 if not supports.get("ams") else 0.8,
            "print_speed": 90.0,
            "travel_speed": 130.0,
            "accel": 3200.0,
            "jerk": 8.0,
        }

        motion_lower = motion.lower()
        if "core" in motion_lower or "h-bot" in motion_lower:
            base_targets.update(
                {
                    "print_speed": 130.0,
                    "travel_speed": 180.0,
                    "accel": 5200.0,
                    "jerk": 12.0,
                }
            )
        elif "belt" in motion_lower or motion_lower.startswith("bed"):
            base_targets.update(
                {
                    "print_speed": 95.0,
                    "travel_speed": 140.0,
                    "accel": 3000.0,
                    "jerk": 7.0,
                }
            )

        if enclosed:
            base_targets["fan_speed"] = min(base_targets["fan_speed"], 40.0)
            base_targets["bed_temp"] = max(base_targets["bed_temp"], material_defaults["bed_temp"] + 3.0)

        if supports.get("input_shaping"):
            base_targets["accel"] = max(base_targets["accel"], 6000.0)

        if material in {"ABS", "ASA"}:
            base_targets["fan_speed"] = min(base_targets["fan_speed"], 20.0)
            base_targets["bed_temp"] = max(base_targets["bed_temp"], material_defaults["bed_temp"])

        targets = self._apply_issue_deltas(base_targets, issue)
        recommendations = list(DEFAULT_RECOMMENDATIONS)
        recommendations.extend(ISSUE_RECOMMENDATIONS.get(issue, []))
        capability_notes = self._capability_notes(machine, motion, enclosed, supports)
        return targets, recommendations, capability_notes

    def _apply_issue_deltas(self, targets: Dict[str, float], issue: str) -> Dict[str, float]:
        deltas = ISSUE_PARAM_DELTAS.get(issue, {})
        adjusted = dict(targets)
        for key, delta in deltas.items():
            if key not in adjusted:
                continue
            value = adjusted[key] + delta
            if key in {"fan_speed", "flow_rate"}:
                value = max(0.0, min(100.0, value))
            elif key in {"retraction_distance"}:
                value = max(0.0, value)
            else:
                value = max(0.0, value)
            adjusted[key] = round(value, 3)
        return adjusted

    def _merge_recommendations(self, base: List[str], secondary_issue: str) -> List[str]:
        merged = list(base)
        for tip in ISSUE_RECOMMENDATIONS.get(secondary_issue, []):
            if tip not in merged:
                merged.append(tip)
        return merged

    def _capability_notes(
        self,
        machine: MachineProfile,
        motion: str,
        enclosed: bool,
        supports: Mapping[str, object],
    ) -> List[str]:
        notes: List[str] = []
        motion_lower = motion.lower()
        if "core" in motion_lower:
            notes.append("CoreXY motion supports aggressive acceleration; raise jerk gradually.")
        elif motion_lower.startswith("bed") or "slinger" in motion_lower:
            notes.append("Bedslinger motion benefits from conservative acceleration adjustments.")
        elif motion:
            notes.append(f"Motion system: {motion}.")

        if enclosed:
            notes.append("Enclosed chamber keeps ambient temperatures stable for heat-sensitive materials.")
        if supports.get("input_shaping"):
            notes.append("Input shaping support allows higher acceleration targets with fewer artifacts.")
        if supports.get("ams"):
            notes.append("Multi-material unit detected; account for purge and filament path lengths.")

        if not notes:
            notes.append("Limited machine metadata available; apply slicer changes gradually.")
        return notes

    @staticmethod
    def _mean(values: object, fallback: float) -> float:
        if isinstance(values, (list, tuple)) and values:
            return float(sum(float(v) for v in values) / len(values))
        if isinstance(values, (int, float)):
            return float(values)
        return float(fallback)


_PIPELINE_SINGLETON: "DiagnosticPipeline" | None = None


def _get_pipeline_singleton() -> DiagnosticPipeline:
    global _PIPELINE_SINGLETON
    if _PIPELINE_SINGLETON is None:
        _PIPELINE_SINGLETON = DiagnosticPipeline()
    return _PIPELINE_SINGLETON


def predict_json(payload: Mapping[str, object], machine: MachineProfile) -> SingleIssueResult:
    """Convenience wrapper that reuses a shared pipeline instance."""

    pipeline = _get_pipeline_singleton()
    return pipeline.predict(payload, machine)


def predict_image(
    image_path: Path | str, machine: MachineProfile, material: str | None = None
) -> ImageAnalysisResult:
    """Run image-based diagnostics using a shared pipeline instance."""

    pipeline = _get_pipeline_singleton()
    path = Path(image_path)
    return pipeline.predict_image(path, machine, material)


__all__ = [
    "DiagnosticPipeline",
    "ImageAnalysisResult",
    "SingleIssueResult",
    "Prediction",
    "predict_image",
    "predict_json",
]
