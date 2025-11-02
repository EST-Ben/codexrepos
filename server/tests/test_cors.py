from __future__ import annotations

import importlib
import sys

from fastapi.middleware.cors import CORSMiddleware


def _reload_server_modules():
    for name in list(sys.modules):
        if name.startswith("server") and not name.startswith("server.tests"):
            sys.modules.pop(name)


def test_production_cors_uses_allowlist(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://app.example.com,https://console.example.com")

    _reload_server_modules()
    main = importlib.import_module("server.main")

    cors_layers = [m for m in main.app.user_middleware if m.cls is CORSMiddleware]
    assert cors_layers, "CORS middleware should be registered"
    cors = cors_layers[0]
    assert cors.options["allow_origins"] == [
        "https://app.example.com",
        "https://console.example.com",
    ]

    # Reset modules to keep subsequent tests in development mode
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)
    _reload_server_modules()
    importlib.import_module("server.main")


def test_development_cors_allows_any_origin(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)

    _reload_server_modules()
    main = importlib.import_module("server.main")

    cors_layers = [m for m in main.app.user_middleware if m.cls is CORSMiddleware]
    cors = cors_layers[0]
    assert cors.options["allow_origins"] == ["*"]
