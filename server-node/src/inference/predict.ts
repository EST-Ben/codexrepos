import crypto from "node:crypto";
import fs from "node:fs";
import { settings } from "../settings.js";

export type Prediction = { issue_id: string; confidence: number };

let taxonomyCache: Record<string, any> | null = null;

function loadTaxonomy(): Record<string, any> {
  if (taxonomyCache) return taxonomyCache;
  const target = settings.data.taxonomy;
  if (!fs.existsSync(target)) {
    taxonomyCache = { issues: {} };
    return taxonomyCache;
  }
  try {
    taxonomyCache = JSON.parse(fs.readFileSync(target, "utf-8"));
  } catch (err) {
    taxonomyCache = { issues: {} };
  }
  return taxonomyCache!;
}

export class InferenceEngine {
  private issueIds: string[];
  private taxonomy: Record<string, any>;

  constructor() {
    this.taxonomy = loadTaxonomy();
    const issues = (this.taxonomy.issues ?? {}) as Record<string, any>;
    this.issueIds = Object.keys(issues);
    if (!this.issueIds.length) {
      this.issueIds = ["general_tuning"];
    }
  }

  predict(imageKey: string): { predictions: Prediction[]; explanations: Array<Record<string, any>> } {
    const predictions = this.predictStub(imageKey);
    const explanations = this.buildExplanations(predictions);
    return { predictions, explanations };
  }

  private predictStub(imageKey: string): Prediction[] {
    const hash = crypto.createHash("sha256").update(imageKey).digest("hex");
    const seed = parseInt(hash.slice(0, 8), 16);
    const ordering = [...this.issueIds];
    if (ordering.length) {
      const index = seed % ordering.length;
      const rotated = ordering.slice(index).concat(ordering.slice(0, index));
      const scores = this.confidenceSequence(seed, rotated.length);
      return rotated.slice(0, 3).map((issue, idx) => ({ issue_id: issue, confidence: scores[idx] }));
    }
    return [{ issue_id: "general_tuning", confidence: 0.45 }];
  }

  private confidenceSequence(seed: number, count: number): number[] {
    const base = (seed % 30) / 100;
    const scores: number[] = [];
    for (let idx = 0; idx < count; idx++) {
      let confidence = 0.75 - idx * 0.18 + base;
      confidence = Math.max(0.1, Math.min(0.95, confidence));
      scores.push(Number(confidence.toFixed(3)));
    }
    return scores;
  }

  private buildExplanations(predictions: Prediction[]): Array<Record<string, any>> {
    const issues = (this.taxonomy.issues ?? {}) as Record<string, any>;
    return predictions.map((prediction) => ({
      issue_id: prediction.issue_id,
      cues: issues?.[prediction.issue_id]?.cues ?? [],
    }));
  }
}
