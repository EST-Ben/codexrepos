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

## Developer tooling

Install the shared hooks locally so formatting and linting run before each commit:

```bash
pip install pre-commit && pre-commit install
```

## Production deployment

When you are ready to ship, follow the detailed checklist in [`DEPLOYMENT.md`](DEPLOYMENT.md). It covers
containerizing the FastAPI service, exporting the Expo web bundle, publishing mobile binaries with EAS,
and wiring up the GitHub Actions workflows that automate releases from version tags.

## Generating machine profiles

Run `python scripts/build_machines.py` after editing the seed files under
`config/seeds/` to regenerate the JSON machine profiles.

## Repository layout

This repository includes all assets discussed during the staged scaffold:

- `app/` – Expo React Native client with onboarding, results, and Jest tests.
- `server/` – FastAPI backend, machine registry, rules engine, and API tests.
- `config/machines/` – Generated machine profiles plus `_schema.json`.
- `config/seeds/` – Editable YAML seeds for families and registry entries.
- `config/slicer_adapters/` – TypeScript maps for Cura, PrusaSlicer, Bambu Studio, and OrcaSlicer.
- `scripts/` – Build, validation, and mock inference helpers (with offline fallbacks).
- `types/` – Shared TypeScript contracts for machine profiles.

## AI Photo Diagnostics

The AI photo workflow is enabled end-to-end in this repository. Configure the
following environment variables before starting the backend:

- `UPLOAD_DIR` – directory where uploaded analysis photos are stored.
  Defaults to `C:\tmp\uploads` on Windows or `<temp>/uploads` elsewhere and is created automatically if missing.
- `MODEL_PATH` – path to a trained model checkpoint (e.g.,
  `./server/models/best.pt`). When running in stub mode the file is not
  required.
- `INFERENCE_MODE` – choose between `"stub"` for the deterministic mock model
  or `"torch"` to load the checkpoint referenced by `MODEL_PATH`.

### Running the stack

The provided scripts take care of environment variables and cache clearing, but you can still launch
everything manually:

```bash
# Backend (from repo root)
export UPLOAD_DIR=$(mktemp -d)/uploads  # or choose a persistent path
python -m uvicorn server.main:app --host 0.0.0.0 --port 8000 --reload

# Expo client (from app/)
export EXPO_PUBLIC_API_URL="http://<LAN-IP>:8000"
npm install
npx expo start --lan -c
```

The client sends captured photos and metadata to `/api/analyze` as multipart form-data. Results include
predictions, machine-aware suggestions, and slicer diffs that can be exported via the provided
buttons.

To replace the stub model, train your detector and export the checkpoint to the path specified by
`MODEL_PATH`, then set `INFERENCE_MODE=torch`. Uploaded files will continue to be written to
`UPLOAD_DIR`, which you can mount elsewhere for long-term storage if desired.

Safety clamps in the rules engine ensure nozzle temperatures, bed temperatures,
travel speeds, acceleration, and CNC spindle/feed parameters never exceed the
selected machine’s declared capabilities. The operator’s experience level
further widens or narrows the suggested deltas so beginners receive conservative
guidance while advanced users unlock broader tuning ranges.

## How to add a new machine

1. Add or update the appropriate family entry in `config/seeds/families.yaml`
   if the machine shares defaults with existing profiles.
2. Append the machine definition to `config/seeds/registry.yaml` under the
   relevant manufacturer block. You can override any defaults directly in the
   registry entry.
3. Regenerate the machine JSON by running `python scripts/build_machines.py`.
4. Optionally run `python scripts/validate_machines.py` or the PyTest suite to
   ensure the new profile validates against the schema.
5. Commit the updated seeds and generated JSON files.
