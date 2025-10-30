// app/src/api/analyzeImage.ts
// Sends an image to FastAPI POST /api/analyze (multipart/form-data)

import Constants from "expo-constants";

export type Experience = "Beginner" | "Intermediate" | "Advanced";

export interface AnalyzeImageRequest {
  uri: string;                 // file://... (from ImagePicker)
  machine: string;             // e.g. "bambu_x1c"
  material?: string;           // default "PLA"
  experience?: Experience;     // default "Intermediate"
  fileName?: string;           // optional override (default: inferred or "print.jpg")
  mimeType?: string;           // optional override (default: "image/jpeg")
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

/** Resolve API base (Expo-safe). Example final URL -> http://192.168.0.35:8000/api/analyze */
function resolveApiBase(): string {
  const extra =
    (Constants?.expoConfig as any)?.extra?.API_URL ??
    (Constants as any)?.manifest?.extra?.API_URL; // legacy fallback
  const root = (extra ?? "http://localhost:8000").toString().replace(/\/+$/, "");
  return `${root}/api`;
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
  const API_BASE = resolveApiBase();

  const form = new FormData();

  // Server expects a JSON "meta" field alongside the file
  const meta = {
    machine_id: req.machine,
    experience: req.experience ?? "Intermediate",
    material: req.material ?? "PLA",
    app_version: (Constants?.expoConfig as any)?.version ?? "dev",
  };
  form.append("meta", JSON.stringify(meta));

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
