export type ExperienceLevel = "Beginner" | "Intermediate" | "Advanced";

export type SlicerId = "cura" | "prusaslicer" | "bambu" | "orca";

export interface MachineRef {
  id: string;
  brand: string;
  model: string;
}

export interface MachineSummary extends MachineRef {
  capabilities?: string[];
  safe_speed_ranges?: Record<string, number[]>;
  max_nozzle_temp_c?: number;
  max_bed_temp_c?: number;
  spindle_rpm_range?: [number, number];
  max_feed_mm_min?: number;
}

export interface AnalyzeResponse {
  image_id: string;
  predictions: Array<{ issue_id: string; confidence: number }>;
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
  applied?: Record<string, number | string>;
  meta?: Record<string, unknown>;
}

export interface AnalysisHistoryRecord {
  imageId: string;
  machineId: string;
  machine: MachineRef;
  timestamp: number;
  response: AnalyzeResponse;
  material?: string;
  localUri?: string;
  summary?: MachineSummary;
  predictions?: AnalyzeResponse["predictions"];
}

export interface ProfileState {
  experience: ExperienceLevel;
  material?: string;
  machines: MachineRef[];
}

export interface AnalyzeRequestMeta {
  machine_id: string;
  experience: ExperienceLevel;
  material?: string;
  base_profile?: Record<string, number | string>;
  app_version?: string;
}

export type HistoryMap = Record<string, AnalysisHistoryRecord[]>;

export interface ExportDiff {
  slicer: SlicerId;
  diff: Record<string, number | string | boolean>;
  markdown?: string;
}

export interface OnboardingState {
  selectedMachines: string[];
  experience: ExperienceLevel;
}
