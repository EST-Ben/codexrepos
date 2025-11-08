#!/usr/bin/env node
// RESUME_MARKER: CHK_6
/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(__dirname, '..', '..');
const OPENAPI_PATH = path.join(ROOT, 'openapi.json');
const GENERATED_TYPES = path.join(ROOT, 'types', 'generated.ts');

async function fetchOpenApi(apiBase: string): Promise<string | null> {
  try {
    const endpoint = new URL('/openapi.json', apiBase.endsWith('/') ? apiBase : `${apiBase}/`).toString();
    const { status, body } = await httpRequest(endpoint);
    if (status >= 200 && status < 300) {
      console.log(`Fetched openapi.json from ${endpoint}`);
      return body;
    }
    console.warn(`▲ openapi.json request returned status ${status}`);
    return null;
  } catch (error) {
    console.warn(`▲ Failed to fetch openapi.json: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

function commandExists(command: string): boolean {
  const probe = spawnSync(command, ['--version'], { stdio: 'ignore' });
  return probe.status === 0;
}

function runPythonFallback(): string | null {
  if (!commandExists('python')) {
    console.warn('▲ Python not found on PATH; skipping local openapi generation.');
    return null;
  }
  const script = `from server.main import app\nfrom fastapi.openapi.utils import get_openapi\nimport json\nopenapi = get_openapi(title=app.title, version=getattr(app, "version", "0.0.0") or "0.0.0", routes=app.routes)\nprint(json.dumps(openapi))`;
  const result = spawnSync('python', ['-c', script], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.warn('▲ Python could not generate openapi.json. Ensure server.main:app is importable.');
    if (result.stderr) {
      console.warn(result.stderr.trim());
    }
    return null;
  }
  console.log('Generated openapi.json via local Python fallback.');
  return result.stdout;
}

async function main(): Promise<void> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:8000';
  let source: string | null = await fetchOpenApi(apiUrl);

  if (!source && fs.existsSync(OPENAPI_PATH)) {
    console.log(`Using existing ${OPENAPI_PATH}`);
    source = fs.readFileSync(OPENAPI_PATH, 'utf8');
  }

  if (!source) {
    source = runPythonFallback();
  }

  if (!source) {
    console.error('✖ Unable to obtain openapi.json. Start the API server or ensure Python is available.');
    process.exitCode = 1;
    return;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    console.error('✖ Received invalid JSON for openapi specification.');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
    return;
  }

  fs.writeFileSync(OPENAPI_PATH, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${OPENAPI_PATH}`);

  if (!fs.existsSync(path.dirname(GENERATED_TYPES))) {
    fs.mkdirSync(path.dirname(GENERATED_TYPES), { recursive: true });
  }

  if (!commandExists('npx')) {
    console.warn('▲ npx not found. Run openapi-typescript manually to update types/generated.ts');
    return;
  }

  const npxResult = spawnSync('npx', ['openapi-typescript', OPENAPI_PATH, '-o', GENERATED_TYPES], {
    stdio: 'inherit',
  });
  if (npxResult.status !== 0) {
    console.warn('▲ openapi-typescript did not run successfully. Install dependencies and retry.');
    process.exitCode = npxResult.status ?? 1;
    return;
  }
  console.log('Updated types/generated.ts');
}

function httpRequest(urlString: string): Promise<{ status: number; body: string }> {
  const target = new URL(urlString);
  const isHttps = target.protocol === 'https:';
  const client = isHttps ? https : http;
  const options: https.RequestOptions = {
    method: 'GET',
    hostname: target.hostname,
    port: target.port || (isHttps ? 443 : 80),
    path: `${target.pathname}${target.search}`,
  };

  return new Promise((resolve, reject) => {
    const req = client.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => {
        resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

void main();
