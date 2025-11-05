import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

import type { MachineSummary, AnalysisHistoryRecord, AnalyzeResponse, ExperienceLevel } from '../types';
import PrinterTabs from '../screens/PrinterTabs';

// Use a "mock*" prefix so Jest allows referencing it inside jest.mock factories
const mockAnalyzeImageApi = jest.fn();

// ---- Mock API client (typed) ---------------------------------
import * as client from '../api/client';
jest.mock('../api/client');
const mockedClient = jest.mocked(client, { shallow: true });

/**
 * Unify all potential picker components to a deterministic mock:
 * - components/CameraButton
 * - components/AnalyzeFromPhoto
 * - components/WebPhotoPicker
 *
 * Each mock renders a <Pressable testID="camera-button" /> that immediately
 * calls props.onImageReady({ uri, name, type }) on press.
 */
const makePickerMock = () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return function MockPicker(props: any) {
    return React.createElement(
      Pressable,
      {
        accessibilityRole: 'button',
        testID: 'camera-button',
        onPress: () =>
          props?.onImageReady?.({
            uri: 'file:///stringing.jpg',
            name: 'stringing.jpg',
            type: 'image/jpeg',
          }),
      },
      React.createElement(Text, null, 'Pick / Capture photo'),
    );
  };
};

jest.mock('../components/CameraButton', () => ({ CameraButton: makePickerMock() }), { virtual: true });
jest.mock('../components/AnalyzeFromPhoto', () => makePickerMock(), { virtual: true });
jest.mock('../components/WebPhotoPicker', () => makePickerMock(), { virtual: true });

// ---- Mock useAnalyze to route uploads to our spy --------------
jest.mock('../hooks/useAnalyze', () => ({
  useAnalyze: () => ({
    mutate: ({ file, meta }: any) => mockAnalyzeImageApi(file, meta),
    isPending: false,
    isSuccess: false,
    data: null,
    reset: jest.fn(),
    progress: 0,
    queuedCount: 0,
    retryQueued: jest.fn(),
  }),
}));

// ---- Minimal machine registry / privacy state -----------------
const summary: MachineSummary = {
  id: 'bambu_p1s',
  brand: 'Bambu Lab',
  model: 'P1S',
  max_nozzle_temp_c: 300,
  safe_speed_ranges: { print: [40, 300] },
};

jest.mock('../hooks/useMachineRegistry', () => ({
  useMachineRegistry: () => ({
    machines: [summary],
    loading: false,
    error: null,
    refresh: jest.fn(),
  }),
  filterMachines: (machines: MachineSummary[]) => machines,
}));

jest.mock('../state/privacy', () => ({
  usePrivacySettings: () => ({
    settings: { storeImagesLocallyOnly: false, telemetryEnabled: false },
    loading: false,
    update: jest.fn(),
  }),
}));

// ---- Helpers ---------------------------------------------------
function minimalAnalyzeResponse(
  overrides: Partial<AnalyzeResponse> = {},
  experience: ExperienceLevel = 'Intermediate'
): AnalyzeResponse {
  return {
    image_id: 'default-image',
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

// ----------------------------------------------------------------

describe('PrinterTabs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAnalyzeImageApi.mockReset();

    // exportProfile returns a minimal shape
    mockedClient.exportProfile.mockResolvedValue({ diff: {} } as any);

    // analyzeImage returns a minimal payload
    mockedClient.analyzeImage.mockResolvedValue(minimalAnalyzeResponse());
  });

  const profile = {
    experience: 'Intermediate' as const,
    machines: [{ id: 'bambu_p1s', brand: 'Bambu Lab', model: 'P1S' }],
    material: 'PLA',
    materialByMachine: { bambu_p1s: 'PLA' },
  };

  const onUpdateMaterial = jest.fn<(machineId: string, material?: string) => void>();
  const onRecordHistory = jest.fn<(entry: AnalysisHistoryRecord) => void>();

  it('renders a camera button for the active machine', () => {
    render(
      <PrinterTabs
        profile={profile as any}
        onEditProfile={jest.fn()}
        onShowAnalysis={jest.fn()}
        onUpdateMaterial={onUpdateMaterial}
        onOpenHistory={jest.fn()}
        onRecordHistory={onRecordHistory as any}
        historyCounts={{}}
      />,
    );
    // Guaranteed by our mocks, regardless of which picker PrinterTabs uses
    expect(screen.getByTestId('camera-button')).toBeTruthy();
    expect(screen.getByText('Pick / Capture photo')).toBeTruthy();
  });

  it('submits uploads with machine meta and experience', async () => {
    mockedClient.analyzeImage.mockResolvedValue(minimalAnalyzeResponse({ image_id: 'test-image' }));

    render(
      <PrinterTabs
        profile={profile as any}
        onEditProfile={jest.fn()}
        onShowAnalysis={jest.fn()}
        onUpdateMaterial={onUpdateMaterial}
        onOpenHistory={jest.fn()}
        onRecordHistory={onRecordHistory as any}
        historyCounts={{}}
      />,
    );

    // 1) Simulate picking a file (enables "Analyze photo")
    fireEvent.press(screen.getByTestId('camera-button'));

    // 2) Press the real "Analyze photo" button that PrinterTabs renders
    fireEvent.press(screen.getByText('Analyze photo'));

    await waitFor(() => expect(mockAnalyzeImageApi).toHaveBeenCalled());

    const [fileArg, meta] = mockAnalyzeImageApi.mock.calls[0] as [any, any];

    expect(meta.machine_id).toBe('bambu_p1s');
    expect(meta.experience).toBe('Intermediate');
    expect(meta.material).toBe('PLA');
    expect(meta.app_version).toBe('printer-page');

    expect(fileArg).toEqual({
      uri: 'file:///stringing.jpg',
      name: 'stringing.jpg',
      type: 'image/jpeg',
    });
  });
});
