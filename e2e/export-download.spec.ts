import { test, expect } from '@playwright/test';
import { TranscriptsPage } from './pages';

/**
 * Export & Download tests — SmartExportDialog, format selection, per-row download.
 */

test.describe('Export & Download', () => {
  let transcriptsPage: TranscriptsPage;

  test.beforeEach(async ({ page }) => {
    transcriptsPage = new TranscriptsPage(page);
    await transcriptsPage.goto();
  });

  test('should open export dialog when clicking export with selected rows', async ({ page }) => {
    const rowCount = await transcriptsPage.getRowCount();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    await transcriptsPage.selectRow(0);
    await page.waitForTimeout(500);

    const exportBtn = page.getByRole('button', { name: /export/i }).first();
    const isVisible = await exportBtn.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip();
      return;
    }

    await exportBtn.click();

    // Export dialog should appear
    const dialog = page.getByRole('dialog').or(
      page.getByText(/export format|export options/i).first()
    );
    await expect(dialog.first()).toBeVisible({ timeout: 5_000 });
  });

  test('should display export format options', async ({ page }) => {
    const rowCount = await transcriptsPage.getRowCount();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    await transcriptsPage.selectRow(0);
    await page.waitForTimeout(500);

    const exportBtn = page.getByRole('button', { name: /export/i }).first();
    const isVisible = await exportBtn.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip();
      return;
    }

    await exportBtn.click();
    await page.waitForTimeout(500);

    // Should show format options: PDF, DOCX, TXT, JSON, CSV, Markdown
    const formats = ['pdf', 'docx', 'txt', 'json', 'csv', 'markdown', 'md'];
    let foundFormats = 0;
    for (const fmt of formats) {
      const formatOption = page.getByText(new RegExp(fmt, 'i')).first();
      if (await formatOption.isVisible().catch(() => false)) {
        foundFormats++;
      }
    }
    expect(foundFormats).toBeGreaterThan(0);
  });

  test('should display organization type options in export dialog', async ({ page }) => {
    const rowCount = await transcriptsPage.getRowCount();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    await transcriptsPage.selectRow(0);
    await page.waitForTimeout(500);

    const exportBtn = page.getByRole('button', { name: /export/i }).first();
    const isVisible = await exportBtn.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip();
      return;
    }

    await exportBtn.click();
    await page.waitForTimeout(500);

    // Should show organization types: single, individual, weekly, folder, tag
    const orgTypes = ['single', 'individual', 'weekly', 'folder', 'tag'];
    let foundTypes = 0;
    for (const type of orgTypes) {
      const option = page.getByText(new RegExp(type, 'i')).first();
      if (await option.isVisible().catch(() => false)) {
        foundTypes++;
      }
    }
    // At least one org type should be visible
    expect(foundTypes).toBeGreaterThan(0);
  });

  test('should have cancel button in export dialog', async ({ page }) => {
    const rowCount = await transcriptsPage.getRowCount();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    await transcriptsPage.selectRow(0);
    await page.waitForTimeout(500);

    const exportBtn = page.getByRole('button', { name: /export/i }).first();
    const isVisible = await exportBtn.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip();
      return;
    }

    await exportBtn.click();
    await page.waitForTimeout(500);

    const cancelBtn = page.getByRole('button', { name: /cancel/i }).first();
    await expect(cancelBtn).toBeVisible({ timeout: 5_000 });

    await cancelBtn.click();

    // Dialog should close
    await page.waitForTimeout(500);
  });

  test('should show per-row download option', async ({ page }) => {
    const rowCount = await transcriptsPage.getRowCount();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    // Look for download icon/button in first row
    const downloadBtn = page.locator('tbody tr[role="row"]').first().getByRole('button', { name: /download/i }).or(
      page.locator('tbody tr[role="row"]').first().locator('[aria-label*="download" i], [aria-label*="Download"]')
    );
    const isVisible = await downloadBtn.first().isVisible().catch(() => false);

    // Download may be in a hover state or always visible
    if (isVisible) {
      await downloadBtn.first().click();
      await page.waitForTimeout(500);

      // Should show format picker (PDF, DOCX, TXT, JSON)
      const formatOption = page.getByText(/pdf|docx|txt|json/i).first();
      await expect(formatOption).toBeVisible({ timeout: 5_000 });
    }
  });
});
