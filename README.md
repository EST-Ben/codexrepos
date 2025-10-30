# Machine Registry Scaffold

This project bootstraps a React Native (Expo) client, FastAPI backend, and
data-driven machine registry.

The Expo app provides an onboarding flow where operators can multi-select their
machines, choose an experience level, and copy capability-aware tuning diffs for
popular slicers. The FastAPI service loads generated machine profiles, exposes
lookup and export endpoints, and ships with a deterministic diagnostics stub so
the pipeline can be demoed without a trained model.

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
  Defaults to `/tmp/uploads` and is created automatically if missing.
- `MODEL_PATH` – path to a trained model checkpoint (e.g.,
  `./server/models/best.pt`). When running in stub mode the file is not
  required.
- `INFERENCE_MODE` – choose between `"stub"` for the deterministic mock model
  or `"torch"` to load the checkpoint referenced by `MODEL_PATH`.

### Running the stack

1. Install backend dependencies (FastAPI, Pydantic, httpx, etc.) and start the
   API server:
   ```bash
   uvicorn server.main:app --reload
   ```
2. Install Expo dependencies inside `app/` and launch the client:
   ```bash
   cd app
   npm install
   npm run start
   ```
3. The client sends captured photos and metadata to `/api/analyze` as
   multipart form-data. Results include predictions, machine-aware suggestions,
   and slicer diffs that can be exported via the provided buttons.

To replace the stub model, train your detector and export the checkpoint to the
path specified by `MODEL_PATH`, then set `INFERENCE_MODE=torch`. Uploaded files
will continue to be written to `UPLOAD_DIR`, which you can mount elsewhere for
long-term storage if desired.

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
