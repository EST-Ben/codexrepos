// app/src/__tests__/printerTabs.test.tsx
import React from 'react';
// Local minimal test helpers to avoid bringing in @testing-library/react-native.
import { fireEvent, render, waitFor, screen } from '../test-utils/native-testing';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

import type {
  MachineSummary,
  AnalysisHistoryRecord,
  AnalyzeResponse,
  ExperienceLevel,
} from '../types';
import PrinterTabs from '../screens/PrinterTabs';
import { Platform } from 'react-native';

const originalPlatform = Platform.OS;

beforeEach(() => {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: 'ios',
  });
});

afterAll(() => {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: originalPlatform,
  });
});

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
 * - components/WebFilePicker
 *
 * Each mock renders a tappable control labeled "Pick / Capture photo"
 * that calls props.onImageReady({ uri, name, type }) on press.
 */
const makePickerMock = () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return function MockPicker(props: any) {
    return React.createElement(
      Pressable,
      {
        accessibilityRole: 'button',
        testID: 'mockPicker',
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

jest.mock(
  '../components/CameraButton',
  () => ({
    __esModule: true,
    default: makePickerMock(),
    CameraButton: makePickerMock(),
  }),
  { virtual: true }
);
jest.mock('../components/AnalyzeFromPhoto', () => makePickerMock(), { virtual: true });
jest.mock('../components/WebFilePicker', () => ({
  __esModule: true,
  default: ({ onPick, children }: any) =>
    children?.(() =>
      onPick?.({
        uri: 'file:///stringing.jpg',
        name: 'stringing.jpg',
        type: 'image/jpeg',
      })
    ),
}));

// ---- Mock useAnalyze to route uploads to our spy --------------
jest.mock('../hooks/useAnalyze', () => ({
  useAnalyze: () => ({
    analyzeImage: (file: any, meta: any) => {
      mockAnalyzeImageApi(file, meta);
      return Promise.resolve();
    },
    mutate: ({ file, meta }: any) => {
      mockAnalyzeImageApi(file, meta);
      return Promise.resolve();
    },
    status: 'idle',
    error: null,
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
    all: [summary],
    ids: [summary.id],
    byId: (id: string) => (id === summary.id ? summary : undefined),
    defaultId: summary.id,
    loading: false,
    error: null,
    refresh: jest.fn().mockResolvedValue(undefined),
  }),
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

  it('renders a photo picker control for the active machine', async () => {
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
    expect(getByText('Upload Photo')).toBeTruthy();
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

    fireEvent.press(getByText('Pick / Capture photo'));

    await waitFor(() => {
      expect(mockAnalyzeImageApi).toHaveBeenCalled();
    });

    // Extract args from whichever mock fired
    let fileArg: any, meta: any;
    if (mockAnalyzeImageApi.mock.calls.length) {
      [fileArg, meta] = mockAnalyzeImageApi.mock.calls[0] as [any, any];
    } else {
      // client.analyzeImage(file, meta, onProgress?)
      const call = mockedClient.analyzeImage.mock.calls[0] as any[];
      [fileArg, meta] = call;
    }

    expect(meta.machine_id).toBe('bambu_p1s');
    expect(meta.experience).toBe('Intermediate');
    expect(meta.material).toBeUndefined();
    expect(meta.app_version).toBe('printer-tabs');

    expect(fileArg).toEqual({
      uri: 'file:///stringing.jpg',
      name: 'stringing.jpg',
      type: 'image/jpeg',
    });
  });
});
