// app/src/api/analyzeImage.ts
// Wrapper that preserves this module's API while delegating the actual
// upload/handling to the stable implementation in ./client to avoid drift.

import Constants from "expo-constants";
import { analyzeImage as coreAnalyzeImage, type RNFileLike } from "./client";
import type { AnalyzeRequestMeta, AnalyzeResponse, ExperienceLevel } from "../types";

export type Experience = ExperienceLevel;

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

// Some Android/iOS URIs come without file extension; default a stable name
function inferName(uri: string, fallback = "print.jpg"): string {
  try {
    const fromUri = uri.split("/").pop();
    if (fromUri && fromUri.includes(".")) return fromUri;
  } catch {}
  return fallback;
}

export async function analyzeImage(req: AnalyzeImageRequest): Promise<AnalyzeResponse> {
  // Build RN-style file object for the shared client
  const file: RNFileLike = {
    uri: req.uri,
    name: req.fileName ?? inferName(req.uri),
    type: req.mimeType ?? "image/jpeg",
  };

  // Build meta in the canonical shape used by the backend & client.ts
  const meta: AnalyzeRequestMeta = {
    machine_id: req.machine,
    experience: (req.experience ?? "Intermediate") as ExperienceLevel,
    material: req.material ?? "PLA",
    base_profile: (req.baseProfile ?? undefined) as Record<string, number> | undefined,
    app_version:
      req.appVersion ??
      // Expo SDK 49+: expoConfig
      (Constants?.expoConfig as any)?.version ??
      // Older SDKs: manifest
      (Constants as any)?.manifest?.version ??
      "dev",
  };

  // Delegate to the central implementation (handles FormData, fetch, etc.)
  return coreAnalyzeImage(file, meta);
}
