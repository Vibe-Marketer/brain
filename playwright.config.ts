import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, 'playwright/.auth/user.json');

// Load the checkout-local environment when present. Linked worktrees keep the
// operator environment one directory above, while browser verification uses
// the dedicated TEST project whenever its guarded credentials are available.
const localEnvPath = path.join(__dirname, '.env');
const parentEnvPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: fs.existsSync(localEnvPath) ? localEnvPath : parentEnvPath });

const testEnvPath = path.join(__dirname, '.env.test');
if (fs.existsSync(testEnvPath)) {
  const testEnv = dotenv.parse(fs.readFileSync(testEnvPath));
  if (testEnv.VITE_SUPABASE_TEST_URL && testEnv.VITE_SUPABASE_TEST_ANON_KEY) {
    process.env.VITE_SUPABASE_URL = testEnv.VITE_SUPABASE_TEST_URL;
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = testEnv.VITE_SUPABASE_TEST_ANON_KEY;
  }
}

/**
 * Playwright configuration for E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory
  testDir: '.',
  testMatch: ['e2e/**/*.spec.ts', 'playwright/**/*.spec.ts'],

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

    // Privacy-safe claim journeys run with deterministic network boundaries
    // and their own runtime-created credentials, so they require no persisted
    // operator session or setup-project dependency.
    {
      name: 'discovery-claim',
      testMatch: /playwright\/discovery-claim\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // Browser projects - all depend on setup and use authenticated state
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      dependencies: ['setup'],
      testIgnore: [/signup\.spec\.ts/, /playwright\/discovery-claim\.spec\.ts/],
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: authFile,
      },
      dependencies: ['setup'],
      testIgnore: [/signup\.spec\.ts/, /playwright\/discovery-claim\.spec\.ts/],
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: authFile,
      },
      dependencies: ['setup'],
      testIgnore: [/signup\.spec\.ts/, /playwright\/discovery-claim\.spec\.ts/],
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
      testIgnore: [/signup\.spec\.ts/, /playwright\/discovery-claim\.spec\.ts/],
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
