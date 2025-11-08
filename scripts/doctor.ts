#!/usr/bin/env node
/**
 * codexrepo Doctor (No-Install Mode)
 * ----------------------------------
 * A fast, safe health check that NEVER installs or modifies dependencies.
 * - Verifies Node/runtime, lockfile/package manager, env files, and ports
 * - Ensures node_modules exists and dependency tree is consistent (npm/pnpm/yarn ls)
 * - Runs optional scripts if present: typecheck, lint, test, build (read-only)
 *
 * Usage:
 *   tsx doctor.ts [--skip-typecheck] [--skip-lint] [--skip-tests] [--skip-build] [--strict]
 *
 * Notes:
 * - This script performs no `install`, `ci`, or lockfile writes. It only *reads* and *executes* existing scripts.
 * - If a check fails, you'll get actionable guidance without changing your working tree.
 */
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as net from "node:net";

type Check = { name: string; run: () => Promise<void> | void };

const ROOT = process.cwd();

// ----------------------------- utils -----------------------------

function sh(cmd: string, args: string[] = [], opts: { cwd?: string } = {}) {
  const out = spawnSync(cmd, args, {
    shell: process.platform === "win32", // allow .cmd resolution on Windows
    cwd: opts.cwd ?? ROOT,
    stdio: "pipe",
    encoding: "utf8",
  });
  return out;
}

function which(cmd: string): boolean {
  const probe = process.platform === "win32" ? `${cmd}.cmd` : cmd;
  const res = sh(process.platform === "win32" ? "where" : "which", [probe]);
  return res.status === 0;
}

function readJSON<T = any>(p: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as T;
  } catch {
    return null;
  }
}

function ok(msg: string) {
  console.log(`\u001b[32m✔\u001b[0m ${msg}`);
}
function warn(msg: string) {
  console.warn(`\u001b[33m▲\u001b[0m ${msg}`);
}
function failThrow(msg: string, details?: unknown): never {
  if (details) {
    console.error(`\u001b[31m✖ ${msg}\u001b[0m\n${String(details)}`);
  } else {
    console.error(`\u001b[31m✖ ${msg}\u001b[0m`);
  }
  throw new Error(msg);
}
function heading(title: string) {
  console.log(`\n\u001b[1m== ${title}\u001b[0m`);
}

function exists(p: string) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function hasScript(name: string, pkg: any): boolean {
  return !!pkg?.scripts?.[name];
}

function runScript(script: string, pm: PackageManager, extraArgs: string[] = []) {
  switch (pm) {
    case "pnpm": return sh("pnpm", ["-s", "run", script, ...extraArgs]);
    case "yarn": return sh("yarn", ["-s", script, ...extraArgs]);
    case "npm":
    default:     return sh("npm", ["run", script, "--silent", ...extraArgs]);
  }
}

type PackageManager = "npm" | "pnpm" | "yarn";

function detectPM(): { pm: PackageManager; lockfile: "package-lock.json" | "pnpm-lock.yaml" | "yarn.lock" | null } {
  const npmLock = path.join(ROOT, "package-lock.json");
  const pnpmLock = path.join(ROOT, "pnpm-lock.yaml");
  const yarnLock = path.join(ROOT, "yarn.lock");
  if (exists(pnpmLock)) return { pm: "pnpm", lockfile: "pnpm-lock.yaml" };
  if (exists(yarnLock)) return { pm: "yarn", lockfile: "yarn.lock" };
  if (exists(npmLock))  return { pm: "npm",  lockfile: "package-lock.json" };
  // default to npm if none are present (rare)
  return { pm: "npm", lockfile: null };
}

function toNumber(v: string): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function isPortInUse(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const srv = net.createServer()
      .once("error", () => resolve(true))
      .once("listening", () => srv.close(() => resolve(false)))
      .listen(port, host);
  });
}

function parseDotEnvLike(filePath: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!exists(filePath)) return out;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[m[1]] = val;
  }
  return out;
}

// --------------------------- arguments ---------------------------

const argv = new Set(process.argv.slice(2));
const SKIP_TYPECHECK = argv.has("--skip-typecheck");
const SKIP_LINT      = argv.has("--skip-lint");
const SKIP_TESTS     = argv.has("--skip-tests");
const SKIP_BUILD     = argv.has("--skip-build");
const STRICT         = argv.has("--strict"); // fail on warnings

