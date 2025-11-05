import type { AnalyzeRequestMeta, Suggestion, SuggestionChange } from "types/api";
import { resolveMachine, type MachineProfile } from "../machines/registry";
import { RulesEngine } from "./clamp";
import type { Prediction } from "../inference/predict";

export class SuggestionPlanner {
  private machine: MachineProfile;
  private material: string;
  private experience: string;
  private supports: Record<string, any>;
  private motion: string;
  private enclosed: boolean;
  private engine: RulesEngine;
  private baselineCache: Record<string, number> | null = null;

  constructor(private meta: AnalyzeRequestMeta) {
    this.machine = resolveMachine(meta.machine_id);
    this.material = (meta.material ?? "PLA").toUpperCase();
    this.experience = meta.experience ?? "Intermediate";
    this.supports = (this.machine.supports ?? {}) as Record<string, any>;
    this.motion = String(this.machine.motion_system ?? "BedSlinger");
    this.enclosed = Boolean(this.machine.enclosed);
    this.engine = new RulesEngine();
  }

  plan(predictions: Prediction[]): [Suggestion[], boolean] {
    const items = [...predictions];
    let lowConfidence = false;
    if (!items.length || items.every((pred) => pred.confidence < 0.5)) {
      lowConfidence = true;
      const fallback: Prediction = { issue_id: "general_tuning", confidence: 0.45 };
      const suggestion = this.generalBestPractice(fallback);
      return [[suggestion], true];
    }

    const suggestions: Suggestion[] = [];
    for (const prediction of items) {
      const handler = this.handlerForIssue(prediction.issue_id);
      suggestions.push(handler.call(this, prediction));
    }
    return [suggestions, lowConfidence];
  }

  baseline(): Record<string, number> {
    return { ...this.getBaseline() };
  }

  private handlerForIssue(issueId: string) {
    const normalized = issueId.toLowerCase();
    if (normalized.includes("string")) return this.stringing;
    if (normalized.includes("under")) return this.underExtrusion;
    if (normalized.includes("ring")) return this.ringing;
    if (normalized.includes("peel")) return this.resinPeel;
    if (normalized.includes("chatter")) return this.cncChatter;
    return this.generalBestPractice;
  }

  private stringing(prediction: Prediction): Suggestion {
    const baseline = this.getBaseline();
    const supportsDrying = Boolean(this.supports?.ams);
    const adjustments = [
      {
        param: "nozzle_temp",
        target: baseline["nozzle_temp"] - 10,
        unit: "C",
        range_hint: [-15, -5] as [number, number],
        requires_clamp: true,
      },
      {
        param: "retraction_distance",
        target: baseline["retraction_distance"] + 1,
        unit: "mm",
        range_hint: [0.5, 1.5] as [number, number],
        requires_clamp: true,
      },
      {
        param: "travel_speed",
        target: baseline["travel_speed"] + 10,
        unit: "mm/s",
        range_hint: [5, 20] as [number, number],
        requires_clamp: true,
      },
      {
        param: "drying_recommendation",
        target: supportsDrying ? 0 : 1,
        requires_clamp: false,
      },
    ];
    let why = "Stringing detected; reducing nozzle temperature and increasing retraction fights ooze.";
    if (!supportsDrying) {
      why += " Include filament drying to remove absorbed moisture.";
    }
    const beginnerNote = "Run a retraction test cube after lowering temperatures to confirm improvements.";
    const advancedNote = "Consider pressure advance or linear advance tuning if your slicer supports it.";
    return this.buildSuggestion(prediction, adjustments, {
      risk: "medium",
      why,
      beginner_note: beginnerNote,
      advanced_note: advancedNote,
    });
  }

  private underExtrusion(prediction: Prediction): Suggestion {
    const baseline = this.getBaseline();
    const idex = Boolean(this.supports?.idex) || this.motion === "IDEX";
    const adjustments = [
      {
        param: "nozzle_temp",
        target: baseline["nozzle_temp"] + 8,
        unit: "C",
        range_hint: [5, 10] as [number, number],
        requires_clamp: true,
      },
      {
        param: "print_speed",
        target: baseline["print_speed"] * 0.85,
        unit: "mm/s",
        range_hint: [-20, -10] as [number, number],
        requires_clamp: true,
      },
      {
        param: "flow_rate",
        target: 103,
        unit: "%",
        range_hint: [2, 5] as [number, number],
        requires_clamp: true,
      },
    ];
    const beginnerNote = "Verify extruder gears are clean before increasing temperatures or flow.";
    let advancedNote = "Run an extrusion multiplier calibration and inspect hotend for partial clogs.";
    if (idex) {
      advancedNote += " Calibrate both toolheads to avoid mismatch between extruders.";
    }
    const why = "Under-extrusion cues suggest raising melt capacity and slowing print speed for consistency.";
    return this.buildSuggestion(prediction, adjustments, {
      risk: "medium",
      why,
      beginner_note: beginnerNote,
      advanced_note: advancedNote,
    });
  }

