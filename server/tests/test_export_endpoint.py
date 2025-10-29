from __future__ import annotations

from fastapi.testclient import TestClient


def test_export_profile_endpoint(client: TestClient) -> None:
    response = client.post(
        '/api/export-profile',
        json={
            'slicer': 'cura',
            'changes': {'nozzle_temp': 215, 'bed_temp': 65},
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload['slicer'] == 'cura'
    assert 'material_print_temperature' in payload['diff']
