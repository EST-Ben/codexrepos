Param()
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repoRoot

if ([string]::IsNullOrWhiteSpace($env:ENV)) {
    $env:ENV = "development"
}
if ([string]::IsNullOrWhiteSpace($env:ENVIRONMENT)) {
    $env:ENVIRONMENT = $env:ENV
}
if ([string]::IsNullOrWhiteSpace($env:ALLOWED_ORIGINS)) {
    $env:ALLOWED_ORIGINS = "http://localhost:19006,http://localhost:5173"
}
if ([string]::IsNullOrWhiteSpace($env:RATE_LIMIT_REQUESTS)) {
    $env:RATE_LIMIT_REQUESTS = "30"
}
if ([string]::IsNullOrWhiteSpace($env:RATE_LIMIT_WINDOW_SECONDS)) {
    $env:RATE_LIMIT_WINDOW_SECONDS = "60"
}
if ([string]::IsNullOrWhiteSpace($env:UPLOAD_MAX_MB)) {
    $env:UPLOAD_MAX_MB = "10"
}

Write-Host "=== Node diagnostics API ==="
$env:npm_config_loglevel = "warn"
npm --prefix server-node run dev
