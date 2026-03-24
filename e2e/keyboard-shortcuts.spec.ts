import { test, expect } from '@playwright/test';

/**
 * Keyboard Shortcuts tests — Cmd+K, Tab nav, Escape handling, Enter/Space.
 */

test.describe('Keyboard Shortcuts & Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/transcripts');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 20_000 });
  });

  test('Cmd+K opens global search modal', async ({ page }) => {
    await page.keyboard.press('Meta+k');

    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible({ timeout: 5_000 });
  });

  test('Escape closes open dialogs', async ({ page }) => {
    // Open search modal
    await page.keyboard.press('Meta+k');
    const dialog = page.getByRole('dialog').first();
    const isVisible = await dialog.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!isVisible) {
      test.skip();
      return;
    }

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });
  });

  test('Tab moves focus through interactive elements', async ({ page }) => {
    // Start from a known focusable element
    const firstFocusable = page.locator('a, button, input, [tabindex="0"]').first();
    await firstFocusable.focus();

    // Tab should move focus
    await page.keyboard.press('Tab');
    const activeElement = page.locator(':focus');
    await expect(activeElement).toBeVisible({ timeout: 3_000 });
  });

  test('Enter activates focused buttons', async ({ page }) => {
    const nav = page.locator('nav').first();
    const settings = nav.getByText(/settings/i).first();
    await settings.focus();

    await page.keyboard.press('Enter');
    await page.waitForTimeout(1_000);

    // Should navigate to settings
    const url = page.url();
    expect(url.includes('/settings')).toBeTruthy();
  });

  test('Space activates focused buttons', async ({ page }) => {
    const nav = page.locator('nav').first();
    const settings = nav.getByText(/settings/i).first();
    await settings.focus();

    await page.keyboard.press('Space');
    await page.waitForTimeout(1_000);

    // Should navigate to settings
    const url = page.url();
    expect(url.includes('/settings')).toBeTruthy();
  });

  test('focus is trapped inside open modals', async ({ page }) => {
    await page.keyboard.press('Meta+k');
    const dialog = page.getByRole('dialog').first();
    const isVisible = await dialog.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!isVisible) {
      test.skip();
      return;
    }

    // Tab through elements — focus should stay within dialog
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
    }

    // Active element should still be within the dialog
    const focusInDialog = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return dialog?.contains(document.activeElement) ?? false;
    });

    expect(focusInDialog).toBeTruthy();
  });

  test('Cmd+K works from any page', async ({ page }) => {
    // Navigate to settings first
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 20_000 });

    // Cmd+K should still open search
    await page.keyboard.press('Meta+k');
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible({ timeout: 5_000 });
  });
});
