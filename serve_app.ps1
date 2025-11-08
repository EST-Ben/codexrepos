[CmdletBinding()]
param(
  [string]$ApiUrl,
  [switch]$DevClient
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location (Join-Path $repoRoot "app")

try {
  if (-not $ApiUrl) {
    $ApiUrl = $env:EXPO_PUBLIC_API_BASE
  }
  if (-not $ApiUrl) {
    $ApiUrl = "http://localhost:8000"
  }

  $env:EXPO_PUBLIC_API_BASE = $ApiUrl

  if ($env:EXPO_PUBLIC_API_BASE -match "<.+>") {
    throw "API URL still contains a <LAN-IP> placeholder. Replace it with your actual LAN address or http://localhost:8000."
  }

  Write-Host "`n=== Expo mobile app ==="
  Write-Host "Using API URL: $($env:EXPO_PUBLIC_API_BASE)" -ForegroundColor Cyan
  Write-Host

  $argsList = @('expo', 'start', '--lan', '-c')
  if ($DevClient.IsPresent -or $env:EXPO_USE_DEV_CLIENT) {
    $argsList = @('expo', 'start', '--dev-client', '--lan', '-c')
    $env:EXPO_USE_DEV_CLIENT = '1'
  }

  npx --yes @argsList
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
