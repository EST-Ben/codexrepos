import type { ExperienceLevel } from '../types';

const EXPERIENCE_RANGES: Record<ExperienceLevel, number> = {
  Beginner: 0.12,
  Intermediate: 0.2,
  Advanced: 0.35,
};

const BEGINNER_KEYS = new Set(['nozzle_temp', 'bed_temp', 'print_speed', 'fan_speed', 'flow_rate']);
const INTERMEDIATE_EXTRA_KEYS = new Set(['travel_speed', 'accel', 'retraction_distance']);

export function filterParametersForExperience(
  parameters: Record<string, number>,
  experience: ExperienceLevel,
): Record<string, number> {
  if (experience === 'Advanced') {
    return { ...parameters };
  }
  const allowed = new Set(BEGINNER_KEYS);
  if (experience === 'Intermediate') {
    INTERMEDIATE_EXTRA_KEYS.forEach((key) => allowed.add(key));
  }
  return Object.fromEntries(
    Object.entries(parameters).filter(([key]) => allowed.has(key)),
  );
}

export interface ParameterRange {
  min: number;
  max: number;
}

export function deriveParameterRanges(
  parameters: Record<string, number>,
  experience: ExperienceLevel,
): Record<string, ParameterRange> {
  const factor = EXPERIENCE_RANGES[experience];
  const ranges: Record<string, ParameterRange> = {};
  for (const [key, value] of Object.entries(parameters)) {
    const delta = Math.max(Math.abs(value) * factor, 1);
    const min = key.includes('temp') || key.includes('fan') ? Math.max(0, value - delta) : value - delta;
    ranges[key] = {
      min: Number(min.toFixed(2)),
      max: Number((value + delta).toFixed(2)),
    };
  }
  return ranges;
}
