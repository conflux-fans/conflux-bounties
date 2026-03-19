import { defineConfig, devices } from '@playwright/test';

const PORT = parseInt(process.env.E2E_PORT || '3001', 10);
const MOCK_API_PORT = parseInt(process.env.MOCK_API_PORT || '3099', 10);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: `npx tsx e2e/mock-api.ts`,
      port: MOCK_API_PORT,
      reuseExistingServer: !process.env.CI,
      env: { PORT: String(MOCK_API_PORT) },
    },
    {
      command: `npx next dev -p ${PORT}`,
      port: PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        NEXT_PUBLIC_API_URL: `http://localhost:${MOCK_API_PORT}/v1`,
        NEXT_PUBLIC_REGISTRY_ADDRESS: '0x0000000000000000000000000000000000000000',
        NEXT_PUBLIC_CONFLUX_RPC_URL: 'https://evmtestnet.confluxrpc.com',
      },
    },
  ],
});
