import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:3800/climate-sim-frontend/';

export default defineConfig({
  testDir: './tests/pages',
  outputDir: 'artifacts/pages',
  timeout: 60000,
  use: {
    baseURL,
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'test -f out/index.html && mkdir -p .local/pages && ' +
      'ln -sfn ../../out .local/pages/climate-sim-frontend && ' +
      'python3 -m http.server 3800 --bind 127.0.0.1 --directory .local/pages',
    url: baseURL,
    reuseExistingServer: false,
  },
});
