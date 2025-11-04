// src/__mocks__/sampleAnalyzeResponse.ts
import type { AnalyzeResponse, ExperienceLevel } from '../types';

export const makeSampleAnalyzeResponse = (
  experience: ExperienceLevel = 'Intermediate',
  overrides: Partial<AnalyzeResponse> = {},
): AnalyzeResponse => ({
  image_id: 'mock-image-id',
  version: 'test-mock-1',
  machine: { id: 'bambu_p1s', brand: 'Bambu Lab', model: 'P1S' },
  experience,
  material: 'PLA',
  predictions: [
    // Example: { issue_id: 'stringing', confidence: 0.87 },
  ],
  // IMPORTANT: explanations is string[]
  explanations: [
    'Detected artifacts consistent with stringing.',
    'Consider tuning retraction and temperature.',
  ],
  localization: { boxes: [], heatmap: null },
  capability_notes: [
    'Increase retraction distance for PLA.',
    'Dry filament to reduce stringing.',
  ],
  recommendations: [
    'Try a lower nozzle temperature (e.g., 205°C).',
    'Reduce travel speed slightly to improve quality.',
  ],
  suggestions: [
    {
      issue_id: 'stringing',
      why: 'Visible fine strings between towers.',
      risk: 'Low',
      confidence: 0.8,
      beginner_note: 'Lower temperature and increase retraction slightly.',
      advanced_note: 'Tune retraction extra prime amount and wipe.',
      clamped_to_machine_limits: false,
      changes: [
        {
          param: 'retraction_distance',
          delta: 0.5,
          unit: 'mm',
          range_hint: [0, 3],
        },
        {
          param: 'nozzle_temperature',
          delta: -5,
          unit: '°C',
          range_hint: [190, 230],
        },
      ],
    },
  ],
  // Matches your SlicerProfileDiff (no `slicer`)
  slicer_profile_diff: {
    parameters: {
      retraction_distance: { value: 1.5, unit: 'mm', range_hint: [0, 3] },
      nozzle_temperature: { value: 205, unit: '°C', range_hint: [190, 230] },
      travel_speed: { value: 180, unit: 'mm/s', range_hint: [80, 300], clamped: false },
    },
    // Legacy plain diff: values must be string | number | boolean
    diff: {
      retraction_distance: 1.5,
      nozzle_temperature: 205,
      travel_speed: 180,
    },
    markdown: [
      '**Suggested Profile Adjustments**',
      '- Increase retraction distance slightly',
      '- Lower nozzle temperature for PLA',
      '- Keep travel speed moderate',
    ].join('\n'),
  },
  applied: {
    parameters: {
      retraction_distance: 1.5,
      nozzle_temperature: 205,
      travel_speed: 180,
    },
    hidden_parameters: [],
    experience_level: experience,
    clamped_to_machine_limits: false,
    explanations: [],
  },
  low_confidence: false,
  ...overrides,
});

// Default export: a ready-to-use sample object
const sampleAnalyzeResponse = makeSampleAnalyzeResponse();
export default sampleAnalyzeResponse;
