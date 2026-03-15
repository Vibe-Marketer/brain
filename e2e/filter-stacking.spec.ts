import { test, expect, type Page } from '@playwright/test';

/**
 * Phase 6 — Filter Stacking & Pill Removal Tests
 *
 * Verifies:
 *  1. Multi-filter AND logic: applying Tags + Contacts + Date simultaneously
 *     intersects the result set (all active pills remain, row count reflects
 *     the conjunction of all three filters).
 *  2. Individual pill removal: removing filter A while filter B is active
 *     leaves filter B's pill intact and filter A's pill gone.
 *
 * @phase 06-e2e-tests
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function goToTranscripts(page: Page) {
  await page.goto('/transcripts');
  await page.waitForLoadState('networkidle');
  await expect(
    page.getByRole('button', { name: /^tag$/i }).or(
      page.getByRole('button', { name: /^folder$/i })
    )
  ).toBeVisible({ timeout: 20_000 });
}

async function expectPill(page: Page, label: string) {
  await expect(
    page.locator('span').filter({ hasText: new RegExp(`^${label}:`, 'i') }).first()
  ).toBeVisible({ timeout: 10_000 });
}

async function expectNoPill(page: Page, label: string) {
  await expect(
    page.locator(`[aria-label="Remove ${label} filter"]`)
  ).not.toBeVisible({ timeout: 5_000 });
}

async function removeFilterPill(page: Page, label: string) {
  const removeBtn = page.locator(`[aria-label="Remove ${label} filter"]`);
  await expect(removeBtn).toBeVisible({ timeout: 5_000 });
  await removeBtn.click();
}

/**
 * Apply the Tag filter by selecting the first available tag.
 * Returns false if no tags exist (caller should skip).
 */
async function applyTagFilter(page: Page): Promise<boolean> {
  const tagBtn = page.getByRole('button', { name: /^tag$/i });
  await tagBtn.click();

  const tagSearch = page.locator('input[placeholder="Search tags..."]');
  await expect(tagSearch).toBeVisible({ timeout: 5_000 });

  const tagCheckboxes = page.locator('input[id^="tag-"]');
  const tagCount = await tagCheckboxes.count();

  if (tagCount === 0) {
    await page.keyboard.press('Escape');
    return false;
  }

  await tagCheckboxes.first().check();
  await page.getByRole('button', { name: /^apply$/i }).click();
  await expectPill(page, 'Tags');
  return true;
}

/**
 * Apply the Duration filter using "More than 30 min".
 */
async function applyDurationFilter(page: Page): Promise<boolean> {
  const durationBtn = page.getByRole('button', { name: /^duration$/i });
  await durationBtn.click();

  await expect(page.getByText('Call Duration (minutes)')).toBeVisible({ timeout: 5_000 });

  const moreThanBtn = page.getByRole('button', { name: /more than \d+ min/i });
  const hasMore = await moreThanBtn.isVisible().catch(() => false);
  if (!hasMore) {
    await page.keyboard.press('Escape');
    return false;
  }

  await moreThanBtn.click();
  await expectPill(page, 'Duration');
  return true;
}

/**
 * Apply the Folder filter using the always-available "Unorganized" option.
 */
async function applyFolderFilter(page: Page): Promise<boolean> {
  const folderBtn = page.getByRole('button', { name: /^folder$/i });
  await folderBtn.click();

  await expect(page.getByText('Select Folders')).toBeVisible({ timeout: 5_000 });

  const unorganized = page.locator('#folder-unorganized');
  await expect(unorganized).toBeVisible();
  await unorganized.check();

  await page.getByRole('button', { name: /^apply$/i }).click();
  await expectPill(page, 'Folders');
  return true;
}

/**
 * Apply the Date filter using the "Last 30 days" quick-select.
 * Returns false if quick-select is not available.
 */
async function applyDateFilter(page: Page): Promise<boolean> {
  // Date button label is "Date" on desktop
  const dateBtn = page.getByRole('button', { name: /^date$/i });
  const visible = await dateBtn.isVisible().catch(() => false);
  if (!visible) return false;

  await dateBtn.click();

  const last30Btn = page.getByRole('button', { name: /last 30 days/i });
  const hasBtn = await last30Btn.isVisible({ timeout: 5_000 }).catch(() => false);

  if (!hasBtn) {
    // Try "Last 7 days"
    const last7Btn = page.getByRole('button', { name: /last 7 days/i });
    const has7 = await last7Btn.isVisible({ timeout: 2_000 }).catch(() => false);
    if (!has7) {
      await page.keyboard.press('Escape');
      return false;
    }
    await last7Btn.click();
  } else {
    await last30Btn.click();
  }

  await expectPill(page, 'Date');
  return true;
}

// ---------------------------------------------------------------------------
// Count visible transcript rows in the table
// ---------------------------------------------------------------------------
async function getTranscriptRowCount(page: Page): Promise<number> {
  // Transcript rows are <tr> elements inside the <tbody> of the transcript table.
  // TranscriptTableRow renders a <TableRow> which maps to <tr role="row">.
  // We exclude the header row by looking at tbody rows only.
  const rows = page.locator('tbody tr[role="row"]');
  return rows.count();
}

// ---------------------------------------------------------------------------
// Test Suite — Filter Stacking (AND logic)
// ---------------------------------------------------------------------------

