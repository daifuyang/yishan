import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config for the Demo Admin app.
 *
 * Pre-reqs:
 *   - Existing module specs use PLAYWRIGHT_BASE_URL (default localhost:8000).
 *   - product-v2.spec.ts starts its own disposable local MySQL/Redis runtime;
 *     build API and Admin first. It never uses persisted auth fixtures.
 *
 * Run: `pnpm exec playwright test --reporter=list`
 */
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'artifacts/playwright',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [
        ['list'],
        [
          'html',
          { open: 'never', outputFolder: 'artifacts/playwright-report' },
        ],
      ]
    : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8000',
    headless: true,
    viewport: { width: 1280, height: 720 },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : undefined,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