  private ringing(prediction: Prediction): Suggestion {
    const baseline = this.getBaseline();
    const isBedslinger = this.motion === "BedSlinger";
    const accelScale = isBedslinger ? 0.6 : 0.8;
    const jerkScale = isBedslinger ? 0.65 : 0.85;
    const adjustments = [
      {
        param: "accel",
        target: baseline["accel"] * accelScale,
        unit: "mm/s^2",
        range_hint: [-3000, -500] as [number, number],
        requires_clamp: true,
      },
      {
        param: "jerk",
        target: baseline["jerk"] * jerkScale,
        unit: "mm/s",
        range_hint: [-8, -2] as [number, number],
        requires_clamp: true,
      },
      {
        param: "print_speed",
        target: baseline["print_speed"] * 0.9,
        unit: "mm/s",
        range_hint: [-15, -5] as [number, number],
        requires_clamp: true,
      },
    ];
    let why = "Ghosting is mitigated by reducing accelerations and jerk, scaled to the motion system.";
    if (this.supports?.input_shaping) {
      why += " Input shaping allows recovering speed after vibrations are controlled.";
    }
    const beginnerNote = "Tighten belts before lowering acceleration to keep motion crisp.";
    const advancedNote = "Capture resonance data with input shaping or accelerometer tools if available.";
    return this.buildSuggestion(prediction, adjustments, {
      risk: "low",
      why,
      beginner_note: beginnerNote,
      advanced_note: advancedNote,
    });
  }

  private resinPeel(prediction: Prediction): Suggestion {
    const baseline = this.baselineResin();
    const adjustments = [
      {
        param: "lift_speed",
        target: baseline["lift_speed"] * 0.85,
        unit: "mm/min",
        range_hint: [-20, -5] as [number, number],
        requires_clamp: true,
      },
      {
        param: "exposure_time",
        target: baseline["exposure_time"] * 1.1,
        unit: "s",
        range_hint: [5, 15] as [number, number],
        requires_clamp: true,
      },
    ];
    const why = "Peel artifacts benefit from slower lifts and slightly longer exposures to ensure adhesion.";
    const beginnerNote = "Check vat film tension before adjusting lift speeds.";
    const advancedNote = "Balance exposure increases with resin manufacturer's recommended maximums.";
    return this.buildSuggestion(prediction, adjustments, {
      risk: "medium",
      why,
      beginner_note: beginnerNote,
      advanced_note: advancedNote,
    });
  }

  private cncChatter(prediction: Prediction): Suggestion {
    const baseline = this.baselineCnc();
    const adjustments = [
      {
        param: "feed_rate",
        target: baseline["feed_rate"] * 0.8,
        unit: "mm/min",
        range_hint: [-25, -10] as [number, number],
        requires_clamp: true,
      },
      {
        param: "doc",
        target: baseline["doc"] * 0.7,
        unit: "mm",
        range_hint: [-2, -0.5] as [number, number],
        requires_clamp: true,
      },
      {
        param: "spindle_rpm",
        target: baseline["spindle_rpm"] * 1.05,
        unit: "rpm",
        range_hint: [5, 10] as [number, number],
        requires_clamp: true,
      },
    ];
    const why = "Reducing feed and depth of cut while slightly increasing spindle RPM mitigates chatter.";
    const beginnerNote = "Ensure tool stick-out is minimized before cutting more slowly.";
    const advancedNote = "Dial in adaptive clearing strategies to maintain consistent chip load.";
    return this.buildSuggestion(prediction, adjustments, {
      risk: "medium",
      why,
      beginner_note: beginnerNote,
      advanced_note: advancedNote,
    });
  }

  private generalBestPractice(prediction: Prediction): Suggestion {
    const baseline = this.getBaseline();
    const adjustments = baseline.nozzle_temp !== undefined
      ? [
          {
            param: "nozzle_temp",
            target: baseline.nozzle_temp,
            unit: "C",
            range_hint: [0, 0] as [number, number],
            requires_clamp: true,
          },
          {
            param: "bed_temp",
            target: baseline.bed_temp,
            unit: "C",
            range_hint: [0, 0] as [number, number],
            requires_clamp: true,
          },
        ]
      : [];
    const why = "Providing general tuning baselines because the model returned low confidence.";
    const beginnerNote = "Re-run calibration prints (flow cube, temperature tower) to gather more data.";
    const advancedNote = "Capture higher-resolution photos and include notes about materials for better results.";
    return this.buildSuggestion(prediction, adjustments, {
      risk: "low",
      why,
      beginner_note: beginnerNote,
      advanced_note: advancedNote,
    });
  }

  private getBaseline(): Record<string, number> {
    if (this.baselineCache) return this.baselineCache;
    const type = this.machine.type;
    if (type === "MSLA" || type === "SLA") {
      this.baselineCache = this.baselineResin();
    } else if (type === "CNC_Router" || type === "CNC_Mill") {
      this.baselineCache = this.baselineCnc();
    } else {
      this.baselineCache = this.baselineFdm();
    }
    return this.baselineCache;
  }

