import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { AnalysisResult } from '../screens/AnalysisResult';
import type { AnalyzeResponse } from '../types';

jest.mock('@react-native-community/slider', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return ({ minimumValue, maximumValue }: any) =>
    React.createElement(Text, { testID: 'heatmap-slider' }, `${minimumValue}:${maximumValue}`);
});

jest.mock('../api/client', () => ({
  exportProfile: jest.fn(async () => ({ slicer: 'cura', diff: {}, markdown: '# Diff' })),
}));

const response: AnalyzeResponse = {
  image_id: 'img-123',
  machine: { id: 'bambu_p1p', brand: 'Bambu Lab', model: 'P1P' },
  issue_list: [
    { id: 'stringing', confidence: 0.82 },
    { id: 'under_extrusion', confidence: 0.34 },
  ],
  top_issue: 'stringing',
  boxes: [
    { issue_id: 'stringing', x: 0.1, y: 0.1, w: 0.5, h: 0.4, score: 0.7 },
  ],
  heatmap: 'data:image/png;base64,AAAA',
  parameter_targets: { print_speed: 200, nozzle_temp: 215 },
  applied: { print_speed: 180, nozzle_temp: 210 },
  recommendations: ['Reduce print speed by 10%'],
  capability_notes: ['Supports input shaping'],
  clamp_explanations: ['Reduced print_speed to stay within safe limits.'],
  hidden_parameters: ['travel_speed'],
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

    expect(screen.getByText(/stringing/i)).toBeTruthy();
    expect(screen.getByText(/print_speed/i)).toBeTruthy();
    expect(screen.getByTestId('heatmap-slider').props.children).toBe('0:1');
  });
});
