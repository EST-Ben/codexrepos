/* eslint-env node */
'use strict';
require('dotenv').config();

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_BASE ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'http://localhost:8000';

module.exports = ({ config = {} }) => {
  const expoConfig = config.expo || {};

  return {
    expo: {
      name: 'codex-app',
      slug: 'codex-app',
      version: '1.0.0',
      orientation: 'portrait',
      platforms: ['ios', 'android', 'web'],
      experiments: expoConfig.experiments || { typedRoutes: false },
      extra: {
        ...(expoConfig.extra || {}),
        apiBaseUrl: API_BASE,
      },
    },
  };
};
