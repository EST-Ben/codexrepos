/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|expo|@expo|expo-.*|@expo-.*|@react-native-community/slider)/)',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};
