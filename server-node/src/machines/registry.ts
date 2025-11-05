import fs from "node:fs";
import path from "node:path";
import { settings } from "../settings";

export type MachineProfile = Record<string, any>;
export type MachineSummary = Record<string, any>;

const MACHINES_DIR = path.resolve(process.cwd(), settings.data.machinesDir);

let byId = new Map<string, MachineProfile>();
let byIdLower = new Map<string, MachineProfile>();
let byAliasLower = new Map<string, MachineProfile>();
let fuzzyKeys: string[] = [];
let fuzzyMap = new Map<string, MachineProfile>();

function loadProfiles(): Map<string, MachineProfile> {
  const profiles = new Map<string, MachineProfile>();
  if (!fs.existsSync(MACHINES_DIR)) return profiles;
  for (const file of fs.readdirSync(MACHINES_DIR)) {
    if (!file.endsWith(".json") || file.startsWith("_")) continue;
    const full = path.join(MACHINES_DIR, file);
    try {
      const data = JSON.parse(fs.readFileSync(full, "utf-8")) as MachineProfile;
      const identifier = String(data?.id ?? path.basename(file, ".json"));
      profiles.set(identifier.toLowerCase(), data);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`Failed to load machine profile ${file}:`, err);
    }
  }
  return profiles;
}

function buildIndexes(profiles: Map<string, MachineProfile>) {
  byId = new Map();
  byIdLower = new Map();
  byAliasLower = new Map();
  fuzzyKeys = [];
  fuzzyMap = new Map();

  for (const profile of profiles.values()) {
    const identifier = String(profile.id ?? "");
    if (!identifier) continue;
    byId.set(identifier, profile);
    byIdLower.set(identifier.toLowerCase(), profile);
    const idKey = identifier.toLowerCase();
    fuzzyKeys.push(idKey);
    fuzzyMap.set(idKey, profile);

    const aliases: unknown = profile.aliases;
    if (Array.isArray(aliases)) {
      for (const alias of aliases) {
        const key = String(alias).toLowerCase();
        byAliasLower.set(key, profile);
        fuzzyKeys.push(key);
        fuzzyMap.set(key, profile);
      }
    }

    const brand = String(profile.brand ?? "").trim();
    const model = String(profile.model ?? "").trim();
    if (brand || model) {
      const combo = `${brand} ${model}`.trim().toLowerCase();
      if (combo) {
        fuzzyKeys.push(combo);
        fuzzyMap.set(combo, profile);
      }
      if (model) {
        const modelKey = model.toLowerCase();
        fuzzyKeys.push(modelKey);
        fuzzyMap.set(modelKey, profile);
      }
    }
  }
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length) || 1;
  return 1 - dist / maxLen;
}

export function reloadRegistry(): void {
  const profiles = loadProfiles();
  buildIndexes(profiles);
}

export function allMachineProfiles(): MachineProfile[] {
  if (!byId.size) reloadRegistry();
  return Array.from(byId.values());
}

export function machineSummaries(): MachineSummary[] {
  if (!byId.size) reloadRegistry();
  const summaries: MachineSummary[] = [];
  for (const profile of byId.values()) {
    summaries.push({
      id: profile.id,
      brand: profile.brand,
      model: profile.model,
      aliases: profile.aliases ?? [],
      type: profile.type,
      capabilities: profile.capabilities ?? [],
      safe_speed_ranges: profile.safe_speed_ranges,
      material_presets: profile.material_presets,
      max_nozzle_temp_c: profile.max_nozzle_temp_c,
      max_bed_temp_c: profile.max_bed_temp_c,
      spindle_rpm_range: profile.spindle_rpm_range,
      max_feed_mm_min: profile.max_feed_mm_min,
      supports: profile.supports,
      notes: profile.notes,
    });
  }
  summaries.sort((a, b) => {
    const brandA = String(a.brand ?? "").toLowerCase();
    const brandB = String(b.brand ?? "").toLowerCase();
    if (brandA === brandB) {
      return String(a.model ?? "").localeCompare(String(b.model ?? ""));
    }
    return brandA.localeCompare(brandB);
  });
  return summaries;
}

export function resolveMachine(nameOrId: string): MachineProfile {
  if (!byId.size) reloadRegistry();
  const token = nameOrId.trim().toLowerCase();
  if (!token) throw new Error("Machine identifier cannot be empty");
  const direct = byIdLower.get(token);
  if (direct) return direct;
  const alias = byAliasLower.get(token);
  if (alias) return alias;

  let best: { key: string; score: number } | null = null;
  for (const key of fuzzyKeys) {
    const score = similarity(token, key);
    if (!best || score > best.score) {
      best = { key, score };
    }
  }
  if (best && best.score >= 0.6) {
    const profile = fuzzyMap.get(best.key);
    if (profile) return profile;
  }
  throw new Error(`Machine '${nameOrId}' was not found in the registry`);
}

reloadRegistry();
