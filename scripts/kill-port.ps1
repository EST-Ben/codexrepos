param(
  [Parameter(Mandatory = $true)]
  [int] $Port
)

Write-Host "Searching for processes listening on port $Port ..." -ForegroundColor Cyan

$killed = 0
$hadMatches = $false
try {
  if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($conns) {
      $hadMatches = $true
      $pids = $conns | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique | Where-Object { $_ -is [int] -and $_ -gt 0 }
      foreach ($procId in $pids) {
        try {
          Write-Host "Killing PID $procId (port $Port)..." -ForegroundColor Yellow
          Stop-Process -Id $procId -Force -ErrorAction Stop
          $killed++
        } catch { Write-Warning "Failed to kill PID $procId: $_" }
      }
    }
  }
} catch { }

if (-not $hadMatches -and $killed -eq 0) {
  $pattern = ":${Port}\s"
  $lines = netstat -ano | Select-String -Pattern $pattern | ForEach-Object { $_.ToString() }
  if (-not $lines -or $lines.Count -eq 0) { Write-Host "No process found on port $Port." -ForegroundColor Green; exit 0 }
  foreach ($line in $lines) {
    $parts = $line -split '\s+' | Where-Object { $_ -ne '' }
    $procId = $parts[-1]
    if ($procId -match '^\d+$') {
      try {
        Write-Host "Killing PID $procId (port $Port)..." -ForegroundColor Yellow
        Stop-Process -Id $procId -Force -ErrorAction Stop
        $killed++
      } catch { Write-Warning "Failed to kill PID $procId: $_" }
    }
  }
}

if ($killed -gt 0) {
  Write-Host "Killed $killed process(es) on port $Port." -ForegroundColor Green
} else {
  if ($hadMatches) {
    Write-Host "Found listeners but did not terminate any processes (permissions or PID resolution issue)." -ForegroundColor Yellow
  } else {
    Write-Host "No process found on port $Port." -ForegroundColor Green
  }
}
