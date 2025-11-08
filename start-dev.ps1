<#
  start-dev.ps1 — smart auto-install + tsconfig/reanimated fixes + dev launcher
  - Scans repo for external imports; installs ONLY missing deps
  - React Native/Expo tsconfig fixes:
      * installs @tsconfig/react-native if app/tsconfig.json extends it
      * if moduleResolution == "bundler" and module == "commonjs"/missing, set module = "esnext"
      * ensures TypeScript >= 5.3 and @types/node when TS is in use
  - Reanimated/Worklets/Babel auto-setup in app/ (write ONLY 'react-native-reanimated/plugin' to avoid duplicates)
  - Ensures server-node dev runner (tsx / ts-node / nodemon) is installed if referenced
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

function Write-Info($m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Write-Warn($m){ Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Write-Ok($m){ Write-Host "[OK]   $m" -ForegroundColor Green }
function Write-Err($m){ Write-Host "[ERR]  $m" -ForegroundColor Red }

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
Write-Info "API base -> $ApiBase"

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

  # ESM import ... from 'x'  OR  import 'x'
  $rx1 = [regex]"(?ms)import\s+(?:[^`'"";]+?\s+from\s+)?['""]([^'""]+)['""]"
  $out += ($rx1.Matches($text) | ForEach-Object { $_.Groups[1].Value })

  # CJS require('x')
  $rx2 = [regex]"(?ms)require\(\s*['""]([^'""]+)['""]\s*\)"
  $out += ($rx2.Matches($text) | ForEach-Object { $_.Groups[1].Value })

  # Dynamic import('x')
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

  $devTag = if ($Dev) { " [dev]" } else { "" }
  Write-Info ("Installing ({0}): {1}{2}" -f $PackageManager, ([string]::Join(", ", $deps)), $devTag)

  & $PackageManager @pmArgs
  if ($LASTEXITCODE -ne 0) { throw "$PackageManager install failed (exit $LASTEXITCODE)" }

  Write-Ok ("Installed: {0}{1}" -f ([string]::Join(", ", $deps)), $devTag)
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
  $tsBundlerMode = $false

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
      $tsBundlerMode = $true
      if (-not $mod -or $mod -eq "commonjs") {
        Copy-Item $appTsconfigPath "$appTsconfigPath.bak" -ErrorAction SilentlyContinue
        if ($modExists) { $tscfg.compilerOptions.module = "esnext" }
        else { $tscfg.compilerOptions | Add-Member -NotePropertyName module -NotePropertyValue "esnext" -Force }
        $changed = $true
        Write-Info "Patched app/tsconfig.json: module -> esnext for bundler resolution. Backup created."
      }
    }

    if ($changed) {
      $tscfg | ConvertTo-Json -Depth 20 | Set-Content -Encoding utf8 $appTsconfigPath
      Write-Ok "Updated $appTsconfigPath"
    }

    if ($tsBundlerMode -and -not $NoTypes) {
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
  if (-not (Test-Path $appDir)) {
    Write-Warn "App folder not found; skipping Reanimated/Worklets setup."
    return
  }

  $appPkgPath = Join-Path $appDir "package.json"
  if (-not (Test-Path $appPkgPath)) {
    Write-Warn "app/package.json not found; skipping Reanimated/Worklets setup."
    return
  }

  try {
    Push-Location $appDir
    Write-Info "Ensuring react-native-reanimated version via 'expo install'..."
    npx expo install react-native-reanimated
    if ($LASTEXITCODE -ne 0) { Write-Warn "expo install react-native-reanimated failed (continuing)." }
  } catch {
    Write-Warn "Could not run 'npx expo install react-native-reanimated' (continuing)."
  } finally {
    Pop-Location
  }

  # Keep worklets package installed, but DO NOT list its plugin in Babel to avoid duplicates
  $workletsPath = Join-Path $appDir "node_modules\react-native-worklets"
  if (-not (Test-Path $workletsPath)) {
    Write-Info "Installing react-native-worklets in app/ (needed by reanimated/plugin)..."
    Push-Location $appDir
    switch ($PackageManager) {
      "npm"  { npm install -D react-native-worklets }
      "pnpm" { pnpm add -D react-native-worklets }
      "yarn" { yarn add -D react-native-worklets }
    }
    if ($LASTEXITCODE -ne 0) { Write-Warn "Installing react-native-worklets failed (continuing)." }
    Pop-Location
  } else {
    Write-Ok "react-native-worklets already installed in app/."
  }

  # Ensure babel.config.js contains ONLY 'react-native-reanimated/plugin'
  $babelJs = Join-Path $appDir "babel.config.js"
  $template = @'
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin'
    ],
  };
};
'@

  $needsRewrite = $true
  if (Test-Path $babelJs) {
    try {
      $text = Get-Content $babelJs -Raw
      $hasReanimated = $text -match "react-native-reanimated/plugin"
      $hasWorklets   = $text -match "react-native-worklets/plugin"
      if ($hasReanimated -and -not $hasWorklets) {
        $needsRewrite = $false
        Write-Ok "app/babel.config.js already lists only reanimated/plugin."
      }
    } catch {
      Write-Warn "Could not read existing app/babel.config.js; will rewrite with a backup."
      $needsRewrite = $true
    }
  }

  if ($needsRewrite) {
    if (Test-Path $babelJs) {
      Copy-Item $babelJs "$babelJs.bak" -ErrorAction SilentlyContinue
      Write-Info "Backed up existing app/babel.config.js to babel.config.js.bak"
    }
    $template | Set-Content -Encoding ascii $babelJs
    Write-Ok "Wrote app/babel.config.js with ONLY 'react-native-reanimated/plugin'."
  }
}

