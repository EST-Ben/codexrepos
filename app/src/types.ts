export type ExperienceLevel = 'Beginner' | 'Intermediate' | 'Advanced';

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
  motion_system?: string;
  enclosed?: boolean;
  supports?: Record<string, unknown>;
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

export interface IssueConfidence {
  id: string;
  confidence: number;
}

export interface BoundingBox {
  issue_id?: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  score?: number;
}

export interface AnalyzeResponse {
  image_id: string;
  machine: MachineRef;
  issue_list: IssueConfidence[];
  top_issue?: string | null;
  boxes?: BoundingBox[];
  heatmap?: string | null;
  parameter_targets: Record<string, number>;
  applied: Record<string, number>;
  recommendations: string[];
  capability_notes: string[];
  clamp_explanations?: string[];
  hidden_parameters?: string[];
}

export interface AnalysisHistoryRecord {
  imageId: string;
  machineId: string;
  machine: MachineRef;
  timestamp: number;
  issues: IssueConfidence[];
  response: AnalyzeResponse;
  material?: string;
  localUri?: string;
  summary?: MachineSummary;
}

export type HistoryMap = Record<string, AnalysisHistoryRecord[]>;

export type SlicerId = 'cura' | 'prusaslicer' | 'bambu' | 'orca';

export interface ExportDiff {
  slicer: SlicerId;
  diff: Record<string, number | string>;
  markdown?: string;
}

export interface OnboardingState {
  selectedMachines: string[];
  experience: ExperienceLevel;
}