  private baselineFdm(): Record<string, number> {
    const presets = (this.machine.material_presets ?? {}) as Record<string, any>;
    const preset = (presets[this.material] ?? presets["PLA"] ?? {}) as Record<string, any>;
    const midpoint = (values: any, fallback: number) => {
      if (Array.isArray(values) && values.length) {
        return Number(values.reduce((sum: number, val: number) => sum + Number(val), 0) / values.length);
      }
      return fallback;
    };
    let nozzle = midpoint(preset["nozzle_c"], 210);
    let bed = midpoint(preset["bed_c"], 60);
    let fan = midpoint(preset["fan_pct"], 70);
    const motion = this.motion;
    const supports = this.supports;
    const enclosed = this.enclosed;
    const printSpeed = motion === "CoreXY" || motion === "H-Bot" ? 120 : 90;
    const travelSpeed = motion === "CoreXY" || motion === "H-Bot" ? 150 : 120;
    const accel = supports?.input_shaping ? 5000 : 3000;
    const jerk = motion === "CoreXY" || motion === "H-Bot" ? 12 : 8;
    const retraction = supports?.ams ? 0.8 : 0.6;
    if (enclosed && this.material === "ABS") {
      const maxBed = typeof this.machine.max_bed_temp_c === "number" ? this.machine.max_bed_temp_c : bed;
      bed = Math.min(bed + 10, maxBed);
      fan = Math.min(fan, 15);
    }
    return {
      nozzle_temp: Number(nozzle),
      bed_temp: Number(bed),
      print_speed: Number(printSpeed),
      travel_speed: Number(travelSpeed),
      accel: Number(accel),
      jerk: Number(jerk),
      fan_speed: Number(fan),
      flow_rate: 100,
      retraction_distance: Number(retraction),
    };
  }

  private baselineResin(): Record<string, number> {
    const exposure = this.material.startsWith("RESIN") ? 2.3 : 2.0;
    return {
      exposure_time: exposure,
      lift_speed: 60,
    };
  }

  private baselineCnc(): Record<string, number> {
    const range = Array.isArray(this.machine.spindle_rpm_range)
      ? this.machine.spindle_rpm_range
      : [8000, 18000];
    const spindle = Number((range[0] + range[range.length - 1]) / 2);
    const maxFeed = typeof this.machine.max_feed_mm_min === "number" ? this.machine.max_feed_mm_min : 6000;
    let doc = 2;
    const rigidity = String(this.machine.rigidity_class ?? "hobby").toLowerCase();
    if (rigidity.includes("industrial")) doc = 4;
    else if (rigidity.includes("light")) doc = 3;
    const stepover = 40;
    return {
      spindle_rpm: spindle,
      feed_rate: maxFeed * 0.7,
      doc,
      stepover,
    };
  }

  private buildSuggestion(
    prediction: Prediction,
    adjustments: Array<{ param: string; target?: number; unit?: string; range_hint?: [number, number]; requires_clamp?: boolean }>,
    meta: { risk: string; why: string; beginner_note: string; advanced_note: string },
  ): Suggestion {
    const clampInputs: Record<string, number> = {};
    for (const change of adjustments) {
      if (change.requires_clamp && typeof change.target === "number") {
        clampInputs[change.param] = change.target;
      }
    }
    const applied = this.engine.clampToMachine(this.machine, clampInputs, this.experience);
    const clampedValues = applied.parameters;
    const clampedFlag = Boolean(applied.clamped_to_machine_limits);
    const explanations = applied.explanations ?? [];

    const changes: SuggestionChange[] = [];
    for (const change of adjustments) {
      const param = change.param;
      const requiresClamp = Boolean(change.requires_clamp);
      if (requiresClamp && !(param in clampedValues)) continue;
      const targetValue = requiresClamp ? clampedValues[param] : change.target;
      if (targetValue === undefined || targetValue === null) continue;
      const rangeHint = change.range_hint ?? null;
      let delta: number | null = null;
      const baseline = this.getBaseline()[param];
      if (typeof baseline === "number" && typeof targetValue === "number") {
        delta = Number((targetValue - baseline).toFixed(3));
      }
      changes.push({
        param,
        new_target: typeof targetValue === "number" ? Number(targetValue) : (targetValue as number),
        unit: change.unit ?? null,
        delta,
        range_hint: rangeHint,
      });
    }

    const explanationSuffix = explanations.length > 1 ? ` ${explanations.slice(1).join(" ")}` : "";
    return {
      issue_id: prediction.issue_id,
      changes,
      why: meta.why + explanationSuffix,
      risk: meta.risk,
      confidence: prediction.confidence,
      beginner_note: meta.beginner_note,
      advanced_note: meta.advanced_note,
      clamped_to_machine_limits: clampedFlag,
    };
  }
}

export function suggest(predictions: Prediction[], meta: AnalyzeRequestMeta): [Suggestion[], boolean] {
  const planner = new SuggestionPlanner(meta);
  return planner.plan(predictions);
}
