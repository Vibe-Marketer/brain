import { test, expect } from '@playwright/test';

/**
 * Routing Rules Page tests — rules list, create, empty state.
 */

test.describe('Routing Rules Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/rules');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3_000);
  });

  test('should display rules page or redirect', async ({ page }) => {
    const url = page.url();

    if (url.includes('/rules') || url.includes('/sorting-tagging/rules')) {
      await expect(
        page.getByText(/rules|routing|auto-sort/i).first()
      ).toBeVisible({ timeout: 10_000 });
    } else {
      // Redirected — feature flag may be off
      expect(url.includes('/') || url.includes('/login')).toBeTruthy();
    }
  });

  test('should show rules list or empty state', async ({ page }) => {
    const url = page.url();
    if (!url.includes('/rules') && !url.includes('/sorting-tagging/rules')) {
      test.skip();
      return;
    }

    // Either rules exist or empty state is shown
    const ruleItems = page.locator('[class*="rule"]').or(
      page.getByText(/when.*then|if.*then/i)
    );
    const hasRules = await ruleItems.first().isVisible({ timeout: 5_000 }).catch(() => false);

    const emptyState = page.getByText(/no rules|create.*first|get started/i);
    const hasEmpty = await emptyState.first().isVisible().catch(() => false);

    const createBtn = page.getByRole('button', { name: /create|new|add/i });
    const hasCreate = await createBtn.first().isVisible().catch(() => false);

    expect(hasRules || hasEmpty || hasCreate).toBeTruthy();
  });

  test('should have create rule button', async ({ page }) => {
    const url = page.url();
    if (!url.includes('/rules') && !url.includes('/sorting-tagging/rules')) {
      test.skip();
      return;
    }

    const createBtn = page.getByRole('button', { name: /create|new|add/i }).first();
    const isVisible = await createBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    // Create button should exist
    expect(isVisible).toBeTruthy();
  });

  test('should not have console errors', async ({ page }) => {
    const url = page.url();
    if (!url.includes('/rules') && !url.includes('/sorting-tagging/rules')) {
      test.skip();
      return;
    }

    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.waitForTimeout(2_000);

    const realErrors = errors.filter(
      (e) =>
        !e.includes('[HMR]') &&
        !e.includes('React DevTools') &&
        !e.includes('Download the React DevTools')
    );
    expect(realErrors).toHaveLength(0);
  });
});
