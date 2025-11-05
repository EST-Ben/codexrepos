#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const source = resolve(root, "types/api.ts");
const target = resolve(root, "server-node/src/_types/api.ts");

mkdirSync(dirname(target), { recursive: true });
const contents = readFileSync(source, "utf-8");
writeFileSync(target, contents);
console.log("Synced", source, "->", target);
