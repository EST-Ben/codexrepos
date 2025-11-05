#!/usr/bin/env bash
set -euo pipefail
python - <<'PY'
from server.main import app
from fastapi.openapi.utils import get_openapi
import json
import pathlib
openapi = get_openapi(title=app.title, version=getattr(app, "version", "0.0.0") or "0.0.0", routes=app.routes)
pathlib.Path("openapi.json").write_text(json.dumps(openapi, indent=2))
print("Wrote openapi.json")
PY
npx --yes openapi-typescript openapi.json -o types/generated.ts
echo "Updated types/generated.ts"
