import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:3700', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev:mock -- --hostname 127.0.0.1 --port 3700',
    env: { NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3700/mock-api' },
    url: 'http://127.0.0.1:3700',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
