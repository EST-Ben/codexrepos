"""Machine learning stubs for diagnostics."""
from __future__ import annotations

from server.models.api import Prediction

from .pipeline import DiagnosticPipeline

__all__ = ["DiagnosticPipeline", "Prediction"]
