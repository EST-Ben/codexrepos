"""Singleton services shared across FastAPI routers."""
from __future__ import annotations

from server.inference.localize import LocalizationEngine
from server.inference.predict import InferenceEngine

INFERENCE_ENGINE = InferenceEngine()
LOCALIZATION_ENGINE = LocalizationEngine()

__all__ = ["INFERENCE_ENGINE", "LOCALIZATION_ENGINE"]
