import crypto from "node:crypto";
import { Prediction } from "./predict.js";

export type BoundingBox = {
  issue_id: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type HeatmapPayload = {
  encoding: "svg";
  width: number;
  height: number;
  data_url: string;
};

export type LocalizationPayload = {
  boxes: BoundingBox[];
  heatmap?: HeatmapPayload | null;
};

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

export class LocalizationEngine {
  constructor(private heatmapSize = 256, private maxBoxes = 3) {}

  localize(imageKey: string, predictions: Prediction[]): LocalizationPayload {
    const boxes = this.buildBoxes(imageKey, predictions);
    const heatmap = this.buildHeatmap(imageKey, predictions);
    return { boxes, heatmap };
  }

  private buildBoxes(imageKey: string, predictions: Prediction[]): BoundingBox[] {
    const results: BoundingBox[] = [];
    for (let index = 0; index < Math.min(this.maxBoxes, predictions.length); index++) {
      const prediction = predictions[index];
      const digest = crypto
        .createHash("sha256")
        .update(`${imageKey}:${prediction.issue_id}:${index}`)
        .digest();
      const baseX = digest[0] / 255;
      const baseY = digest[1] / 255;
      const baseW = 0.25 + (digest[2] / 255) * 0.45;
      const baseH = 0.2 + (digest[3] / 255) * 0.5;
      const width = clamp(baseW);
      const height = clamp(baseH);
      const x = clamp(baseX * (1 - width));
      const y = clamp(baseY * (1 - height));
      results.push({
        issue_id: prediction.issue_id,
        confidence: prediction.confidence,
        x,
        y,
        width,
        height,
      });
    }
    return results;
  }

  private buildHeatmap(imageKey: string, predictions: Prediction[]): HeatmapPayload | null {
    if (!predictions.length) return null;
    const topIssue = predictions[0].issue_id;
    const digest = crypto.createHash("sha256").update(`heatmap:${imageKey}:${topIssue}`).digest("hex");
    const hue = parseInt(digest.slice(0, 2), 16);
    const intensity = 60 + (parseInt(digest.slice(2, 4), 16) % 120);
    const saturation = 65 + (parseInt(digest.slice(4, 6), 16) % 25);
    const svg = `
<svg xmlns='http://www.w3.org/2000/svg' width='${this.heatmapSize}' height='${this.heatmapSize}' viewBox='0 0 100 100'>
  <defs>
    <radialGradient id='heat' cx='50%' cy='50%' r='65%'>
      <stop offset='0%' stop-color='hsla(${hue}, ${saturation}%, ${intensity}%, 0.85)' />
      <stop offset='100%' stop-color='hsla(${hue}, ${saturation}%, ${intensity}%, 0)' />
    </radialGradient>
  </defs>
  <rect x='0' y='0' width='100' height='100' fill='url(#heat)' />
</svg>
`.trim();
    const dataUrl = "data:image/svg+xml;base64," + Buffer.from(svg, "utf-8").toString("base64");
    return { encoding: "svg", width: this.heatmapSize, height: this.heatmapSize, data_url: dataUrl };
  }
}
