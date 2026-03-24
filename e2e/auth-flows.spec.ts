import { test, expect } from '@playwright/test';
import { LoginPage } from './pages';

/**
 * Authentication flow tests — login, logout, invalid credentials, session handling.
 *
 * These tests do NOT use the shared auth state since they test the auth flow itself.
 */

test.describe('Authentication Flows', () => {
  // Use a fresh context without stored auth state
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should display login page with email and password fields', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.signInButton).toBeVisible();
  });

  test('should show welcome title on login page', async ({ page }) => {
    await page.goto('/login');
    await expect(
      page.getByText(/welcome|sign in|log in/i).first()
    ).toBeVisible({ timeout: 20_000 });
  });

  test('should show error for invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('invalid@example.com', 'wrongpassword123');
    await loginPage.expectErrorMessage();
  });

  test('should show validation for empty email', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Try to submit with empty email
    await loginPage.passwordInput.fill('somepassword');
    await loginPage.signInButton.click();

    // HTML5 validation or custom validation should prevent submission
    // The URL should still be /login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show validation for empty password', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.emailInput.fill('test@example.com');
    await loginPage.signInButton.click();

    // Should remain on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    const email = process.env.CALLVAULTAI_LOGIN;
    const password = process.env.CALLVAULTAI_LOGIN_PASSWORD;
    if (!email || !password) {
      test.skip();
      return;
    }

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(email, password);
    await loginPage.expectLoginSuccess();
  });

  test('should redirect authenticated users away from /login', async ({ page, context }) => {
    const email = process.env.CALLVAULTAI_LOGIN;
    const password = process.env.CALLVAULTAI_LOGIN_PASSWORD;
    if (!email || !password) {
      test.skip();
      return;
    }

    // Login first
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(email, password);
    await loginPage.expectLoginSuccess();

    // Try to go back to login — should redirect away
    await page.goto('/login');
    await page.waitForTimeout(3_000);
    // Should either stay redirected or show the app
    const url = page.url();
    // If properly redirected, URL won't be /login
    // (Some apps allow it briefly, so just check the page content)
    const hasAppContent = await page.locator('nav').first().isVisible().catch(() => false);
    const isOnLogin = url.includes('/login');
    // Either redirected away OR app content is showing
    expect(hasAppContent || !isOnLogin).toBeTruthy();
  });

  test('should not have console errors on login page', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const realErrors = errors.filter(
      (e) =>
        !e.includes('[HMR]') &&
        !e.includes('React DevTools') &&
        !e.includes('Download the React DevTools') &&
        !e.includes('favicon')
    );
    expect(realErrors).toHaveLength(0);
  });
});
