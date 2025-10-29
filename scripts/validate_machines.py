import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

try:  # pragma: no cover - optional dependency
    from jsonschema import validate  # type: ignore
except ImportError:  # pragma: no cover - offline fallback
    from scripts._schema import validate

ROOT = os.path.dirname(os.path.dirname(__file__))
SCHEMA = json.load(open(os.path.join(ROOT,"config","machines","_schema.json")))
DIR = os.path.join(ROOT,"config","machines")

bad = 0
for fn in os.listdir(DIR):
    if not fn.endswith(".json") or fn.startswith("_"): continue
    obj = json.load(open(os.path.join(DIR,fn)))
    try:
        validate(obj, SCHEMA)
    except Exception as e:
        print("Invalid:", fn, e)
        bad += 1
print("OK" if bad==0 else f"{bad} invalid files")
