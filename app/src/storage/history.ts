import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AnalysisHistoryRecord, HistoryMap } from '../types';

const HISTORY_STORAGE_KEY = 'machine-diagnostics:history';
const MAX_HISTORY_PER_MACHINE = 20;

function normalizeMap(raw: unknown): HistoryMap {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  const map: HistoryMap = {};
  for (const [machineId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(value)) {
      continue;
    }
    const entries: AnalysisHistoryRecord[] = [];
    for (const entry of value) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }
      const normalized = entry as Partial<AnalysisHistoryRecord>;
      if (typeof normalized.imageId !== 'string' || typeof normalized.machineId !== 'string') {
        continue;
      }
      entries.push({
        imageId: normalized.imageId,
        machineId: normalized.machineId,
        machine: normalized.machine as AnalysisHistoryRecord['machine'],
        timestamp: typeof normalized.timestamp === 'number' ? normalized.timestamp : Date.now(),
        issues: Array.isArray((normalized as any).issues)
          ? ((normalized as any).issues as AnalysisHistoryRecord['issues'])
          : [],
        response: normalized.response as AnalysisHistoryRecord['response'],
        material: normalized.material,
        localUri: typeof normalized.localUri === 'string' ? normalized.localUri : undefined,
        summary: normalized.summary,
        predictions: Array.isArray((normalized as any).predictions)
          ? ((normalized as any).predictions as AnalysisHistoryRecord['predictions'])
          : undefined,
      });
    }
    if (entries.length) {
      map[machineId] = entries.sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_HISTORY_PER_MACHINE);
    }
  }
  return map;
}

export async function loadHistory(): Promise<HistoryMap> {
  const raw = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizeMap(parsed);
  } catch (err) {
    console.warn('Failed to parse stored history', err);
    return {};
  }
}

async function persistHistory(map: HistoryMap): Promise<void> {
  await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(map));
}

export async function appendHistoryEntry(entry: AnalysisHistoryRecord): Promise<void> {
  const current = await loadHistory();
  const list = current[entry.machineId] ?? [];
  const filtered = list.filter((item) => item.imageId !== entry.imageId);
  current[entry.machineId] = [entry, ...filtered].slice(0, MAX_HISTORY_PER_MACHINE);
  await persistHistory(current);
}

export async function clearHistoryForMachine(machineId: string): Promise<void> {
  const current = await loadHistory();
  if (!current[machineId]) {
    return;
  }
  delete current[machineId];
  await persistHistory(current);
}

export async function removeHistoryEntry(machineId: string, imageId: string): Promise<void> {
  const current = await loadHistory();
  const list = current[machineId];
  if (!list) {
    return;
  }
  const next = list.filter((item) => item.imageId !== imageId);
  if (next.length) {
    current[machineId] = next;
  } else {
    delete current[machineId];
  }
  await persistHistory(current);
}
