# Server

## AI Analyze API

The `/api/analyze` endpoint accepts a multipart form upload containing:

- `image`: the captured diagnostic photo (`image/jpeg` or `image/png`).
- `meta`: JSON string matching the `AnalyzeRequestMeta` schema defined in `server/models/api.py`.

At runtime the server streams the image to `UPLOAD_DIR`, runs inference (stub or torch depending on
`INFERENCE_MODE`), applies machine-aware rules, and returns an `AnalyzeResponse`. The response contains
model predictions, explanations sourced from `config/taxonomy.json`, suggestions clamped to machine limits,
and a slicer profile diff ready for export.

All payloads are validated via Pydantic models and mirrored by the shared TypeScript interfaces in `types/common.ts`.