// --------------------------- checks ------------------------------

const checks: Check[] = [];

// 0) Banner / Mode
checks.push({
  name: "No-Install Mode Banner",
  run: () => {
    ok("Running in NO-INSTALL mode — no dependency changes will be made.");
  }
});

// 1) package.json presence
checks.push({
  name: "package.json present",
  run: () => {
    const pkgPath = path.join(ROOT, "package.json");
    if (!exists(pkgPath)) {
      failThrow("package.json not found at project root.");
    }
    ok("package.json found.");
  }
});

// 2) Node version & engines
checks.push({
  name: "Node.js version / engines",
  run: () => {
    const pkg = readJSON<any>(path.join(ROOT, "package.json"));
    const current = process.version; // e.g., v22.3.0
    if (pkg?.engines?.node) {
      // lightweight semver check: major only to avoid adding deps
      const want = String(pkg.engines.node);
      const majorWant = (want.match(/(\d+)(?:\.\d+)?/) ?? [])[1];
      const majorHave = (current.match(/v(\d+)/) ?? [])[1];
      if (majorWant && majorHave && majorWant !== majorHave) {
        const msg = `Node major version mismatch. engines.node=${want}, current=${current}.`;
        if (STRICT) failThrow(msg); else warn(msg);
      } else {
        ok(`Node version OK (${current}).`);
      }
    } else {
      ok(`Node version = ${current} (no engines.node specified).`);
    }
  }
});

// 3) Package manager / lockfile
checks.push({
  name: "Package manager & lockfile sanity",
  run: () => {
    const { pm, lockfile } = detectPM();
    const pmExists = which(pm);
    if (!pmExists) {
      const msg = `Package manager "${pm}" not found in PATH.`;
      if (STRICT) failThrow(msg); else warn(msg);
    } else {
      ok(`Detected ${pm} (lockfile: ${lockfile ?? "none"}).`);
    }
    // Do not install; only verify node_modules presence
    if (!exists(path.join(ROOT, "node_modules"))) {
      const msg = "node_modules directory is missing — packages appear not installed.";
      if (STRICT) failThrow(msg); else warn(msg);
    } else {
      ok("node_modules present.");
    }
  }
});

// 4) Dependency tree (read-only)
checks.push({
  name: "Dependency tree health (ls)",
  run: () => {
    const { pm } = detectPM();
    const cmd = pm === "pnpm" ? ["ls", "--depth", "0"] :
                pm === "yarn" ? ["list", "--depth", "0"] :
                                ["ls", "--depth", "0"];
    const res = sh(pm, cmd);
    if (res.status !== 0) {
      const msg = `Dependency tree has issues (exit ${res.status}). Output:\n${res.stdout}\n${res.stderr}`;
      if (STRICT) failThrow(msg); else warn(msg);
    } else {
      ok("Dependency tree looks consistent.");
    }
  }
});

// 5) .env sanity (compare to .env.example if present)
checks.push({
  name: "Environment file keys",
  run: () => {
    const envExamplePath = path.join(ROOT, ".env.example");
    if (!exists(envExamplePath)) {
      warn(".env.example not found (skipping env key comparison).");
      return;
    }
    const example = parseDotEnvLike(envExamplePath);
    const envReal = parseDotEnvLike(path.join(ROOT, ".env"));
    const missing: string[] = [];
    for (const k of Object.keys(example)) {
      if (!(k in envReal) && !(k in process.env)) missing.push(k);
    }
    if (missing.length) {
      const msg = `Missing env keys: ${missing.join(", ")}.`;
      if (STRICT) failThrow(msg); else warn(msg);
    } else {
      ok(".env keys present.");
    }
  }
});

