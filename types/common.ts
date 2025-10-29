export type ExperienceLevel = "Beginner" | "Intermediate" | "Advanced";

export interface MachineRef {
  id: string;
  brand: string;
  model: string;
}

export interface AnalyzeRequestMeta {
  machine_id: string;
  experience: ExperienceLevel;
  material?: string;
  base_profile?: Record<string, any>;
  app_version?: string;
}

export interface Prediction {
  issue_id: string;
  confidence: number;
}

export interface SuggestionChange {
  param: string;
  delta?: number;
  unit?: string;
  new_target?: number;
  range_hint?: [number, number];
}

export interface Suggestion {
  issue_id: string;
  changes: SuggestionChange[];
  why: string;
  risk: "low" | "medium" | "high";
  confidence: number;
  beginner_note?: string;
  advanced_note?: string;
  clamped_to_machine_limits?: boolean;
}

export interface AnalyzeResponse {
  predictions: Prediction[];
  explanations: { issue_id: string; cues: string[] }[];
  suggestions: Suggestion[];
  slicer_profile_diff: Record<string, any>;
  image_id: string;
  version: string;
  low_confidence?: boolean;
}
