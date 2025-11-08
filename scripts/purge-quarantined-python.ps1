Param([string]$Path)
$ErrorActionPreference = 'Stop'
if (-not $Path) {
  $latest = Get-ChildItem -Directory "diagnostics" -Filter "py-quarantine-*" | Sort-Object Name -Descending | Select-Object -First 1
  if (-not $latest) { Write-Error "No quarantine folder found."; exit 1 }
  $Path = $latest.FullName
}
if (-not (Test-Path $Path)) { Write-Error "Path not found: $Path"; exit 1 }
Write-Host "Purging: $Path" -ForegroundColor Yellow
Remove-Item -LiteralPath $Path -Recurse -Force
Write-Host "Done." -ForegroundColor Green
