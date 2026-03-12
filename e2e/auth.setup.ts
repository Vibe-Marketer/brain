import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, '../playwright/.auth/user.json');

/**
 * Authentication setup for E2E tests.
 * Logs in once and saves the authenticated state for reuse across all tests.
 */
setup('authenticate', async ({ page }) => {
  // Get credentials from environment
  const email = process.env.CALLVAULTAI_LOGIN;
  const password = process.env.CALLVAULTAI_LOGIN_PASSWORD;

  if (!email || !password) {
    throw new Error('Missing CALLVAULTAI_LOGIN or CALLVAULTAI_LOGIN_PASSWORD in environment');
  }

  // Navigate to login page
  await page.goto('/login');

  // Wait for the email input to be visible (CardTitle may be "Welcome to CallVault™")
  const emailInput = page.locator('input[type="email"]');
  await expect(emailInput).toBeVisible({ timeout: 20000 });

  await emailInput.fill(email);

  const passwordInput = page.locator('input[type="password"]');
  await expect(passwordInput).toBeVisible();
  await passwordInput.fill(password);

  // Click sign in button — the Login page has a "Sign In" button
  const signInButton = page.getByRole('button', { name: /sign in/i }).first();
  await signInButton.click();

  // Wait for navigation away from /login — any authenticated page
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 30000 });

  // Wait for the sidebar to confirm we're logged in
  await expect(page.locator('nav').first()).toBeVisible({ timeout: 15000 });

  // Save the authenticated state
  await page.context().storageState({ path: authFile });
});
