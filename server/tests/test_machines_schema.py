from __future__ import annotations

import json
from pathlib import Path

from scripts._schema import validate

ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = ROOT / 'config' / 'machines' / '_schema.json'
MACHINES_DIR = ROOT / 'config' / 'machines'


def test_machine_profiles_match_schema() -> None:
    schema = json.loads(SCHEMA_PATH.read_text())
    for path in MACHINES_DIR.glob('*.json'):
        if path.name.startswith('_'):
            continue
        data = json.loads(path.read_text())
        validate(data, schema)
