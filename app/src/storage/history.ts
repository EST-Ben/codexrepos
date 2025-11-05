import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AnalysisHistoryRecord, AnalyzeResponse, HistoryMap } from '../types';

const HISTORY_KEY = 'analysis_history_v1';

export async function loadHistory(): Promise<HistoryMap> {
  const raw = await AsyncStorage.getItem(HISTORY_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as HistoryMap;
    return parsed ?? {};
  } catch {
    return {};
  }
}

export async function appendHistory(entry: AnalysisHistoryRecord): Promise<void> {
  const history = await loadHistory();
  const machineKey = entry.machineId ?? 'unknown';
  const arr = history[machineKey] ?? [];
  arr.unshift(entry);
  history[machineKey] = arr.slice(0, 100); // cap growth
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

/**
 * Helper to normalize older shapes into the current required fields.
 * If a legacy record had `issues`, convert to `predictions`.
 */
export function normalizeResponse(resp: any): AnalyzeResponse {
  // predictions preferred
  let predictions = resp?.predictions as AnalyzeResponse['predictions'] | undefined;
  if (!Array.isArray(predictions) && Array.isArray(resp?.issues)) {
    predictions = resp.issues.map((it: any) => ({
      issue_id: it.id ?? it.issue_id ?? 'unknown',
      confidence: typeof it.confidence === 'number' ? it.confidence : 0,
    }));
  }

  return {
    image_id: resp?.image_id ?? 'unknown',
    version: resp?.version ?? 'unknown',
    machine: resp?.machine ?? {},
    experience: resp?.experience ?? 'Beginner',
    material: resp?.material,
    predictions: predictions ?? [],
    explanations: Array.isArray(resp?.explanations) ? resp.explanations : [],
    localization: resp?.localization ?? { boxes: [], heatmap: null },
    capability_notes: Array.isArray(resp?.capability_notes) ? resp.capability_notes : [],
    recommendations: Array.isArray(resp?.recommendations) ? resp.recommendations : [],
    suggestions: Array.isArray(resp?.suggestions) ? resp.suggestions : [],
    slicer_profile_diff: resp?.slicer_profile_diff ?? undefined,
    applied: resp?.applied ?? {
      parameters: {},
      hidden_parameters: [],
      experience_level: 'Beginner',
      clamped_to_machine_limits: false,
      explanations: [],
    },
    low_confidence: !!resp?.low_confidence,
  };
}
