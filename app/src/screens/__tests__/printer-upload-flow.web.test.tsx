import React from 'react';
import { render, fireEvent, waitFor, within } from '@testing-library/react-native';
import * as rn from 'react-native';
import PrinterTabs from '../PrinterTabs';

jest.mock('expo-constants', () => ({
  expoConfig: { extra: { apiBaseUrl: 'http://localhost:8000' } },
}));

const mockPick = jest.fn();

jest.mock('../../components/WebFilePicker', () => {
  const React = require('react');
  return ({ onPick, children }: any) => {
    const open = () => {
      mockPick();
      onPick({
        uri: 'blob://sample',
        name: 'sample.jpg',
        type: 'image/jpeg',
      });
    };
    return <>{children(open)}</>;
  };
});

describe('PrinterTabs web upload flow', () => {
  let originalPlatformOs: string;

  beforeEach(() => {
    mockPick.mockClear();
    originalPlatformOs = rn.Platform.OS;
    Object.defineProperty(rn.Platform, 'OS', {
      configurable: true,
      value: 'web',
    });
    (global as any).fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/machines')) {
        return {
          ok: true,
          json: async () => ({
            machines: [
              {
                id: 'bambu_p1s',
                brand: 'Bambu Lab',
                model: 'P1S',
                type: 'FFF',
              },
            ],
          }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({}),
      } as Response;
    });
  });

  afterEach(() => {
    Object.defineProperty(rn.Platform, 'OS', {
      configurable: true,
      value: originalPlatformOs,
    });
    jest.restoreAllMocks();
    delete (global as any).fetch;
  });

  it('switches CTA from Upload Photo to Analyze after picking a file', async () => {
    const { findByTestId } = render(<PrinterTabs />);

    const cta = await findByTestId('uploadAnalyzeCta');
    expect(within(cta).getByText(/upload photo/i)).toBeTruthy();

    await waitFor(() => {
      fireEvent.press(cta);
      expect(mockPick).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(within(cta).getByText(/analyze/i)).toBeTruthy();
    });
  });
});
