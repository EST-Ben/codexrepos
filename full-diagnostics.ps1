Param([switch] $Md)
$ErrorActionPreference = 'Stop'
Write-Host "== Full Diagnostics ==" -ForegroundColor Cyan

# [1/4] Force Expo LAN settings
$expoSettings = Join-Path -Path "app\.expo" -ChildPath "settings.json"
New-Item -ItemType Directory -Path (Split-Path $expoSettings) -Force | Out-Null
@{ hostType="lan"; devClient=$true; https=$false } | ConvertTo-Json | Set-Content -Path $expoSettings -Encoding UTF8
Write-Host "[1/4] Expo settings written: $expoSettings" -ForegroundColor Green

# [2/4] Toolchain versions
$nodeVer = (node -v) 2>$null
$npmVer  = (npm -v) 2>$null
Write-Host "[2/4] Node: $nodeVer | npm: $npmVer" -ForegroundColor Cyan

# [3/4] Port scan
function Test-Port {
  param([int]$Port)
  try {
    if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
      $c = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($c) { return @{Port=$Port;Status="LISTEN";Pid=$c.OwningProcess} }
    }
  } catch { }
  $line = netstat -ano | Select-String -Pattern ":${Port}\s" | Select-Object -First 1
  if ($line) {
    $parts = ($line.ToString() -split '\s+') | Where-Object { $_ -ne '' }
    $pid = $parts[-1]
    return @{Port=$Port;Status="LISTEN";Pid=$pid}
  }
  return @{Port=$Port;Status="free";Pid=$null}
}
$ports = 8000,8081 | ForEach-Object { Test-Port -Port $_ }
Write-Host "[3/4] Ports:" -ForegroundColor Cyan
$ports | ForEach-Object { Write-Host ("  {0}: {1} {2}" -f $_.Port, $_.Status, ($(if($_.Pid){"PID "+$_.Pid}else{""}))) }

# [4/4] LAN IPv4 detection
$lan = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notin @('127.0.0.1') -and $_.PrefixOrigin -ne 'WellKnown' } |
  Select-Object -First 1)
$ip = if ($lan) { $lan.IPAddress } else { "unknown" }
Write-Host "[4/4] LAN IPv4: $ip" -ForegroundColor Cyan

Write-Host ""
Write-Host "Recommended start commands:" -ForegroundColor Green
Write-Host "  cd app; npx expo start --host lan"
Write-Host "  npm --prefix server-node run start"
Write-Host "API health:  http://$ip:8000/health"

if ($Md) {
  $report = @"
## Full Diagnostics
- Expo LAN: set
- Node: $nodeVer
- npm : $npmVer
- Ports:
$($ports | ForEach-Object { "- " + ($_.Port) + ": " + ($_.Status) + ($(if($_.Pid){" (PID "+$_.Pid+")"}else{""})) } | Out-String)
- LAN IPv4: $ip
"@
  $out = "diagnostics/diagnostics-$(Get-Date -UFormat %s).md"
  New-Item -ItemType Directory -Path "diagnostics" -Force | Out-Null
  $report | Set-Content -Path $out -Encoding UTF8
  Write-Host "Markdown report written: $out" -ForegroundColor Green
}
