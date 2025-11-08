#!/usr/bin/env node
"use strict";
// RESUME_MARKER: CHK_8
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
function parseArgs(argv) {
    const options = {
        material: 'PLA',
        experience: 'Intermediate',
        issues: [],
    };
    let i = 0;
    while (i < argv.length) {
        const arg = argv[i];
        if (arg === '--material') {
            options.material = argv[i + 1] ?? options.material;
            i += 2;
            continue;
        }
        if (arg === '--experience') {
            options.experience = argv[i + 1] ?? options.experience;
            i += 2;
            continue;
        }
        if (arg === '--issues') {
            i += 1;
            while (i < argv.length && !argv[i].startsWith('--')) {
                options.issues.push(argv[i]);
                i += 1;
            }
            continue;
        }
        if (arg === '--payload') {
            options.payload = argv[i + 1];
            i += 2;
            continue;
        }
        if (!arg.startsWith('-') && !options.machine) {
            options.machine = arg;
            i += 1;
            continue;
        }
        i += 1;
    }
    return options;
}
function usage() {
    console.error('Usage: mock_inference <machine> [--material PLA] [--experience Intermediate] [--issues issue1 issue2] [--payload JSON|@file]');
    process.exit(1);
}
function loadPayload(source) {
    if (!source)
        return {};
    if (source.startsWith('@')) {
        const filePath = source.slice(1);
        const resolved = node_path_1.default.resolve(process.cwd(), filePath);
        const raw = node_fs_1.default.readFileSync(resolved, 'utf8');
        return JSON.parse(raw);
    }
    return JSON.parse(source);
}
function createPRNG(seed) {
    let h = 0x811c9dc5;
    for (const char of seed) {
        h ^= char.charCodeAt(0);
        h = Math.imul(h, 0x01000193);
        h >>>= 0;
    }
    return () => {
        h ^= h >>> 13;
        h = Math.imul(h, 0x5bd1e995);
        h ^= h >>> 15;
        return (h >>> 0) / 0xffffffff;
    };
}
function formatMachine(machine) {
    const parts = machine.split(/[_-]+/).filter(Boolean);
    if (parts.length === 0) {
        return { brand: machine, model: machine };
    }
    const [first, ...rest] = parts;
    return {
        brand: capitalize(first),
        model: rest.map(capitalize).join(' ') || capitalize(first),
    };
}
function capitalize(value) {
    if (!value)
        return value;
    return value[0].toUpperCase() + value.slice(1).toLowerCase();
}
function clampApplied(diff, experience) {
    const multipliers = {
        Beginner: 0.9,
        Intermediate: 1,
        Expert: 1.1,
    };
    const factor = multipliers[experience] ?? 1;
    const applied = {};
    for (const [key, value] of Object.entries(diff)) {
        applied[key] = Number((value * factor).toFixed(2));
    }
    return applied;
}
function buildStub(options, extra) {
    const machineId = options.machine ?? 'unknown';
    const seed = `${machineId}|${options.material}|${options.experience}|${options.issues.join(',')}|${JSON.stringify(extra)}`;
    const random = createPRNG(seed);
    const machineInfo = formatMachine(machineId);
    const diff = {
        flow_rate: Number((0.8 + random() * 0.4).toFixed(2)),
        nozzle_temp_c: Math.round(190 + random() * 40),
        bed_temp_c: Math.round(55 + random() * 15),
        speed_mm_s: Math.round(60 + random() * 30),
    };
    const applied = clampApplied(diff, options.experience);
    const primaryIssue = options.issues[0] ?? 'baseline';
    const confidence = Number(random().toFixed(2));
    const recommendations = [
        {
            id: `rec_${primaryIssue}`,
            summary: `Adjust flow to ${Math.round(diff.flow_rate * 100)}% and nozzle to ${diff.nozzle_temp_c}°C`,
            details: `Generated for ${options.material} at ${options.experience} experience.`,
        },
        {
            id: 'rec_followup',
            summary: `Set bed to ${diff.bed_temp_c}°C and speed to ${diff.speed_mm_s} mm/s`,
            details: 'Ensure consistent cooling and check filament quality.',
        },
    ];
    const capabilityNotes = [`${machineInfo.brand} ${machineInfo.model} handles ${options.material} with tuned cooling.`];
    const explanations = [
        `${primaryIssue} -> tuned flow (${diff.flow_rate}) based on provided payload`,
        `Experience level ${options.experience} scales applied values`,
    ];
    return {
        meta: {
            machine: { id: machineId, brand: machineInfo.brand, model: machineInfo.model },
            experience: options.experience,
            material: options.material,
        },
        predictions: [{ issue_id: primaryIssue, confidence }],
        recommendations,
        capability_notes: capabilityNotes,
        slicer_profile_diff: { diff },
        applied,
        explanations,
        payload: { material: options.material, issues: options.issues, ...extra },
    };
}
async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (!options.machine) {
        usage();
    }
    try {
        const extra = loadPayload(options.payload);
        const output = buildStub(options, extra);
        console.log(JSON.stringify(output, null, 2));
    }
    catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
    }
}
void main();
