import type {
  AnalyzeRequestMeta,
  AnalyzeResponse,
  ExportDiff,
  SlicerProfileDiff,
} from '../types';

const API_HOST = (process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:8000').replace(/\/$/, '');
const API_BASE = `${API_HOST}/api`;

function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function analyzeImage(
  file: File | { uri: string; name: string; type: string },
  meta: AnalyzeRequestMeta,
  onProgress?: (p: number) => void,
): Promise<AnalyzeResponse> {
  const form = new FormData();
  // Web <input type="file"> gives File; native often gives { uri, name, type }
  if (file instanceof File) {
    form.append('image', file);
  } else {
    // @ts-expect-error RN FormData supports { uri, name, type }
    form.append('image', file);
  }
  form.append('meta', JSON.stringify(meta));

  onProgress?.(0);

  const res = await fetch(`${API_BASE}/analyze-image`, {
    method: 'POST',
    body: form,
  });
  const result = await json<AnalyzeResponse>(res);
  onProgress?.(100);
  return result;
}

export async function analyzeJson(payload: AnalyzeRequestMeta & { issues?: string[] }): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_BASE}/analyze-json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      machine: payload.machine_id,
      material: payload.material,
      experience: payload.experience,
      issues: payload['issues'] ?? [],
      payload: payload.base_profile ?? {},
    }),
  });
  return json<AnalyzeResponse>(res);
}

/**
 * Export a profile diff from backend and normalize it into our `ExportDiff` shape.
 */
export async function exportProfile(payload: {
  slicer: string;
  changes: Record<string, number | string | boolean>;
  base_profile?: Record<string, number | string | boolean>;
}): Promise<ExportDiff> {
  const res = await fetch(`${API_BASE}/export-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slicer: payload.slicer,
      changes: payload.changes,
      base_profile: payload.base_profile,
    }),
  });
  const responsePayload = await json<SlicerProfileDiff | ExportDiff>(res);

  const hasParameters =
    responsePayload &&
    typeof responsePayload === 'object' &&
    'parameters' in responsePayload &&
    (responsePayload as any).parameters &&
    typeof (responsePayload as any).parameters === 'object';

  if (hasParameters) {
    const structured = responsePayload as SlicerProfileDiff;
    const flat: Record<string, string | number | boolean> = {};

    for (const [k, v] of Object.entries(structured.parameters ?? {})) {
      if (typeof v?.value === 'number') flat[k] = v.value;
      else if (typeof v?.delta === 'number') flat[k] = v.delta;
      else if (typeof v?.clamped === 'boolean') flat[k] = v.clamped;
    }

    return {
      slicer: payload.slicer as any,
      diff: flat,
      markdown: structured.markdown,
    };
  }

  const legacy = responsePayload as ExportDiff;
  return {
    slicer: payload.slicer as any,
    diff: legacy.diff ?? {},
    markdown: legacy.markdown,
  };
}