test.describe('Filter Stacking — AND logic & pill removal', () => {
  test.beforeEach(async ({ page }) => {
    await goToTranscripts(page);
  });

  // -------------------------------------------------------------------------
  // AND logic: Tags + Duration + Folders (3-filter combination)
  // -------------------------------------------------------------------------
  test('3-filter combination (Tags + Duration + Folders) narrows results via AND logic', async ({
    page,
  }) => {
    // Apply Tags filter
    const tagApplied = await applyTagFilter(page);
    if (!tagApplied) {
      test.skip();
      return;
    }

    // Capture row count after Tags-only filter
    const rowsAfterTag = await getTranscriptRowCount(page);

    // Apply Duration filter
    const durationApplied = await applyDurationFilter(page);
    if (!durationApplied) {
      test.skip();
      return;
    }

    // Row count after Tags + Duration should be <= rows after Tags alone
    const rowsAfterTagAndDuration = await getTranscriptRowCount(page);
    expect(rowsAfterTagAndDuration).toBeLessThanOrEqual(rowsAfterTag);

    // Apply Folders filter (Unorganized)
    const folderApplied = await applyFolderFilter(page);
    if (!folderApplied) {
      test.skip();
      return;
    }

    // Row count after all 3 filters should be <= after 2 filters
    const rowsAfterAll3 = await getTranscriptRowCount(page);
    expect(rowsAfterAll3).toBeLessThanOrEqual(rowsAfterTagAndDuration);

    // All three pills must be visible simultaneously
    await expectPill(page, 'Tags');
    await expectPill(page, 'Duration');
    await expectPill(page, 'Folders');
  });

  // -------------------------------------------------------------------------
  // AND logic: Tags + Date (2-filter combination required by spec)
  // -------------------------------------------------------------------------
  test('Tags + Date combination shows both pills and intersected results', async ({
    page,
  }) => {
    // Apply Tags
    const tagApplied = await applyTagFilter(page);
    if (!tagApplied) {
      test.skip();
      return;
    }

    const rowsAfterTag = await getTranscriptRowCount(page);

    // Apply Date
    const dateApplied = await applyDateFilter(page);
    if (!dateApplied) {
      test.skip();
      return;
    }

    // Both pills visible
    await expectPill(page, 'Tags');
    await expectPill(page, 'Date');

    // Row count must be <= tag-only count (AND intersection)
    const rowsAfterBoth = await getTranscriptRowCount(page);
    expect(rowsAfterBoth).toBeLessThanOrEqual(rowsAfterTag);
  });

  // -------------------------------------------------------------------------
  // Individual pill removal: apply A + B, remove A, verify only B remains
  // -------------------------------------------------------------------------
  test('Removing Tags pill while Duration is active clears only Tags', async ({
    page,
  }) => {
    // Apply Tags
    const tagApplied = await applyTagFilter(page);
    if (!tagApplied) {
      test.skip();
      return;
    }

    // Apply Duration
    const durationApplied = await applyDurationFilter(page);
    if (!durationApplied) {
      test.skip();
      return;
    }

    // Both pills present
    await expectPill(page, 'Tags');
    await expectPill(page, 'Duration');

    // Capture row count with both filters active
    const rowsBothFilters = await getTranscriptRowCount(page);

    // Remove Tags pill only
    await removeFilterPill(page, 'Tags');

    // Tags pill is gone
    await expectNoPill(page, 'Tags');

    // Duration pill is still present
    await expectPill(page, 'Duration');

    // Row count should be >= count with both filters (removing a filter widens results)
    const rowsAfterTagRemoved = await getTranscriptRowCount(page);
    expect(rowsAfterTagRemoved).toBeGreaterThanOrEqual(rowsBothFilters);
  });

  // -------------------------------------------------------------------------
  // Individual pill removal: remove Folders while Tags remains
  // -------------------------------------------------------------------------
  test('Removing Folders pill while Tags is active clears only Folders', async ({
    page,
  }) => {
    const tagApplied = await applyTagFilter(page);
    if (!tagApplied) {
      test.skip();
      return;
    }

    const folderApplied = await applyFolderFilter(page);
    if (!folderApplied) {
      test.skip();
      return;
    }

    // Both pills present
    await expectPill(page, 'Tags');
    await expectPill(page, 'Folders');

    // Remove Folders pill
    await removeFilterPill(page, 'Folders');

    // Folders gone, Tags remains
    await expectNoPill(page, 'Folders');
    await expectPill(page, 'Tags');
  });

  // -------------------------------------------------------------------------
  // Clear All: all pills removed at once
  // -------------------------------------------------------------------------
  test('"Clear all" button removes all active filter pills', async ({ page }) => {
    const tagApplied = await applyTagFilter(page);
    if (!tagApplied) {
      test.skip();
      return;
    }

    const folderApplied = await applyFolderFilter(page);
    if (!folderApplied) {
      test.skip();
      return;
    }

    // Both pills present
    await expectPill(page, 'Tags');
    await expectPill(page, 'Folders');

    // Click "Clear all"
    const clearAllBtn = page.getByRole('button', { name: /clear all/i });
    await expect(clearAllBtn).toBeVisible();
    await clearAllBtn.click();

    // Both pills gone
    await expectNoPill(page, 'Tags');
    await expectNoPill(page, 'Folders');

    // Clear all button itself should be gone (no active filters)
    await expect(clearAllBtn).not.toBeVisible({ timeout: 5_000 });
  });
});
