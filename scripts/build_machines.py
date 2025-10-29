import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

try:  # pragma: no cover - optional dependency
    import yaml  # type: ignore
except ImportError:  # pragma: no cover - offline fallback
    from scripts import _mini_yaml as yaml  # type: ignore

try:  # pragma: no cover - optional dependency
    from jsonschema import validate  # type: ignore
except ImportError:  # pragma: no cover - offline fallback
    from scripts._schema import validate

SCHEMA_PATH = os.path.join(ROOT, "config", "machines", "_schema.json")
OUT_DIR = os.path.join(ROOT, "config", "machines")
SEEDS = os.path.join(ROOT, "config", "seeds")

def main():
    with open(SCHEMA_PATH) as f: schema = json.load(f)
    with open(os.path.join(SEEDS, "families.yaml")) as f: families = yaml.safe_load(f)
    with open(os.path.join(SEEDS, "registry.yaml")) as f: registry = yaml.safe_load(f)

    os.makedirs(OUT_DIR, exist_ok=True)
    count = 0
    for entry in registry["machines"]:
        fam = families[entry["family"]]
        data = merge_family(entry, fam)
        validate(instance=data, schema=schema)
        out = os.path.join(OUT_DIR, f"{data['id']}.json")
        with open(out, "w") as w: json.dump(data, w, indent=2)
        count += 1
    print(f"Generated {count} machine profiles into {OUT_DIR}")

def merge_family(entry, fam):
    # Apply family defaults, then per-model overrides from entry
    data = {**fam["defaults"]}
    data.update({
        "id": entry["id"],
        "brand": fam["brand"],
        "model": entry["model"],
        "type": fam["type"]
    })
    # Deep-merge select dict fields
    for k in ["material_presets","supports","safe_speed_ranges"]:
        merged = {**fam.get(k, {})}
        merged.update(entry.get(k, {}))
        data[k] = merged
    # Copy simple fields if present
    for k in [
        "motion_system",
        "enclosed",
        "build_volume_mm",
        "workarea_mm",
        "nozzle_diameters",
        "max_nozzle_temp_c",
        "max_bed_temp_c",
        "spindle_rpm_range",
        "max_feed_mm_min",
        "rigidity_class",
        "capabilities",
        "aliases",
        "notes",
    ]:
        value = entry.get(k, data.get(k))
        if value is not None:
            data[k] = value
        elif k in data:
            data.pop(k, None)
    return data

if __name__ == "__main__":
    main()
