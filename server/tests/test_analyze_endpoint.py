"""Tests for the analyze API endpoints."""
import json
from typing import Dict, Tuple

import pytest
from fastapi.testclient import TestClient

from server import settings
from server.models.api import BoundingBox, Prediction


def _multipart_payload(meta: Dict[str, object]) -> Tuple[Dict[str, object], Dict[str, Tuple[str, bytes, str]]]:
    files = {"image": ("test.jpg", b"data", "image/jpeg")}
    data = {"meta": json.dumps(meta)}
    return data, files


def test_analyze_endpoint_returns_expected_shape(client: TestClient) -> None:
    data, files = _multipart_payload(
        {"machine_id": "bambu_p1p", "experience": "Intermediate", "material": "PLA"}
    )
    response = client.post("/api/analyze", data=data, files=files)
    assert response.status_code == 200
    payload = response.json()

    assert payload["machine"]["id"] == "bambu_p1p"
    assert isinstance(payload["issue_list"], list)
    assert "parameter_targets" in payload
    assert payload["applied"]["experience_level"] == "Intermediate"
    assert isinstance(payload["boxes"], list)
    assert isinstance(payload["capability_notes"], list)


def test_analyze_uses_pipeline_targets(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from server.app.ml.pipeline import ImageAnalysisResult
    from server.app.routers import analyze_image as analyze_image_router

    class DummyPipeline:
        def predict_image(self, *_args, **_kwargs) -> ImageAnalysisResult:
            return ImageAnalysisResult(
                predictions=[Prediction(issue_id="stringing", confidence=0.91)],
                boxes=[
                    BoundingBox(
                        issue_id="stringing",
                        confidence=0.91,
                        x=0.1,
                        y=0.2,
                        width=0.3,
                        height=0.4,
                    )
                ],
                heatmap="data:image/svg+xml;base64,ZmFrZQ==",
                parameter_targets={
                    "nozzle_temp": 205.0,
                    "bed_temp": 60.0,
                    "fan_speed": 80.0,
                },
                recommendations=["Test recommendation"],
                capability_notes=["Test capability"],
            )

    monkeypatch.setattr(analyze_image_router, "_PIPELINE", DummyPipeline())

    data, files = _multipart_payload({"machine_id": "bambu_p1p", "experience": "Intermediate"})
    response = client.post("/api/analyze", data=data, files=files)
    assert response.status_code == 200
    payload = response.json()

    assert payload["parameter_targets"]["nozzle_temp"] == 205.0
    assert payload["recommendations"][0] == "Test recommendation"
    assert payload["heatmap"].startswith("data:image/svg+xml;base64,")


def test_analyze_rejects_large_images(client: TestClient) -> None:
    big_content = b"x" * (settings.MAX_UPLOAD_BYTES + 1)
    data = {"meta": json.dumps({"machine_id": "bambu_p1p", "experience": "Advanced"})}
    files = {"image": ("large.jpg", big_content, "image/jpeg")}
    response = client.post("/api/analyze", data=data, files=files)
    assert response.status_code == 413
