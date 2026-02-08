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

  // Wait for the login form to be visible
  await expect(page.getByRole('heading', { name: /sign in|log in|welcome/i })).toBeVisible({ timeout: 10000 });

  // Fill in credentials
  // Try common email input selectors
  const emailInput = page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i)).or(page.locator('input[type="email"]'));
  await emailInput.fill(email);

  const passwordInput = page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i)).or(page.locator('input[type="password"]'));
  await passwordInput.fill(password);

  // Click sign in button
  const signInButton = page.getByRole('button', { name: /sign in|log in|submit/i });
  await signInButton.click();

  // Wait for navigation to dashboard/home - indicates successful login
  await expect(page).toHaveURL(/\/(home|dashboard|chat)?$/, { timeout: 30000 });

  // Additional check: wait for authenticated UI element (use .first() to avoid strict mode violation)
  await expect(
    page.getByRole('button', { name: /collapse sidebar/i })
  ).toBeVisible({ timeout: 10000 });

  // Save the authenticated state
  await page.context().storageState({ path: authFile });
});
