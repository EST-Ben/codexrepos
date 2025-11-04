// jest.setup.ts

// In ESM / isolatedModules, import Jest globals explicitly
import { jest } from '@jest/globals';

import '@testing-library/jest-native/extend-expect';
import 'react-native-gesture-handler/jestSetup';

// React Native Reanimated mock (official suggestion)
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// Silence reanimated's "useNativeDriver" warnings in tests
(globalThis as any).ReanimatedDataMock = { now: () => 0 };

// Mock: expo-constants (so code depending on app version/env won't break in tests)
jest.mock('expo-constants', () => ({
  expoConfig: { version: 'test', extra: {} },
}));

// Mock: expo-image-manipulator (typed safely without generics causing TS2345)
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(() =>
    Promise.resolve({
      uri: 'file://mock.jpg',
      base64: undefined,
      width: 100,
      height: 100,
    })
  ),
}));

// Optional: guard fetch if your tests call network by accident
if (typeof (globalThis as any).fetch === 'undefined') {
  (globalThis as any).fetch = jest.fn() as any;
}

// Make this file a module for TS
export {};