// 6) Port conflicts (common dev ports)
checks.push({
  name: "Port conflicts",
  run: async () => {
    const ports = new Set<number>();
    // read from package.json scripts for common dev servers
    const pkg = readJSON<any>(path.join(ROOT, "package.json")) ?? {};
    const scripts = pkg.scripts ?? {};
    const COMMON = [3000, 3001, 5173, 8080, 8000, 4200];
    COMMON.forEach(p => ports.add(p));
    const scriptStr = Object.values<string>(scripts).join(" ");
    const portMatches = scriptStr.match(/--port\s+(\d+)/g) ?? [];
    for (const m of portMatches) {
      const n = toNumber(m.replace("--port", "").trim());
      if (n) ports.add(n);
    }
    const conflicts: number[] = [];
    for (const p of ports) {
      if (await isPortInUse(p)) conflicts.push(p);
    }
    if (conflicts.length) {
      const msg = `Ports in use on localhost: ${conflicts.join(", ")}.`;
      if (STRICT) failThrow(msg); else warn(msg);
    } else {
      ok("No common dev port conflicts detected.");
    }
  }
});

// 7) Typecheck (optional)
checks.push({
  name: "Typecheck",
  run: () => {
    if (SKIP_TYPECHECK) { warn("Skipped (--skip-typecheck)."); return; }
    const pkg = readJSON<any>(path.join(ROOT, "package.json")) ?? {};
    if (hasScript("typecheck", pkg)) {
      const { pm } = detectPM();
      const res = runScript("typecheck", pm);
      if (res.status !== 0) {
        failThrow("Typecheck failed.\n" + (res.stdout || res.stderr));
      }
      ok("Typecheck passed.");
    } else if (exists(path.join(ROOT, "tsconfig.json"))) {
      // Fallback: try tsc --noEmit if available
      if (!which("tsc")) { warn("No 'typecheck' script and 'tsc' not found. Skipping."); return; }
      const res = sh("tsc", ["--noEmit"]);
      if (res.status !== 0) failThrow("tsc --noEmit failed.\n" + (res.stdout || res.stderr));
      ok("tsc --noEmit passed.");
    } else {
      warn("No typecheck script or tsconfig.json found. Skipping.");
    }
  }
});

// 8) Lint (optional)
checks.push({
  name: "Lint",
  run: () => {
    if (SKIP_LINT) { warn("Skipped (--skip-lint)."); return; }
    const pkg = readJSON<any>(path.join(ROOT, "package.json")) ?? {};
    if (hasScript("lint", pkg)) {
      const { pm } = detectPM();
      const res = runScript("lint", pm);
      if (res.status !== 0) failThrow("Lint failed.\n" + (res.stdout || res.stderr));
      ok("Lint passed.");
    } else {
      warn("No 'lint' script found. Skipping.");
    }
  }
});

// 9) Tests (optional)
checks.push({
  name: "Tests",
  run: () => {
    if (SKIP_TESTS) { warn("Skipped (--skip-tests)."); return; }
    const pkg = readJSON<any>(path.join(ROOT, "package.json")) ?? {};
    const scriptName = hasScript("test:ci", pkg) ? "test:ci" : hasScript("test", pkg) ? "test" : null;
    if (scriptName) {
      const { pm } = detectPM();
      const res = runScript(scriptName, pm, ["--silent"]);
      if (res.status !== 0) failThrow("Tests failed.\n" + (res.stdout || res.stderr));
      ok("Tests passed.");
    } else {
      warn("No 'test' or 'test:ci' script found. Skipping.");
    }
  }
});

// 10) Build (optional)
checks.push({
  name: "Build",
  run: () => {
    if (SKIP_BUILD) { warn("Skipped (--skip-build)."); return; }
    const pkg = readJSON<any>(path.join(ROOT, "package.json")) ?? {};
    if (hasScript("build", pkg)) {
      const { pm } = detectPM();
      const res = runScript("build", pm);
      if (res.status !== 0) failThrow("Build failed.\n" + (res.stdout || res.stderr));
      ok("Build passed.");
    } else {
      warn("No 'build' script found. Skipping.");
    }
  }
});

// ---------------------------- runner -----------------------------

async function main() {
  let failures = 0;
  for (const c of checks) {
    try {
      heading(c.name);
      await c.run();
    } catch (e) {
      failures++;
      console.error(e instanceof Error ? e.message : String(e));
    }
  }
  heading("Doctor Summary");
  if (failures) {
    console.error(`\u001b[31m${failures} check(s) failed.\u001b[0m`);
    process.exitCode = 1;
  } else {
    ok("All checks passed.");
  }
}

main().catch(e => {
  console.error("\u001b[31mDoctor crashed\u001b[0m");
  console.error(e);
  process.exitCode = 1;
});
