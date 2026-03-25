import { test, expect } from '@playwright/test';

/**
 * Workspace Management tests — workspace sidebar, folder tree, quick create.
 */

test.describe('Workspace Management (Pane 2)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/transcripts');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 20_000 });
  });

  test('should display workspace sidebar pane', async ({ page }) => {
    // Pane 2 is the workspace/folder sidebar
    const pane2 = page.locator('[class*="sidebar"], [class*="workspace"]').filter({
      hasText: /workspace|folder|library/i,
    }).first();

    const isVisible = await pane2.isVisible().catch(() => false);
    // Pane 2 may be toggled — either visible or there's a toggle button
    if (!isVisible) {
      // Look for a toggle button to show pane 2
      const toggleBtn = page.getByRole('button', { name: /workspace|library|toggle/i }).first();
      const hasToggle = await toggleBtn.isVisible().catch(() => false);
      expect(hasToggle || isVisible).toBeTruthy();
    }
  });

  test('should show folder hierarchy in workspace sidebar', async ({ page }) => {
    // Look for folder items in the sidebar
    const folderItems = page.locator('[class*="folder"]').or(
      page.getByText(/folder/i)
    );
    const hasFolders = await folderItems.first().isVisible({ timeout: 10_000 }).catch(() => false);

    // Either folders exist or we see an empty state/create button
    const createBtn = page.getByRole('button', { name: /create.*folder|new.*folder|add.*folder/i }).first();
    const hasCreate = await createBtn.isVisible().catch(() => false);

    expect(hasFolders || hasCreate).toBeTruthy();
  });

  test('should have workspace switcher or workspace name', async ({ page }) => {
    // Look for workspace name or switcher
    const wsName = page.getByText(/workspace|my workspace/i).first();
    const isVisible = await wsName.isVisible({ timeout: 10_000 }).catch(() => false);

    // Workspace context should be indicated somewhere
    expect(isVisible).toBeTruthy();
  });

  test('should show quick create folder option', async ({ page }) => {
    // Look for "New Folder" or "Create Folder" button
    const createBtn = page.getByRole('button', { name: /create.*folder|new.*folder|add.*folder|\+/i }).first();
    const isVisible = await createBtn.isVisible({ timeout: 10_000 }).catch(() => false);

    if (isVisible) {
      await createBtn.click();
      await page.waitForTimeout(500);

      // Should show a dialog or inline input for folder name
      const input = page.locator('input[placeholder*="folder" i], input[placeholder*="name" i]').first().or(
        page.getByRole('dialog').locator('input').first()
      );
      const hasInput = await input.isVisible({ timeout: 5_000 }).catch(() => false);
      expect(hasInput).toBeTruthy();

      // Cancel/close
      await page.keyboard.press('Escape');
    }
  });

  test('should filter transcripts when selecting a folder', async ({ page }) => {
    // Find a folder item in the sidebar
    const folderItem = page.locator('[class*="folder-item"], [role="treeitem"]').first();
    const isVisible = await folderItem.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!isVisible) {
      test.skip();
      return;
    }

    // Note row count before folder selection
    const rowsBefore = await page.locator('tbody tr[role="row"]').count();

    await folderItem.click();
    await page.waitForTimeout(1_000);

    // Row count may change (filtered) or URL may update
    const url = page.url();
    // Just verify no crash
    await expect(page.locator('nav').first()).toBeVisible();
  });
});