function Initialize-ServerNodeDevTools {
  $dir = Join-Path $RepoRoot "server-node"
  if (-not (Test-Path $dir)) { return }

  $pkg = Get-PackageJson $dir
  if ($null -eq $pkg) { return }

  $scriptsJson = ""
  try { $scriptsJson = ($pkg.scripts | ConvertTo-Json -Compress) } catch { }

  $needsTsx = $false
  $needsTsNode = $false
  $needsNodemon = $false

  if ($scriptsJson -match '(?i)\btsx\b')      { $needsTsx = -not (Test-Path (Join-Path $dir "node_modules\tsx")) }
  if ($scriptsJson -match '(?i)\bts-node\b')  { $needsTsNode = -not (Test-Path (Join-Path $dir "node_modules\ts-node")) }
  if ($scriptsJson -match '(?i)\bnodemon\b')  { $needsNodemon = -not (Test-Path (Join-Path $dir "node_modules\nodemon")) }

  if ($NoInstall) {
    if ($needsTsx -or $needsTsNode -or $needsNodemon) {
      Write-Warn "Dev tools missing in server-node (tsx/ts-node/nodemon). Re-run without -NoInstall to auto-install."
    }
    return
  }

  Push-Location $dir
  try {
    if ($needsTsx) {
      Write-Info "Installing tsx in server-node..."
      switch ($PackageManager) {
        "npm"  { npm install -D tsx }
        "pnpm" { pnpm add -D tsx }
        "yarn" { yarn add -D tsx }
      }
    }
    if ($needsTsNode) {
      Write-Info "Installing ts-node in server-node..."
      switch ($PackageManager) {
        "npm"  { npm install -D ts-node }
        "pnpm" { pnpm add -D ts-node }
        "yarn" { yarn add -D ts-node }
      }
    }
    if ($needsNodemon) {
      Write-Info "Installing nodemon in server-node..."
      switch ($PackageManager) {
        "npm"  { npm install -D nodemon }
        "pnpm" { pnpm add -D nodemon }
        "yarn" { yarn add -D nodemon }
      }
    }
  } finally {
    Pop-Location
  }
}

