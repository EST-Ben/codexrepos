from __future__ import annotations

from fastapi.testclient import TestClient


def test_analyze_endpoint_returns_capability_notes(client: TestClient) -> None:
    response = client.post(
        '/api/analyze',
        json={
            'machine': 'bambu_p1p',
            'experience': 'Intermediate',
            'material': 'PLA',
            'issues': ['ringing'],
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload['machine']['id'] == 'bambu_p1p'
    assert any('Motion system' in note for note in payload['capability_notes'])
    assert payload['applied']['experience_level'] == 'Intermediate'
