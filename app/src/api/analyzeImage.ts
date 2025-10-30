// app/src/api/analyzeImage.ts
// Sends an image to the FastAPI endpoint /api/analyze/image as multipart/form-data

export type Experience = "Beginner" | "Intermediate" | "Advanced";

export interface AnalyzeImageRequest {
  uri: string;                 // file://... (from ImagePicker)
  machine: string;             // e.g. "bambu_x1c"
  material?: string;           // default "PLA"
  experience?: Experience;     // default "Intermediate"
  fileName?: string;           // optional override (default: "print.jpg")
  mimeType?: string;           // optional override (default: "image/jpeg")
}

export interface AnalyzeImageResponse {
  machine: { id?: string; brand?: string; model?: string };
  issue: string;
  confidence: number;
  recommendations: string[];
  parameter_targets: Record<string, number>;
  applied: Record<string, number>;
  capability_notes: string[];
}

function ensureApiBase(): string {
  const base = process.env.EXPO_PUBLIC_API_BASE;
  if (!base) {
    throw new Error(
      "EXPO_PUBLIC_API_BASE is not set. Example: http://localhost:8000/api"
    );
  }
  return base.replace(/\/$/, ""); // no trailing slash
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
  const base = ensureApiBase();

  const form = new FormData();
  form.append("machine", req.machine);
  form.append("material", req.material ?? "PLA");
  form.append("experience", req.experience ?? "Intermediate");

  const name = req.fileName ?? inferName(req.uri);
  const type = req.mimeType ?? "image/jpeg";

  // NOTE: In React Native/Expo, the file object must have uri/name/type
  form.append("image", {
    uri: req.uri,
    name,
    type,
  } as any);

  const res = await fetch(`${base}/analyze/image`, {
    method: "POST",
    body: form,
    // DO NOT set Content-Type; fetch will set proper boundary for FormData
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Analyze image failed (${res.status}): ${text || res.statusText}`
    );
  }

  return (await res.json()) as AnalyzeImageResponse;
}
