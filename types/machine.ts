export type MotionSystem =
  | 'BedSlinger'
  | 'CoreXY'
  | 'H-Bot'
  | 'Delta'
  | 'Cartesian'
  | 'IDEX'
  | 'Belt'
  | 'Other';

export type MachineType =
  | 'FDM'
  | 'MSLA'
  | 'SLA'
  | 'CNC_Router'
  | 'CNC_Mill'
  | 'Generic';

export interface MachineProfile {
  id: string;
  brand: string;
  model: string;
  type: MachineType;
  motion_system?: MotionSystem;
  enclosed?: boolean;
  build_volume_mm?: [number, number, number];
  workarea_mm?: [number, number, number];
  nozzle_diameters?: number[];
  max_nozzle_temp_c?: number;
  max_bed_temp_c?: number;
  spindle_rpm_range?: [number, number];
  max_feed_mm_min?: number;
  rigidity_class?: 'hobby' | 'hobby_pro' | 'light_industrial' | 'industrial';
  supports?: Record<string, boolean>;
  material_presets?: Record<string, Record<string, number[]>>;
  safe_speed_ranges?: Record<string, number[]>;
  capabilities?: string[];
  aliases?: string[];
  notes?: string;
}

export interface MachineRegistry {
  machines: Array<MachineProfile & { family: string }>;
}
