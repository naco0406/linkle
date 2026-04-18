import { defineConfig, devices } from '@playwright/test';

// Run against both the web (game) and admin apps. The API is mocked at the
// network layer via page.route so tests are deterministic and don't depend on
// a live wrangler dev server. Phase 9 will add a separate CI job that runs
// the tests against a live deployment.

export default defineConfig({
  testDir: './specs',
  timeout: 30_000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 5000,
  },
  projects: [
    {
      name: 'web:mobile',
      testDir: './specs/web',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        hasTouch: true,
        isMobile: true,
        userAgent: devices['iPhone 14'].userAgent,
        baseURL: 'http://localhost:5173',
      },
    },
    {
      name: 'web:desktop',
      testDir: './specs/web',
      use: {
        viewport: { width: 1280, height: 800 },
        baseURL: 'http://localhost:5173',
      },
    },
    {
      name: 'admin',
      testDir: './specs/admin',
      use: {
        viewport: { width: 1280, height: 800 },
        baseURL: 'http://localhost:5174',
      },
    },
  ],
  webServer: [
    {
      name: 'web',
      command: 'pnpm --filter @linkle/web dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env['CI'],
      timeout: 60_000,
      cwd: '../..',
    },
    {
      name: 'admin',
      command: 'pnpm --filter @linkle/admin dev',
      url: 'http://localhost:5174',
      reuseExistingServer: !process.env['CI'],
      timeout: 60_000,
      cwd: '../..',
    },
  ],
});
