Param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$dest = Join-Path "diagnostics" ("py-quarantine-" + (Get-Date -UFormat %s))
New-Item -ItemType Directory -Path $dest -Force | Out-Null

$patterns = @("*.py","**\\*.py",".venv","**\\__pycache__")
$skip = @("server-node","app","node_modules",".expo",".git",".vscode")

function Should-Skip($path) {
  foreach ($s in $skip) { if ($path -like "*\\$s\\*") { return $true } }
  return $false
}

$matches = @()
foreach ($p in $patterns) {
  Get-ChildItem -Recurse -Force -ErrorAction SilentlyContinue -Path . -Filter $p | ForEach-Object {
    $full = $_.FullName
    if (-not (Should-Skip $full)) { $matches += $full }
  }
}
$matches = $matches | Sort-Object -Unique
Write-Host "Quarantine destination: $dest"
Write-Host "Candidates:" -ForegroundColor Cyan
$matches | ForEach-Object { Write-Host "  $_" }

if (-not $Apply) { Write-Host "`nPreview complete. Re-run with -Apply to move files." -ForegroundColor Yellow; exit 0 }

foreach ($m in $matches) {
  $rel = Resolve-Path $m | ForEach-Object { $_.Path.Substring((Resolve-Path .).Path.Length + 1) }
  $target = Join-Path $dest $rel
  New-Item -ItemType Directory -Path (Split-Path $target) -Force | Out-Null
  Move-Item -LiteralPath $m -Destination $target -Force -ErrorAction SilentlyContinue
  Write-Host "Moved: $rel" -ForegroundColor Green
}
