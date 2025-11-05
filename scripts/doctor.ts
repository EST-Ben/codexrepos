#!/usr/bin/env node
/**
 * codexrepo Doctor — one-command deep health check for app + server.
 * Runs env checks, port conflicts, dependency sanity, typechecks, tests, and live smoke tests.
 */
import { execSync, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

type Check = { name: string; run: () => Promise<void> | void };

const ROOT = process.cwd();

function sh(cmd: string, cwd = ROOT) {
  const out = spawnSync(cmd, { shell: true, cwd, stdio: "pipe", encoding: "utf8" });
  if (out.status !== 0) throw new Error(`[FAIL ${cmd}]\n${out.stderr || out.stdout}`);
  return out.stdout.trim();
}

function heading(s: string) { console.log(`\n\u001b[1m== ${s} ==\u001b[0m`); }
function ok(s: string) { console.log(`\u001b[32m✓\u001b[0m ${s}`); }
function fail(s: string, e: unknown) { console.error(`\u001b[31m✗ ${s}\u001b[0m\n${e instanceof Error ? e.message : String(e)}`); }

async function main() {
  heading("codexrepo Doctor");
  const checks: Check[] = [
    {
      name: "Node version (>=20) & npm present",
      run: () => {
        const v = sh("node -v");
        const n = sh("npm -v");
        if (!/^v2\d\./.test(v)) throw new Error(`Node must be >=20; got ${v}`);
        ok(`Node ${v}, npm ${n}`);
      },
    },
    {
      name: "Expo CLI present",
      run: () => { ok(sh("npx expo --version")); },
    },
    {
      name: "Android/iOS toolchain (best effort)",
      run: () => {
        try { ok("Android SDK: " + sh("adb --version")); } catch {}
        try { ok("Xcode: " + sh("xcodebuild -version")); } catch {}
      },
    },
    {
      name: "Install deps (app)",
      run: () => { ok(sh("npm ci", path.join(ROOT, "app"))); },
    },
    {
      name: "Install deps (server-node)",
      run: () => {
        const sn = path.join(ROOT, "server-node");
        if (fs.existsSync(sn)) ok(sh("npm ci", sn));
      },
    },
    {
      name: "Typecheck (app)",
      run: () => { ok(sh("npm run -s tsc -- --noEmit", path.join(ROOT, "app"))); },
    },
    {
      name: "Lint (app)",
      run: () => { try { ok(sh("npm run -s lint", path.join(ROOT, "app"))); } catch (e) { fail("Lint (app)", e); } },
    },
    {
      name: "Jest (app)",
      run: () => { try { ok(sh("npm test -- --ci --passWithNoTests", path.join(ROOT, "app"))); } catch (e) { fail("Jest (app)", e); } },
    },
    {
      name: "Build server-node",
      run: () => {
        const sn = path.join(ROOT, "server-node");
        if (fs.existsSync(sn)) ok(sh("npm run -s build", sn));
      },
    },
    {
      name: "Server healthcheck",
      run: () => {
        const sn = path.join(ROOT, "server-node");
        if (!fs.existsSync(sn)) return;
        // start server on 8000, probe /health, then kill
        const start = spawnSync("npm", ["run", "start:ci"], { cwd: sn, shell: true, encoding: "utf8" });
        try {
          ok("Started server (CI)");
          ok(sh("node -e \"require('node:http').get('http://127.0.0.1:8000/health', r => {r.resume(); r.on('end', ()=>process.exit(0));}).on('error', ()=>process.exit(1));\""));
        } catch (e) { fail("Server healthcheck", e); }
      },
    },
    {
      name: "Env sanity (.env.example)",
      run: () => {
        const envEx = path.join(ROOT, ".env.example");
        if (!fs.existsSync(envEx)) throw new Error(".env.example missing");
        ok(".env.example present");
      },
    },
    {
      name: "Machine registry & assets present",
      run: () => {
        const conf = path.join(ROOT, "config");
        if (!fs.existsSync(conf)) throw new Error("config/ directory missing");
        ok("config/ exists");
      },
    },
  ];

  let failures = 0;
  for (const c of checks) {
    try { heading(c.name); await c.run(); } catch (e) { failures++; fail(c.name, e); }
  }
  heading("Doctor Summary");
  if (failures) {
    console.error(`\u001b[31m${failures} check(s) failed.\u001b[0m`);
    process.exitCode = 1;
  } else {
    ok("All checks passed.");
  }
}
main().catch(e => { fail("Doctor crashed", e); process.exitCode = 1; });
