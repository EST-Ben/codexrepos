from __future__ import annotations

from server.app.routers.export import SLICER_KEY_MAP


def test_export_key_map_contains_expected_keys() -> None:
    for slicer, mapping in SLICER_KEY_MAP.items():
        assert 'nozzle_temp' in mapping
        assert isinstance(mapping['nozzle_temp'], str)
