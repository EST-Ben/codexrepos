"""Lightweight localization heuristics for print defect visualization."""
from __future__ import annotations

import base64
import hashlib
from dataclasses import dataclass
from typing import Iterable, List

from server.models.api import BoundingBox, HeatmapPayload, LocalizationPayload, Prediction


def _clamp(value: float, min_value: float = 0.0, max_value: float = 1.0) -> float:
    return max(min_value, min(max_value, value))


@dataclass
class LocalizationConfig:
    heatmap_size: int = 256
    max_boxes: int = 3


class LocalizationEngine:
    """Deterministic heuristics that mimic defect localization."""

    def __init__(self, config: LocalizationConfig | None = None) -> None:
        self.config = config or LocalizationConfig()

    # ------------------------------------------------------------------
    def localize(
        self,
        image_key: str,
        predictions: Iterable[Prediction],
    ) -> LocalizationPayload:
        preds = list(predictions)
        boxes = self._build_boxes(image_key, preds)
        heatmap = self._build_heatmap(image_key, preds)
        return LocalizationPayload(boxes=boxes, heatmap=heatmap)

    # ------------------------------------------------------------------
    def _build_boxes(self, image_key: str, predictions: List[Prediction]) -> List[BoundingBox]:
        results: List[BoundingBox] = []
        for index, prediction in enumerate(predictions[: self.config.max_boxes]):
            digest = hashlib.sha256(f"{image_key}:{prediction.issue_id}:{index}".encode()).digest()
            base_x = digest[0] / 255.0
            base_y = digest[1] / 255.0
            base_w = 0.25 + (digest[2] / 255.0) * 0.45
            base_h = 0.2 + (digest[3] / 255.0) * 0.5

            width = _clamp(base_w)
            height = _clamp(base_h)
            # Anchor boxes around the centre point while staying within bounds.
            x = _clamp(base_x * (1.0 - width))
            y = _clamp(base_y * (1.0 - height))

            results.append(
                BoundingBox(
                    issue_id=prediction.issue_id,
                    confidence=float(prediction.confidence),
                    x=x,
                    y=y,
                    width=width,
                    height=height,
                )
            )
        return results

    # ------------------------------------------------------------------
    def _build_heatmap(
        self, image_key: str, predictions: List[Prediction]
    ) -> HeatmapPayload | None:
        if not predictions:
            return None

        top_issue = predictions[0].issue_id
        digest = hashlib.sha256(f"heatmap:{image_key}:{top_issue}".encode()).hexdigest()
        hue = int(digest[:2], 16)
        intensity = 60 + int(digest[2:4], 16) % 120
        saturation = 65 + int(digest[4:6], 16) % 25

        svg = f"""
<svg xmlns='http://www.w3.org/2000/svg' width='{self.config.heatmap_size}' height='{self.config.heatmap_size}' viewBox='0 0 100 100'>
  <defs>
    <radialGradient id='heat' cx='50%' cy='50%' r='65%'>
      <stop offset='0%' stop-color='hsla({hue}, {saturation}%, {intensity}%, 0.85)' />
      <stop offset='100%' stop-color='hsla({hue}, {saturation}%, {intensity}%, 0)' />
    </radialGradient>
  </defs>
  <rect x='0' y='0' width='100' height='100' fill='url(#heat)' />
</svg>
""".strip()

        data_url = "data:image/svg+xml;base64," + base64.b64encode(svg.encode("utf-8")).decode("ascii")
        return HeatmapPayload(width=self.config.heatmap_size, height=self.config.heatmap_size, data_url=data_url)


__all__ = ["LocalizationEngine", "LocalizationConfig"]
