import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, 'playwright/.auth/user.json');

/**
 * Playwright configuration for E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory
  testDir: './e2e',

  // Global timeout for tests (2 minutes for real AI API calls)
  timeout: 120 * 1000,

  // Timeout for expect assertions
  expect: {
    timeout: 30 * 1000,
  },

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry failed tests (2 retries for stability)
  retries: 2,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: 'html',

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: process.env.BASE_URL || 'http://localhost:3001',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Take screenshot on failure
    screenshot: 'only-on-failure',

    // Retain video on failure for debugging
    video: 'retain-on-failure',
  },

  // Configure projects for major browsers
  projects: [
    // API project - pure HTTP tests, no browser auth required (e.g. MCP server E2E)
    {
      name: 'api',
      testMatch: /mcp-server\.spec\.ts/,
      use: {},
    },

    // Signup project - LOGGED-OUT browser flow (ticket 3d1da686).
    // No storageState, no auth-setup dependency: it must exercise the real
    // new-account signup UI from a clean context.
    {
      name: 'signup',
      testMatch: /signup\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // Setup project - runs authentication once before all tests
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    // Browser projects - all depend on setup and use authenticated state
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      dependencies: ['setup'],
      testIgnore: /signup\.spec\.ts/,
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: authFile,
      },
      dependencies: ['setup'],
      testIgnore: /signup\.spec\.ts/,
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: authFile,
      },
      dependencies: ['setup'],
      testIgnore: /signup\.spec\.ts/,
    },

    // Microsoft Edge (Chromium-based)
    {
      name: 'edge',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
        storageState: authFile,
      },
      dependencies: ['setup'],
      testIgnore: /signup\.spec\.ts/,
    },
  ],

  // Run local dev server before starting the tests
  // (skip for api/signup runs against a remote BASE_URL)
  webServer: process.env.PLAYWRIGHT_PROJECT === 'api' ||
    (process.env.PLAYWRIGHT_PROJECT === 'signup' && process.env.BASE_URL) ? undefined : {
    command: 'npm run dev',
    url: process.env.BASE_URL || 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
