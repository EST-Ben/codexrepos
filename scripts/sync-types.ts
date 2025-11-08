#!/usr/bin/env node
// RESUME_MARKER: CHK_9
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const SOURCE = path.join(ROOT, 'types', 'api.ts');
const TARGET = path.join(ROOT, 'server-node', 'src', '_types', 'api.ts');

export function syncTypes(): void {
  fs.mkdirSync(path.dirname(TARGET), { recursive: true });
  const contents = fs.readFileSync(SOURCE, 'utf8');
  fs.writeFileSync(TARGET, contents);
  console.log('Synced', SOURCE, '->', TARGET);
}

if (require.main === module) {
  try {
    syncTypes();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
