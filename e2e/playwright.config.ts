import { defineConfig, devices } from '@playwright/test';

const WEB_PORT = 5273;
const API_PORT = 3001;
const WEB_URL = `http://localhost:${WEB_PORT}`;
const API_URL = `http://localhost:${API_PORT}`;

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  // Generous timeouts: the first test absorbs the cold Vite compile.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI
    ? 'line'
    : [['html', { outputFolder: './playwright-report', open: 'never' }]],
  use: {
    baseURL: WEB_URL,
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @game-lobby/server dev',
      url: `${API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        DATABASE_URL: 'pglite://memory',
        JWT_SECRET: 'e2e-secret',
        CORS_ORIGIN: WEB_URL,
        PORT: String(API_PORT),
      },
    },
    {
      command: 'pnpm --filter @game-lobby/web dev',
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
