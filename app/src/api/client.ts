import type { AnalyzeRequestMeta, AnalyzeResponse, MachineSummary, SlicerId } from '../types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchMachines(): Promise<MachineSummary[]> {
  const res = await fetch(`${API_URL}/api/machines`);
  return handleResponse<MachineSummary[]>(res);
}

export async function analyze(
  file: Blob | { uri: string; name: string; type: string },
  meta: AnalyzeRequestMeta,
  onProgress?: (progress: number) => void,
): Promise<AnalyzeResponse> {
  const form = new FormData();
  if (typeof (file as any).uri === 'string') {
    const payload = file as { uri: string; name: string; type: string };
    form.append('image', {
      uri: payload.uri,
      name: payload.name || 'upload.jpg',
      type: payload.type || 'image/jpeg',
    } as any);
  } else {
    form.append('image', file as any, 'upload.jpg');
  }
  form.append('meta', JSON.stringify(meta));

  return new Promise<AnalyzeResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/api/analyze`);
    xhr.responseType = 'text';

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          onProgress(event.loaded / event.total);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const parsed = JSON.parse(xhr.responseText || '{}');
          resolve(parsed as AnalyzeResponse);
        } catch (err) {
          reject(new Error('Failed to parse server response'));
        }
      } else {
        reject(new Error(xhr.responseText || `Request failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error while uploading image'));
    };

    xhr.send(form);
  });
}

export interface ExportPayload {
  slicer: SlicerId;
  changes: Record<string, number | string>;
  baseProfile?: Record<string, number | string>;
}

export interface ExportDiff {
  slicer: SlicerId;
  diff: Record<string, number | string | boolean>;
  source_keys: string[];
}

export async function exportProfile(payload: ExportPayload): Promise<ExportDiff> {
  const res = await fetch(`${API_URL}/api/export-profile`, {
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
