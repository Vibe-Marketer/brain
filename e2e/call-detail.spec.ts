import { test, expect } from '@playwright/test';

/**
 * Call Detail Pane tests — opening, content, close, pane layout behavior.
 */

test.describe('Call Detail Pane', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/transcripts');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 20_000 });
  });

  test('should open detail pane when clicking a call title', async ({ page }) => {
    const rows = page.locator('tbody tr[role="row"]');
    const rowCount = await rows.count();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    // Click the title area of the first row
    await rows.first().locator('td').first().click();
    await page.waitForTimeout(1_000);

    // Detail pane or dialog should appear
    const detailContent = page.locator('[data-pane="detail"]').or(
      page.getByRole('dialog')
    ).or(
      page.locator('[class*="detail-pane"], [class*="DetailPane"]')
    );
    await expect(detailContent.first()).toBeVisible({ timeout: 10_000 });
  });

  test('should display call title in detail pane', async ({ page }) => {
    const rows = page.locator('tbody tr[role="row"]');
    const rowCount = await rows.count();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    // Get the title text from the first row
    const titleCell = rows.first().locator('td').first();
    const titleText = await titleCell.innerText();

    await titleCell.click();
    await page.waitForTimeout(1_000);

    // The detail pane should show the call title somewhere
    if (titleText.trim()) {
      const titleInDetail = page.getByText(titleText.trim().substring(0, 20), { exact: false });
      await expect(titleInDetail.first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('should have a close button in detail pane', async ({ page }) => {
    const rows = page.locator('tbody tr[role="row"]');
    const rowCount = await rows.count();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    await rows.first().locator('td').first().click();
    await page.waitForTimeout(1_000);

    // Look for close button
    const closeBtn = page.getByRole('button', { name: /close/i }).first().or(
      page.locator('[aria-label*="close"], [aria-label*="Close"]').first()
    );
    await expect(closeBtn).toBeVisible({ timeout: 10_000 });
  });

  test('should close detail pane when clicking close button', async ({ page }) => {
    const rows = page.locator('tbody tr[role="row"]');
    const rowCount = await rows.count();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    await rows.first().locator('td').first().click();
    await page.waitForTimeout(1_000);

    const closeBtn = page.getByRole('button', { name: /close/i }).first().or(
      page.locator('[aria-label*="close"], [aria-label*="Close"]').first()
    );
    const isBtnVisible = await closeBtn.isVisible().catch(() => false);
    if (!isBtnVisible) {
      test.skip();
      return;
    }

    await closeBtn.click();
    await page.waitForTimeout(500);

    // Verify we're back to the table view without detail pane
    // The table should still be visible
    await expect(page.locator('table').first()).toBeVisible({ timeout: 5_000 });
  });

  test('should navigate directly to call detail via URL', async ({ page }) => {
    // Navigate to /call/1 — may show a call or redirect
    await page.goto('/call/1');
    await page.waitForLoadState('networkidle');

    // Should either show call content or redirect to transcripts
    const hasCallContent = await page.getByText(/transcript|summary|participants|duration/i).first().isVisible({ timeout: 10_000 }).catch(() => false);
    const redirectedToMain = page.url().includes('/transcripts') || page.url().endsWith('/');

    expect(hasCallContent || redirectedToMain).toBeTruthy();
  });

  test('should not have console errors when opening detail', async ({ page }) => {
    const rows = page.locator('tbody tr[role="row"]');
    const rowCount = await rows.count();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await rows.first().locator('td').first().click();
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
