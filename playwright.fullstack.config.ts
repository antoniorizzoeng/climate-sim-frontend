import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-fullstack',
  outputDir: './artifacts/e2e-fullstack/playwright',
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  projects: [{ name: 'chromium-fullstack', use: { browserName: 'chromium' } }],
  use: {
    baseURL: 'http://127.0.0.1:3200',
    viewport: { width: 1440, height: 1000 },
    actionTimeout: 15_000,
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
