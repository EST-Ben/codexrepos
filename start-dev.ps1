<#
  start-dev.ps1 — LAN-first dev launcher (Expo on 192.168.0.35, API on :8000)
  - Scans repo for external imports; installs ONLY missing deps
  - RN/Expo tsconfig nudges (bundler -> module esnext when needed)
  - Reanimated plugin normalization (avoid duplicates)
  - Starts Fastify on 0.0.0.0:8000 (CORS allow localhost + LAN web port)
  - Starts Expo in LAN mode, advertising 192.168.0.35

  Usage:
    .\start-dev.ps1                         # native (Metro) + server
    .\start-dev.ps1 -Web                    # web + server
    .\start-dev.ps1 -LanHost 192.168.0.35   # override LAN IP
    .\start-dev.ps1 -DryRun                 # print actions only
#>

param(
  [string]$RepoRoot = "C:\Users\hodgeb\Documents\Scripts\codexrepos",

  # Your LAN IP for Expo/Metro to advertise to devices
  [string]$LanHost = "192.168.0.35",

  # API base for the app; server listens on this port
  [int]$ApiPort = 8000,

  # Expo web dev server port (Expo Web defaults to 8081)
  [int]$WebPort = 8081,

  [ValidateSet("npm","pnpm","yarn")][string]$PackageManager = "npm",
  [switch]$NoInstall,
  [switch]$NoTypes,
  [switch]$DryRun,
  [switch]$DevClient,
  [switch]$Web
)

$ErrorActionPreference = "Stop"

