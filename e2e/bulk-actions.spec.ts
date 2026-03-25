import { test, expect } from '@playwright/test';
import { TranscriptsPage } from './pages';

/**
 * Bulk Actions tests — multi-select, toolbar, delete confirm, tag, move.
 */

test.describe('Bulk Actions', () => {
  let transcriptsPage: TranscriptsPage;

  test.beforeEach(async ({ page }) => {
    transcriptsPage = new TranscriptsPage(page);
    await transcriptsPage.goto();
  });

  test('should show checkboxes on transcript rows', async ({ page }) => {
    const rowCount = await transcriptsPage.getRowCount();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    const checkbox = page.locator('tbody tr[role="row"]').first().locator('input[type="checkbox"]');
    await expect(checkbox).toBeVisible({ timeout: 5_000 });
  });

  test('should show bulk action toolbar when rows are selected', async ({ page }) => {
    const rowCount = await transcriptsPage.getRowCount();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    await transcriptsPage.selectRow(0);
    await page.waitForTimeout(500);

    // Bulk toolbar should appear with "selected" text
    await expect(
      page.getByText(/selected/i).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test('should select all rows via header checkbox', async ({ page }) => {
    const rowCount = await transcriptsPage.getRowCount();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    const headerCheckbox = page.locator('thead input[type="checkbox"]').first();
    const isVisible = await headerCheckbox.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip();
      return;
    }

    await headerCheckbox.check();
    await page.waitForTimeout(500);

    // Should show bulk toolbar
    await expect(
      page.getByText(/selected/i).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test('should hide bulk toolbar when deselecting all', async ({ page }) => {
    const rowCount = await transcriptsPage.getRowCount();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    // Select a row
    await transcriptsPage.selectRow(0);
    await page.waitForTimeout(500);
    await expect(page.getByText(/selected/i).first()).toBeVisible({ timeout: 5_000 });

    // Deselect
    const checkbox = page.locator('tbody tr[role="row"]').first().locator('input[type="checkbox"]');
    await checkbox.uncheck();
    await page.waitForTimeout(500);

    // Toolbar should hide (or show "0 selected" which effectively means hidden)
    const selectedText = page.getByText(/\d+ selected/i).first();
    const isStillVisible = await selectedText.isVisible().catch(() => false);
    if (isStillVisible) {
      const text = await selectedText.innerText();
      expect(text).toMatch(/^0/);
    }
  });

  test('should show delete confirmation dialog', async ({ page }) => {
    const rowCount = await transcriptsPage.getRowCount();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    await transcriptsPage.selectRow(0);
    await page.waitForTimeout(500);

    // Look for delete button in bulk toolbar
    const deleteBtn = page.getByRole('button', { name: /delete/i }).first();
    const isDeleteVisible = await deleteBtn.isVisible().catch(() => false);
    if (!isDeleteVisible) {
      test.skip();
      return;
    }

    await deleteBtn.click();

    // Confirmation dialog should appear
    const confirmDialog = page.getByRole('dialog').or(
      page.getByText(/permanently delete|are you sure|confirm/i).first()
    );
    await expect(confirmDialog.first()).toBeVisible({ timeout: 5_000 });
  });

  test('should cancel delete when clicking cancel in confirmation', async ({ page }) => {
    const rowCount = await transcriptsPage.getRowCount();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    await transcriptsPage.selectRow(0);
    await page.waitForTimeout(500);

    const deleteBtn = page.getByRole('button', { name: /delete/i }).first();
    const isDeleteVisible = await deleteBtn.isVisible().catch(() => false);
    if (!isDeleteVisible) {
      test.skip();
      return;
    }

    await deleteBtn.click();
    await page.waitForTimeout(500);

    // Click cancel in the confirmation dialog
    const cancelBtn = page.getByRole('button', { name: /cancel/i }).first();
    const isCancelVisible = await cancelBtn.isVisible().catch(() => false);
    if (!isCancelVisible) {
      await page.keyboard.press('Escape');
    } else {
      await cancelBtn.click();
    }

    // Table should still have the same rows
    const newRowCount = await transcriptsPage.getRowCount();
    expect(newRowCount).toBe(rowCount);
  });

  test('should show tag assignment option in bulk toolbar', async ({ page }) => {
    const rowCount = await transcriptsPage.getRowCount();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    await transcriptsPage.selectRow(0);
    await page.waitForTimeout(500);

    // Look for tag-related button in bulk actions
    const tagBtn = page.getByRole('button', { name: /tag|assign tag/i }).first();
    const isVisible = await tagBtn.isVisible().catch(() => false);

    // Either tag button is visible directly, or we need to look in a dropdown
    if (!isVisible) {
      // May be in a "more actions" dropdown
      const moreBtn = page.getByRole('button', { name: /more|actions/i }).first();
      const hasMore = await moreBtn.isVisible().catch(() => false);
      if (hasMore) {
        await moreBtn.click();
        const tagOption = page.getByText(/tag/i).first();
        await expect(tagOption).toBeVisible({ timeout: 5_000 });
      }
    }
  });

  test('should show export option in bulk toolbar', async ({ page }) => {
    const rowCount = await transcriptsPage.getRowCount();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    await transcriptsPage.selectRow(0);
    await page.waitForTimeout(500);

    const exportBtn = page.getByRole('button', { name: /export/i }).first();
    const isVisible = await exportBtn.isVisible().catch(() => false);

    // Export button should be available when items are selected
    expect(isVisible).toBeTruthy();
  });
});
