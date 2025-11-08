// src/__tests__/analysisResult.test.tsx
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock slider as a virtual module
jest.mock('@react-native-community/slider', () => {
  const React = require('react');
  return function SliderMock(props: any) {
    return React.createElement('div', { 'data-testid': props?.testID ?? 'slider' });
  };
}, { virtual: true });

// Mock expo-clipboard as a virtual module (avoid ESM import at test time)
jest.mock('expo-clipboard', () => {
  return {
    setStringAsync: jest.fn(async () => undefined),
    getStringAsync: jest.fn(async () => ''),
    hasStringAsync: jest.fn(async () => false),
  };
}, { virtual: true });

import React from 'react';
import { render } from '@testing-library/react-native';
import AnalysisResult from '../screens/AnalysisResult';
import type { AnalyzeResponse, ExperienceLevel, MachineSummary } from '../types';

const sampleSummary: MachineSummary = {
  id: 'bambu_p1s',
  brand: 'Bambu Lab',
  model: 'P1S',
};

function minimalAnalyzeResponse(
  overrides: Partial<AnalyzeResponse> = {},
  experience: ExperienceLevel = 'Intermediate',
): AnalyzeResponse {
  return {
    image_id: 'img-1',
    version: 'test',
    machine: { id: 'bambu_p1s', brand: 'Bambu Lab', model: 'P1S' },
    experience,
    material: 'PLA',
    predictions: [],
    explanations: [],
    localization: { boxes: [], heatmap: null },
    capability_notes: [],
    recommendations: [],
    suggestions: [],
    slicer_profile_diff: { parameters: {} },
    applied: {
      parameters: {},
      hidden_parameters: [],
      experience_level: experience,
      clamped_to_machine_limits: false,
      explanations: [],
    },
    low_confidence: false,
    ...overrides,
  };
}

describe('AnalysisResult screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with minimal payload', () => {
    render(
      <AnalysisResult
        machine={sampleSummary}
        response={minimalAnalyzeResponse()}
        experience="Intermediate"
        machineSummary={sampleSummary}
        onClose={jest.fn()}
        onRetake={jest.fn()}
        image={{ uri: 'file:///something.jpg', width: 100, height: 100 }}
      />,
    );
    expect(true).toBe(true);
  });
});
