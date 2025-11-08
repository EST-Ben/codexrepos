// Keep this file minimal to avoid resolver issues.
import '@testing-library/jest-native/extend-expect';

// TextEncoder/TextDecoder for some RN polyfills in Node test env.
import { TextEncoder, TextDecoder } from 'util';
// @ts-expect-error assign globals for tests
global.TextEncoder = TextEncoder as unknown as typeof global.TextEncoder;
// @ts-expect-error assign globals for tests
global.TextDecoder = TextDecoder as unknown as typeof global.TextDecoder;

// Optional: quiet reanimated in unit tests (if present)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mockReanimated = require('react-native-reanimated/mock');
  // @ts-expect-error mock shapes differ
  jest.mock('react-native-reanimated', () => mockReanimated);
} catch { /* noop */ }

// Stable Expo constants mock
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: { apiBaseUrl: 'http://127.0.0.1:8000' },
    },
  },
}));
