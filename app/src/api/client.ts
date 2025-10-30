import type { AnalyzeResponse, ExperienceLevel, ExportDiff, MachineSummary } from '../types';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:8000/api';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchMachines(): Promise<MachineSummary[]> {
  const res = await fetch(`${API_BASE}/machines`);
  return handleResponse<MachineSummary[]>(res);
}

export interface AnalyzePayload {
  machine: string;
  experience: ExperienceLevel;
  material: string;
  issues: string[];
}

export async function analyzeMachine(payload: AnalyzePayload): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      machine: payload.machine,
      experience: payload.experience,
      material: payload.material,
      issues: payload.issues,
    }),
  });
  return handleResponse<AnalyzeResponse>(res);
}

export interface ExportPayload {
  slicer: ExportDiff['slicer'];
  changes: Record<string, number | string>;
  baseProfile?: Record<string, number | string>;
}

export async function exportProfile(payload: ExportPayload): Promise<ExportDiff> {
  const res = await fetch(`${API_BASE}/export-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slicer: payload.slicer,
      changes: payload.changes,
      base_profile: payload.baseProfile ?? null,
    }),
  });
  return handleResponse<ExportDiff>(res);
}