# ------------------ your requested function: Initialize-ScriptsTsconfig ------------------
function Initialize-ScriptsTsconfig {
  $cfgPath = Join-Path $RepoRoot "tsconfig.scripts.json"
  $shouldWrite = $true

  if (Test-Path $cfgPath) {
    try {
      $raw = Get-Content $cfgPath -Raw
      $json = $raw | ConvertFrom-Json
      $co = $json.compilerOptions
      if ($co -and
          $co.module -eq "NodeNext" -and
          $co.moduleResolution -eq "NodeNext" -and
          -not $json.PSObject.Properties.Name.Contains("extends")) {
        $shouldWrite = $false
      }
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
  "include": [
    "scripts/**/*.ts",
    "scripts/**/*.mts",
    "scripts/**/*.cts",
    "scripts/types/**/*.d.ts"
  ],
  "exclude": ["node_modules"]
}
'@ | Set-Content -Encoding ascii $cfgPath
  }

  # Ensure TypeScript + @types/node are present (the script already guards this, but belt & braces)
  if (-not (Test-PackageInstalled "typescript")) { Add-ToList $script:NeededDev "typescript" }
  if (-not (Test-PackageInstalled "@types/node")) { Add-ToList $script:NeededDev "@types/node" }
}

# ------------------ gather current deps (safe) ------------------
$script:Needed     = New-Object System.Collections.Generic.List[string]
$script:NeededDev  = New-Object System.Collections.Generic.List[string]

$rootPkg = Get-PackageJson $RepoRoot
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
Write-Info "Scanning $($files.Count) source files for external imports..."
$allImports = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($f in $files) {
  foreach ($spec in (Get-ImportSpecsFromFile $f.FullName)) { [void]$allImports.Add($spec) }
}
# HashSet -> array, then sort
$imports = @()
foreach ($i in $allImports) { $imports += $i }
$imports = $imports | Sort-Object

if ($imports.Count -eq 0) { Write-Warn "No external imports found. Skipping auto-install." }
else { Write-Info "Found external packages: $([string]::Join(', ', $imports))" }

foreach ($pkgName in $imports) {
  $installed = Test-PackageInstalled $pkgName
  $declaredAsDev = $devDepDeclared.ContainsKey($pkgName)
  $declaredAsDep = $depDeclared.ContainsKey($pkgName)

  if (-not $installed) {
    if ($declaredAsDev -and -not $NoTypes) {
      Add-ToList $script:NeededDev $pkgName
    } else {
      if ($declaredAsDev -and -not $declaredAsDep) { Add-ToList $script:NeededDev $pkgName }
      else { Add-ToList $script:Needed $pkgName }
    }
  }
}

# ------------------ tsconfig and TS tooling alignment ------------------
Initialize-AppTsconfig

# If any TS is detected anywhere, ensure basic tooling
$tsDetected = (Test-Path ".\tsconfig.json") -or (Test-Path ".\tsconfig.scripts.json") -or ($files | Where-Object { $_.Extension -in ".ts",".tsx",".mts",".cts" } | Select-Object -First 1)
if ($tsDetected -and -not $NoTypes) {
  if (-not (Test-PackageInstalled "typescript")) { Add-ToList $script:NeededDev "typescript" }
  if (-not (Test-PackageInstalled "@types/node")) { Add-ToList $script:NeededDev "@types/node" }
}

# ------------------ ensure scripts tsconfig (your requested step) ------------------
Initialize-ScriptsTsconfig

# ------------------ install missing ------------------
if (-not $NoInstall) {
  if ($script:Needed.Count -eq 0 -and $script:NeededDev.Count -eq 0) {
    Write-Ok "All dependencies already present. No install needed."
  } else {
    if ($script:Needed.Count -gt 0)   { Invoke-PMInstall -deps $script:Needed.ToArray() }
    if ($script:NeededDev.Count -gt 0){ Invoke-PMInstall -deps $script:NeededDev.ToArray() -Dev }
  }
} else {
  Write-Warn "NoInstall set - skipping install."
  if ($script:Needed.Count -gt 0 -or $script:NeededDev.Count -gt 0) {
    Write-Info "Would install runtime: $([string]::Join(', ', $script:Needed))"
    Write-Info "Would install dev:     $([string]::Join(', ', $script:NeededDev))"
  }
}

