import { test, expect } from '@playwright/test';
import { TranscriptsPage } from './pages';

/**
 * Dashboard / Transcripts page tests — table, columns, pagination, loading.
 */

test.describe('Dashboard — Transcripts Table', () => {
  let transcriptsPage: TranscriptsPage;

  test.beforeEach(async ({ page }) => {
    transcriptsPage = new TranscriptsPage(page);
    await transcriptsPage.goto();
  });

  test('should load the transcripts page with table or empty state', async ({ page }) => {
    // Either table or empty state is visible
    const table = page.locator('table').first();
    const emptyState = page.getByText(/no calls|no transcripts|get started|import/i).first();
    await expect(table.or(emptyState)).toBeVisible({ timeout: 20_000 });
  });

  test('should display transcript table headers', async ({ page }) => {
    const table = page.locator('table').first();
    const isTableVisible = await table.isVisible().catch(() => false);
    if (!isTableVisible) {
      test.skip();
      return;
    }

    // Check for expected column headers
    const headers = page.locator('thead th');
    const headerCount = await headers.count();
    expect(headerCount).toBeGreaterThan(0);

    // Title column should always be present
    await expect(page.locator('thead').getByText(/title/i)).toBeVisible({ timeout: 5_000 });
  });

  test('should show transcript rows with data', async ({ page }) => {
    const rowCount = await transcriptsPage.getRowCount();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    // First row should have clickable content
    const firstRow = page.locator('tbody tr[role="row"]').first();
    await expect(firstRow).toBeVisible();
  });

  test('should open call detail when clicking a transcript row', async ({ page }) => {
    const rowCount = await transcriptsPage.getRowCount();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    // Click the title cell in the first row
    const titleCell = page.locator('tbody tr[role="row"]').first().locator('td').first();
    await titleCell.click();

    // Wait for detail content to appear (pane 4 or dialog)
    await page.waitForTimeout(1_000);

    // Some detail should be visible — a heading, transcript content, or detail pane
    const detailVisible = await page
      .locator('[data-pane="detail"], [role="dialog"]')
      .first()
      .isVisible()
      .catch(() => false);
    const headingVisible = await page
      .locator('h1, h2, h3')
      .filter({ hasNotText: /sorting|settings|analytics/i })
      .first()
      .isVisible()
      .catch(() => false);

    expect(detailVisible || headingVisible).toBeTruthy();
  });

  test('should display pagination controls when rows exist', async ({ page }) => {
    const rowCount = await transcriptsPage.getRowCount();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    // Look for pagination indicators — buttons, page numbers, or "showing X of Y"
    const pagination = page.getByText(/page|showing|of \d+/i).first().or(
      page.getByRole('button', { name: /next|previous/i }).first()
    );
    await expect(pagination).toBeVisible({ timeout: 10_000 });
  });

  test('should allow column toggling via column picker', async ({ page }) => {
    const columnPicker = page.getByRole('button', { name: /columns/i }).first();
    const isVisible = await columnPicker.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip();
      return;
    }

    await columnPicker.click();

    // Should show column checkboxes or menu items
    const columnOptions = page.getByRole('menuitemcheckbox').or(
      page.getByRole('checkbox')
    );
    await expect(columnOptions.first()).toBeVisible({ timeout: 5_000 });

    // Close the picker
    await page.keyboard.press('Escape');
  });

  test('should display filter buttons', async ({ page }) => {
    // Check for filter buttons: Tag, Folder, Date, Duration, etc.
    const filterButtons = [
      page.getByRole('button', { name: /^tag$/i }),
      page.getByRole('button', { name: /^folder$/i }),
      page.getByRole('button', { name: /^date$/i }),
    ];

    let visibleCount = 0;
    for (const btn of filterButtons) {
      if (await btn.isVisible().catch(() => false)) {
        visibleCount++;
      }
    }
    expect(visibleCount).toBeGreaterThan(0);
  });

  test('should load page within performance threshold', async ({ page }) => {
    const start = Date.now();
    await page.goto('/transcripts');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - start;

    // Page should load within 10 seconds (generous for dev server)
    expect(loadTime).toBeLessThan(10_000);
  });

  test('should not have console errors on page load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/transcripts');
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
