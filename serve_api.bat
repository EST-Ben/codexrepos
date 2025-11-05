@echo off
setlocal ENABLEDELAYEDEXPANSION
set "REPO_ROOT=%~dp0"
if "%REPO_ROOT:~-1%"=="\" set "REPO_ROOT=%REPO_ROOT:~0,-1%"
cd /d "%REPO_ROOT%"

if not defined ENV set "ENV=development"
if not defined ENVIRONMENT set "ENVIRONMENT=%ENV%"
if not defined ALLOWED_ORIGINS set "ALLOWED_ORIGINS=http://localhost:19006,http://localhost:5173"
if not defined RATE_LIMIT_REQUESTS set "RATE_LIMIT_REQUESTS=30"
if not defined RATE_LIMIT_WINDOW_SECONDS set "RATE_LIMIT_WINDOW_SECONDS=60"
if not defined UPLOAD_MAX_MB set "UPLOAD_MAX_MB=10"

echo === Node diagnostics API ===
set "npm_config_loglevel=warn"
npm --prefix server-node run dev
endlocal
