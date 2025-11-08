#!/usr/bin/env node
"use strict";
// RESUME_MARKER: CHK_6
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_http_1 = __importDefault(require("node:http"));
const node_https_1 = __importDefault(require("node:https"));
const node_child_process_1 = require("node:child_process");
const ROOT = node_path_1.default.resolve(__dirname, '..', '..');
const OPENAPI_PATH = node_path_1.default.join(ROOT, 'openapi.json');
const GENERATED_TYPES = node_path_1.default.join(ROOT, 'types', 'generated.ts');
async function fetchOpenApi(apiBase) {
    try {
        const endpoint = new URL('/openapi.json', apiBase.endsWith('/') ? apiBase : `${apiBase}/`).toString();
        const { status, body } = await httpRequest(endpoint);
        if (status >= 200 && status < 300) {
            console.log(`Fetched openapi.json from ${endpoint}`);
            return body;
        }
        console.warn(`▲ openapi.json request returned status ${status}`);
        return null;
    }
    catch (error) {
        console.warn(`▲ Failed to fetch openapi.json: ${error instanceof Error ? error.message : error}`);
        return null;
    }
}
function commandExists(command) {
    const probe = (0, node_child_process_1.spawnSync)(command, ['--version'], { stdio: 'ignore' });
    return probe.status === 0;
}
function runPythonFallback() {
    if (!commandExists('python')) {
        console.warn('▲ Python not found on PATH; skipping local openapi generation.');
        return null;
    }
    const script = `from server.main import app\nfrom fastapi.openapi.utils import get_openapi\nimport json\nopenapi = get_openapi(title=app.title, version=getattr(app, "version", "0.0.0") or "0.0.0", routes=app.routes)\nprint(json.dumps(openapi))`;
    const result = (0, node_child_process_1.spawnSync)('python', ['-c', script], { encoding: 'utf8' });
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
async function main() {
    const apiUrl = process.env.API_URL ?? 'http://localhost:8000';
    let source = await fetchOpenApi(apiUrl);
    if (!source && node_fs_1.default.existsSync(OPENAPI_PATH)) {
        console.log(`Using existing ${OPENAPI_PATH}`);
        source = node_fs_1.default.readFileSync(OPENAPI_PATH, 'utf8');
    }
    if (!source) {
        source = runPythonFallback();
    }
    if (!source) {
        console.error('✖ Unable to obtain openapi.json. Start the API server or ensure Python is available.');
        process.exitCode = 1;
        return;
    }
    let parsed;
    try {
        parsed = JSON.parse(source);
    }
    catch (error) {
        console.error('✖ Received invalid JSON for openapi specification.');
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
        return;
    }
    node_fs_1.default.writeFileSync(OPENAPI_PATH, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${OPENAPI_PATH}`);
    if (!node_fs_1.default.existsSync(node_path_1.default.dirname(GENERATED_TYPES))) {
        node_fs_1.default.mkdirSync(node_path_1.default.dirname(GENERATED_TYPES), { recursive: true });
    }
    if (!commandExists('npx')) {
        console.warn('▲ npx not found. Run openapi-typescript manually to update types/generated.ts');
        return;
    }
    const npxResult = (0, node_child_process_1.spawnSync)('npx', ['openapi-typescript', OPENAPI_PATH, '-o', GENERATED_TYPES], {
        stdio: 'inherit',
    });
    if (npxResult.status !== 0) {
        console.warn('▲ openapi-typescript did not run successfully. Install dependencies and retry.');
        process.exitCode = npxResult.status ?? 1;
        return;
    }
    console.log('Updated types/generated.ts');
}
function httpRequest(urlString) {
    const target = new URL(urlString);
    const isHttps = target.protocol === 'https:';
    const client = isHttps ? node_https_1.default : node_http_1.default;
    const options = {
        method: 'GET',
        hostname: target.hostname,
        port: target.port || (isHttps ? 443 : 80),
        path: `${target.pathname}${target.search}`,
    };
    return new Promise((resolve, reject) => {
        const req = client.request(options, (res) => {
            const chunks = [];
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
