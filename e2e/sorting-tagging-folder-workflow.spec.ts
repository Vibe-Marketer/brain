import { test, expect, type Page } from '@playwright/test';

/**
 * E2E test for the complete folder workflow in the SortingTagging page.
 *
 * This test covers the full CRUD lifecycle:
 * 1. Navigate to the Sorting & Tagging page (Folders tab)
 * 2. Create a new folder
 * 3. Select the folder in the list
 * 4. Verify the right detail panel opens
 * 5. Edit the folder in the detail panel
 * 6. Verify changes are persisted
 * 7. Test inline rename via double-click
 * 8. Test keyboard shortcuts (Cmd+E for edit, Cmd+Backspace for delete)
 * 9. Delete the folder via the detail panel
 * 10. Verify folder is removed from the list
 */

test.describe('Folder Workflow', () => {
  const testFolderName = `E2E Test Folder ${Date.now()}`;
  const updatedFolderName = `Updated ${testFolderName}`;
  const inlineRenamedName = `Inline Renamed ${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    // Navigate to the sorting-tagging page with folders tab active
    await page.goto('/sorting-tagging');

    // Wait for the page to load and folders tab to be visible
    await expect(page.getByRole('tab', { name: /folders/i })).toBeVisible();

    // Click the Folders tab to ensure we're on the right tab
    await page.getByRole('tab', { name: /folders/i }).click();

    // Wait for content to load (either folder list or empty state)
    await expect(
      page.locator('table').or(page.getByText(/no folders yet/i))
    ).toBeVisible({ timeout: 10000 });
  });

  test('should create a new folder via the Create Folder button', async ({ page }) => {
    // Click the "Create Folder" button
    const createButton = page.getByRole('button', { name: /create folder/i }).first();
    await expect(createButton).toBeVisible();
    await createButton.click();

    // Wait for the dialog to appear
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Fill in the folder name
    const nameInput = dialog.getByLabel(/folder name/i);
    await nameInput.fill(testFolderName);

    // Submit the form (click Create button in dialog)
    const submitButton = dialog.getByRole('button', { name: /create/i });
    await submitButton.click();

    // Wait for dialog to close
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Verify the new folder appears in the list
    await expect(page.getByText(testFolderName)).toBeVisible({ timeout: 5000 });
  });

  test('should open detail panel when clicking a folder row', async ({ page }) => {
    // First, ensure there's at least one folder to click
    await ensureFolderExists(page, testFolderName);

    // Find and click the folder row
    const folderRow = page.getByRole('row').filter({ hasText: testFolderName });
    await folderRow.click();

    // Verify the right panel opens with folder details
    const detailPanel = page.getByRole('region', { name: /folder details/i });
    await expect(detailPanel).toBeVisible({ timeout: 5000 });

    // Verify the panel shows the correct folder name
    await expect(detailPanel.getByText(testFolderName)).toBeVisible();
  });

  test('should edit folder in the detail panel', async ({ page }) => {
    // Ensure folder exists and open detail panel
    await ensureFolderExists(page, testFolderName);

    // Click the folder to open detail panel
    const folderRow = page.getByRole('row').filter({ hasText: testFolderName });
    await folderRow.click();

    // Wait for detail panel to open
    const detailPanel = page.getByRole('region', { name: /folder details/i });
    await expect(detailPanel).toBeVisible({ timeout: 5000 });

    // Edit the folder name in the panel
    const nameInput = detailPanel.getByLabel(/folder name/i);
    await nameInput.clear();
    await nameInput.fill(updatedFolderName);

    // Click Save Changes button
    const saveButton = detailPanel.getByRole('button', { name: /save changes/i });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // Wait for save to complete (button should say "Saving..." briefly then back to "Save Changes")
    await expect(saveButton).not.toContainText(/saving/i, { timeout: 5000 });

    // Verify the folder name is updated in the list
    await expect(page.getByText(updatedFolderName)).toBeVisible({ timeout: 5000 });
  });

  test('should rename folder inline via double-click', async ({ page }) => {
    // Ensure folder exists
    const folderName = await ensureFolderExists(page, `Double Click Test ${Date.now()}`);

    // Find the folder row and double-click on the name to start inline edit
    const folderRow = page.getByRole('row').filter({ hasText: folderName });
    const folderNameSpan = folderRow.locator('span.font-medium').first();
    await folderNameSpan.dblclick();

    // An input should appear for inline editing
    const inlineInput = folderRow.getByRole('textbox');
    await expect(inlineInput).toBeVisible({ timeout: 3000 });

    // Clear and type new name
    await inlineInput.fill(inlineRenamedName);

    // Press Enter to save
    await inlineInput.press('Enter');

    // Verify the renamed folder appears in the list
    await expect(page.getByText(inlineRenamedName)).toBeVisible({ timeout: 5000 });
  });

  test('should cancel inline rename with Escape key', async ({ page }) => {
    const originalName = `Escape Test ${Date.now()}`;
    await ensureFolderExists(page, originalName);

    // Find folder row and start inline edit
    const folderRow = page.getByRole('row').filter({ hasText: originalName });
    const folderNameSpan = folderRow.locator('span.font-medium').first();
    await folderNameSpan.dblclick();

    // Type a different name
    const inlineInput = folderRow.getByRole('textbox');
    await expect(inlineInput).toBeVisible();
    await inlineInput.fill('This should not be saved');

    // Press Escape to cancel
    await inlineInput.press('Escape');

    // Verify original name is still shown
    await expect(page.getByText(originalName)).toBeVisible();
  });

  test('should use keyboard shortcut Cmd+N to open create dialog', async ({ page }) => {
    // Press Cmd+N (or Ctrl+N on Windows/Linux)
    await page.keyboard.press('Meta+n');

    // The create folder dialog should open
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // Close the dialog
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('should use keyboard shortcut Cmd+E to edit selected folder', async ({ page }) => {
    const folderName = await ensureFolderExists(page, `Edit Shortcut Test ${Date.now()}`);

    // Click folder to select it
    const folderRow = page.getByRole('row').filter({ hasText: folderName });
    await folderRow.click();

    // Wait for detail panel
    const detailPanel = page.getByRole('region', { name: /folder details/i });
    await expect(detailPanel).toBeVisible();

    // Press Cmd+E to trigger edit mode (starts inline rename)
    await page.keyboard.press('Meta+e');

    // Check that inline editing started (input should be visible in the row)
    const inlineInput = folderRow.getByRole('textbox');
    await expect(inlineInput).toBeVisible({ timeout: 3000 });

    // Cancel the edit
    await inlineInput.press('Escape');
  });

  test('should use keyboard shortcut Cmd+Backspace to delete selected folder', async ({ page }) => {
    const folderName = await ensureFolderExists(page, `Delete Shortcut Test ${Date.now()}`);

    // Click folder to select it
    const folderRow = page.getByRole('row').filter({ hasText: folderName });
    await folderRow.click();

    // Wait for detail panel to confirm selection
    const detailPanel = page.getByRole('region', { name: /folder details/i });
    await expect(detailPanel).toBeVisible();

    // Press Cmd+Backspace to trigger delete confirmation
    await page.keyboard.press('Meta+Backspace');

    // Delete confirmation dialog should appear
    const deleteDialog = page.getByRole('alertdialog');
    await expect(deleteDialog).toBeVisible({ timeout: 3000 });

    // Cancel the delete
    await deleteDialog.getByRole('button', { name: /cancel/i }).click();
    await expect(deleteDialog).not.toBeVisible();

    // Folder should still exist
    await expect(page.getByText(folderName)).toBeVisible();
  });

  test('should delete folder from detail panel', async ({ page }) => {
    const folderName = await ensureFolderExists(page, `Delete Panel Test ${Date.now()}`);

    // Click folder to open detail panel
    const folderRow = page.getByRole('row').filter({ hasText: folderName });
    await folderRow.click();

    // Wait for detail panel
    const detailPanel = page.getByRole('region', { name: /folder details/i });
    await expect(detailPanel).toBeVisible();

    // Click the Delete Folder button in the panel
    const deleteButton = detailPanel.getByRole('button', { name: /delete folder/i });
    await deleteButton.click();

    // Confirmation dialog should appear
    const confirmDialog = page.getByRole('alertdialog');
    await expect(confirmDialog).toBeVisible();

    // Click Delete in the confirmation dialog
    const confirmDeleteButton = confirmDialog.getByRole('button', { name: /delete/i }).last();
    await confirmDeleteButton.click();

    // Dialog should close
    await expect(confirmDialog).not.toBeVisible({ timeout: 5000 });

    // Detail panel should close
    await expect(detailPanel).not.toBeVisible({ timeout: 5000 });

    // Folder should no longer be in the list
    await expect(page.getByText(folderName)).not.toBeVisible();
  });

  test('should use context menu for folder actions', async ({ page }) => {
    const folderName = await ensureFolderExists(page, `Context Menu Test ${Date.now()}`);

    // Find the folder row
    const folderRow = page.getByRole('row').filter({ hasText: folderName });

    // Right-click to open context menu
    await folderRow.click({ button: 'right' });

    // Context menu should appear with options
    const contextMenu = page.getByRole('menu');
    await expect(contextMenu).toBeVisible({ timeout: 3000 });

    // Verify menu options exist
    await expect(contextMenu.getByRole('menuitem', { name: /rename/i })).toBeVisible();
    await expect(contextMenu.getByRole('menuitem', { name: /duplicate/i })).toBeVisible();
    await expect(contextMenu.getByRole('menuitem', { name: /delete/i })).toBeVisible();

    // Click elsewhere to close the menu
    await page.keyboard.press('Escape');
  });

  test('should duplicate folder via context menu', async ({ page }) => {
    const originalName = `Original Folder ${Date.now()}`;
    await ensureFolderExists(page, originalName);

    // Find and right-click the folder
    const folderRow = page.getByRole('row').filter({ hasText: originalName });
    await folderRow.click({ button: 'right' });

    // Click Duplicate option
    const contextMenu = page.getByRole('menu');
    await contextMenu.getByRole('menuitem', { name: /duplicate/i }).click();

    // A new folder with "Copy of" prefix should appear
    await expect(page.getByText(`Copy of ${originalName}`)).toBeVisible({ timeout: 5000 });
  });

  test('should close detail panel with Escape key', async ({ page }) => {
    const folderName = await ensureFolderExists(page, `Escape Close Test ${Date.now()}`);

    // Click folder to open detail panel
    const folderRow = page.getByRole('row').filter({ hasText: folderName });
    await folderRow.click();

    // Wait for detail panel
    const detailPanel = page.getByRole('region', { name: /folder details/i });
    await expect(detailPanel).toBeVisible();

    // Press Escape to close the panel
    await page.keyboard.press('Escape');

    // Panel should close
    await expect(detailPanel).not.toBeVisible({ timeout: 3000 });
  });

  test('should show selection highlighting on folder row', async ({ page }) => {
    const folderName = await ensureFolderExists(page, `Selection Test ${Date.now()}`);

    // Click folder to select it
    const folderRow = page.getByRole('row').filter({ hasText: folderName });
    await folderRow.click();

    // Verify row has selection highlighting (check for bg class change)
    await expect(folderRow).toHaveClass(/bg-cb-hover/);
  });

  test('should navigate folder list with arrow keys', async ({ page }) => {
    // Create two folders for navigation
    const folder1 = await ensureFolderExists(page, `Arrow Nav 1 ${Date.now()}`);
    const folder2 = await ensureFolderExists(page, `Arrow Nav 2 ${Date.now()}`);

    // Click first folder to give focus to the list
    const folder1Row = page.getByRole('row').filter({ hasText: folder1 });
    await folder1Row.click();

    // Press down arrow to move to next folder
    await page.keyboard.press('ArrowDown');

    // The next folder should have focus indication (ring class)
    const folder2Row = page.getByRole('row').filter({ hasText: folder2 });
    await expect(folder2Row).toHaveClass(/ring-vibe-orange/);

    // Press Enter to select and open detail panel
    await page.keyboard.press('Enter');

    // Detail panel should open with folder2
    const detailPanel = page.getByRole('region', { name: /folder details/i });
    await expect(detailPanel).toBeVisible();
    await expect(detailPanel.getByText(folder2)).toBeVisible();
  });

  test('should pin detail panel', async ({ page }) => {
    const folderName = await ensureFolderExists(page, `Pin Test ${Date.now()}`);

    // Click folder to open detail panel
    const folderRow = page.getByRole('row').filter({ hasText: folderName });
    await folderRow.click();

    // Wait for detail panel
    const detailPanel = page.getByRole('region', { name: /folder details/i });
    await expect(detailPanel).toBeVisible();

    // Find and click the pin button
    const pinButton = detailPanel.getByRole('button', { name: /pin panel/i });
    await pinButton.click();

    // Pin button should now show as pressed/pinned
    await expect(pinButton).toHaveAttribute('aria-pressed', 'true');
  });

  test('should display folder statistics in detail panel', async ({ page }) => {
    const folderName = await ensureFolderExists(page, `Stats Test ${Date.now()}`);

    // Click folder to open detail panel
    const folderRow = page.getByRole('row').filter({ hasText: folderName });
    await folderRow.click();

    // Wait for detail panel
    const detailPanel = page.getByRole('region', { name: /folder details/i });
    await expect(detailPanel).toBeVisible();

    // Verify statistics are displayed
    const statsGroup = detailPanel.getByRole('group', { name: /folder statistics/i });
    await expect(statsGroup).toBeVisible();

    // Check for Calls stat
    await expect(statsGroup.getByText(/calls/i)).toBeVisible();

    // Check for Created stat
    await expect(statsGroup.getByText(/created/i)).toBeVisible();
  });
});

/**
 * Helper function to ensure a folder exists before running a test.
 * Creates the folder if it doesn't exist and returns the folder name.
 */
async function ensureFolderExists(page: Page, folderName: string): Promise<string> {
  // Check if folder already exists
  const existingFolder = page.getByText(folderName);

  try {
    await existingFolder.waitFor({ state: 'visible', timeout: 2000 });
    return folderName;
  } catch {
    // Folder doesn't exist, create it
    const createButton = page.getByRole('button', { name: /create folder/i }).first();
    await createButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const nameInput = dialog.getByLabel(/folder name/i);
    await nameInput.fill(folderName);

    const submitButton = dialog.getByRole('button', { name: /create/i });
    await submitButton.click();

    await expect(dialog).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText(folderName)).toBeVisible({ timeout: 5000 });

    return folderName;
  }
}
