# Machine Registry Scaffold

This project bootstraps a React Native (Expo) client, FastAPI backend, and
data-driven machine registry.

The Expo app provides an onboarding flow where operators can multi-select their
machines, choose an experience level, and copy capability-aware tuning diffs for
popular slicers. The FastAPI service loads generated machine profiles, exposes
lookup and export endpoints, and ships with a deterministic diagnostics stub so
the pipeline can be demoed without a trained model.

## Quick start

1. **Install dependencies**
   - Python 3.11 (Miniforge recommended on Windows)
   - Node.js 18 LTS and Yarn/NPM
2. **Start the FastAPI backend**
   ```powershell
   # From the repo root
   ./serve_api.ps1      # PowerShell
   #   or
   serve_api.bat        # Command Prompt
   ```
3. **Configure environment variables**
   - Copy `.env.example` to `.env.local` (or export variables in your shell) and update values as needed.
   - For production builds set `ENVIRONMENT=production` and provide a comma-separated `ALLOWED_ORIGINS` list.

4. **Start the Expo client in LAN mode**
   ```powershell
   # Replace <LAN-IP> with your computer's LAN address
   ./serve_app.ps1 -ApiUrl "http://<LAN-IP>:8000"
   #   or (CMD)
   set API_URL=http://<LAN-IP>:8000
   serve_app.bat
   ```
   Pass `-DevClient` (or `--dev-client` on Windows CMD) if you're targeting an EAS development build
   instead of Expo Go. The launchers now refuse to run if the placeholder `<LAN-IP>` string is left in
   place, preventing the "Failed to parse URL" Expo error – swap in your actual LAN IP or
   `http://localhost:8000` for local web testing.
5. Scan the QR code with the Expo Go app, ensure `/api/machines` loads in the UI, then capture or pick
   a photo to test `/api/analyze`.

See [`LOCAL_DEV.md`](LOCAL_DEV.md) for the full Windows + Miniforge walkthrough, including curl smoke
tests and firewall notes.

## Managing machines

1. Create or update a machine definition under `config/machines/` using the `_schema.json` contract as
   a guide. Validate your edits with `npm run scripts:validate-machines` from the repo root.
2. The Fastify service exposes summaries at `GET /api/machines`; the Expo client now fetches them via
   `useMachineRegistry()`, so new entries appear automatically in onboarding and results.
3. No manual edits to app constants are required—select labels are derived from the registry data.

## Photo analysis workflow

- The “Add photo” buttons (native camera and web picker) share a single handler that streams images to
  `/api/analyze-image` with multipart form data.
- Progress, errors, and the latest inference summary surface inline; verify `EXPO_PUBLIC_API_BASE` (or
  `EXPO_PUBLIC_API_BASE_URL`) points at your backend so uploads reach the Fastify server.

## Developer tooling

Install the shared hooks locally so formatting and linting run before each commit:

```bash
pip install pre-commit && pre-commit install
```

## Production deployment

## Running the App

### Requirements
- Node.js >= 20 and npm
- iOS: macOS with Xcode + simulators
- Android: Android Studio + emulator or device (USB debugging)
- Web: modern browser
- (Optional) Expo Go on your device for quick runs

### 1) Install dependencies
```bash
# App (Expo)
cd app && npm ci && cd ..

# Backend (Node/TS)
cd server-node && npm ci && cd ..
```

### 2) Start the backend (Node/TS)
```bash
cd server-node
# dev with TS + fast refresh
npm run dev
# server listens on http://localhost:8000
```

You can set API base for the app via environment:

```bash
# in repo root
echo 'EXPO_PUBLIC_API_BASE=http://localhost:8000' > app/.env
```

### 3) Start the app (Expo)

From repo root:

```bash
cd app
# start Metro
npx expo start
```

Run on iOS (Simulator)

On macOS: press `i` in the Expo terminal, or run:

```bash
npx expo run:ios
```

Run on Android (Emulator/Device)

Start an emulator from Android Studio, then:

```bash
npx expo run:android
```

Or, if Metro is running, press `a` in the Expo terminal.

Run on Web

```bash
npx expo start --web
```

### 4) Debugging & Doctor

On-device HUD: long-press the 🛠 floating button to open logs; tap Clear to reset.

Network logs: all fetch calls are logged with status + latency.

Error boundary: uncaught UI errors render a crash screen with **Try again**.

Doctor: run end-to-end checks:

```bash
npm run doctor
```

Server diagnostics: curl `http://localhost:8000/_debug` for live rate-limit windows, memory usage, and request counters. `/health` remains the lightweight liveness probe consumed by CI and the Docker healthcheck.

### 5) Notes

The old Python backend under `server/` is deprecated. All endpoints are now served by `server-node/` with matching routes.

Configure CORS via `ALLOWED_ORIGINS` and rate limits via `RATE_LIMIT_*` in `.env`.

See [`MIGRATION_NOTES.md`](MIGRATION_NOTES.md) for a summary of parity between the FastAPI and Fastify stacks and forward-looking follow-ups.

## Repository layout

- `app/` – Expo React Native client with onboarding, results, and Jest tests.
- `server-node/` – Fastify + TypeScript backend (replacement for the legacy FastAPI service).
- `server/` – Deprecated FastAPI backend retained temporarily for reference only.
- `config/` – Machine registry data, slicer adapters, and taxonomy assets shared by both stacks.
- `types/` – Shared TypeScript contracts consumed by the app and server-node backend.
- `scripts/` – Automation helpers including the new `doctor` CLI.

## Developer tooling

Install the shared hooks locally so formatting and linting run before each commit:

```bash
pip install pre-commit && pre-commit install
```

(Backend linting is now handled by ESLint/TypeScript in CI; the Python hook remains available for legacy scripts.)

## Production deployment

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the full deployment checklist. The release workflow builds the Node backend container, runs a smoke test against `/health`, publishes to GHCR, exports the Expo web bundle, and optionally pushes mobile binaries via EAS.

## TypeScript automation scripts

All utility CLIs now live in TypeScript. Build them once:

```bash
npm run build:scripts
```

Then invoke the generated JavaScript under `dist-scripts/` (or use the accompanying npm scripts). Examples:

| Task | macOS/Linux | Windows PowerShell |
| --- | --- | --- |
| Generate machine profiles | `npm run scripts:build-machines` | `node .\dist-scripts\scripts\build_machines.js` |
| Validate profiles | `npm run scripts:validate-machines` | `node .\dist-scripts\scripts\validate_machines.js` |
| Demo analyzer upload | `npm run scripts:demo-analyze` | `node .\dist-scripts\scripts\demo_analyze.js` |
| Generate SDK types | `npm run scripts:generate-sdk` | `node .\dist-scripts\scripts\generate_sdk.js` |
| Release helper | `npm run scripts:release` | `node .\dist-scripts\scripts\release.js` |
| Mock inference stub | `node dist-scripts/scripts/mock_inference.js bambu_p1s --issues stringing` | `node .\dist-scripts\scripts\mock_inference.js bambu_p1s --issues stringing` |
| Sync shared types | `node dist-scripts/scripts/sync-types.js` | `node .\dist-scripts\scripts\sync-types.js` |

Optional tools such as Docker, Python, Expo CLI, and `openapi-typescript` are detected automatically; if they're missing, the scripts emit a warning with follow-up steps instead of crashing.
