@echo off
setlocal ENABLEDELAYEDEXPANSION
set "REPO_ROOT=%~dp0"
if "%REPO_ROOT:~-1%"=="\" set "REPO_ROOT=%REPO_ROOT:~0,-1%"
cd /d "%REPO_ROOT%"

if not defined UPLOAD_DIR (
    set "UPLOAD_DIR=C:\tmp\uploads"
)
if not exist "%UPLOAD_DIR%" (
    mkdir "%UPLOAD_DIR%"
)
if not defined INFERENCE_MODE (
    set "INFERENCE_MODE=stub"
)
set "PYTHONPATH=%REPO_ROOT%;%PYTHONPATH%"

python -m uvicorn server.main:app --host 0.0.0.0 --port 8000 --reload
endlocal
