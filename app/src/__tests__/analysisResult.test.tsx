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
  predictions: [
    { issue_id: 'stringing', confidence: 0.82 },
    { issue_id: 'under_extrusion', confidence: 0.34 },
  ],
  recommendations: ['Reduce print speed by 10%'],
  capability_notes: ['Supports input shaping'],
  localization: {
    heatmap: { data_url: 'data:image/png;base64,AAAA' },
    boxes: [
      { issue_id: 'stringing', x: 0.1, y: 0.1, width: 0.5, height: 0.4, confidence: 0.7 },
    ],
  },
  applied: { print_speed: 180, nozzle_temp: 210 },
  slicer_profile_diff: {
    diff: { print_speed: 180 },
    markdown: '# print_speed: 180',
  },
  meta: { machine_id: 'bambu_p1p' },
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
