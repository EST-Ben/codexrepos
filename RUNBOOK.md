# Runbook

## Fresh Install
1. Install Node.js 18+ and npm (or install `yarn` if preferred).
2. Install Python 3.10+ and Miniforge/conda for isolated environments.
3. Create and activate the backend env: `conda create -n diagnostics python=3.10 && conda activate diagnostics`.
4. Install backend deps: `pip install -r server/requirements.txt`.
5. From `app/`, install frontend deps: `npm install` (or `yarn install`).
6. For iOS native builds (macOS only), run `npx pod-install` inside `app/ios`.

## Running the Backend
1. From repo root, activate the env (`conda activate diagnostics`).
2. Set required vars (examples below) and start: `python -m uvicorn server.main:app --reload --host 0.0.0.0 --port 8000`.

## Running the Frontend
- **Web:** `cd app && npx expo start --web -c`.
- **Native (Expo Go / Dev Client):** `cd app && npx expo start --lan -c` (use `--dev-client` when launching an EAS dev build).

## Environment Variables
- `EXPO_PUBLIC_API_URL` (or `expo.extra.API_URL` in app.json) — defaults to `http://localhost:8000`.
- Backend honors `INFERENCE_MODE` (`stub` | `torch` | `onnx`), `UPLOAD_DIR`, and optional `MODEL_PATH`.

## Known Limitations
- Torch/ONNX inference requires installing optional dependencies not bundled by default.
- Jest and native builds may need platform-specific tooling that is unavailable in this containerized environment.
- Mobile camera capture requires physical device permissions; simulators may not support full camera workflows.

## Next Steps
- Integrate CI runners with the optional ML dependencies for full test coverage.
- Add automated end-to-end tests for the photo workflow once device farms are available.
- Monitor performance when swapping in real models and capture heuristics.
