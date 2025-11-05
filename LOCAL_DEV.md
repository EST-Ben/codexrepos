# Local Development (Windows + Miniforge)

These steps assume **Windows 11** with Node.js 20 LTS for Expo and the Node diagnostics backend. Miniforge
is still useful for running legacy Python tooling, but the default API now lives in `server-node/`.

> [!NOTE]
> The FastAPI backend under `server/` is deprecated. Stick to the Node.js service unless you are running
> historical tests or migrations. A short legacy appendix remains at the bottom of this document.

## 1. Install dependencies

```powershell
# From the repository root
npm --prefix server-node ci
npm --prefix app ci
```

## 2. Start the Node diagnostics server

Launch one of the provided scripts from the repository root:

```powershell
# PowerShell
./serve_api.ps1

# or Command Prompt
serve_api.bat
```

The scripts set `ENV`, `ALLOWED_ORIGINS`, and rate limit defaults before running
`npm --prefix server-node run dev`. The API binds to `http://0.0.0.0:8000` so devices on your LAN can reach it.
Adjust `.env` (or direct shell variables such as `ALLOWED_ORIGINS`, `RATE_LIMIT_REQUESTS`, `RATE_LIMIT_WINDOW_SECONDS`,
and `UPLOAD_MAX_MB`) as needed.

## 3. Start the Expo app in LAN mode (Expo Go)

The Expo launchers pin the API base URL via `EXPO_PUBLIC_API_BASE`. Use this path when testing with
**Expo Go** on a device that shares the same Wi-Fi network:

```powershell
# PowerShell
./serve_app.ps1 -ApiUrl "http://<YOUR-LAN-IP>:8000"

# or Command Prompt
set EXPO_PUBLIC_API_BASE=http://<YOUR-LAN-IP>:8000
serve_app.bat
```

The scripts start Metro in `--lan` mode so Expo Go resolves the same LAN IP for API calls. Scan the QR code
printed in the terminal to load the bundle.

## 3b. Start Expo for an EAS Development Build (optional)

If you maintain an Apple Developer account you can build a custom dev client so the iPad runs Metro
bundles without Expo Go. Use the EAS CLI from Windows and pass the new `--dev-client` flag to the
launcher so Metro starts in the correct mode:

```powershell
# Install and authenticate once
npm install -g eas-cli
eas login

# Configure the project (run from repo root)
Set-Location app
eas build:configure

# Kick off a development build for iOS
eas build -p ios --profile development

# Back at the repo root start Metro in dev-client mode
Set-Location ..
./serve_app.ps1 -ApiUrl "http://<YOUR-LAN-IP>:8000" -DevClient
# or Command Prompt
set API_URL=http://<YOUR-LAN-IP>:8000
serve_app.bat --dev-client
```

Install the generated dev build on the iPad from the EAS link, open it, and it will attach to Metro over
LAN. The app shares the same API base configuration as Expo Go.

## 4. Verify the API

Use the built-in `curl` on Windows (PowerShell or CMD) once the backend is running:

```powershell
# Basic health check
curl http://localhost:8000/health

# Machine catalog
curl http://localhost:8000/api/machines

# JSON diagnostics
curl -X POST http://localhost:8000/api/analyze-json `
  -H "Content-Type: application/json" `
  -d '{"machine":"bambu_a1","material":"pla","experience":"intermediate","issues":["stringing"]}'

# Multipart photo diagnostics (replace sample.jpg with your file)
curl -X POST http://localhost:8000/api/analyze `
  -F "image=@sample.jpg;type=image/jpeg" `
  -F "meta={\"machine_id\":\"bambu_a1\",\"experience\":\"intermediate\",\"material\":\"pla\"};type=application/json"
```

Successful responses return JSON payloads with deterministic stubbed predictions plus safety clamps
for the requested machine.

## 5. Allow LAN traffic through Windows Firewall (one-time)

If the Expo app cannot reach the API, add inbound firewall rules for the Uvicorn and Expo dev ports
after the first launch prompt:

```powershell
netsh advfirewall firewall add rule name="Diagnostics API" dir=in action=allow protocol=TCP localport=8000
netsh advfirewall firewall add rule name="Expo Dev Server" dir=in action=allow protocol=TCP localport=8081
netsh advfirewall firewall add rule name="Expo Tunnel" dir=in action=allow protocol=UDP localport=19000
```

You only need to run these commands once per machine. Confirm the Expo Go client can load the
machines list and run a sample photo analysis afterwards.

## 6. Troubleshooting tips

- If Expo reports a Metro bundler cache error, stop the process and re-run the launcher – the `-c`
  flag already clears caches, but you can also delete `app/.expo`.
- To point the mobile client at a different server, re-run `serve_app.ps1 -ApiUrl "http://..."` or set
  `EXPO_PUBLIC_API_BASE` before invoking `serve_app.bat`.
- When switching Python versions, recreate the `conda` environment so compiled dependencies remain in
  sync.
- `404 /api/machines` in the app almost always means the backend isn't running or the base URL is
  wrong. Confirm `npm --prefix server-node run dev` is running (the provided scripts already start it)
  and that you're pointing the client at `http://<LAN-IP>:8000` or `http://localhost:8000`.
- "Failed to parse URL from http://<LAN-IP>:8000" indicates the placeholder hasn't been replaced.
  Re-run the Expo launcher with your actual LAN IP (e.g., `http://192.168.1.50:8000`) or change it to
  `http://localhost:8000` if you're only testing in a local browser.
- CORS errors in development mean the browser is reaching a different host than the API – ensure the
  Expo app and backend share the same base URL. In production, configure `ALLOWED_ORIGINS` with your
  deployed web origin instead of using `*`.
- If Expo warns about dependency versions, run `npx expo install` once in `app/`, then align TypeScript
  and React types via `npm i -D typescript@~5.3.3 @types/react@~18.2.79` and install
  `@react-native-async-storage/async-storage@1.23.1`.
- `ModuleNotFoundError: server` means `PYTHONPATH` isn't pointed at the repo root. The helper scripts do
  this automatically, but if you launch Uvicorn manually set `set PYTHONPATH=%CD%` (Windows) or
  `export PYTHONPATH=$PWD` (macOS/Linux) first.

Refer to `README.md` for a high-level overview and `CHANGELOG.md` for the list of recent fixes.


---

## Legacy FastAPI backend (reference only)

The original FastAPI service in `server/` is preserved for comparison and historical tests. If you need to
run it, recreate the Python environment and launch Uvicorn manually:

```powershell
conda create -n diagnostics python=3.11
conda activate diagnostics
pip install -r server/requirements.txt
python -m uvicorn server.main:app --host 0.0.0.0 --port 8000 --reload
```

Use the Node backend for all new development; the FastAPI version no longer receives updates.
