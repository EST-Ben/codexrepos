#!/usr/bin/env node
// RESUME_MARKER: CHK_7
/* eslint-disable @typescript-eslint/no-explicit-any */

import path from 'node:path';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const ROOT = path.resolve(__dirname, '..', '..');
const DIST_DIR = path.join(ROOT, 'dist', 'web');

function commandExists(command: string): boolean {
  const result = spawnSync(command, ['--version'], { stdio: 'ignore' });
  return result.status === 0;
}

function runCommand(command: string, args: string[], cwd: string): number {
  const child = spawnSync(command, args, { stdio: 'inherit', cwd });
  return child.status ?? 1;
}

function main(): void {
  const imageName = process.env.IMAGE_NAME ?? 'diagnostics-api';
  const imageTag = process.env.IMAGE_TAG ?? 'latest';
  const registry = process.env.REGISTRY ?? 'ghcr.io';
  const skipDocker = process.env.SKIP_DOCKER === '1';
  const pushImage = process.env.PUSH_IMAGE === '1';
  const exportWeb = process.env.EXPORT_WEB === '1';

  const fullImage = `${registry}/${imageName}:${imageTag}`;

  if (!skipDocker) {
    if (!commandExists('docker')) {
      console.warn('▲ Docker not found on PATH; skipping image build.');
    } else {
      console.log(`\nBuilding Docker image ${fullImage}`);
      const buildStatus = runCommand('docker', ['build', '-t', fullImage, '.'], ROOT);
      if (buildStatus !== 0) {
        console.error('✖ Docker build failed.');
        process.exitCode = buildStatus;
        return;
      }
      if (pushImage) {
        console.log(`Pushing ${fullImage}`);
        const pushStatus = runCommand('docker', ['push', fullImage], ROOT);
        if (pushStatus !== 0) {
          console.error('✖ Docker push failed.');
          process.exitCode = pushStatus;
          return;
        }
      }
    }
  } else {
    console.log('Skipping Docker build because SKIP_DOCKER=1.');
  }

  if (exportWeb) {
    if (!commandExists('npx')) {
      console.warn('▲ npx not found; cannot export Expo web bundle.');
    } else {
      console.log('\nExporting Expo web bundle');
      const status = runCommand('npx', ['expo', 'export', '--platform', 'web', '--output-dir', DIST_DIR], path.join(ROOT, 'app'));
      if (status !== 0) {
        console.error('✖ Expo export failed. Run npm install inside app/ if dependencies are missing.');
        process.exitCode = status;
        return;
      }
    }
  } else {
    console.log('Expo web export skipped. Set EXPORT_WEB=1 to enable.');
  }

  if (fs.existsSync(DIST_DIR)) {
    console.log(`\nWeb bundle available at ${DIST_DIR}`);
  }
}

main();
