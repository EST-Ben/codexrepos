export type ExperienceLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export interface MachineSummary {
  id: string;
  brand?: string;
  model?: string;
  aliases?: string[];
}

export interface AnalyzeResponse {
  machine: { id: string; brand?: string; model?: string };
  issue: string;
  confidence: number;
  recommendations: string[];
  parameter_targets: Record<string, number>;
  applied: {
    parameters: Record<string, number>;
    hidden_parameters: string[];
    experience_level: ExperienceLevel;
    clamped_to_machine_limits: boolean;
    explanations: string[];
  };
  capability_notes: string[];
}

export interface ExportDiff {
  slicer: 'cura' | 'prusaslicer' | 'bambu' | 'orca';
  diff: Record<string, number | string | boolean>;
  source_keys: string[];
}

export interface OnboardingState {
  selectedMachines: string[];
  experience: ExperienceLevel;
}
