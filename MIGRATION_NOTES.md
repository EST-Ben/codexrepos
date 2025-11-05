# Backend migration notes

We replaced the legacy FastAPI implementation under `server/` with a Fastify + TypeScript service in `server-node/`. The Python stack is still present for reference, but all new development, CI, and deployment targets the Node service.

## Routing parity

| Endpoint | Status | Notes |
| --- | --- | --- |
| `GET /health` | ✅ | Returns uptime metadata and stub inference status. |
| `GET /_debug` | ✅ | New diagnostic endpoint with runtime stats and rate-limit window info. |
| `POST /api/analyze-image` | ✅ | Accepts multipart uploads and reuses the existing inference/rules logic ported to TypeScript. |
| `POST /api/analyze-json` | ✅ | Mirrors the legacy JSON analysis path. |
| `GET /api/machines` | ✅ | Loads registry data from `config/machines`. |
| `POST /api/export-profile` | ✅ | Generates slicer diffs using the same mapping tables. |

## Type sharing

OpenAPI schemas are generated from the Fastify + Zod validators and converted into TypeScript under `types/generated.ts`. The Expo app consumes these alongside the hand-authored domain models in `types/api.ts`.

## Debug & tooling

* `npm run doctor` now runs workspace-wide diagnostics, including port checks, type/lint/test runs, and a live `/health` probe against the built server.
* A floating Debugger HUD, network interceptor, and error boundary are wired into the Expo client for fast feedback.
* `scripts/generate_sdk.sh` compiles the server, emits `openapi.json`, and refreshes the generated types.

## Next steps

* Delete or archive the Python stack once no longer needed for reference.
* Wire production observability (metrics/log shipping) against the `/metrics` surface once introduced.
* Plan authentication/authorization for the new service before exposing it beyond trusted networks.
