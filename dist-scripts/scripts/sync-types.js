#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncTypes = syncTypes;
// RESUME_MARKER: CHK_9
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const ROOT = node_path_1.default.resolve(__dirname, '..', '..');
const SOURCE = node_path_1.default.join(ROOT, 'types', 'api.ts');
const TARGET = node_path_1.default.join(ROOT, 'server-node', 'src', '_types', 'api.ts');
function syncTypes() {
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(TARGET), { recursive: true });
    const contents = node_fs_1.default.readFileSync(SOURCE, 'utf8');
    node_fs_1.default.writeFileSync(TARGET, contents);
    console.log('Synced', SOURCE, '->', TARGET);
}
if (require.main === module) {
    try {
        syncTypes();
    }
    catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
    }
}
