<#
  start-dev.ps1 — smart auto-install + tsconfig fixer + dev launcher
  - Scans repo for external imports; installs ONLY missing deps
  - React Native/Expo tsconfig fixes:
      * installs @tsconfig/react-native if app/tsconfig.json extends it
      * if moduleResolution == "bundler" and module == "commonjs"/missing, set module to "esnext"
      * ensures TypeScript >= 5.3 and @types/node when TS is in use
  - Builds TS utility scripts and launches backend + Expo app

  Usage examples:
    .\start-dev.ps1
    .\start-dev.ps1 -DryRun
    .\start-dev.ps1 -PackageManager pnpm -Web
#>

param(
  [string]$RepoRoot = "C:\Users\hodgeb\Documents\Scripts\codexrepos",
  [string]$ApiBase = "",
  [ValidateSet("npm","pnpm","yarn")][string]$PackageManager = "npm",
  [switch]$NoInstall,     # skip auto-install phase
  [switch]$NoTypes,       # do not auto-install @types/* or typescript
  [switch]$DryRun,        # only print what would happen
  [switch]$DevClient,     # pass --dev-client to Expo
  [switch]$Web            # start Expo for web instead of native
)

$ErrorActionPreference = "Stop"

function Info($m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Warn($m){ Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Ok($m){ Write-Host "[OK]   $m" -ForegroundColor Green }
function Err($m){ Write-Host "[ERR]  $m" -ForegroundColor Red }

# Pick PowerShell host for spawned windows
$psExe = if (Get-Command pwsh -ErrorAction SilentlyContinue) { "pwsh" } else { "powershell" }

# Validate RepoRoot
if (-not (Test-Path $RepoRoot)) { throw "Repo path not found: $RepoRoot" }
Push-Location $RepoRoot

# Resolve API base if not provided
if (-not $ApiBase) {
  try {
    $lan = Get-NetIPAddress -AddressFamily IPv4 |
      Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' -and $_.InterfaceOperationalStatus -eq 'Up' } |
      Select-Object -ExpandProperty IPAddress -First 1
    if ($lan) { $ApiBase = "http://$lan`:8000" } else { $ApiBase = "http://localhost:8000" }
  } catch { $ApiBase = "http://localhost:8000" }
}
Info "API base -> $ApiBase"

# Ensure package manager exists
if (-not (Get-Command $PackageManager -ErrorAction SilentlyContinue)) {
  throw "Package manager '$PackageManager' not found on PATH."
}

# ---------------------- helpers ----------------------
$BuiltinNode = @(
  "assert","async_hooks","buffer","child_process","cluster","console","constants","crypto",
  "dgram","diagnostics_channel","dns","domain","events","fs","http","http2","https",
  "inspector","module","net","os","path","perf_hooks","process","punycode","querystring",
  "readline","repl","stream","string_decoder","timers","tls","trace_events","tty",
  "url","util","v8","vm","zlib","worker_threads"
)

function Is-ExternalModule([string]$spec) {
  if (-not $spec) { return $false }
  if ($spec.StartsWith("./") -or $spec.StartsWith("../") -or $spec.StartsWith("/")) { return $false }
  if ($spec.StartsWith("node:")) { return $false }
  if ($BuiltinNode -contains $spec) { return $false }
  return $true
}

function Get-PackageBase([string]$spec) {
  if ($spec -match "^@[^/]+/[^/]+") { return ([regex]::Match($spec, "^@[^/]+/[^/]+")).Value }
  else { return ($spec -split "/")[0] }
}

function Get-AllSourceFiles([string]$root) {
  $patterns = @("*.js","*.jsx","*.ts","*.tsx","*.mjs","*.cjs")
  $files = @()
  foreach ($p in $patterns) { $files += Get-ChildItem -Path $root -Recurse -Include $p -File -ErrorAction SilentlyContinue }
  $files = $files | Where-Object { $_.FullName -notmatch "\\node_modules\\|/node_modules/|\\dist\\|/dist/|\\build\\|/build/" }
  return $files
}

function Get-ImportSpecsFromFile([string]$file) {
  try { $text = Get-Content -LiteralPath $file -Raw -ErrorAction Stop } catch { return @() }
  $matches = @()

  # ESM import ... from 'x'  OR  import 'x'
  $regex1 = [regex]"(?ms)import\s+(?:[^`'"";]+?\s+from\s+)?['""]([^'""]+)['""]"
  $matches += ($regex1.Matches($text) | ForEach-Object { $_.Groups[1].Value })

  # CJS require('x')
  $regex2 = [regex]"(?ms)require\(\s*['""]([^'""]+)['""]\s*\)"
  $matches += ($regex2.Matches($text) | ForEach-Object { $_.Groups[1].Value })

  # Dynamic import('x')
  $regex3 = [regex]"(?ms)import\(\s*['""]([^'""]+)['""]\s*\)"
  $matches += ($regex3.Matches($text) | ForEach-Object { $_.Groups[1].Value })

  $externals = $matches | Where-Object { Is-ExternalModule $_ } | ForEach-Object { Get-PackageBase $_ }
  return ($externals | Sort-Object -Unique)
}

function Test-PackageInstalled([string]$pkg) {
  $pkgPath = Join-Path "node_modules" $pkg
  return (Test-Path $pkgPath)
}

function Read-PackageJson([string]$dir = $RepoRoot) {
  $pkgPath = Join-Path $dir "package.json"
  if (Test-Path $pkgPath) {
    try { return Get-Content $pkgPath -Raw | ConvertFrom-Json } catch { return $null }
  }
  return $null
}

function Add-ToList([System.Collections.Generic.List[string]]$list, [string]$item) {
  if ([string]::IsNullOrWhiteSpace($item)) { return }
  if (-not ($list.Contains($item))) { [void]$list.Add($item) }
}

function Invoke-PMInstall([string[]]$deps, [switch]$Dev) {
  if ($deps.Count -eq 0) { return }

  $args = @()
  switch ($PackageManager) {
    "npm"  { $args = @("install"); if ($Dev){ $args += "-D" }; $args += $deps; $args += @("--no-audit","--no-fund") }
    "pnpm" { $args = @("add");     if ($Dev){ $args += "-D" }; $args += $deps }
    "yarn" { $args = @("add");     if ($Dev){ $args += "-D" }; $args += $deps }
  }

  if ($DryRun) {
    Info ("DRY RUN: {0} {1}" -f $PackageManager, ($args -join ' '))
    return
  }

  $devTag = if ($Dev) { " [dev]" } else { "" }
  Info ("Installing ({0}): {1}{2}" -f $PackageManager, ([string]::Join(", ", $deps)), $devTag)

  & $PackageManager @args
  if ($LASTEXITCODE -ne 0) { throw "$PackageManager install failed (exit $LASTEXITCODE)" }

  Ok ("Installed: {0}{1}" -f ([string]::Join(", ", $deps)), $devTag)
}

function Get-LocalPkgVersion([string]$pkgName) {
  $p = Join-Path $RepoRoot ("node_modules\" + $pkgName + "\package.json")
  if (Test-Path $p) {
    try { return ((Get-Content $p -Raw | ConvertFrom-Json).version) } catch { return $null }
  }
  return $null
}

function Version-Gte([string]$a, [string]$b) {
  if (-not $a -or -not $b) { return $false }
  $pa = ($a -split "[^\d]+" | Where-Object {$_ -ne ""})[0..2]; while($pa.Count -lt 3){$pa += 0}
  $pb = ($b -split "[^\d]+" | Where-Object {$_ -ne ""})[0..2]; while($pb.Count -lt 3){$pb += 0}
  for ($i=0; $i -lt 3; $i++){ if ([int]$pa[$i] -gt [int]$pb[$i]) { return $true } elseif ([int]$pa[$i] -lt [int]$pb[$i]) { return $false } }
  return $true
}

# ------------------ gather current deps ------------------
$Needed     = New-Object System.Collections.Generic.List[string]
$NeededDev  = New-Object System.Collections.Generic.List[string]

$rootPkg = Read-PackageJson $RepoRoot
$depDeclared    = @{}
$devDepDeclared = @{}

if ($null -ne $rootPkg) {
  $depsObj    = $null
  $devDepsObj = $null

  if ($rootPkg.PSObject.Properties.Name -contains 'dependencies')    { $depsObj    = $rootPkg.dependencies }
  if ($rootPkg.PSObject.Properties.Name -contains 'devDependencies') { $devDepsObj = $rootPkg.devDependencies }

  if ($null -ne $depsObj)    { foreach ($prop in $depsObj.PSObject.Properties)    { $depDeclared[$prop.Name] = $true } }
  if ($null -ne $devDepsObj) { foreach ($prop in $devDepsObj.PSObject.Properties) { $devDepDeclared[$prop.Name] = $true } }
}

# ------------------ scan imports across repo ------------------
$files = Get-AllSourceFiles $RepoRoot
Info "Scanning $($files.Count) source files for external imports..."
$allImports = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($f in $files) {
  foreach ($spec in (Get-ImportSpecsFromFile $f.FullName)) { [void]$allImports.Add($spec) }
}

# Enumerate HashSet -> array, then sort
$imports = @()
foreach ($i in $allImports) { $imports += $i }
$imports = $imports | Sort-Object
if ($imports.Count -eq 0) { Warn "No external imports found. Skipping auto-install." }
else { Info "Found external packages: $([string]::Join(', ', $imports))" }

foreach ($pkg in $imports) {
  $installed = Test-PackageInstalled $pkg
  $declaredAsDev = $devDepDeclared.ContainsKey($pkg)
  $declaredAsDep = $depDeclared.ContainsKey($pkg)

  if (-not $installed) {
    if ($declaredAsDev -and -not $NoTypes) {
      Add-ToList $NeededDev $pkg
    } else {
      if ($declaredAsDev -and -not $declaredAsDep) { Add-ToList $NeededDev $pkg }
      else { Add-ToList $Needed $pkg }
    }
  }
}

# ------------------ React Native / Expo tsconfig fixes ------------------
$appDir = Join-Path $RepoRoot "app"
$appTsconfigPath = Join-Path $appDir "tsconfig.json"
$tsBundlerMode = $false

if (Test-Path $appTsconfigPath) {
  try {
    $raw = Get-Content $appTsconfigPath -Raw
    $tscfg = $raw | ConvertFrom-Json
    $changed = $false

    # If extends '@tsconfig/react-native/tsconfig.json' but package missing, queue it (dev dep)
    if ($tscfg.extends -and $tscfg.extends -eq "@tsconfig/react-native/tsconfig.json") {
      if (-not (Test-PackageInstalled "@tsconfig/react-native")) { Add-ToList $NeededDev "@tsconfig/react-native" }
    }

    # If moduleResolution == "bundler" but module is "commonjs"/missing, set module to "esnext"
    if (-not $tscfg.PSObject.Properties.Name.Contains('compilerOptions')) {
      $tscfg | Add-Member -NotePropertyName compilerOptions -NotePropertyValue ([pscustomobject]@{}) -Force
    }
    $mr = $tscfg.compilerOptions.moduleResolution
    $modExists = $tscfg.compilerOptions.PSObject.Properties.Name.Contains('module')
    $mod = if ($modExists) { $tscfg.compilerOptions.module } else { $null }

    if ($mr -eq "bundler") {
      $tsBundlerMode = $true
      if (-not $mod -or $mod -eq "commonjs") {
        Copy-Item $appTsconfigPath "$appTsconfigPath.bak" -ErrorAction SilentlyContinue
        if ($modExists) { $tscfg.compilerOptions.module = "esnext" }
        else { $tscfg.compilerOptions | Add-Member -NotePropertyName module -NotePropertyValue "esnext" -Force }
        $changed = $true
        Info "Patched app/tsconfig.json: module -> esnext for bundler resolution. Backup created."
      }
    }

    if ($changed) {
      $tscfg | ConvertTo-Json -Depth 20 | Set-Content -Encoding utf8 $appTsconfigPath
      Ok "Updated $appTsconfigPath"
    }
  } catch {
    Warn "Could not parse or update $appTsconfigPath"
  }
}

# If bundler mode detected, ensure TS >= 5.3 and @types/node present
if ($tsBundlerMode -and -not $NoTypes) {
  $tsVer = Get-LocalPkgVersion "typescript"
  if (-not $tsVer -or -not (Version-Gte $tsVer "5.3.0")) { Add-ToList $NeededDev "typescript@^5.3.0" }
  if (-not (Test-PackageInstalled "@types/node")) { Add-ToList $NeededDev "@types/node" }
}

# If any TS use is detected, ensure tooling present
$tsDetected = (Test-Path ".\tsconfig.json") -or (Test-Path ".\tsconfig.scripts.json") -or ($files | Where-Object { $_.Extension -in ".ts",".tsx",".mts",".cts" } | Select-Object -First 1)
if ($tsDetected -and -not $NoTypes) {
  if (-not (Test-PackageInstalled "typescript")) { Add-ToList $NeededDev "typescript" }
  if (-not (Test-PackageInstalled "@types/node")) { Add-ToList $NeededDev "@types/node" }
}

# Dedup and de-conflict
$Needed    = @($Needed    | Sort-Object -Unique)
$NeededDev = @($NeededDev | Sort-Object -Unique | Where-Object { $Needed -notcontains $_ })

# ------------------ install missing ------------------
if (-not $NoInstall) {
  if ($Needed.Count -eq 0 -and $NeededDev.Count -eq 0) {
    Ok "All dependencies already present. No install needed."
  } else {
    if ($Needed.Count -gt 0)   { Invoke-PMInstall -deps $Needed }
    if ($NeededDev.Count -gt 0){ Invoke-PMInstall -deps $NeededDev -Dev }
  }
} else {
  Warn "NoInstall set - skipping install."
  if ($Needed.Count -gt 0 -or $NeededDev.Count -gt 0) {
    Info "Would install runtime: $([string]::Join(', ', $Needed))"
    Info "Would install dev:     $([string]::Join(', ', $NeededDev))"
  }
}

# ------------------ build TS utility scripts ------------------
$tscfgScripts = Join-Path $RepoRoot "tsconfig.scripts.json"
if (Test-Path $tscfgScripts) {
  $tsc = Get-Command tsc -ErrorAction SilentlyContinue
  if ($tsc) {
    Info "Building TypeScript utility scripts (tsc -p tsconfig.scripts.json)..."
    tsc -p tsconfig.scripts.json
    if ($LASTEXITCODE -ne 0) { Warn "TypeScript build had errors (continuing). Exit code: $LASTEXITCODE" }
    else { Ok "Utility scripts built." }
  } else {
    Warn "tsc not on PATH; trying npx..."
    try {
      npx tsc -p tsconfig.scripts.json
      if ($LASTEXITCODE -eq 0) { Ok "Utility scripts built via npx." }
    } catch { }
  }
} else {
  Warn "tsconfig.scripts.json not found - skipping scripts build."
}

# ------------------ write Expo env ------------------
$envPath = Join-Path $RepoRoot "app\.env"
"EXPO_PUBLIC_API_BASE=$ApiBase" | Set-Content -Encoding ascii $envPath
Ok "Wrote $envPath"

# ------------------ launch backend + app ------------------
$serverDir = Join-Path $RepoRoot "server-node"
$appDir    = Join-Path $RepoRoot "app"
if (-not (Test-Path $serverDir)) { throw "Missing folder: $serverDir" }
if (-not (Test-Path $appDir))    { throw "Missing folder: $appDir" }

$serverArgs = @("-NoLogo","-NoExit","-Command","cd `"$serverDir`"; npm run dev")
Start-Process -FilePath $psExe -ArgumentList $serverArgs -WorkingDirectory $serverDir
Ok "Launched server-node (npm run dev) in a new window."

$serveAppLauncher = Join-Path $RepoRoot "serve_app.ps1"
if (Test-Path $serveAppLauncher) {
  $cmd = "cd `"$RepoRoot`"; .\serve_app.ps1 -ApiUrl `"$ApiBase`""
  if ($DevClient) { $cmd += " -DevClient" }
  $expoArgs = @("-NoLogo","-NoExit","-Command", $cmd)
  Start-Process -FilePath $psExe -ArgumentList $expoArgs -WorkingDirectory $RepoRoot
  Ok "Launched Expo via serve_app.ps1."
} else {
  $expoCmd = if ($Web) { "npx expo start --web" } else { "npx expo start" }
  if ($DevClient) { $expoCmd += " --dev-client" }
  $expoArgs = @("-NoLogo","-NoExit","-Command","cd `"$appDir`"; $expoCmd")
  Start-Process -FilePath $psExe -ArgumentList $expoArgs -WorkingDirectory $appDir
  Ok "Launched Expo ($expoCmd) in a new window."
}

Pop-Location

Info "Tips:"
Write-Host "  - Use -DryRun to preview installs; -NoTypes to skip @types/* and TS tooling." -ForegroundColor DarkGray
Write-Host "  - Use -PackageManager pnpm|yarn to switch installers." -ForegroundColor DarkGray
Write-Host "  - If VS Code still warns, switch to the workspace TypeScript and reload the window." -ForegroundColor DarkGray
