# Local Development (Windows + Miniforge)

These steps assume **Windows 11** with [Miniforge](https://github.com/conda-forge/miniforge) for Python
and the latest **Node 18 LTS** for Expo. Adapt the paths for other shells as needed.

## 1. Create and populate the Python environment

```powershell
# Launch the "Miniforge Prompt" (PowerShell)
conda create -n diagnostics python=3.11
conda activate diagnostics
pip install -r server/requirements.txt
```

The backend defaults to stub inference and stores uploads in `C:\tmp\uploads` on Windows (or your
system temp directory elsewhere). Override by setting `UPLOAD_DIR` before launch.

## 2. Start the FastAPI server

Run one of the provided launchers from the repository root:

```powershell
# PowerShell
./serve_api.ps1

# or Command Prompt
serve_api.bat
```

Both scripts set `PYTHONPATH`, ensure the upload directory exists, and start Uvicorn bound to
`http://0.0.0.0:8000` so phones on the LAN can reach it.

## 3. Start the Expo app in LAN mode

The Expo launchers automatically pin the API base URL via `EXPO_PUBLIC_API_URL` and clear caches to
avoid stale manifests:

```powershell
# PowerShell
./serve_app.ps1 -ApiUrl "http://<YOUR-LAN-IP>:8000"

# or Command Prompt
set API_URL=http://<YOUR-LAN-IP>:8000
serve_app.bat
```

The scripts install the `expo-image-picker` native module (safe to re-run) and start the dev server in
`--lan` mode so the Expo Go app on your phone uses the same LAN IP for API calls.

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
  `API_URL` before invoking `serve_app.bat`.
- When switching Python versions, recreate the `conda` environment so compiled dependencies remain in
  sync.

Refer to `README.md` for a high-level overview and `CHANGELOG.md` for the list of recent fixes.

