// Keep this file minimal to avoid resolver issues.
import '@testing-library/jest-native/extend-expect';

// TextEncoder/TextDecoder for some RN polyfills in Node test env.
import { TextEncoder, TextDecoder } from 'util';
// @ts-expect-error assign globals for tests
global.TextEncoder = TextEncoder as unknown as typeof global.TextEncoder;
// @ts-expect-error assign globals for tests
global.TextDecoder = TextDecoder as unknown as typeof global.TextDecoder;

// JSI / reanimated is noisy in unit tests — if present, use their recommended mock.
// If the module doesn't exist, this import will be tree-shaken by ts-jest.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const reanimatedMock = require('react-native-reanimated/mock');
  // @ts-expect-error mock shapes differ
  jest.mock('react-native-reanimated', () => reanimatedMock);
} catch { /* noop */ }

// Provide a stable Expo extra config for code that reads Constants.expoConfig.extra
// so getString/get constants don't explode in test env.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: { apiBaseUrl: 'http://127.0.0.1:8000' },
    },
  },
}));
