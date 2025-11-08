param(
  [string]$RepoPath = "C:\Users\hodgeb\Documents\Scripts\codexrepos",
  [switch]$CleanCache,
  [switch]$LegacyPeerDeps
)
$ErrorActionPreference = "Stop"
Push-Location $RepoPath
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
if ($CleanCache) { npm cache clean --force } else { npm cache verify | Out-Null }
try {
  if ($LegacyPeerDeps) { npm install --legacy-peer-deps } else { npm install }
} catch {
  Write-Warning "Retrying with --legacy-peer-deps…"
  npm install --legacy-peer-deps
}
Pop-Location
Write-Host "Fresh lockfile and node_modules created."
