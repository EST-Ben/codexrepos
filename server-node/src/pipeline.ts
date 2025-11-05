import crypto from "node:crypto";
import type { AnalyzeRequestMeta, AnalyzeResponse, Suggestion } from "types/api";
import { InferenceEngine } from "./inference/predict";
import { LocalizationEngine } from "./inference/localize";
import { SuggestionPlanner } from "./rules/suggest";
import { RulesEngine } from "./rules/clamp";
import { resolveMachine } from "./machines/registry";

const RESPONSE_VERSION = "2024.01";

const inference = new InferenceEngine();
const localization = new LocalizationEngine();

export function analyzeImage(meta: AnalyzeRequestMeta, imageBuffer: Buffer, filename: string): AnalyzeResponse {
  const machine = resolveMachine(meta.machine_id);
  const imageKey = buildImageKey(filename, imageBuffer);
  const { predictions, explanations } = inference.predict(imageKey);

  const planner = new SuggestionPlanner(meta);
  const [suggestions, lowConfidence] = planner.plan(predictions);
  const baseline = planner.baseline();
  const parameterTargets = buildParameterTargets(baseline, suggestions);
  const rulesEngine = new RulesEngine();
  const applied = rulesEngine.clampToMachine(machine, parameterTargets, meta.experience);

  const localizationPayload = localization.localize(imageKey, predictions);
  const capabilityNotes = buildCapabilityNotes(machine);
  const recommendations = suggestions.map((item) => item.why).slice(0, 5);
  const explanationStrings = combineExplanations(applied.explanations, explanations);

  return {
    image_id: imageKey.slice(0, 16),
    version: RESPONSE_VERSION,
    machine: {
      id: machine.id,
      brand: machine.brand,
      model: machine.model,
    },
    experience: meta.experience,
    material: meta.material,
    predictions,
    explanations: explanationStrings,
    localization: localizationPayload,
    capability_notes: capabilityNotes,
    recommendations,
    suggestions,
    slicer_profile_diff: undefined,
    applied,
    low_confidence: lowConfidence,
    parameter_targets: parameterTargets,
    issues: predictions.map((p) => ({ id: p.issue_id, confidence: p.confidence })),
    issue_list: predictions.map((p) => ({ id: p.issue_id, confidence: p.confidence })),
    clamp_explanations: applied.explanations,
  } as AnalyzeResponse;
}

export function analyzeJson(
  meta: AnalyzeRequestMeta,
  payload: { issues?: string[]; data?: Record<string, any> },
): AnalyzeResponse {
  const buffer = Buffer.from(JSON.stringify(payload));
  return analyzeImage(meta, buffer, `json-${meta.machine_id}-${Date.now()}.json`);
}

function buildImageKey(filename: string, buffer: Buffer): string {
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  return `${filename}:${hash}`;
}

function buildParameterTargets(
  baseline: Record<string, number>,
  suggestions: Suggestion[],
): Record<string, number> {
  const targets = { ...baseline };
  for (const suggestion of suggestions) {
    for (const change of suggestion.changes) {
      if (typeof change.new_target === "number") {
        targets[change.param] = change.new_target;
      }
    }
  }
  return targets;
}

function combineExplanations(
  clamp: string[] | undefined,
  extra: Array<Record<string, any>>,
): string[] {
  const result = [] as string[];
  if (Array.isArray(clamp)) {
    for (const item of clamp) {
      if (typeof item === "string") result.push(item);
    }
  }
  for (const entry of extra ?? []) {
    const cues = entry?.cues;
    if (Array.isArray(cues) && cues.length) {
      result.push(`${entry.issue_id}: ${cues.join(", ")}`);
    }
  }
  return result;
}

function buildCapabilityNotes(machine: Record<string, any>): string[] {
  const notes: string[] = [];
  if (machine.supports?.ams) {
    notes.push("Multi-material support detected (AMS/AMS-lite). Consider drying all spools.");
  }
  if (machine.enclosed) {
    notes.push("Enclosed build volume helps maintain chamber temperatures.");
  }
  if (machine.motion_system) {
    notes.push(`Motion system: ${machine.motion_system}. Adjust acceleration targets accordingly.`);
  }
  return notes;
}
