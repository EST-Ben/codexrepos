export type {
  ExperienceLevel,
  MachineRef,
  AnalyzeRequestMeta,
  Prediction,
  Suggestion,
  SuggestionChange,
  AnalyzeResponse,
} from '../../types/common';

export type { MachineProfile } from '../../types/machine';

export interface MachineSummary extends MachineRef {
  aliases?: string[];
  capabilities?: string[];
  safe_speed_ranges?: Record<string, number[]>;
  material_presets?: Record<string, Record<string, number[]>>;
  max_nozzle_temp_c?: number;
  max_bed_temp_c?: number;
  spindle_rpm_range?: [number, number];
  max_feed_mm_min?: number;
  notes?: string;
  type?: string;
  supports?: Record<string, boolean>;
}

export type SlicerId = 'cura' | 'prusaslicer' | 'bambu' | 'orca';

export interface ProfileState {
  experience: ExperienceLevel;
  machines: MachineRef[];
  material?: string;
  materialByMachine?: Record<string, string | undefined>;
}

export interface AnalysisHistoryRecord {
  imageId: string;
  machineId: string;
  machine?: MachineRef;
  timestamp: number;
  predictions: Prediction[];
  response?: AnalyzeResponse;
  material?: string;
  localUri?: string;
  summary?: MachineSummary;
}

export type HistoryMap = Record<string, AnalysisHistoryRecord[]>;
