// app/src/api/analyzeImage.ts
// Sends an image to FastAPI POST /api/analyze (multipart/form-data)

import Constants from "expo-constants";

import { getApiRoot } from "./client";

export type Experience = "Beginner" | "Intermediate" | "Advanced";

export interface AnalyzeImageRequest {
  uri: string; // file://... (from ImagePicker)
  machine: string; // e.g. "bambu_x1c"
  material?: string; // default "PLA"
  experience?: Experience; // default "Intermediate"
  baseProfile?: Record<string, unknown> | null; // optional per-machine overrides
  appVersion?: string; // optional override for meta.app_version
  fileName?: string; // optional override (default: inferred or "print.jpg")
  mimeType?: string; // optional override (default: "image/jpeg")
}

export interface AnalyzeImageResponse {
  machine: { id?: string; brand?: string; model?: string };
  issue?: string;
  confidence?: number;
  recommendations?: string[];
  suggestions?: any;                 // server may return "suggestions"
  parameter_targets?: Record<string, number>;
  slicer_profile_diff?: Record<string, any>;
  applied?: Record<string, number> | any;
  capability_notes?: string[];
  predictions?: any[];
  version?: string;
}

// Some Android/iOS URIs come without file extension; default a stable name
function inferName(uri: string, fallback = "print.jpg"): string {
  try {
    const fromUri = uri.split("/").pop();
    if (fromUri && fromUri.includes(".")) return fromUri;
  } catch {}
  return fallback;
}

export async function analyzeImage(
  req: AnalyzeImageRequest
): Promise<AnalyzeImageResponse> {
  const API_BASE = `${getApiRoot()}/api`;

  const form = new FormData();

  // Server expects a JSON "meta" field alongside the file
  const meta = {
    machine_id: req.machine,
    experience: req.experience ?? "Intermediate",
    material: req.material ?? "PLA",
    base_profile: req.baseProfile ?? undefined,
    app_version:
      req.appVersion ?? (Constants?.expoConfig as any)?.version ?? "dev",
  };
  // Remove undefined keys before serialising to keep payload tidy
  const metaClean = Object.fromEntries(
    Object.entries(meta).filter(([_, value]) => value !== undefined)
  );
  form.append("meta", JSON.stringify(metaClean));

  const name = req.fileName ?? inferName(req.uri);
  const type = req.mimeType ?? "image/jpeg";

  // React Native/Expo FormData file shape: { uri, name, type }
  const rnFile: any = { uri: req.uri, name, type };
  form.append("image", rnFile);

  const res = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    // Do NOT set Content-Type; fetch sets correct boundary for FormData
    headers: { Accept: "application/json" },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Analyze image failed (${res.status}): ${text || res.statusText}`);
  }

  return (await res.json()) as AnalyzeImageResponse;
}
