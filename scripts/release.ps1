[CmdletBinding()]
param(
  [string]$ImageName = "diagnostics-api",
  [string]$ImageTag = "latest",
  [string]$Registry = "ghcr.io",
  [switch]$PushImage,
  [switch]$SkipDocker
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repoRoot

$fullImage = "$Registry/$ImageName:$ImageTag"

if (-not $SkipDocker.IsPresent) {
    Write-Host "`nBuilding Docker image $fullImage" -ForegroundColor Cyan
    docker build -t $fullImage .
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    if ($PushImage.IsPresent) {
        Write-Host "Pushing $fullImage" -ForegroundColor Cyan
        docker push $fullImage
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
}

Push-Location (Join-Path $repoRoot "app")
try {
    npm install
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    $distDir = Join-Path $repoRoot "dist/web"
    npx expo export --platform web --output-dir $distDir
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    Write-Host "`nWeb bundle available at $distDir" -ForegroundColor Green
}
finally {
    Pop-Location
}
