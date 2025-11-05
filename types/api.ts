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

export type SlicerId = 'cura' | 'prusaslicer' | 'bambu' | 'orca';

export interface ExportDiff {
  slicer: SlicerId;
  diff: Record<string, number | string | boolean>;
  markdown?: string;
}

export interface OnboardingState {
  selectedMachines: string[];
  experience: ExperienceLevel;
}

export type SlicerProfileParameter = {
  value?: number;
  delta?: number;
  unit?: string;
  range_hint?: [number, number];
  clamped?: boolean;
};

export type SlicerProfileDiff = {
  diff?: Record<string, string | number | boolean>;
  parameters?: Record<string, SlicerProfileParameter>;
  markdown?: string;
};

export interface ExportProfileResponse {
  profile: { name: string; params: Record<string, unknown> };
  warnings: string[];
}

export interface AnalyzeResponse {
  image_id: string;
  version: string;
  machine: { id?: string; brand?: string; model?: string };
  experience: ExperienceLevel;
  material?: string;
  predictions: { issue_id: string; confidence: number }[];
  explanations: string[];
  localization: LocalizationPayload;
  capability_notes: string[];
  recommendations: string[];
  suggestions: Suggestion[];
  slicer_profile_diff?: SlicerProfileDiff;
  applied: AppliedClamp;
  low_confidence: boolean;
  parameter_targets: Record<string, number>;
  issues?: Array<{ id: string; confidence: number }>;
  issue_list?: Array<{ id: string; confidence: number }>;
  clamp_explanations?: string[];
}

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
