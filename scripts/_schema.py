"""Tiny jsonschema validator subset for offline use."""
from __future__ import annotations

from typing import Any, Dict


class ValidationError(Exception):
    pass


def _assert(condition: bool, message: str) -> None:
    if not condition:
        raise ValidationError(message)


def _validate(instance: Any, schema: Dict[str, Any], path: str) -> None:
    schema_type = schema.get("type")
    if schema_type == "object" or (schema_type is None and "properties" in schema):
        _assert(isinstance(instance, dict), f"{path or '<root>'} must be an object")
        required = schema.get("required", [])
        for field in required:
            _assert(field in instance, f"Missing required field {path + '.' if path else ''}{field}")
        properties = schema.get("properties", {})
        for key, value in instance.items():
            if key in properties:
                _validate(value, properties[key], f"{path}.{key}" if path else key)
        if not schema.get("additionalProperties", True):
            for key in instance:
                _assert(key in properties, f"Unexpected field {path}.{key}" if path else key)
        return
    if schema_type == "array":
        _assert(isinstance(instance, list), f"{path} must be an array")
        min_items = schema.get("minItems")
        max_items = schema.get("maxItems")
        if min_items is not None:
            _assert(len(instance) >= min_items, f"{path} must have at least {min_items} items")
        if max_items is not None:
            _assert(len(instance) <= max_items, f"{path} must have at most {max_items} items")
        item_schema = schema.get("items")
        if item_schema:
            for idx, item in enumerate(instance):
                _validate(item, item_schema, f"{path}[{idx}]")
        return
    if schema_type == "boolean":
        _assert(isinstance(instance, bool), f"{path} must be a boolean")
        return
    if schema_type == "number":
        _assert(isinstance(instance, (int, float)), f"{path} must be a number")
        return
    if schema_type == "string":
        _assert(isinstance(instance, str), f"{path} must be a string")
        if "enum" in schema:
            _assert(instance in schema["enum"], f"{path} must be one of {schema['enum']}")
        return
    if "enum" in schema:
        _assert(instance in schema["enum"], f"{path} must be one of {schema['enum']}")
        return
    # Fallback: accept any type


def validate(instance: Any, schema: Dict[str, Any]) -> None:
    _validate(instance, schema, "")


__all__ = ["validate", "ValidationError"]
