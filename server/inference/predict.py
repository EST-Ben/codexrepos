"""Inference engine that supports both stub and torch-backed predictions."""
from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

from server.models.api import Prediction
from server.settings import INFERENCE_MODE, MODEL_PATH

LOGGER = logging.getLogger(__name__)

_TAXONOMY_CACHE: Dict[str, object] | None = None


def load_taxonomy(path: Path | None = None) -> Dict[str, object]:
    """Load taxonomy metadata describing issue cues."""
    global _TAXONOMY_CACHE
    if _TAXONOMY_CACHE is not None:
        return _TAXONOMY_CACHE
    target = path or Path("config/taxonomy.json").resolve()
    if target.exists():
        try:
            _TAXONOMY_CACHE = json.loads(target.read_text())
        except json.JSONDecodeError as exc:  # pragma: no cover - defensive
            LOGGER.warning("Failed to parse taxonomy JSON at %s: %s", target, exc)
            _TAXONOMY_CACHE = {"issues": {}}
    else:
        _TAXONOMY_CACHE = {"issues": {}}
    return _TAXONOMY_CACHE


class InferenceEngine:
    """Inference facade that supports torch or deterministic stub predictions."""

    def __init__(self) -> None:
        self.mode = INFERENCE_MODE.lower().strip()
        self.taxonomy = load_taxonomy()
        issues = self.taxonomy.get("issues") or {}
        self.issue_ids: List[str] = list(issues.keys()) or ["general_tuning"]
        self._torch_model = None
        self._torch_preprocess = None
        if self.mode == "torch":
            self._setup_torch_backend()

    # ------------------------------------------------------------------
    def predict(self, image_path: Path) -> Tuple[List[Prediction], List[Dict[str, object]]]:
        """Run inference on an image and return predictions plus explanations."""
        if self.mode == "torch" and self._torch_model is not None:
            predictions = self._predict_with_torch(image_path)
        else:
            predictions = self._predict_stub(image_path)
        explanations = self._build_explanations(predictions)
        return predictions, explanations

    # ------------------------------------------------------------------
    def _setup_torch_backend(self) -> None:
        """Attempt to load a torch model; fallback to stub if unavailable."""
        try:  # pragma: no cover - optional dependency
            import torch
            from torchvision import transforms
            from PIL import Image  # noqa: F401  # ensure Pillow is installed
        except Exception as exc:  # pragma: no cover - dependency handling
            LOGGER.warning("Torch backend unavailable, falling back to stub mode: %s", exc)
            self.mode = "stub"
            return

        if not MODEL_PATH.exists():  # pragma: no cover - depends on runtime assets
            LOGGER.warning("Model path %s does not exist; using stub predictions.", MODEL_PATH)
            self.mode = "stub"
            return

        try:  # pragma: no cover - depends on runtime assets
            model = torch.jit.load(str(MODEL_PATH))
            model.eval()
            self._torch_model = model
            self._torch_preprocess = transforms.Compose(
                [
                    transforms.Resize((224, 224)),
                    transforms.ToTensor(),
                    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
                ]
            )
        except Exception as exc:
            LOGGER.warning("Failed to load torch model at %s: %s", MODEL_PATH, exc)
            self.mode = "stub"
            self._torch_model = None
            self._torch_preprocess = None

    # ------------------------------------------------------------------
    def _predict_with_torch(self, image_path: Path) -> List[Prediction]:
        """Predict using the torch backend."""
        try:  # pragma: no cover - optional dependency path
            import torch
            from PIL import Image
        except Exception as exc:  # pragma: no cover - dependency handling
            LOGGER.warning("Torch dependencies missing at runtime: %s", exc)
            return self._predict_stub(image_path)

        if self._torch_model is None or self._torch_preprocess is None:
            return self._predict_stub(image_path)

        image = Image.open(image_path).convert("RGB")
        tensor = self._torch_preprocess(image).unsqueeze(0)
        with torch.no_grad():
            logits = self._torch_model(tensor)
            probabilities = torch.softmax(logits, dim=1)[0].tolist()

        predictions: List[Prediction] = []
        for idx, confidence in enumerate(probabilities):
            if idx >= len(self.issue_ids):
                break
            if confidence < 0.05:
                continue
            predictions.append(Prediction(issue_id=self.issue_ids[idx], confidence=float(confidence)))
        if not predictions:
            predictions.append(Prediction(issue_id=self.issue_ids[0], confidence=0.4))
        return sorted(predictions, key=lambda item: item.confidence, reverse=True)

    # ------------------------------------------------------------------
    def _predict_stub(self, image_path: Path) -> List[Prediction]:
        """Deterministic stub predictions seeded from the image filename."""
        digest = hashlib.sha256(image_path.name.encode("utf-8")).hexdigest()
        seed = int(digest[:8], 16)
        ordering = list(self.issue_ids)
        if ordering:
            index = seed % len(ordering)
            ordering = ordering[index:] + ordering[:index]
        scores = self._confidence_sequence(seed, len(ordering))
        predictions = [
            Prediction(issue_id=issue_id, confidence=score)
            for issue_id, score in zip(ordering[:3], scores)
        ]
        return predictions

    def _confidence_sequence(self, seed: int, count: int) -> Iterable[float]:
        base = (seed % 30) / 100.0
        for idx in range(count):
            confidence = max(0.1, min(0.95, 0.75 - idx * 0.18 + base))
            yield round(confidence, 3)

    def _build_explanations(self, predictions: Iterable[Prediction]) -> List[Dict[str, object]]:
        taxonomy = self.taxonomy.get("issues") or {}
        result: List[Dict[str, object]] = []
        for prediction in predictions:
            cues = taxonomy.get(prediction.issue_id, {}).get("cues") or []
            result.append({"issue_id": prediction.issue_id, "cues": cues})
        return result


__all__ = ["InferenceEngine", "load_taxonomy"]
