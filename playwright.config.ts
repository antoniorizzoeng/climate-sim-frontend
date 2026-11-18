import { defineConfig } from '@playwright/test';

const port = process.env.MOCK_E2E_PORT ?? '3100';
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  timeout: 60000,
  use: { baseURL, trace: 'retain-on-failure' },
  webServer: {
    command: `npm run dev:mock -- --hostname 127.0.0.1 --port ${port}`,
    env: { NEXT_PUBLIC_API_URL: `${baseURL}/mock-api` },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
