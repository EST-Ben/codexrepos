Param()
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repoRoot

if ([string]::IsNullOrWhiteSpace($env:UPLOAD_DIR)) {
    $env:UPLOAD_DIR = "C:\tmp\uploads"
}
if (-not (Test-Path -Path $env:UPLOAD_DIR)) {
    New-Item -ItemType Directory -Path $env:UPLOAD_DIR | Out-Null
}
if ([string]::IsNullOrWhiteSpace($env:INFERENCE_MODE)) {
    $env:INFERENCE_MODE = "stub"
}
if ([string]::IsNullOrWhiteSpace($env:PYTHONPATH)) {
    $env:PYTHONPATH = $repoRoot
} else {
    $env:PYTHONPATH = "$repoRoot;$env:PYTHONPATH"
}

python -m uvicorn server.main:app --host 0.0.0.0 --port 8000 --reload
