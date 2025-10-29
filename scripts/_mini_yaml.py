"""Minimal YAML loader for the project seeds.

This loader supports the subset of YAML used by the seed files so the
build scripts work in offline environments without PyYAML.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Tuple


@dataclass
class _Line:
    indent: int
    content: str


def _iter_lines(text: str) -> Iterable[_Line]:
    for raw in text.splitlines():
        stripped = raw.strip()
        if not stripped or stripped.startswith("#"):
            continue
        indent = len(raw) - len(raw.lstrip(" "))
        if stripped.startswith("#"):
            continue
        # remove trailing comments keeping inline braces
        hash_index = stripped.find(" #")
        if hash_index != -1:
            stripped = stripped[:hash_index].rstrip()
        yield _Line(indent=indent, content=stripped)


def _parse_value(token: str) -> Any:
    token = token.strip()
    if token == "":
        return None
    if token.lower() == "true":
        return True
    if token.lower() == "false":
        return False
    if token.lower() in {"null", "none"}:
        return None
    if token[0:1] in {"'", '"'} and token[-1:] == token[0]:
        return token[1:-1]
    # inline list
    if token.startswith("[") and token.endswith("]"):
        inner = token[1:-1].strip()
        if not inner:
            return []
        return [_parse_value(part) for part in _split_items(inner)]
    # inline map
    if token.startswith("{") and token.endswith("}"):
        inner = token[1:-1].strip()
        result = {}
        if not inner:
            return result
        for item in _split_items(inner):
            key, value = _split_pair(item)
            result[key] = _parse_value(value)
        return result
    # numeric handling
    try:
        if "." in token:
            return float(token)
        return int(token)
    except ValueError:
        return token


def _split_items(text: str) -> Iterable[str]:
    items = []
    current = []
    depth = 0
    quote: str | None = None
    escape = False
    for ch in text:
        if quote:
            current.append(ch)
            if escape:
                escape = False
                continue
            if ch == "\\":
                escape = True
                continue
            if ch == quote:
                quote = None
            continue
        if ch in {'"', "'"}:
            quote = ch
            current.append(ch)
            continue
        if ch in "[{":
            depth += 1
            current.append(ch)
            continue
        if ch in "]}":
            depth -= 1
            current.append(ch)
            continue
        if ch == "," and depth == 0:
            items.append("".join(current).strip())
            current = []
            continue
        current.append(ch)
    if current:
        items.append("".join(current).strip())
    return [item for item in items if item]


def _split_pair(item: str) -> Tuple[str, str]:
    if ":" not in item:
        raise ValueError(f"Invalid mapping token: {item}")
    key, value = item.split(":", 1)
    return key.strip().strip('"').strip("'"), value.strip()


def _parse_block(lines: Iterable[_Line], start: int, indent: int) -> Tuple[Any, int]:
    entries = list(lines)
    result: dict[str, Any] = {}
    i = start
    while i < len(entries):
        line = entries[i]
        if line.indent < indent:
            break
        if line.indent > indent:
            raise ValueError(f"Unexpected indentation at line: {line.content}")
        if line.content.startswith("- "):
            raise ValueError("Unexpected list item without key")
        key, value = _split_pair(line.content) if ":" in line.content else (line.content, "")
        key = key.strip()
        if value == "":
            # Determine if the block is a list or dict by peeking ahead
            sub_start = i + 1
            while sub_start < len(entries) and entries[sub_start].indent <= indent:
                if entries[sub_start].indent == indent:
                    break
                sub_start += 1
            j = i + 1
            # peek next meaningful line
            while j < len(entries) and entries[j].indent <= indent:
                j += 1
            next_line = entries[i + 1] if i + 1 < len(entries) else None
            if next_line and next_line.content.startswith("- ") and next_line.indent > indent:
                value_obj, new_index = _parse_list(entries, i + 1, indent + 2)
            else:
                value_obj, new_index = _parse_block(entries, i + 1, indent + 2)
            result[key] = value_obj
            i = new_index
        else:
            result[key] = _parse_value(value)
            i += 1
    return result, i


def _parse_list(entries: list[_Line], start: int, indent: int) -> Tuple[list[Any], int]:
    items: list[Any] = []
    i = start
    while i < len(entries):
        line = entries[i]
        if line.indent < indent:
            break
        if not line.content.startswith("- "):
            break
        token = line.content[2:].strip()
        if token == "":
            # nested block item
            value, new_index = _parse_block(entries, i + 1, indent + 2)
            items.append(value)
            i = new_index
            continue
        if token.startswith("{") and token.endswith("}"):
            value = _parse_value(token)
            items.append(value)
            i += 1
            continue
        if token.startswith("[") and token.endswith("]"):
            items.append(_parse_value(token))
            i += 1
            continue
        # simple scalar
        items.append(_parse_value(token))
        i += 1
    return items, i


def safe_load(stream: Any) -> Any:
    text = stream.read() if hasattr(stream, "read") else str(stream)
    lines = list(_iter_lines(text))
    if not lines:
        return {}
    result, index = _parse_block(lines, 0, lines[0].indent)
    if index < len(lines):
        # The first block may not cover everything if indentation resets.
        extra, _ = _parse_block(lines, index, lines[index].indent)
        result.update(extra)
    return result

