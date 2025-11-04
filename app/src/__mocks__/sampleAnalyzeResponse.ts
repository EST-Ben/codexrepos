// Test helper: returns a minimal AnalyzeResponse compatible with src/types.ts

import type { AnalyzeResponse, ExperienceLevel } from '../types';

export function sampleAnalyzeResponse(
  overrides: Partial<AnalyzeResponse> = {},
  experience: ExperienceLevel = 'Intermediate'
): AnalyzeResponse {
  return {
    image_id: 'sample-image',
    version: 'test',
    machine: { id: 'bambu_p1s', brand: 'Bambu Lab', model: 'P1S' },
    experience,
    material: 'PLA',
    predictions: [],
    // Explanations are strings in our app model
    explanations: [],
    localization: { boxes: [], heatmap: null },
    capability_notes: [],
    // Recommendations are strings in our app model
    recommendations: [],
    suggestions: [],
    // New SlicerProfileDiff shape: parameters OR diff, both optional
    slicer_profile_diff: { parameters: {} },
    applied: {
      parameters: {},
      hidden_parameters: [],
      experience_level: experience,
      clamped_to_machine_limits: false,
      explanations: []
    },
    low_confidence: false,
    ...overrides
  };
}
