#!/usr/bin/env node
// RESUME_MARKER: CHK_3
/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from 'node:fs';
import path from 'node:path';

import { safeLoad } from './_mini_yaml';
import { validate } from './_schema';

const ROOT = path.resolve(__dirname, '..', '..');
const SCHEMA_PATH = path.join(ROOT, 'config', 'machines', '_schema.json');
const OUT_DIR = path.join(ROOT, 'config', 'machines');
const SEEDS_DIR = path.join(ROOT, 'config', 'seeds');

function readJson(filePath: string): any {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function readYaml(filePath: string): any {
  const raw = fs.readFileSync(filePath, 'utf8');
  return safeLoad(raw);
}

type AnyRecord = Record<string, any>;

function mergeFamily(entry: AnyRecord, family: AnyRecord): AnyRecord {
  const data: AnyRecord = { ...(family.defaults ?? {}) };
  Object.assign(data, {
    id: entry.id,
    brand: family.brand,
    model: entry.model,
    type: family.type,
  });

  for (const key of ['material_presets', 'supports', 'safe_speed_ranges']) {
    const baseValue = isPlainObject(family[key]) ? (family[key] as AnyRecord) : {};
    const merged: AnyRecord = { ...baseValue };
    const entryValue = entry[key];
    if (isPlainObject(entryValue)) {
      Object.assign(merged, entryValue);
    }
    data[key] = merged;
  }

  const simpleKeys = [
    'motion_system',
    'enclosed',
    'build_volume_mm',
    'workarea_mm',
    'nozzle_diameters',
    'max_nozzle_temp_c',
    'max_bed_temp_c',
    'spindle_rpm_range',
    'max_feed_mm_min',
    'rigidity_class',
    'capabilities',
    'aliases',
    'notes',
  ];

  for (const key of simpleKeys) {
    const hasEntry = Object.prototype.hasOwnProperty.call(entry, key);
    const value = hasEntry ? entry[key] : data[key];
    if (value !== null && value !== undefined) {
      data[key] = value;
    } else if (Object.prototype.hasOwnProperty.call(data, key)) {
      delete data[key];
    }
  }

  return data;
}

function isPlainObject(value: unknown): value is AnyRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function main(): Promise<void> {
  try {
    const schema = readJson(SCHEMA_PATH);
    const families = readYaml(path.join(SEEDS_DIR, 'families.yaml'));
    const registry = readYaml(path.join(SEEDS_DIR, 'registry.yaml'));

    fs.mkdirSync(OUT_DIR, { recursive: true });

    let count = 0;
    for (const entry of registry.machines as AnyRecord[]) {
      const family = families[entry.family];
      if (!family) {
        throw new Error(`Unknown family ${entry.family}`);
      }
      const data = mergeFamily(entry, family);
      validate(data, schema);
      const outFile = path.join(OUT_DIR, `${data.id}.json`);
      fs.writeFileSync(outFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
      count += 1;
    }

    console.log(`Generated ${count} machine profiles into ${OUT_DIR}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

void main();
