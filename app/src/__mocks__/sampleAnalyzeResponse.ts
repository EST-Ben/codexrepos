import { AnalyzeResponse } from "../types";

export const sampleAnalyzeResponse: AnalyzeResponse = {
  image_id: "sample-image-001",
  predictions: [
    { issue_id: "stringing", confidence: 0.82 },
    { issue_id: "under_extrusion", confidence: 0.47 },
  ],
  recommendations: [
    "Increase retraction distance by 0.5 mm to reduce stringing.",
    "Verify filament path for obstructions to address under-extrusion.",
  ],
  capability_notes: [
    "CoreXY motion allows higher travel speeds without backlash.",
    "Enclosed chamber supports elevated bed temperatures for ABS.",
  ],
  localization: {
    heatmap: {
      data_url:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAGgwJ/lh9i7gAAAABJRU5ErkJggg==",
    },
    boxes: [
      {
        issue_id: "stringing",
        x: 0.32,
        y: 0.18,
        width: 0.24,
        height: 0.27,
        confidence: 0.79,
      },
      {
        issue_id: "under_extrusion",
        x: 0.58,
        y: 0.52,
        width: 0.19,
        height: 0.21,
        confidence: 0.58,
      },
    ],
  },
  slicer_profile_diff: {
    diff: {
      nozzle_temp: 205,
      retraction_distance: 4.5,
      travel_speed: 160,
      enable_combing: true,
    },
    markdown: "- Set nozzle temperature to **205°C**\n- Increase retraction distance to **4.5 mm**\n- Raise travel speed to **160 mm/s**\n- Enable combing for cleaner travel moves",
  },
  explanations: [
    "Detected fine wisps indicative of stringing across infill gaps.",
    "Surface gaps along the perimeter suggest under-extrusion symptoms.",
  ],
  applied: {
    nozzle_temp: 205,
    retraction_distance: 4.5,
    travel_speed: 160,
    enable_combing: true,
  },
  meta: {
    machine_id: "bambu_x1c",
    material: "PLA",
    experience: "Intermediate",
  },
};

export default sampleAnalyzeResponse;
