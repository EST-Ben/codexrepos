/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest'
  },
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
  setupFilesAfterEnv: [],
  // Don’t force testEnvironment; let jest-expo choose the right one
};
