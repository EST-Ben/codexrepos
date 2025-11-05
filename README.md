# codexrepo Diagnostics Suite

A full-stack workflow for diagnosing print issues: the Expo client captures prints, the new Node.js/TypeScript backend serves the analysis APIs, and a shared machine registry keeps clamps and presets aligned.

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

### 5) Notes

The old Python backend under `server/` is deprecated. All endpoints are now served by `server-node/` with matching routes.

Configure CORS via `ALLOWED_ORIGINS` and rate limits via `RATE_LIMIT_*` in `.env`.

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

## Generating machine profiles

Run `python scripts/build_machines.py` after editing the seed files under `config/seeds/` to regenerate the JSON machine profiles. These assets are consumed by the Node backend at runtime.
