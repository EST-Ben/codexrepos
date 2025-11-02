import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { MachineSummary } from '../types';
import { PrinterTabs } from '../screens/PrinterTabs';

const mutate = jest.fn();
const retryQueued = jest.fn();

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
    lookup: new Map([[summary.id, summary]]),
    loading: false,
    error: null,
    refresh: jest.fn(),
  }),
  filterMachines: (machines: MachineSummary[]) => machines,
}));

jest.mock('../hooks/useAnalyze', () => ({
  useAnalyze: () => ({
    mutate,
    isPending: false,
    isSuccess: false,
    data: null,
    reset: jest.fn(),
    progress: 0,
    queuedCount: 0,
    retryQueued,
  }),
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
              size: 1024,
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
    mutate.mockClear();
    retryQueued.mockClear();
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

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    const payload = mutate.mock.calls[0][0];
    expect(payload.meta.machine_id).toBe('bambu_p1s');
    expect(payload.meta.experience).toBe('Intermediate');
  });
});
