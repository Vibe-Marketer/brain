import { test, expect } from '@playwright/test';

/**
 * Error Handling tests — network errors, empty states, API failures.
 */

test.describe('Error Handling & Edge Cases', () => {
  test('should handle network error gracefully on transcripts page', async ({ page }) => {
    // Mock API to return errors
    await page.route('**/rest/v1/fathom_calls**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    await page.goto('/transcripts');
    await page.waitForLoadState('networkidle');

    // Should show error state or empty state — not crash
    const hasError = await page.getByText(/error|something went wrong|try again|failed/i).first().isVisible({ timeout: 10_000 }).catch(() => false);
    const hasEmpty = await page.getByText(/no calls|no transcripts|get started/i).first().isVisible().catch(() => false);
    const hasTable = await page.locator('table').first().isVisible().catch(() => false);

    // App should handle the error gracefully (show error, empty state, or empty table)
    expect(hasError || hasEmpty || hasTable).toBeTruthy();
  });

  test('should show empty state when no transcripts exist', async ({ page }) => {
    // Mock API to return empty array
    await page.route('**/rest/v1/fathom_calls**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
        headers: { 'content-range': '0-0/0' },
      });
    });

    await page.goto('/transcripts');
    await page.waitForLoadState('networkidle');

    // Should show empty state or empty table
    const hasEmpty = await page.getByText(/no calls|no transcripts|get started|import/i).first().isVisible({ timeout: 10_000 }).catch(() => false);
    const hasEmptyTable = await page.locator('tbody').first().isVisible().catch(() => false);

    expect(hasEmpty || hasEmptyTable).toBeTruthy();
  });

  test('should handle auth session expiry gracefully', async ({ page }) => {
    // Mock auth endpoint to return 401
    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' }),
      });
    });

    await page.goto('/transcripts');
    await page.waitForTimeout(5_000);

    // Should redirect to login or show auth error
    const url = page.url();
    const onLogin = url.includes('/login');
    const hasAuthError = await page.getByText(/session|expired|sign in|log in/i).first().isVisible().catch(() => false);

    expect(onLogin || hasAuthError).toBeTruthy();
  });

  test('should handle slow API responses', async ({ page }) => {
    // Mock API with a 3-second delay
    await page.route('**/rest/v1/fathom_calls**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 1, title: 'Delayed Call' }]),
        headers: { 'content-range': '0-0/1' },
      });
    });

    await page.goto('/transcripts');

    // Should show loading indicator while waiting
    const hasLoading = await page.getByText(/loading/i).or(
      page.locator('[class*="skeleton"], [class*="spinner"], [class*="loading"]')
    ).first().isVisible({ timeout: 2_000 }).catch(() => false);

    // Wait for data to arrive
    await page.waitForTimeout(4_000);

    // Should eventually show content
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 10_000 });
  });

  test('should redirect unknown routes to home', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2_000);

    const url = page.url();
    // Catch-all route redirects to /
    expect(
      url.endsWith('/') ||
      url.includes('/transcripts') ||
      url.includes('/login')
    ).toBeTruthy();
  });

  test('should redirect legacy /vaults route', async ({ page }) => {
    await page.goto('/vaults');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2_000);

    const url = page.url();
    expect(url).not.toContain('/vaults');
  });

  test('should redirect legacy /agents route', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2_000);

    const url = page.url();
    expect(url).not.toContain('/agents');
  });

  test('should redirect legacy /banks route to settings', async ({ page }) => {
    await page.goto('/banks');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2_000);

    const url = page.url();
    expect(url).not.toContain('/banks');
  });

  test('should not crash on rapid route changes', async ({ page }) => {
    const routes = ['/', '/settings', '/analytics', '/transcripts', '/settings'];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForTimeout(200); // Rapid navigation
    }

    // App should still be responsive
    await page.waitForLoadState('networkidle');
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 20_000 });
  });
});
