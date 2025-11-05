#!/usr/bin/env bash
set -euo pipefail
npm --prefix server-node run build >/dev/null 2>&1 || npm --prefix server-node run build
node <<'NODE'
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from './server-node/dist/index.js';

const app = await createServer();
await app.ready();
const openapi = app.swagger();
const target = resolve('openapi.json');
writeFileSync(target, JSON.stringify(openapi, null, 2));
await app.close();
console.log('Wrote openapi.json');
NODE
npm exec -- openapi-typescript openapi.json -o types/generated.ts
echo "Updated types/generated.ts"
