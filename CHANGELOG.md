# Changelog

## Unreleased

- Mounted all FastAPI routers under `/api`, added the `/health` endpoint, and enabled development
  CORS so LAN clients can reach the backend.
- Defaulted `UPLOAD_DIR` to a Windows-friendly path (with automatic directory creation) and wired the
  diagnostics endpoints to the stub pipeline and rules engine shims.
- Unified the Expo client’s API base resolution, ensured multipart uploads send JSON metadata, and
  hardened the Analyze From Photo screen.
- Added Windows launcher scripts (`serve_api.*`, `serve_app.*`) that clear caches, set environment
  variables, and start the dev servers in LAN mode.
- Documented the local development workflow in `LOCAL_DEV.md`, refreshed the README quick start, and
  ignored Node lockfiles across the repo.

