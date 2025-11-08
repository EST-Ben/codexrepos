#!/usr/bin/env node
"use strict";
// RESUME_MARKER: CHK_4
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const _schema_1 = require("./_schema");
const ROOT = node_path_1.default.resolve(__dirname, '..', '..');
const SCHEMA_PATH = node_path_1.default.join(ROOT, 'config', 'machines', '_schema.json');
const MACHINES_DIR = node_path_1.default.join(ROOT, 'config', 'machines');
function main() {
    const schema = JSON.parse(node_fs_1.default.readFileSync(SCHEMA_PATH, 'utf8'));
    const files = node_fs_1.default.readdirSync(MACHINES_DIR);
    let bad = 0;
    for (const file of files) {
        if (!file.endsWith('.json') || file.startsWith('_')) {
            continue;
        }
        const fullPath = node_path_1.default.join(MACHINES_DIR, file);
        const obj = JSON.parse(node_fs_1.default.readFileSync(fullPath, 'utf8'));
        try {
            (0, _schema_1.validate)(obj, schema);
        }
        catch (error) {
            console.log('Invalid:', file, error instanceof Error ? error.message : error);
            bad += 1;
        }
    }
    if (bad === 0) {
        console.log('OK');
    }
    else {
        console.log(`${bad} invalid files`);
        process.exitCode = 1;
    }
}
main();
