// Builds (if needed) and runs Lighthouse CI against a production server using Playwright's Chromium.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { loadEnv } from './env';

loadEnv();
const env = {
  ...process.env,
  DATABASE_URL: process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL,
  DEMO_DATABASE_URL: process.env.E2E_DEMO_DATABASE_URL ?? process.env.DEMO_DATABASE_URL,
  PUBLIC_SITE_URL: 'http://localhost:3200',
  APP_URL: 'http://localhost:3200',
  NEXT_DIST_DIR: '.next-lh',
  LOG_SILENT: '1',
  CHROME_PATH: chromium.executablePath(),
};
if (!existsSync('.next-lh/BUILD_ID') || process.argv.includes('--build'))
  execSync('npx next build', { stdio: 'inherit', env });
execSync('npx lhci autorun --config=lighthouserc.cjs', { stdio: 'inherit', env });
