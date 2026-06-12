import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:8788',
    trace: 'on-first-retry',
  },
  webServer: {
    command: "npx wrangler dev --local --port 8788 --var MOCK_HERMES_DELAY_MS:3000 --var 'MOCK_HERMES_RESPONSE:Smoke test async reply.'",
    url: 'http://127.0.0.1:8788',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
