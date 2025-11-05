// jest.setup.ts

// In ESM / isolatedModules, import Jest globals explicitly
import { jest } from '@jest/globals';

try {
  // Optional in this repo: extend Jest matchers when the package is installed.
  require('@testing-library/jest-native/extend-expect');
} catch {
  // No-op if @testing-library/jest-native is not available.
}

try {
  require('react-native-gesture-handler/jestSetup');
} catch {
  // Tests that do not rely on gesture handler can proceed without the setup script.
}

// Lightweight React Native Reanimated mock (we avoid pulling the full package in tests).
jest.mock(
  'react-native-reanimated',
  () => ({
    __esModule: true,
    default: {},
    Easing: { linear: jest.fn((value) => value) },
    useSharedValue: jest.fn((value) => ({ value })),
    useAnimatedStyle: jest.fn(() => ({})),
    withTiming: jest.fn((value) => value),
    withSpring: jest.fn((value) => value),
    withDecay: jest.fn((value) => value),
    runOnJS: jest.fn((fn) => fn),
  }),
  { virtual: true },
);

// Silence reanimated's "useNativeDriver" warnings in tests
(globalThis as any).ReanimatedDataMock = { now: () => 0 };

// Mock: expo-constants (so code depending on app version/env won't break in tests)
jest.mock(
  'expo-constants',
  () => ({
    expoConfig: { version: 'test', extra: {} },
  }),
  { virtual: true },
);

// Mock: expo-image-manipulator (typed safely without generics causing TS2345)
jest.mock(
  'expo-image-manipulator',
  () => ({
    manipulateAsync: jest.fn(() =>
      Promise.resolve({
        uri: 'file://mock.jpg',
        base64: undefined,
        width: 100,
        height: 100,
      }),
    ),
  }),
  { virtual: true },
);

// Optional: guard fetch if your tests call network by accident
if (typeof (globalThis as any).fetch === 'undefined') {
  (globalThis as any).fetch = jest.fn() as any;
}

// Make this file a module for TS
export {};
