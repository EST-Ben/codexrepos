export type ExperienceLevel = "Beginner" | "Intermediate" | "Advanced";

export interface MachineRef {
  id: string;
  brand: string;
  model: string;
  type?: string;
}

export interface MachineSummary extends MachineRef {
  aliases?: string[];
  capabilities?: string[];
  safe_speed_ranges?: {
    print?: [number, number];
    travel?: [number, number];
    accel?: [number, number];
    jerk?: [number, number];
  };
  max_nozzle_temp_c?: number;
  max_bed_temp_c?: number;
  spindle_rpm_range?: [number, number];
  max_feed_mm_min?: number;
  material_presets?: Record<string, unknown>;
}

export interface ProfileState {
  experience: ExperienceLevel;
  machines: MachineRef[];
  material?: string;
  materialByMachine?: Record<string, string | undefined>;
}

export interface AnalyzeRequestMeta {
  machine_id: string;
  experience: ExperienceLevel;
  material?: string;
  base_profile?: Record<string, number>;
  app_version?: string;
}

export interface BoundingBox {
  issue_id: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HeatmapPayload {
  encoding: 'svg';
  width: number;
  height: number;
  data_url: string;
}

export interface LocalizationPayload {
  boxes: BoundingBox[];
  heatmap?: HeatmapPayload | null;
}

export interface SuggestionChange {
  param: string;
  delta?: number | null;
  unit?: string | null;
  new_target?: number | null;
  range_hint?: [number, number] | null;
}

export interface Suggestion {
  issue_id: string;
  changes: SuggestionChange[];
  why: string;
  risk: string;
  confidence: number;
  beginner_note?: string | null;
  advanced_note?: string | null;
  clamped_to_machine_limits?: boolean | null;
}

export interface AppliedClamp {
  parameters: Record<string, number>;
  hidden_parameters: string[];
  experience_level: ExperienceLevel;
  clamped_to_machine_limits: boolean;
  explanations: string[];
}

/** Slicer identifiers supported by export flows */
export type SlicerId = 'cura' | 'prusaslicer' | 'bambu' | 'orca';

/** Used for exports */
export interface ExportDiff {
  slicer: SlicerId;
  diff: Record<string, number | string | boolean>;
  markdown?: string;
}

/** Onboarding UI state */
export interface OnboardingState {
  selectedMachines: string[];
  experience: ExperienceLevel;
}

/** Slicer profile parameter descriptor */
export type SlicerProfileParameter = {
  value?: number;
  delta?: number;
  unit?: string;
  range_hint?: [number, number];
  clamped?: boolean;
};

/**
 * Flexible diff payload returned by the backend.
 * - `parameters` is the preferred structured form.
 * - `diff` is a legacy/plain object for compatibility.
 */
export type SlicerProfileDiff = {
  diff?: Record<string, string | number | boolean>;
  parameters?: Record<string, SlicerProfileParameter>;
  markdown?: string;
};

export interface AnalyzeResponse {
  image_id: string;
  version: string;
  machine: { id?: string; brand?: string; model?: string };
  experience: ExperienceLevel;
  material?: string;

  /** Main predictions list */
  predictions: { issue_id: string; confidence: number }[];

  /** Human-readable notes/explanations */
  explanations: string[];

  /** 2D localization info and optional heatmap */
  localization: LocalizationPayload;

  /** Additional context / tips */
  capability_notes: string[];
  recommendations: string[];

  /** Parameter-level change suggestions */
  suggestions: Suggestion[];

  /** Flexible slicer diff payload (structured + legacy) */
  slicer_profile_diff?: SlicerProfileDiff;

  /** What was actually applied after clamping */
  applied: AppliedClamp;

  /** Confidence flag from the backend */
  low_confidence: boolean;

  /* ---------- Compatibility aliases (optional) ---------- */

  /**
   * Some callers/tests may still reference these:
   * - `issues` or `issue_list` as mirrors of `predictions`
   * - `clamp_explanations` as extra strings alongside `explanations`
   */
  issues?: Array<{ id: string; confidence: number }>;
  issue_list?: Array<{ id: string; confidence: number }>;
  clamp_explanations?: string[];
}

/** History types */
export interface AnalysisHistoryRecord {
  imageId: string;
  machineId: string;
  machine: MachineRef;
  timestamp: number;
  predictions: AnalyzeResponse['predictions'];
  response: AnalyzeResponse;
  material?: string;
  localUri?: string;
  summary?: MachineSummary;
}

export type HistoryMap = Record<string, AnalysisHistoryRecord[]>;
