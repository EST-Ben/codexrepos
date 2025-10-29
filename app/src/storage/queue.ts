import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AnalyzeRequestMeta, MachineRef } from '../types';

export interface QueuedAnalysisItem {
  id: string;
  machine: MachineRef;
  fileUri: string;
  fileType: string;
  fileName: string;
  meta: AnalyzeRequestMeta;
  createdAt: number;
  material?: string;
}

const QUEUE_STORAGE_KEY = 'machine-diagnostics:queue';

function normalizeQueue(raw: unknown): QueuedAnalysisItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const normalized: QueuedAnalysisItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const value = entry as Partial<QueuedAnalysisItem>;
    if (!value.meta || typeof value.meta !== 'object') {
      continue;
    }
    if (!value.machine || typeof value.machine !== 'object') {
      continue;
    }
    if (typeof value.fileUri !== 'string' || typeof value.fileName !== 'string') {
      continue;
    }
    normalized.push({
      id: typeof value.id === 'string' ? value.id : `queued-${Date.now()}-${normalized.length}`,
      machine: value.machine as MachineRef,
      fileUri: value.fileUri,
      fileType: typeof value.fileType === 'string' ? value.fileType : 'image/jpeg',
      fileName: value.fileName,
      meta: value.meta as AnalyzeRequestMeta,
      createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
      material: typeof value.material === 'string' ? value.material : undefined,
    });
  }
  return normalized.sort((a, b) => a.createdAt - b.createdAt);
}

async function loadRawQueue(): Promise<QueuedAnalysisItem[]> {
  const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizeQueue(parsed);
  } catch (err) {
    console.warn('Failed to parse queued analyses', err);
    return [];
  }
}

async function persistQueue(items: QueuedAnalysisItem[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(items));
}

export async function listQueuedAnalyses(): Promise<QueuedAnalysisItem[]> {
  return loadRawQueue();
}

export async function enqueueAnalysis(item: Omit<QueuedAnalysisItem, 'id' | 'createdAt'>): Promise<QueuedAnalysisItem> {
  const current = await loadRawQueue();
  const entry: QueuedAnalysisItem = {
    ...item,
    id: `queued-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  await persistQueue([...current, entry]);
  return entry;
}

export async function removeQueuedAnalysis(id: string): Promise<void> {
  const current = await loadRawQueue();
  await persistQueue(current.filter((item) => item.id !== id));
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
}
