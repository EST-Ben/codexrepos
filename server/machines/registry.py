"""Load machine profiles and expose lookup helpers."""
from __future__ import annotations

import json
from difflib import get_close_matches
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

MachineProfile = Dict[str, object]
MachineSummary = Dict[str, object]

ROOT = Path(__file__).resolve().parents[2]
MACHINES_DIR = ROOT / "config" / "machines"

_by_id: Dict[str, MachineProfile] = {}
_by_id_lower: Dict[str, MachineProfile] = {}
_by_alias_lower: Dict[str, MachineProfile] = {}
_fuzzy_keys: List[str] = []
_fuzzy_map: Dict[str, MachineProfile] = {}


def _load_profiles() -> Dict[str, MachineProfile]:
    profiles: Dict[str, MachineProfile] = {}
    for path in MACHINES_DIR.glob("*.json"):
        if path.name.startswith("_"):
            continue
        data: MachineProfile = json.loads(path.read_text())
        identifier = str(data["id"]).lower()
        profiles[identifier] = data
    return profiles


def _build_indexes(profiles: Dict[str, MachineProfile]) -> None:
    global _by_id, _by_id_lower, _by_alias_lower, _fuzzy_keys, _fuzzy_map
    _by_id = {profile["id"]: profile for profile in profiles.values()}
    _by_id_lower = {key.lower(): value for key, value in _by_id.items()}
    _by_alias_lower = {}
    _fuzzy_map = {}
    _fuzzy_keys = []
    for profile in _by_id.values():
        identifier = str(profile["id"]).lower()
        _fuzzy_keys.append(identifier)
        _fuzzy_map[identifier] = profile
        aliases = profile.get("aliases") or []
        if isinstance(aliases, list):
            for alias in aliases:
                alias_key = str(alias).lower()
                _by_alias_lower[alias_key] = profile
                _fuzzy_keys.append(alias_key)
                _fuzzy_map[alias_key] = profile
        brand = str(profile.get("brand", "")).strip()
        model = str(profile.get("model", "")).strip()
        if brand or model:
            combo = f"{brand} {model}".strip().lower()
            if combo:
                _fuzzy_keys.append(combo)
                _fuzzy_map[combo] = profile
            if model:
                _fuzzy_keys.append(model.lower())
                _fuzzy_map[model.lower()] = profile


def reload_registry() -> None:
    """Reload machine metadata from disk."""
    profiles = _load_profiles()
    _build_indexes(profiles)


def all_machine_profiles() -> Iterable[MachineProfile]:
    return _by_id.values()


def machine_summaries() -> List[MachineSummary]:
    summaries: List[MachineSummary] = []
    for profile in _by_id.values():
        summaries.append(
            {
                "id": profile.get("id"),
                "brand": profile.get("brand"),
                "model": profile.get("model"),
                "aliases": profile.get("aliases", []),
            }
        )
    summaries.sort(key=lambda item: (str(item.get("brand") or "").lower(), str(item.get("model") or "")))
    return summaries


def resolve_machine(name_or_id: str) -> MachineProfile:
    if not name_or_id:
        raise KeyError("Machine identifier cannot be empty")
    token = name_or_id.strip().lower()
    direct = _by_id_lower.get(token)
    if direct:
        return direct
    alias = _by_alias_lower.get(token)
    if alias:
        return alias
    matches = get_close_matches(token, _fuzzy_keys, n=1, cutoff=0.6)
    if matches:
        match = matches[0]
        resolved = _fuzzy_map.get(match)
        if resolved:
            return resolved
    raise KeyError(f"Machine '{name_or_id}' was not found in the registry")


# Initial load during module import.
reload_registry()

