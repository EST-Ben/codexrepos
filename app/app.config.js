/* eslint-env node */
'use strict';
require('dotenv').config();

const API =
  process.env.EXPO_PUBLIC_API_BASE ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'http://localhost:8000';

module.exports = {
  expo: {
    name: 'codex-app',
    slug: 'codex-app',
    version: '1.0.0',
    orientation: 'portrait',
    platforms: ['ios', 'android', 'web'],
    experiments: { typedRoutes: false },
    extra: { apiBaseUrl: API },
  },
};
