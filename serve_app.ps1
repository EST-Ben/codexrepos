[CmdletBinding()]
param(
  [string]$ApiUrl
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location (Join-Path $repoRoot "app")

try {
  if (-not $ApiUrl) {
    $ApiUrl = $env:API_URL
  }
  if (-not $ApiUrl) {
    $ApiUrl = "http://localhost:8000"
  }

  $env:API_URL = $ApiUrl
  if (-not $env:EXPO_PUBLIC_API_URL) {
    $env:EXPO_PUBLIC_API_URL = $ApiUrl
  }

  Write-Host "`n=== Expo mobile app ==="
  Write-Host "Using API URL: $($env:EXPO_PUBLIC_API_URL)" -ForegroundColor Cyan
  Write-Host

  npx --yes expo install expo-image-picker
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  npx expo start --lan -c
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
