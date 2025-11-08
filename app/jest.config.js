/** Minimal, RN-friendly config that loads our setup */
module.exports = {
  preset: 'react-native',
  testMatch: ['**/?(*.)+(test).[tj]sx?'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(@react-native|react-native|react-native-gesture-handler|react-native-reanimated|@react-navigation)/)'
  ]
};