function Write-Info($m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Write-Warn($m){ Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Write-Ok($m){ Write-Host "[OK]   $m" -ForegroundColor Green }
function Write-Err($m){ Write-Host "[ERR]  $m" -ForegroundColor Red }

# Which PowerShell to spawn new consoles with
$psExe = if (Get-Command pwsh -ErrorAction SilentlyContinue) { "pwsh" } else { "powershell" }

# Validate repo root
if (-not (Test-Path $RepoRoot)) { throw "Repo path not found: $RepoRoot" }
Push-Location $RepoRoot

# Compute API base from LAN host + port
$ApiBase = "http://${LanHost}:$ApiPort"
Write-Info ("API base -> {0}" -f $ApiBase)
Write-Info ("Expo/Metro will advertise LAN host -> {0} (standard Metro ports)" -f $LanHost)

# Ensure package manager exists
if (-not (Get-Command $PackageManager -ErrorAction SilentlyContinue)) {
  throw "Package manager '$PackageManager' not found on PATH."
}

# ---------- helpers ----------
$BuiltinNode = @(
  "assert","async_hooks","buffer","child_process","cluster","console","constants","crypto",
  "dgram","diagnostics_channel","dns","domain","events","fs","http","http2","https",
  "inspector","module","net","os","path","perf_hooks","process","punycode","querystring",
  "readline","repl","stream","string_decoder","timers","tls","trace_events","tty",
  "url","util","v8","vm","zlib","worker_threads"
)
function Test-ExternalModule([string]$spec) {
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
  $out = @()
  $rx1 = [regex]"(?ms)import\s+(?:[^`'"";]+?\s+from\s+)?['""]([^'""]+)['""]"
  $out += ($rx1.Matches($text) | ForEach-Object { $_.Groups[1].Value })
  $rx2 = [regex]"(?ms)require\(\s*['""]([^'""]+)['""]\s*\)"
  $out += ($rx2.Matches($text) | ForEach-Object { $_.Groups[1].Value })
  $rx3 = [regex]"(?ms)import\(\s*['""]([^'""]+)['""]\s*\)"
  $out += ($rx3.Matches($text) | ForEach-Object { $_.Groups[1].Value })
  $externals = $out | Where-Object { Test-ExternalModule $_ } | ForEach-Object { Get-PackageBase $_ }
  return ($externals | Sort-Object -Unique)
}
function Test-PackageInstalled([string]$pkg) {
  $pkgPath = Join-Path "node_modules" $pkg
  return (Test-Path $pkgPath)
}
function Get-PackageJson([string]$dir = $RepoRoot) {
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
  $pmArgs = @()
  switch ($PackageManager) {
    "npm"  { $pmArgs = @("install"); if ($Dev){ $pmArgs += "-D" }; $pmArgs += $deps; $pmArgs += @("--no-audit","--no-fund") }
    "pnpm" { $pmArgs = @("add");     if ($Dev){ $pmArgs += "-D" }; $pmArgs += $deps }
    "yarn" { $pmArgs = @("add");     if ($Dev){ $pmArgs += "-D" }; $pmArgs += $deps }
  }
  if ($DryRun) {
    Write-Info ("DRY RUN: {0} {1}" -f $PackageManager, ($pmArgs -join ' '))
    return
  }
  & $PackageManager @pmArgs
  if ($LASTEXITCODE -ne 0) { throw "$PackageManager install failed (exit $LASTEXITCODE)" }
  Write-Ok ("Installed: {0}{1}" -f ([string]::Join(", ", $deps)), ($(if($Dev){" [dev]"} else {""})))
}
function Get-LocalPkgVersion([string]$pkgName) {
  $p = Join-Path $RepoRoot ("node_modules\" + $pkgName + "\package.json")
  if (Test-Path $p) {
    try { return ((Get-Content $p -Raw | ConvertFrom-Json).version) } catch { return $null }
  }
  return $null
}
function Test-VersionGte([string]$a, [string]$b) {
  if (-not $a -or -not $b) { return $false }
  $pa = ($a -split "[^\d]+" | Where-Object {$_ -ne ""})[0..2]; while($pa.Count -lt 3){$pa += 0}
  $pb = ($b -split "[^\d]+" | Where-Object {$_ -ne ""})[0..2]; while($pb.Count -lt 3){$pb += 0}
  for ($i=0; $i -lt 3; $i++){ if ([int]$pa[$i] -gt [int]$pb[$i]) { return $true } elseif ([int]$pa[$i] -lt [int]$pb[$i]) { return $false } }
  return $true
}

function Initialize-AppTsconfig {
  $appDir = Join-Path $RepoRoot "app"
  $appTsconfigPath = Join-Path $appDir "tsconfig.json"
  if (-not (Test-Path $appTsconfigPath)) { return }
  try {
    $raw = Get-Content $appTsconfigPath -Raw
    $tscfg = $raw | ConvertFrom-Json
    $changed = $false
    if ($tscfg.extends -and $tscfg.extends -eq "@tsconfig/react-native/tsconfig.json") {
      if (-not (Test-PackageInstalled "@tsconfig/react-native")) { Add-ToList $script:NeededDev "@tsconfig/react-native" }
    }
    if (-not $tscfg.PSObject.Properties.Name.Contains('compilerOptions')) {
      $tscfg | Add-Member -NotePropertyName compilerOptions -NotePropertyValue ([pscustomobject]@{}) -Force
    }
    $mr = $tscfg.compilerOptions.moduleResolution
    $modExists = $tscfg.compilerOptions.PSObject.Properties.Name.Contains('module')
    $mod = if ($modExists) { $tscfg.compilerOptions.module } else { $null }
    if ($mr -eq "bundler") {
      if (-not $mod -or $mod -eq "commonjs") {
        Copy-Item $appTsconfigPath "$appTsconfigPath.bak" -ErrorAction SilentlyContinue
        if ($modExists) { $tscfg.compilerOptions.module = "esnext" }
        else { $tscfg.compilerOptions | Add-Member -NotePropertyName module -NotePropertyValue "esnext" -Force }
        $changed = $true
        Write-Info "Patched app/tsconfig.json: module -> esnext for bundler resolution."
      }
    }
    if ($changed) {
      $tscfg | ConvertTo-Json -Depth 20 | Set-Content -Encoding utf8 $appTsconfigPath
      Write-Ok "Updated $appTsconfigPath"
    }
    if ($mr -eq "bundler" -and -not $NoTypes) {
      $tsVer = Get-LocalPkgVersion "typescript"
      if (-not $tsVer -or -not (Test-VersionGte $tsVer "5.3.0")) { Add-ToList $script:NeededDev "typescript@^5.3.0" }
      if (-not (Test-PackageInstalled "@types/node")) { Add-ToList $script:NeededDev "@types/node" }
    }
  } catch {
    Write-Warn "Could not parse or update $appTsconfigPath"
  }
}

function Initialize-ReanimatedWorkletsBabel {
  $appDir = Join-Path $RepoRoot "app"
  if (-not (Test-Path $appDir)) { Write-Warn "App folder not found; skipping Reanimated setup."; return }
  $appPkgPath = Join-Path $appDir "package.json"
  if (-not (Test-Path $appPkgPath)) { Write-Warn "app/package.json not found; skipping Reanimated setup."; return }

  try {
    Push-Location $appDir
    Write-Info "Ensuring react-native-reanimated via 'expo install'..."
    npx expo install react-native-reanimated
    if ($LASTEXITCODE -ne 0) { Write-Warn "expo install react-native-reanimated failed (continuing)." }
  } catch { Write-Warn "Could not run 'expo install' (continuing)." } finally { Pop-Location }

  # Only reanimated plugin in Babel (avoid worklets plugin duplication)
  $babelJs = Join-Path $appDir "babel.config.js"
  $template = @'
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
'@
  $needsRewrite = $true
  if (Test-Path $babelJs) {
    try {
      $text = Get-Content $babelJs -Raw
      if ($text -match "react-native-reanimated/plugin" -and $text -notmatch "react-native-worklets/plugin") {
        $needsRewrite = $false
        Write-Ok "app/babel.config.js already OK (only reanimated plugin)."
      }
    } catch { $needsRewrite = $true }
  }
  if ($needsRewrite) {
    if (Test-Path $babelJs) { Copy-Item $babelJs "$babelJs.bak" -ErrorAction SilentlyContinue; Write-Info "Backed up babel.config.js" }
    $template | Set-Content -Encoding ascii $babelJs
    Write-Ok "Wrote app/babel.config.js (reanimated plugin only)."
  }
}

function Initialize-ServerNodeDevTools {
  $dir = Join-Path $RepoRoot "server-node"
  if (-not (Test-Path $dir)) { return }
  $pkg = Get-PackageJson $dir; if ($null -eq $pkg) { return }
  $scriptsJson = ""; try { $scriptsJson = ($pkg.scripts | ConvertTo-Json -Compress) } catch {}
  $needsTsx     = ($scriptsJson -match '(?i)\btsx\b')      -and -not (Test-Path (Join-Path $dir "node_modules\tsx"))
  $needsTsNode  = ($scriptsJson -match '(?i)\bts-node\b')  -and -not (Test-Path (Join-Path $dir "node_modules\ts-node"))
  $needsNodemon = ($scriptsJson -match '(?i)\bnodemon\b')  -and -not (Test-Path (Join-Path $dir "node_modules\nodemon"))
  if ($NoInstall) { if ($needsTsx -or $needsTsNode -or $needsNodemon){ Write-Warn "Dev tools missing in server-node. Re-run without -NoInstall to auto-install." }; return }
  Push-Location $dir
  try {
    if ($needsTsx)    { Write-Info "Installing tsx in server-node...";    & $PackageManager @("install","-D","tsx") }
    if ($needsTsNode) { Write-Info "Installing ts-node in server-node...";& $PackageManager @("install","-D","ts-node") }
    if ($needsNodemon){ Write-Info "Installing nodemon in server-node...";& $PackageManager @("install","-D","nodemon") }
  } finally { Pop-Location }
}

function Initialize-ScriptsTsconfig {
  $cfgPath = Join-Path $RepoRoot "tsconfig.scripts.json"
  $shouldWrite = $true
  if (Test-Path $cfgPath) {
    try {
      $raw = Get-Content $cfgPath -Raw
      $json = $raw | ConvertFrom-Json
      $co = $json.compilerOptions
      if ($co -and $co.module -eq "NodeNext" -and $co.moduleResolution -eq "NodeNext" -and -not $json.PSObject.Properties.Name.Contains("extends")) { $shouldWrite = $false }
    } catch { $shouldWrite = $true }
  }
  if ($shouldWrite) {
    Write-Info "Writing NodeNext tsconfig for scripts (tsconfig.scripts.json)..."
    @'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist-scripts",
    "rootDir": ".",
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "types": ["node"],
    "skipLibCheck": true,
    "strict": false,
    "noEmitOnError": false
  },
  "include": ["scripts/**/*.ts","scripts/**/*.mts","scripts/**/*.cts","scripts/types/**/*.d.ts"],
  "exclude": ["node_modules"]
}
'@ | Set-Content -Encoding ascii $cfgPath
  }
  if (-not (Test-PackageInstalled "typescript")) { Add-ToList $script:NeededDev "typescript" }
  if (-not (Test-PackageInstalled "@types/node")) { Add-ToList $script:NeededDev "@types/node" }
}

# ---------- dependency scan ----------
$script:Needed     = New-Object System.Collections.Generic.List[string]
$script:NeededDev  = New-Object System.Collections.Generic.List[string]

$rootPkg = Get-PackageJson $RepoRoot
$depDeclared    = @{}
$devDepDeclared = @{}
if ($null -ne $rootPkg) {
  if ($rootPkg.PSObject.Properties.Name -contains 'dependencies')    { foreach ($p in $rootPkg.dependencies.PSObject.Properties)    { $depDeclared[$p.Name] = $true } }
  if ($rootPkg.PSObject.Properties.Name -contains 'devDependencies') { foreach ($p in $rootPkg.devDependencies.PSObject.Properties) { $devDepDeclared[$p.Name] = $true } }
}

$files = Get-AllSourceFiles $RepoRoot
Write-Info ("Scanning {0} source files for external imports..." -f $files.Count)
$allImports = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($f in $files) { foreach ($spec in (Get-ImportSpecsFromFile $f.FullName)) { [void]$allImports.Add($spec) } }
$imports = @(); foreach ($i in $allImports) { $imports += $i }; $imports = $imports | Sort-Object
if ($imports.Count -eq 0) { Write-Warn "No external imports found. Skipping auto-install." } else { Write-Info ("Found external packages: {0}" -f ([string]::Join(', ', $imports))) }

foreach ($pkgName in $imports) {
  $installed = Test-PackageInstalled $pkgName
  $declaredAsDev = $devDepDeclared.ContainsKey($pkgName)
  $declaredAsDep = $depDeclared.ContainsKey($pkgName)
  if (-not $installed) {
    if ($declaredAsDev -and -not $NoTypes) { Add-ToList $script:NeededDev $pkgName }
    else { if ($declaredAsDev -and -not $declaredAsDep) { Add-ToList $script:NeededDev $pkgName } else { Add-ToList $script:Needed $pkgName } }
  }
}

# ---------- TS + configs ----------
Initialize-AppTsconfig
$tsDetected = (Test-Path ".\tsconfig.json") -or (Test-Path ".\tsconfig.scripts.json") -or ($files | Where-Object { $_.Extension -in ".ts",".tsx",".mts",".cts" } | Select-Object -First 1)
if ($tsDetected -and -not $NoTypes) {
  if (-not (Test-PackageInstalled "typescript")) { Add-ToList $script:NeededDev "typescript" }
  if (-not (Test-PackageInstalled "@types/node")) { Add-ToList $script:NeededDev "@types/node" }
}
Initialize-ScriptsTsconfig

# ---------- install missing ----------
if (-not $NoInstall) {
  if ($script:Needed.Count -gt 0)   { Invoke-PMInstall -deps $script:Needed.ToArray() }
  if ($script:NeededDev.Count -gt 0){ Invoke-PMInstall -deps $script:NeededDev.ToArray() -Dev }
} else {
  Write-Warn "NoInstall set - skipping install."
  if ($script:Needed.Count -gt 0 -or $script:NeededDev.Count -gt 0) {
    Write-Info ("Would install runtime: {0}" -f ([string]::Join(', ', $script:Needed)))
    Write-Info ("Would install dev:     {0}" -f ([string]::Join(', ', $script:NeededDev)))
  }
}

# ---------- Reanimated/Babel ----------
Initialize-ReanimatedWorkletsBabel

# ---------- build TS utility scripts ----------
$tscfgScripts = Join-Path $RepoRoot "tsconfig.scripts.json"
if (Test-Path $tscfgScripts) {
  $tsc = Get-Command tsc -ErrorAction SilentlyContinue
  if ($tsc) { Write-Info "Building scripts (tsc -p tsconfig.scripts.json)..."; tsc -p tsconfig.scripts.json; if ($LASTEXITCODE -ne 0) { Write-Warn ("tsc exited {0} (continuing)" -f $LASTEXITCODE)} else { Write-Ok "Utility scripts built." } }
  else { Write-Warn "tsc not on PATH; trying npx..."; try { npx tsc -p tsconfig.scripts.json; if ($LASTEXITCODE -eq 0) { Write-Ok "Utility scripts built (npx)." } } catch {} }
} else { Write-Warn "tsconfig.scripts.json not found - skipping scripts build." }

# ---------- write Expo env (.env) ----------
$envPath = Join-Path $RepoRoot "app\.env"
@(
  "API_BASE_URL=$ApiBase",
  "EXPO_PUBLIC_API_BASE=$ApiBase",
  "EXPO_PUBLIC_API_BASE_URL=$ApiBase"
) | Set-Content -Encoding ascii $envPath
Write-Ok ("Wrote {0}" -f $envPath)

# ---------- ensure server-node dev tools ----------
Initialize-ServerNodeDevTools

# ---------- launch backend ----------
$serverDir = Join-Path $RepoRoot "server-node"
$appDir    = Join-Path $RepoRoot "app"
if (-not (Test-Path $serverDir)) { throw "Missing folder: $serverDir" }
if (-not (Test-Path $appDir))    { throw "Missing folder: $appDir" }

# Allow Expo Web on localhost + LAN host:WebPort
$allowedOrigins = "http://localhost:$WebPort,http://${LanHost}:$WebPort"

# Start server on 0.0.0.0:ApiPort so LAN devices can reach it
$serverCmd = @"
`$env:HOST = '0.0.0.0';
`$env:PORT = '$ApiPort';
`$env:ALLOWED_ORIGINS = '$allowedOrigins';
cd `"$serverDir`";
npm run dev
"@
Start-Process -FilePath $psExe -ArgumentList @("-NoLogo","-NoExit","-Command",$serverCmd) -WorkingDirectory $serverDir
Write-Ok ("Launched server-node on 0.0.0.0:{0} (npm run dev)." -f $ApiPort)

# ---------- launch Expo (LAN) ----------
# Export env so Expo advertises the LAN IP in bundles/URLs.
$expoBaseCmd = @"
cd `"$appDir`";
`$env:REACT_NATIVE_PACKAGER_HOSTNAME = '$LanHost';
`$env:EXPO_DEV_SERVER_HOST = '$LanHost';
`$env:API_BASE_URL = '$ApiBase';
"@

if ($Web) {
  # Web dev server on WebPort; Metro native remains on its own internal port.
  $expoCmd = $expoBaseCmd + "npx expo start --host lan --web --port $WebPort"
  Start-Process -FilePath $psExe -ArgumentList @("-NoLogo","-NoExit","-Command",$expoCmd) -WorkingDirectory $appDir
  Write-Ok ("Launched Expo Web on http://{0}:{1} (LAN)." -f $LanHost, $WebPort)
} else {
  $expoCmd = $expoBaseCmd + ("npx expo start --host lan" + ($(if($DevClient){" --dev-client"})))
  Start-Process -FilePath $psExe -ArgumentList @("-NoLogo","-NoExit","-Command",$expoCmd) -WorkingDirectory $appDir
  Write-Ok ("Launched Expo (Metro) in LAN mode (host {0})." -f $LanHost)
}

Pop-Location

Write-Info "Tips:"
Write-Host ("  - App points to API at {0}" -f $ApiBase) -ForegroundColor DarkGray
Write-Host ("  - Expo Web runs on {0}:{1} (use -Web to launch web)" -f $LanHost, $WebPort) -ForegroundColor DarkGray
Write-Host ("  - Metro advertises {0}; devices on your Wi-Fi can load the app" -f $LanHost) -ForegroundColor DarkGray
