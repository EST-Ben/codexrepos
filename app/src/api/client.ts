import type {
  AnalyzeRequestMeta,
  AnalyzeResponse,
  ExportDiff,
  SlicerProfileDiff,
} from '../types';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:8000';

function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function analyzeImage(file: File | { uri: string; name: string; type: string; }, meta: AnalyzeRequestMeta, onProgress: ((p: number) => void) | undefined): Promise<AnalyzeResponse> {
  const form = new FormData();
  // Web <input type="file"> gives File; native often gives { uri, name, type }
  if (file instanceof File) {
    form.append('file', file);
  } else {
    // @ts-expect-error RN FormData supports { uri, name, type }
    form.append('file', file);
  }
  form.append('meta', JSON.stringify(meta));

  const res = await fetch(`${API_BASE}/analyze-image`, {
    method: 'POST',
    body: form,
  });
  return json<AnalyzeResponse>(res);
}

/**
 * Export a profile diff from backend and normalize it into our `ExportDiff` shape.
 * The backend may return either:
 *  - { diff: Record<string, string|number|boolean>, markdown?: string }
 *  - { parameters: Record<string, { value?: number; delta?: number; ... }>, markdown?: string }
 */
export async function exportProfile(slicer: string): Promise<ExportDiff> {
  const res = await fetch(`${API_BASE}/export-profile?slicer=${encodeURIComponent(slicer)}`);
  const payload = await json<SlicerProfileDiff | ExportDiff>(res);

  // Narrow the union before accessing `.parameters`
  const hasParameters =
    payload &&
    typeof payload === 'object' &&
    'parameters' in payload &&
    payload.parameters &&
    typeof (payload as any).parameters === 'object';

  if (hasParameters) {
    const structured = payload as SlicerProfileDiff;
    const flat: Record<string, string | number | boolean> = {};

    // Flatten known numeric/boolean-ish fields into a simple map for exporting
    for (const [k, v] of Object.entries(structured.parameters ?? {})) {
      // Prefer `value`, then `delta`, else boolean clamped flag as a last resort
      if (typeof v?.value === 'number') flat[k] = v.value;
      else if (typeof v?.delta === 'number') flat[k] = v.delta;
      else if (typeof v?.clamped === 'boolean') flat[k] = v.clamped;
    }

    return {
      slicer: slicer as any,
      diff: flat,
      markdown: structured.markdown,
    };
  }

  // Already a legacy/simple diff
  const legacy = payload as ExportDiff;
  return {
    slicer: slicer as any,
    diff: legacy.diff ?? {},
    markdown: legacy.markdown,
  };
}
