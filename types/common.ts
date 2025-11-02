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
  image_id: string;
  predictions: Prediction[];
  recommendations: string[];
  capability_notes: string[];
  localization?: {
    heatmap?: { data_url: string };
    boxes?: Array<{
      issue_id: string;
      x: number;
      y: number;
      width: number;
      height: number;
      confidence: number;
    }>;
  };
  slicer_profile_diff?: {
    diff: Record<string, string | number | boolean>;
    markdown?: string;
  };
  explanations?: string[];
  applied?: Record<string, string | number>;
  meta?: Record<string, unknown>;
}
