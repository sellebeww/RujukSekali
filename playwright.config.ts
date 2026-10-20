import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

if (existsSync('.env')) process.loadEnvFile('.env');
// E2E_PORT lets the suite run while another local server holds 3100.
const PORT = Number(process.env.E2E_PORT ?? 3100);
const URL = `http://localhost:${PORT}`;
const env = {
  ...process.env,
  DATABASE_URL: process.env.E2E_DATABASE_URL!,
  DEMO_DATABASE_URL: process.env.E2E_DEMO_DATABASE_URL!,
  PUBLIC_SITE_URL: URL,
  APP_URL: URL,
  LOG_SILENT: '1',
  NEXT_DIST_DIR: '.next-e2e',
} as Record<string, string>;

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [['list']],
  // Reduced motion: axe must measure contrast on settled content, not mid-fade (scroll reveal, tab fade).
  use: {
    baseURL: URL,
    trace: 'retain-on-failure',
    locale: 'id-ID',
    contextOptions: { reducedMotion: 'reduce' },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /(navigation|patient)\.spec\.ts/ },
  ],
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: URL,
    timeout: 300_000,
    reuseExistingServer: false,
    env,
  },
});
