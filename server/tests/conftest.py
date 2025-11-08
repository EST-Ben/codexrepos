from __future__ import annotations

import os
import sys
from pathlib import Path

import importlib

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _load_app():
    module = importlib.import_module("server.main")
    return module.app


@pytest.fixture()
def client() -> TestClient:
    app = _load_app()
    return TestClient(app)
