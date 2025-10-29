import json, os, sys
from jsonschema import validate

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
