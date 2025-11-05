import { MachineProfile } from "../machines/registry";

export type ClampResult = {
  parameters: Record<string, number>;
  hidden_parameters: string[];
  experience_level: string;
  clamped_to_machine_limits: boolean;
  explanations: string[];
};

export class RulesEngine {
  private EXPERIENCE_SETTINGS: Record<string, { allowed: "*" | Set<string>; max_factor: number; note: string }>; 

  constructor() {
    this.EXPERIENCE_SETTINGS = {
      Beginner: {
        allowed: new Set(["nozzle_temp", "bed_temp", "print_speed", "fan_speed", "flow_rate"]),
        max_factor: 0.85,
        note: "Beginner mode limits adjustments to core temperature and speed controls.",
      },
      Intermediate: {
        allowed: new Set([
          "nozzle_temp",
          "bed_temp",
          "print_speed",
          "travel_speed",
          "accel",
          "fan_speed",
          "flow_rate",
          "retraction_distance",
          "jerk",
        ]),
        max_factor: 0.95,
        note: "Intermediate mode unlocks motion controls with moderate guard rails.",
      },
      Advanced: {
        allowed: "*",
        max_factor: 1,
        note: "Advanced mode exposes all tunables within machine limits.",
      },
    } as const;
  }

  clampToMachine(machine: MachineProfile, parameters: Record<string, any>, experience = "Intermediate"): ClampResult {
    const settings = this.EXPERIENCE_SETTINGS[experience] ?? this.EXPERIENCE_SETTINGS["Intermediate"];
    const allowed = settings.allowed;
    const maxFactor = settings.max_factor;
    const clamped: Record<string, number> = {};
    const hidden = new Set<string>();
    let clampedFlag = false;
    const explanations = [settings.note];

    for (const [key, value] of Object.entries(parameters)) {
      if (allowed !== "*" && !allowed.has(key)) {
        hidden.add(key);
        continue;
      }
      const [minBound, maxBound] = this.boundsFor(machine, key);
      let effectiveMax = maxBound;
      if (typeof maxBound === "number" && maxFactor < 1) {
        effectiveMax = maxBound * maxFactor;
      }
      let newValue = value;
      if (typeof newValue === "number") {
        if (minBound !== null && minBound !== undefined && newValue < minBound) {
          newValue = minBound;
          clampedFlag = true;
          explanations.push(`Raised ${key} to machine minimum ${minBound}.`);
        }
        if (effectiveMax !== null && effectiveMax !== undefined && newValue > effectiveMax) {
          newValue = effectiveMax;
          clampedFlag = true;
          explanations.push(`Reduced ${key} to ${effectiveMax} based on limits.`);
        }
        if (typeof newValue === "number") {
          newValue = Number(newValue.toFixed(3));
        }
      }
      if (typeof newValue === "number") {
        clamped[key] = newValue;
      }
    }

    return {
      parameters: clamped,
      hidden_parameters: Array.from(hidden).sort(),
      experience_level: experience,
      clamped_to_machine_limits: clampedFlag,
      explanations,
    };
  }

  private boundsFor(machine: MachineProfile, key: string): [number | null, number | null] {
    const safe = (machine.safe_speed_ranges ?? {}) as Record<string, [number, number]>;
    const presets = (machine.material_presets ?? {}) as Record<string, Record<string, number[]>>;

    if (key === "nozzle_temp") {
      const minV = this.minFromPresets(presets, "nozzle_c");
      return [minV, toFloat(machine.max_nozzle_temp_c)];
    }
    if (key === "bed_temp") {
      const minV = this.minFromPresets(presets, "bed_c");
      return [minV, toFloat(machine.max_bed_temp_c)];
    }
    if (key === "print_speed") return this.rangeFromSafe(safe, "print");
    if (key === "travel_speed") return this.rangeFromSafe(safe, "travel");
    if (key === "accel") return this.rangeFromSafe(safe, "accel");
    if (key === "jerk") return this.rangeFromSafe(safe, "jerk");
    if (key === "fan_speed") return [0, 100];
    if (key === "flow_rate") return [80, 120];
    if (key === "retraction_distance") return [0.2, 8];
    if (key === "spindle_rpm") {
      const rng = machine.spindle_rpm_range ?? [];
      return this.rangeFromList(rng);
    }
    if (key === "feed_rate") {
      const maxFeed = toFloat(machine.max_feed_mm_min);
      return [100, maxFeed ?? null];
    }
    if (key === "doc") {
      return [0.1, this.docLimit(machine)];
    }
    if (key === "stepover") {
      return [1, 60];
    }
    return [null, null];
  }

  private docLimit(machine: MachineProfile): number {
    const rigidity = String(machine.rigidity_class ?? "hobby").toLowerCase();
    const limits: Record<string, number> = {
      hobby: 2,
      hobby_pro: 3,
      light_industrial: 5,
      industrial: 8,
    };
    return limits[rigidity] ?? 3;
  }

  private rangeFromSafe(safe: Record<string, [number, number]>, key: string): [number | null, number | null] {
    const values = safe[key];
    if (Array.isArray(values) && values.length) {
      return [toFloat(values[0]) ?? null, toFloat(values[values.length - 1]) ?? null];
    }
    return [null, null];
  }

  private rangeFromList(values: unknown): [number | null, number | null] {
    if (!Array.isArray(values) || !values.length) return [null, null];
    return [toFloat(values[0]) ?? null, toFloat(values[values.length - 1]) ?? null];
  }

  private minFromPresets(
    presets: Record<string, Record<string, number[]>>,
    key: string,
  ): number | null {
    const mins: number[] = [];
    for (const preset of Object.values(presets)) {
      const values = preset[key];
      if (Array.isArray(values) && values.length) {
        const candidate = toFloat(values[0]);
        if (typeof candidate === "number") mins.push(candidate);
      }
    }
    if (mins.length) return Math.min(...mins);
    return null;
  }
}

function toFloat(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
