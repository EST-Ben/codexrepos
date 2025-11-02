// app/src/types.ts

// ---------- Core domain types ----------

export type ExperienceLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export interface MachineRef {
  id: string;
  brand: string;
  model: string;
}

export interface MachineSummary {
  id: string;
  brand: string;
  model: string;
  capabilities?: string[];
  // e.g. { speed: [80, 200], accel: [2000, 7000] }
  safe_speed_ranges?: Record<string, number[]>;
  max_nozzle_temp_c?: number;
  max_bed_temp_c?: number;
  spindle_rpm_range?: [number, number];
  max_feed_mm_min?: number;
}

export interface ProfileState {
  machines: MachineRef[];
  experience: ExperienceLevel;
  material?: string;
}

// ---------- Analyze: request/response ----------

export interface AnalyzeRequestMeta {
  machine_id: string;
  experience: ExperienceLevel;
  material?: string;
  app_version?: string;
}

export interface Prediction {
  issue_id: string;
  confidence: number; // 0..1
}

export interface BoundingBox {
  // support both legacy (x,y,w,h in 0..1) and new (x,y,width,height) shapes
  x: number;
  y: number;
  w?: number;
  h?: number;
  width?: number;
  height?: number;
  issue_id?: string;
  confidence?: number; // some payloads call this score/confidence
  score?: number;      // legacy alias
}

export interface SlicerProfileDiff {
  // Minimal structure used by UI: a normalized diff map and optional markdown
  diff: Record<string, string | number>;
  markdown?: string;
}

export interface AnalyzeResponse {
  image_id: string;
  machine: MachineRef;

  // New canonical fields
  predictions: Prediction[];                // ← replaces legacy issue_list
  recommendations: string[];
  capability_notes: string[];

  // Parameter guidance
  parameter_targets?: Record<string, string | number>;
  /**
   * Servers may return either:
   *   - a plain param map (legacy), or
   *   - an object with richer details.
   * Support both.
   */
  applied?:
    | Record<string, string | number>
    | {
        parameters?: Record<string, string | number>;
        hidden_parameters?: string[];
        experience_level?: ExperienceLevel | string;
        clamped_to_machine_limits?: boolean;
        explanations?: string[];
      };

  // General explanations / clamp notes (canonical)
  explanations?: string[];

  // Optional localization block (canonical)
  localization?: {
    // Some responses send a bare data URL string; others wrap it.
    heatmap?: string | { data_url: string };
    boxes?: BoundingBox[];
  };

  // Optional slicer export diff
  slicer_profile_diff?: SlicerProfileDiff;

  // ---------- Backward-compat aliases (do not rely on these long-term) ----------
  // Old top-level names some screens/hooks might still touch
  top_issue?: string;                       // prefer deriving from predictions[0]
  heatmap?: string;                         // prefer localization.heatmap
  boxes?: BoundingBox[];                    // prefer localization.boxes
  hidden_parameters?: string[];             // prefer applied.hidden_parameters
  clamp_explanations?: string[];            // prefer explanations
  issue_list?: Prediction[];                // prefer predictions
  parameters?: Record<string, string | number>; // prefer parameter_targets
}

// ---------- History & UI contracts ----------

export interface AnalysisHistoryRecord {
  imageId: string;
  machineId: string;
  machine: MachineRef;
  timestamp: number;
  response: AnalyzeResponse;
  material?: string;
  localUri?: string;
  summary?: MachineSummary;

  // Backward-compat for legacy code that expected issues on the record:
  issues?: Prediction[];       // deprecated — prefer response.predictions
  // Convenience (optional) for quick display/search without digging into response:
  predictions?: Prediction[];  // optional mirror of response.predictions
}

// ---------- Slicer export ----------

export type SlicerId = 'cura' | 'prusaslicer' | 'bambu' | 'orca';

// Optional: small helper type some components import
export type Experience = ExperienceLevel;
