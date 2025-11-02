import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { AnalysisResult } from '../screens/AnalysisResult';
import type { AnalyzeResponse } from '../types';

jest.mock('@react-native-community/slider', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return ({ minimumValue, maximumValue }: any) =>
    React.createElement(Text, { testID: 'adjustment-slider' }, `${minimumValue}:${maximumValue}`);
});

jest.mock('../api/client', () => ({
  exportProfile: jest.fn(async () => ({ slicer: 'cura', diff: {}, markdown: '# Diff' })),
}));

const response: AnalyzeResponse = {
  image_id: 'img-123',
  version: 'mvp-0.2',
  machine: { id: 'bambu_p1p', brand: 'Bambu Lab', model: 'P1P' },
  experience: 'Intermediate',
  material: 'PLA',
  predictions: [{ issue_id: 'stringing', confidence: 0.8 }],
  explanations: [],
  localization: { boxes: [{ issue_id: 'stringing', confidence: 0.8, x: 0.1, y: 0.1, width: 0.4, height: 0.3 }], heatmap: null },
  capability_notes: ['Supports input shaping'],
  recommendations: ['Reduce speed by 20%'],
  suggestions: [
    {
      issue_id: 'stringing',
      changes: [
        {
          param: 'print_speed',
          new_target: 260,
          unit: 'mm/s',
          delta: -20,
          range_hint: [40, 300],
        },
      ],
      why: 'Reduce ringing by slowing down moves.',
      risk: 'medium',
      confidence: 0.8,
      clamped_to_machine_limits: false,
      beginner_note: 'Tighten belts first.',
      advanced_note: 'Consider input shaping.',
    },
  ],
  slicer_profile_diff: {
    slicer: 'generic',
    parameters: {
      print_speed: { value: 260, unit: 'mm/s' },
    },
    markdown: '# Diff',
  },
  applied: {
    parameters: { print_speed: 260 },
    hidden_parameters: [],
    experience_level: 'Intermediate',
    clamped_to_machine_limits: false,
    explanations: [],
  },
  low_confidence: false,
};

const summary = {
  id: 'bambu_p1p',
  brand: 'Bambu Lab',
  model: 'P1P',
  safe_speed_ranges: { print: [40, 300] },
};

describe('AnalysisResult', () => {
  it('renders issues, parameters, and heatmap slider', () => {
    render(
      <AnalysisResult
        machine={{ id: 'bambu_p1p', brand: 'Bambu Lab', model: 'P1P' }}
        response={response}
        experience="Intermediate"
        machineSummary={summary as any}
        onClose={jest.fn()}
        onRetake={jest.fn()}
        image={{ uri: 'http://example.com/photo.jpg', width: 640, height: 480 }}
      />,
    );

    const sliders = screen.getAllByTestId('adjustment-slider');
    expect(sliders.some((node) => node.props.children === '40:300')).toBe(true);
  });
});
