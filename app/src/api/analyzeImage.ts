import { getApiRoot } from "./client";
import type { AnalyzeResponse } from "../types";

export default async function analyzeImage(formData: FormData): Promise<AnalyzeResponse> {
  const response = await fetch(`${getApiRoot()}/api/analyze`, {
    method: "POST",
    headers: { Accept: "application/json" },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Analyze image failed with status ${response.status}`);
  }

  return (await response.json()) as AnalyzeResponse;
}
