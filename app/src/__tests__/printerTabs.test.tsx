import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { MachineSummary } from '../types';
import { PrinterTabs } from '../screens/PrinterTabs';

const analyzeImageApi = jest.fn();

jest.mock('../api/client', () => ({
  analyzeImage: jest.fn(),
  exportProfile: jest.fn().mockResolvedValue({ slicer: 'cura', diff: {} }),
}));

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
              blob: new Blob(),
              uri: 'file:///stringing.jpg',
              name: 'stringing.jpg',
              type: 'image/jpeg',
              width: 1024,
              height: 768,
            }),
        },
        React.createElement(Text, null, 'Camera'),
      ),
  };
});

describe('PrinterTabs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    analyzeImageApi.mockReset();
    (jest.requireMock('../api/client').analyzeImage as jest.Mock).mockImplementation(analyzeImageApi);
  });

  const profile = {
    experience: 'Intermediate' as const,
    machines: [{ id: 'bambu_p1s', brand: 'Bambu Lab', model: 'P1S' }],
    material: 'PLA',
    materialByMachine: { bambu_p1s: 'PLA' },
  };

  it('renders a camera button for the active machine', () => {
    render(
      <PrinterTabs
        profile={profile}
        onEditProfile={jest.fn()}
        onShowAnalysis={jest.fn()}
        onUpdateMaterial={jest.fn()}
        onOpenHistory={jest.fn()}
        onRecordHistory={jest.fn()}
        historyCounts={{}}
      />,
    );
    expect(screen.getByTestId('camera-button')).toBeTruthy();
  });

  it('submits uploads with machine meta and experience', async () => {
    analyzeImageApi.mockResolvedValue({
      image_id: 'test-image',
      predictions: [],
      recommendations: [],
      capability_notes: [],
    });

    render(
      <PrinterTabs
        profile={profile}
        onEditProfile={jest.fn()}
        onShowAnalysis={jest.fn()}
        onUpdateMaterial={jest.fn()}
        onOpenHistory={jest.fn()}
        onRecordHistory={jest.fn()}
        historyCounts={{}}
      />,
    );

    fireEvent.press(screen.getByTestId('camera-button'));

    await waitFor(() => expect(analyzeImageApi).toHaveBeenCalled());
    const [fileArg, meta] = analyzeImageApi.mock.calls[0];
    expect(meta.machine_id).toBe('bambu_p1s');
    expect(meta.experience).toBe('Intermediate');
    expect(meta.material).toBe('PLA');
    expect(meta.app_version).toBe('printer-page');
    expect(fileArg).toEqual({ uri: 'file:///stringing.jpg', name: 'stringing.jpg', type: 'image/jpeg' });
  });
});
