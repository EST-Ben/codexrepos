#!/usr/bin/env node
"use strict";
// RESUME_MARKER: CHK_3
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const _mini_yaml_1 = require("./_mini_yaml");
const _schema_1 = require("./_schema");
const ROOT = node_path_1.default.resolve(__dirname, '..', '..');
const SCHEMA_PATH = node_path_1.default.join(ROOT, 'config', 'machines', '_schema.json');
const OUT_DIR = node_path_1.default.join(ROOT, 'config', 'machines');
const SEEDS_DIR = node_path_1.default.join(ROOT, 'config', 'seeds');
function readJson(filePath) {
    const raw = node_fs_1.default.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
}
function readYaml(filePath) {
    const raw = node_fs_1.default.readFileSync(filePath, 'utf8');
    return (0, _mini_yaml_1.safeLoad)(raw);
}
function mergeFamily(entry, family) {
    const data = { ...(family.defaults ?? {}) };
    Object.assign(data, {
        id: entry.id,
        brand: family.brand,
        model: entry.model,
        type: family.type,
    });
    for (const key of ['material_presets', 'supports', 'safe_speed_ranges']) {
        const baseValue = isPlainObject(family[key]) ? family[key] : {};
        const merged = { ...baseValue };
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
        }
        else if (Object.prototype.hasOwnProperty.call(data, key)) {
            delete data[key];
        }
    }
    return data;
}
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
async function main() {
    try {
        const schema = readJson(SCHEMA_PATH);
        const families = readYaml(node_path_1.default.join(SEEDS_DIR, 'families.yaml'));
        const registry = readYaml(node_path_1.default.join(SEEDS_DIR, 'registry.yaml'));
        node_fs_1.default.mkdirSync(OUT_DIR, { recursive: true });
        let count = 0;
        for (const entry of registry.machines) {
            const family = families[entry.family];
            if (!family) {
                throw new Error(`Unknown family ${entry.family}`);
            }
            const data = mergeFamily(entry, family);
            (0, _schema_1.validate)(data, schema);
            const outFile = node_path_1.default.join(OUT_DIR, `${data.id}.json`);
            node_fs_1.default.writeFileSync(outFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
            count += 1;
        }
        console.log(`Generated ${count} machine profiles into ${OUT_DIR}`);
    }
    catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    }
}
void main();
