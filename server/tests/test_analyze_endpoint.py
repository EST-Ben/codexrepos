from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from server.models.api import AnalyzeResponse, Prediction


def _multipart_payload(meta: dict) -> tuple[dict, dict]:
    files = {"image": ("test.jpg", b"data", "image/jpeg")}
    data = {"meta": json.dumps(meta)}
    return data, files


def test_analyze_endpoint_returns_capability_notes(client: TestClient) -> None:
    data, files = _multipart_payload(
        {
            "machine_id": "bambu_p1p",
            "experience": "Intermediate",
            "material": "PLA",
        }
    )
    response = client.post("/api/analyze", data=data, files=files)
    assert response.status_code == 200
    payload = response.json()
    assert payload["image_id"]
    assert isinstance(payload["suggestions"], list)
    assert payload["suggestions"][0]["changes"]
    assert payload["slicer_profile_diff"]["slicer"] == "generic"


def test_analyze_low_confidence_triggers_generic(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from server import main

    def fake_predict(_path):
        return ([Prediction(issue_id="stringing", confidence=0.3)], [{"issue_id": "stringing", "cues": []}])

    monkeypatch.setattr(main.INFERENCE_ENGINE, "predict", fake_predict)
    data, files = _multipart_payload(
        {
            "machine_id": "bambu_p1p",
            "experience": "Beginner",
        }
    )
    response = client.post("/api/analyze", data=data, files=files)
    assert response.status_code == 200
    payload = response.json()
    assert payload["low_confidence"] is True
    assert payload["suggestions"][0]["issue_id"] == "general_tuning"
    assert len(payload["suggestions"]) == 1
    assert all(change["param"] in {"nozzle_temp", "bed_temp"} for change in payload["suggestions"][0]["changes"])


def test_analyze_response_matches_contract(client: TestClient) -> None:
    data, files = _multipart_payload(
        {
            "machine_id": "bambu_p1p",
            "experience": "Intermediate",
            "material": "PLA",
        }
    )
    response = client.post("/api/analyze", data=data, files=files)
    assert response.status_code == 200
    payload = response.json()
    model = AnalyzeResponse.model_validate(payload)
    assert model.image_id
    assert model.version
    assert model.suggestions


def test_analyze_rejects_large_images(client: TestClient) -> None:
    big_content = b"x" * (12 * 1024 * 1024 + 1)
    data = {"meta": json.dumps({"machine_id": "bambu_p1p", "experience": "Advanced"})}
    files = {"image": ("large.jpg", big_content, "image/jpeg")}
    response = client.post("/api/analyze", data=data, files=files)
    assert response.status_code == 413
