import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

import type { MachineSummary, AnalysisHistoryRecord, AnalyzeResponse, ExperienceLevel } from '../types';
import PrinterTabs from '../screens/PrinterTabs'; // default export

// Spy we can assert against when uploads happen
const analyzeImageApi = jest.fn();

// ---- Mock API client (typed) ---------------------------------
import * as client from '../api/client';
jest.mock('../api/client'); // TS keeps module shape; methods become jest.Mock
const mockedClient = jest.mocked(client, { shallow: true });

// ---- Mock useAnalyze to route uploads to our spy --------------
jest.mock('../hooks/useAnalyze', () => ({
  useAnalyze: () => ({
    mutate: ({ file, meta }: any) => analyzeImageApi(file, meta),
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

// ---- Mock CameraButton to synchronously “pick” an image -------
jest.mock('../components/CameraButton', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    CameraButton: ({ disabled, onImageReady }: any) =>
      React.createElement(
        Pressable,
        {
          accessibilityRole: 'button',
          testID: 'camera-button',
          disabled,
          onPress: () =>
            onImageReady({
              // match RN-style file arg expected by the screen / api
              uri: 'file:///stringing.jpg',
              name: 'stringing.jpg',
              type: 'image/jpeg',
            }),
        },
        React.createElement(Text, null, 'Camera'),
      ),
  };
});

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
    // Align with SlicerProfileDiff: no `slicer` field here
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
    analyzeImageApi.mockReset();

    // exportProfile can return a legacy diff shape; minimal stub is fine
    mockedClient.exportProfile.mockResolvedValue({ diff: {} } as any);

    // Default analyzeImage to a minimal payload conforming to src/types.ts
    mockedClient.analyzeImage.mockResolvedValue(minimalAnalyzeResponse());
  });

  // IMPORTANT: Shape matches PrinterTabsProps.profile
  const profile = {
    machineId: 'bambu_p1s',
    brand: 'Bambu Lab',
    model: 'P1S',
    experience: 'Intermediate' as const,
    material: 'PLA',
  };

  // Create jest fns for props; onRecordHistory matches component signature
  const onUpdateMaterial = jest.fn<(machineId: string, material?: string) => void>();
  const onRecordHistory = jest.fn<(record: unknown) => void>();

  it('renders a camera button for the active machine', () => {
    render(
      <PrinterTabs
        profile={profile}
        onEditProfile={jest.fn()}
        onShowAnalysis={jest.fn()}
        onUpdateMaterial={onUpdateMaterial}
        onOpenHistory={jest.fn()}
        onRecordHistory={onRecordHistory}
        historyCounts={{}}
      />,
    );
    expect(screen.getByTestId('camera-button')).toBeTruthy();
  });

  it('submits uploads with machine meta and experience', async () => {
    mockedClient.analyzeImage.mockResolvedValue(
      minimalAnalyzeResponse({ image_id: 'test-image' })
    );

    render(
      <PrinterTabs
        profile={profile}
        onEditProfile={jest.fn()}
        onShowAnalysis={jest.fn()}
        onUpdateMaterial={onUpdateMaterial}
        onOpenHistory={jest.fn()}
        onRecordHistory={onRecordHistory}
        historyCounts={{}}
      />,
    );

    fireEvent.press(screen.getByTestId('camera-button'));

    await waitFor(() => expect(analyzeImageApi).toHaveBeenCalled());

    // Cast the tuple so meta/file have concrete types for assertions
    const [fileArg, meta] = analyzeImageApi.mock.calls[0] as [any, any];

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
