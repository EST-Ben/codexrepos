// jest.config.js
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'jsdom',
  transformIgnorePatterns: [
    // Allow these ESM modules from node_modules to be transformed by Babel
    'node_modules/(?!(?:' +
      'react-native' +
      '|@react-native' +
      '|react-native-web' +
      '|expo' +
      '|@expo' +
      '|expo-clipboard' +
      '|expo-image-picker' +
      '|expo-status-bar' +
      '|expo-modules-core' +
    ')/)'
  ],
  setupFilesAfterEnv: [
    '<rootDir>/app/jest.setup.ts'
  ],
  moduleNameMapper: {
    // Map assets to identity-obj-proxy or a stub if needed later
  },
};
