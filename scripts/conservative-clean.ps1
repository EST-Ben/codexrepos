Param(
  [switch] $Apply,
  [switch] $IncludeDiagnostics
)

$ErrorActionPreference = 'Stop'
Write-Host "== conservative-clean.ps1 ==" -ForegroundColor Cyan

$targets = @(
  "node_modules",
  "app\node_modules",
  "server-node\node_modules",
  "app\\.expo\\.web",
  "app\\.expo\\devices",
  "app\\.expo\\logs",
  "app\\.turbo",
  "app\\.parcel-cache",
  "app\\.jest",
  "app\\coverage",
  "app\\.cache",
  "server-node\\dist"
)
if ($IncludeDiagnostics) {
  $targets += @("diagnostics\\*.json","diagnostics\\*.md","diagnostics\\quarantine")
}

Write-Host "`nPlanned removals (preview):" -ForegroundColor DarkCyan
$existing = @()
foreach ($t in $targets) {
  $found = Get-ChildItem -LiteralPath $t -Force -ErrorAction SilentlyContinue
  if ($found) { $found | ForEach-Object { Write-Host "  would remove: $($_.FullName)"; $existing += $_ } }
}

if (-not $Apply) { Write-Host "`nPreview complete. Re-run with -Apply to delete." -ForegroundColor Yellow; exit 0 }

Write-Host "`nApplying removals..." -ForegroundColor Yellow
foreach ($item in $existing) {
  try {
    if (Test-Path $item.FullName) {
      Remove-Item -LiteralPath $item.FullName -Recurse -Force -ErrorAction Stop
      Write-Host "  removed: $($item.FullName)" -ForegroundColor Green
    }
  } catch { Write-Warning "  failed: $($item.FullName) -> $_" }
}
Write-Host "Done." -ForegroundColor Green
