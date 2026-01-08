
import { defineConfig, devices } from '@playwright/test';
import path from 'path';

// Use process.env.PORT by default and fallback to 3000
const PORT = process.env.PORT || 3000;

// Set webServer.url and use.baseURL with the location of the WebServer
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  // Look for test files in the "e2e/specs" directory, relative to this configuration file.
  testDir: 'e2e/specs',

  // The output directory for files created during test execution.
  outputDir: 'e2e/test-results',

  // Global setup and teardown scripts.
  globalSetup: require.resolve('./e2e/support/global-setup'),
  globalTeardown: require.resolve('./e2e/support/global-teardown'),

  // Configure projects for major browsers.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Shared settings for all the projects.
  use: {
    // Use the baseURL in actions like `await page.goto('/')`.
    baseURL,

    // Record trace only when retrying a test for the first time.
    trace: 'on-first-retry',

    // Capture screenshot on failure.
    screenshot: 'only-on-failure',

    // Record video on failure.
    video: 'retain-on-failure',
  },

  // Run your local dev server before starting the tests.
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
});
