import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /**
   * Clears + seeds the Auth/Firestore emulators over REST before the run.
   * Requires `docker compose up -d --wait` (frontend/backend/firestore +
   * firebase-auth-emulator). globalSetup pings all deps and fails fast.
   */
  globalSetup: './e2e/global-setup.ts',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3010',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /**
   * Project split (M3): public specs run across the full browser matrix;
   * the heavier authed specs (real UI login + seeded data) run on Chromium
   * only. testMatch keys off the spec filename.
   */
  projects: [
    {
      name: 'public',
      testMatch:
        /(marketing|contact|auth-pages|browse|book-unauth|smoke)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'public-firefox',
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'public-webkit',
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'authed',
      testMatch: /(mypage|booking|admin)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /**
   * Reuses the docker-compose frontend (:3010) locally
   * (reuseExistingServer). The effective e2e Firebase env lives in
   * docker-compose.yml `frontend.environment` — NOT here — because Playwright
   * does not start its own server when one already listens on :3010.
   */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3010',
    reuseExistingServer: !process.env.CI,
  },
});
