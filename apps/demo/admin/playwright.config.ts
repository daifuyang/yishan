import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config for the yishan-admin app.
 *
 * Pre-reqs:
 *   - API server reachable at http://localhost:3000 (with admin/admin123 seeded)
 *   - Admin dev server reachable at http://localhost:8000
 *
 * Run: `pnpm exec playwright test --reporter=list`
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:8000',
    headless: true,
    viewport: { width: 1280, height: 720 },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Block any real navigation away from the admin origin.
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});