# ------------------ Reanimated / Worklets / Babel in app ------------------
Initialize-ReanimatedWorkletsBabel

# ------------------ build TS utility scripts ------------------
$tscfgScripts = Join-Path $RepoRoot "tsconfig.scripts.json"
if (Test-Path $tscfgScripts) {
  $tsc = Get-Command tsc -ErrorAction SilentlyContinue
  if ($tsc) {
    Write-Info "Building TypeScript utility scripts (tsc -p tsconfig.scripts.json)..."
    tsc -p tsconfig.scripts.json
    if ($LASTEXITCODE -ne 0) { Write-Warn "TypeScript build had errors (continuing). Exit code: $LASTEXITCODE" }
    else { Write-Ok "Utility scripts built." }
  } else {
    Write-Warn "tsc not on PATH; trying npx..."
    try {
      npx tsc -p tsconfig.scripts.json
      if ($LASTEXITCODE -eq 0) { Write-Ok "Utility scripts built via npx." }
    } catch { }
  }
} else {
  Write-Warn "tsconfig.scripts.json not found - skipping scripts build."
}

# ------------------ write Expo env ------------------
$envPath = Join-Path $RepoRoot "app\.env"
"EXPO_PUBLIC_API_BASE=$ApiBase" | Set-Content -Encoding ascii $envPath
Write-Ok "Wrote $envPath"

# ------------------ ensure server-node dev tools (tsx etc.) ------------------
Initialize-ServerNodeDevTools

# ------------------ launch backend + app ------------------
$serverDir = Join-Path $RepoRoot "server-node"
$appDir    = Join-Path $RepoRoot "app"
if (-not (Test-Path $serverDir)) { throw "Missing folder: $serverDir" }
if (-not (Test-Path $appDir))    { throw "Missing folder: $appDir" }

$serverArgs = @("-NoLogo","-NoExit","-Command","cd `"$serverDir`"; npm run dev")
Start-Process -FilePath $psExe -ArgumentList $serverArgs -WorkingDirectory $serverDir
Write-Ok "Launched server-node (npm run dev) in a new window."

$serveAppLauncher = Join-Path $RepoRoot "serve_app.ps1"
if (Test-Path $serveAppLauncher) {
  $cmd = "cd `"$RepoRoot`"; .\serve_app.ps1 -ApiUrl `"$ApiBase`""
  if ($DevClient) { $cmd += " -DevClient" }
  $expoArgs = @("-NoLogo","-NoExit","-Command", $cmd)
  Start-Process -FilePath $psExe -ArgumentList $expoArgs -WorkingDirectory $RepoRoot
  Write-Ok "Launched Expo via serve_app.ps1."
} else {
  $expoCmd = if ($Web) { "npx expo start --web" } else { "npx expo start" }
  if ($DevClient) { $expoCmd += " --dev-client" }
  $expoArgs = @("-NoLogo","-NoExit","-Command","cd `"$appDir`"; $expoCmd")
  Start-Process -FilePath $psExe -ArgumentList $expoArgs -WorkingDirectory $appDir
  Write-Ok "Launched Expo ($expoCmd) in a new window."
}

Pop-Location

Write-Info "Tips:"
Write-Host "  - Use -DryRun to preview installs; -NoTypes to skip @types/* and TS tooling." -ForegroundColor DarkGray
Write-Host "  - Use -PackageManager pnpm|yarn to switch installers." -ForegroundColor DarkGray
Write-Host "  - If VS Code still warns, switch to the workspace TypeScript and reload the window." -ForegroundColor DarkGray
