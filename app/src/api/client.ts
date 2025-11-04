// app/src/api/client.ts
import Constants from "expo-constants";
import type {
  AnalyzeRequestMeta,
  AnalyzeResponse,
  ExperienceLevel,
  MachineRef,
  MachineSummary,
  SlicerId,
  SlicerProfileParameter,
} from "../types";

/**
 * API root resolution (Expo-safe, no Node typings required)
 * Priority:
 *  1) app.json -> expo.extra.API_URL (e.g., "http://192.168.0.35:8000")
 *  2) fallback "http://localhost:8000"
 * NOTE: All endpoints below append "/api/...".
 */
function resolveApiRoot(): string {
  const env = ((globalThis as any)?.process?.env ?? {}) as Record<string, string | undefined>;
  const envFromExpo = env.EXPO_PUBLIC_API_URL ?? env.EXPO_PUBLIC_API_BASE;

  const extraFromExpo =
    (Constants?.expoConfig as any)?.extra?.API_URL ??
    // Legacy SDK fallback (older manifests):
    (Constants as any)?.manifest?.extra?.API_URL;

  const base = (envFromExpo ?? extraFromExpo ?? "http://localhost:8000").toString();
  return base.replace(/\/+$/, ""); // strip trailing slash
}

/** Mutable API root (handy for a hidden debug/Settings screen) */
let API_ROOT = resolveApiRoot();

export function setApiRoot(nextBase: string) {
  if (!nextBase) return;
  API_ROOT = nextBase.replace(/\/+$/, "");
}

export function getApiRoot(): string {
  return API_ROOT;
}

function apiBase(): string {
  return `${getApiRoot()}/api`;
}

/** Shared JSON response handler */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

/* -------------------------------------------------------------
 * Health (useful for testing phone ↔ API connectivity)
 * GET /health
 * ----------------------------------------------------------- */
export async function health(): Promise<{ status: string; mode?: string }> {
  const res = await fetch(`${getApiRoot()}/health`, { method: "GET" });
  return handleResponse(res);
}

/* -------------------------------------------------------------
 * Machines
 * GET /api/machines -> MachineSummary[]
 * ----------------------------------------------------------- */
export async function fetchMachines(): Promise<MachineSummary[]> {
  const res = await fetch(`${apiBase()}/machines`, { method: "GET" });
  return handleResponse<MachineSummary[]>(res);
}

/* -------------------------------------------------------------
 * Analyze (JSON)
 * POST /api/analyze-json
 * ----------------------------------------------------------- */
export async function analyzeMachineJSON(payload: {
  machine: MachineRef;
  experience: ExperienceLevel;
  material?: string;
  issues?: string[];
}): Promise<AnalyzeResponse> {
  const res = await fetch(`${apiBase()}/analyze-json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      machine: payload.machine.id,
      experience: payload.experience,
      material: payload.material ?? "PLA",
      issues: payload.issues ?? [],
    }),
  });
  return handleResponse<AnalyzeResponse>(res);
}

/**
 * COMPAT SHIM:
 * Older screens call `analyzeMachine(...)`.
 * Keep them working by delegating to the JSON endpoint.
 */
export const analyzeMachine = analyzeMachineJSON;

/* -------------------------------------------------------------
 * Analyze (Multipart Image Upload)
 * POST /api/analyze
 * - RN/Expo: pass { uri, name?, type? }
 * - Web: pass Blob | File
 * ----------------------------------------------------------- */
export type RNFileLike = { uri: string; name?: string; type?: string };

export async function analyzeImage(
  fileArg: Blob | File | RNFileLike,
  meta: AnalyzeRequestMeta
): Promise<AnalyzeResponse> {
  const form = new FormData();

  // Detect React-Native style file object
  const isRN =
    typeof fileArg === "object" &&
    fileArg !== null &&
    "uri" in (fileArg as any) &&
    typeof (fileArg as any).uri === "string";

  if (isRN) {
    const f = fileArg as RNFileLike;
    // RN FormData needs { uri, name, type } object; cast once to 'any' to avoid TS warnings
    const rnFormFile: any = {
      uri: f.uri,
      name: f.name ?? "upload.jpg",
      type: f.type ?? "image/jpeg",
    };
    form.append("image", rnFormFile);
  } else {
    // Web: Blob/File is fine
    const blob = fileArg as Blob;
    const blobAny = blob as any;
    const filename = typeof blobAny?.name === "string" ? blobAny.name : "upload.jpg";
    form.append("image", blob, filename);
  }

  form.append("meta", JSON.stringify(meta));

  const res = await fetch(`${apiBase()}/analyze`, {
    method: "POST",
    body: form, // don't set Content-Type; fetch sets the boundary automatically
    headers: { Accept: "application/json" },
  });

  return handleResponse<AnalyzeResponse>(res);
}

export async function analyze(
  fileArg: Blob | File | RNFileLike,
  meta: AnalyzeRequestMeta,
  onProgress?: (value: number) => void
): Promise<AnalyzeResponse> {
  onProgress?.(0.05);
  const result = await analyzeImage(fileArg, meta);
  onProgress?.(1);
  return result;
}

/* -------------------------------------------------------------
 * Export profile
 * POST /api/export-profile
 * ----------------------------------------------------------- */
export async function exportProfile(payload: {
  slicer: SlicerId;
  changes: Record<string, string | number | boolean>;
}): Promise<{ diff: Record<string, string | number | boolean> }> {
  const res = await fetch(`${apiBase()}/export-profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slicer: payload.slicer,
      changes: payload.changes,
    }),
  });
  type ExportProfileResponse = {
    diff?: Record<string, string | number | boolean>;
    slicer_profile_diff?: {
      diff?: Record<string, string | number | boolean>;
      parameters?: Record<string, SlicerProfileParameter>;
    };
  };

  const data = await handleResponse<ExportProfileResponse>(res);
  const structured = data.slicer_profile_diff ?? data;
  const flatParameters = flattenParameters(structured?.parameters);
  return { diff: structured?.diff ?? flatParameters };
}

function flattenParameters(
  parameters?: Record<string, SlicerProfileParameter>,
): Record<string, string | number | boolean> {
  if (!parameters) return {};
  const flat: Record<string, string | number | boolean> = {};
  for (const [key, descriptor] of Object.entries(parameters)) {
    if (!descriptor) continue;
    if (descriptor.value !== undefined && descriptor.value !== null) {
      flat[key] = descriptor.value;
      continue;
    }
    if (descriptor.delta !== undefined && descriptor.delta !== null) {
      flat[`${key}_delta`] = descriptor.delta;
    }
    if (descriptor.unit) {
      flat[`${key}_unit`] = descriptor.unit;
    }
    if (descriptor.clamped !== undefined && descriptor.clamped !== null) {
      flat[`${key}_clamped`] = descriptor.clamped;
    }
  }
  return flat;
}
