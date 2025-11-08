#!/usr/bin/env node
// RESUME_MARKER: CHK_4
/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from 'node:fs';
import path from 'node:path';

import { validate } from './_schema';

const ROOT = path.resolve(__dirname, '..', '..');
const SCHEMA_PATH = path.join(ROOT, 'config', 'machines', '_schema.json');
const MACHINES_DIR = path.join(ROOT, 'config', 'machines');

function main(): void {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const files = fs.readdirSync(MACHINES_DIR);
  let bad = 0;

  for (const file of files) {
    if (!file.endsWith('.json') || file.startsWith('_')) {
      continue;
    }
    const fullPath = path.join(MACHINES_DIR, file);
    const obj = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    try {
      validate(obj, schema);
    } catch (error) {
      console.log('Invalid:', file, error instanceof Error ? error.message : error);
      bad += 1;
    }
  }

  if (bad === 0) {
    console.log('OK');
  } else {
    console.log(`${bad} invalid files`);
    process.exitCode = 1;
  }
}

main();
