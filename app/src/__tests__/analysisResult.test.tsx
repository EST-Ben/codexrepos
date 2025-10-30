import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { AnalysisResult } from '../screens/AnalysisResult';
import type { AnalyzeResponse } from '../types';

jest.mock('@react-native-community/slider', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return ({ minimumValue, maximumValue }: any) => (
    <Text testID="adjustment-slider">{`${minimumValue}:${maximumValue}`}</Text>
  );
});

jest.mock('../api/client', () => ({
  exportProfile: jest.fn(async () => ({ slicer: 'cura', diff: {}, source_keys: [] })),
}));

const response: AnalyzeResponse = {
  predictions: [
    { issue_id: 'stringing', confidence: 0.8 },
  ],
  explanations: [],
  suggestions: [
    {
      issue_id: 'stringing',
      changes: [
        {
          param: 'print_speed',
          new_target: 260,
          unit: 'mm/s',
          delta: -20,
        },
      ],
      why: 'Reduce ringing by slowing down moves.',
      risk: 'medium',
      confidence: 0.8,
      clamped_to_machine_limits: false,
    },
  ],
  slicer_profile_diff: {},
  image_id: 'img-123',
  version: 'mvp-0.2',
};

const summary = {
  id: 'bambu_p1p',
  brand: 'Bambu Lab',
  model: 'P1P',
  safe_speed_ranges: { print: [40, 300] },
  max_nozzle_temp_c: 300,
};

describe('AnalysisResult', () => {
  it('constrains sliders within machine ranges', () => {
    render(
      <AnalysisResult
        machine={{ id: 'bambu_p1p', brand: 'Bambu Lab', model: 'P1P' }}
        response={response}
        experience="Intermediate"
        machineSummary={summary as any}
        onClose={jest.fn()}
        onRetake={jest.fn()}
      />,
    );

    const slider = screen.getByTestId('adjustment-slider');
    expect(slider).toHaveTextContent('40:300');
  });
});
