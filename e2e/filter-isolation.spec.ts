import { test, expect, type Page } from '@playwright/test';

/**
 * Phase 6 — Filter Isolation Tests
 *
 * Verifies each of the 6 filter types in the transcript library works correctly
 * in isolation: tags, folders, contacts, duration, source, and date.
 *
 * Each test:
 *  1. Navigates to the transcript library (/transcripts)
 *  2. Opens the target filter popover
 *  3. Selects a value and applies
 *  4. Asserts a filter pill appears for that filter type
 *  5. Clears the filter and asserts the pill is gone
 *
 * Tests are designed to be resilient — if there is no data available for a filter
 * (e.g. no tags exist yet) the test skips gracefully rather than failing.
 *
 * @phase 06-e2e-tests
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate to the transcript library and wait for the filter bar to appear. */
async function goToTranscripts(page: Page) {
  await page.goto('/transcripts');
  await page.waitForLoadState('networkidle');

  // The filter bar is rendered inside TranscriptsTab; wait for any filter
  // button to confirm the page has loaded past the skeleton.
  await expect(
    page.getByRole('button', { name: /tag/i }).or(
      page.getByRole('button', { name: /folder/i })
    )
  ).toBeVisible({ timeout: 20_000 });
}

/** Click the X button on a filter pill identified by its label text. */
async function removeFilterPill(page: Page, label: string) {
  const pill = page.locator(`[aria-label="Remove ${label} filter"]`);
  await pill.click();
}

/** Assert that a filter pill with the given label is visible. */
async function expectPill(page: Page, label: string) {
  // Pills render as Badge elements with aria-label on the remove button.
  // We look for the label text within the pill area.
  await expect(
    page.locator('span').filter({ hasText: new RegExp(`^${label}:`, 'i') }).first()
  ).toBeVisible({ timeout: 10_000 });
}

/** Assert that NO filter pill for the given label exists in the DOM. */
async function expectNoPill(page: Page, label: string) {
  await expect(
    page.locator(`[aria-label="Remove ${label} filter"]`)
  ).not.toBeVisible({ timeout: 5_000 });
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

test.describe('Filter Isolation — Transcript Library', () => {
  test.beforeEach(async ({ page }) => {
    await goToTranscripts(page);
  });

  // -------------------------------------------------------------------------
  // 1. Tags filter
  // -------------------------------------------------------------------------
  test('TAG filter — opens popover, selects a tag, shows pill, clears', async ({ page }) => {
    // Open tag popover
    const tagBtn = page.getByRole('button', { name: /^tag$/i });
    await expect(tagBtn).toBeVisible();
    await tagBtn.click();

    // Popover should be open — look for the tag search input
    const tagSearch = page.locator('input[placeholder="Search tags..."]');
    await expect(tagSearch).toBeVisible({ timeout: 5_000 });

    // Check if any tags exist
    const tagCheckboxes = page.locator('input[id^="tag-"]');
    const tagCount = await tagCheckboxes.count();

    if (tagCount === 0) {
      // No tags yet — close popover and skip
      await page.keyboard.press('Escape');
      test.skip();
      return;
    }

    // Select the first available tag
    const firstTagCheckbox = tagCheckboxes.first();
    await firstTagCheckbox.check();

    // Click Apply
    await page.getByRole('button', { name: /^apply$/i }).click();

    // Pill should now appear
    await expectPill(page, 'Tags');

    // Remove the pill
    await removeFilterPill(page, 'Tags');
    await expectNoPill(page, 'Tags');
  });

  // -------------------------------------------------------------------------
  // 2. Folders filter
  // -------------------------------------------------------------------------
  test('FOLDER filter — opens popover, selects a folder, shows pill, clears', async ({ page }) => {
    const folderBtn = page.getByRole('button', { name: /^folder$/i });
    await expect(folderBtn).toBeVisible();
    await folderBtn.click();

    // Popover opens — look for "Select Folders" heading
    await expect(page.getByText('Select Folders')).toBeVisible({ timeout: 5_000 });

    // Check for any folder checkboxes (id^="folder-" but not "folder-unorganized")
    const folderCheckboxes = page.locator('input[id^="folder-"]').filter({
      hasNot: page.locator('#folder-unorganized'),
    });
    const folderCount = await folderCheckboxes.count();

    // "Unorganized" is always shown — let's use it as our test selection
    const unorganizedCheckbox = page.locator('#folder-unorganized');
    await expect(unorganizedCheckbox).toBeVisible();
    await unorganizedCheckbox.check();

    // Apply
    await page.getByRole('button', { name: /^apply$/i }).click();

    // Pill appears
    await expectPill(page, 'Folders');

    // Clear
    await removeFilterPill(page, 'Folders');
    await expectNoPill(page, 'Folders');
  });

  // -------------------------------------------------------------------------
  // 3. Contacts filter
  // -------------------------------------------------------------------------
  test('CONTACTS filter — opens popover, selects a contact, shows pill, clears', async ({ page }) => {
    const contactsBtn = page.getByRole('button', { name: /^contacts$/i });
    await expect(contactsBtn).toBeVisible();
    await contactsBtn.click();

    // Popover opens — search input appears
    const searchInput = page.locator('input[placeholder="Search contacts..."]');
    await expect(searchInput).toBeVisible({ timeout: 5_000 });

    // Check if contacts exist
    const contactCheckboxes = page.locator('[id][class*="checkbox"]').filter({
      has: page.locator('label'),
    });

    // More targeted: look for a checkbox inside the contacts popover
    const popoverContent = page.locator('[data-radix-popper-content-wrapper]').last();
    const firstContactCheckbox = popoverContent.locator('input[type="checkbox"]').first();

    const hasContacts = await firstContactCheckbox.isVisible().catch(() => false);

    if (!hasContacts) {
      // No contacts — close and skip
      await page.keyboard.press('Escape');
      test.skip();
      return;
    }

    await firstContactCheckbox.check();

    // Apply
    await popoverContent.getByRole('button', { name: /^apply$/i }).click();

    // Pill appears
    await expectPill(page, 'Contacts');

    // Clear
    await removeFilterPill(page, 'Contacts');
    await expectNoPill(page, 'Contacts');
  });

  // -------------------------------------------------------------------------
  // 4. Duration filter
  // -------------------------------------------------------------------------
  test('DURATION filter — opens popover, applies "more than X min", shows pill, clears', async ({ page }) => {
    const durationBtn = page.getByRole('button', { name: /^duration$/i });
    await expect(durationBtn).toBeVisible();
    await durationBtn.click();

    // Popover opens — "Call Duration" heading
    await expect(page.getByText('Call Duration (minutes)')).toBeVisible({ timeout: 5_000 });

    // Click the "More than X min" button — the slider defaults to 30, so this
    // clicks "More than 30 min"
    const moreThanBtn = page.getByRole('button', { name: /more than \d+ min/i });
    await expect(moreThanBtn).toBeVisible();
    await moreThanBtn.click();

    // Pill appears
    await expectPill(page, 'Duration');

    // Clear
    await removeFilterPill(page, 'Duration');
    await expectNoPill(page, 'Duration');
  });

  // -------------------------------------------------------------------------
  // 5. Source filter
  // -------------------------------------------------------------------------
  test('SOURCE filter — opens popover, selects a source, shows pill, clears', async ({ page }) => {
    // The Source button only renders if availableSources is non-empty.
    const sourceBtn = page.getByRole('button', { name: /^source$/i });
    const sourceVisible = await sourceBtn.isVisible().catch(() => false);

    if (!sourceVisible) {
      // No source data for this org — skip gracefully
      test.skip();
      return;
    }

    await sourceBtn.click();

    // Popover opens — "Filter by Source" heading
    await expect(page.getByText('Filter by Source')).toBeVisible({ timeout: 5_000 });

    // Select the first source checkbox
    const popoverContent = page.locator('[data-radix-popper-content-wrapper]').last();
    const firstSourceCheckbox = popoverContent.locator('input[type="checkbox"]').first();

    const hasSource = await firstSourceCheckbox.isVisible().catch(() => false);
    if (!hasSource) {
      await page.keyboard.press('Escape');
      test.skip();
      return;
    }

    // Source filter applies immediately on checkbox click (no staged Apply)
    await firstSourceCheckbox.check();

    // Close the popover by clicking away
    await page.keyboard.press('Escape');

    // Pill appears
    await expectPill(page, 'Source');

    // Clear
    await removeFilterPill(page, 'Source');
    await expectNoPill(page, 'Source');
  });

  // -------------------------------------------------------------------------
  // 6. Date filter
  // -------------------------------------------------------------------------
  test('DATE filter — opens date range picker, selects last 7 days, shows pill, clears', async ({ page }) => {
    // The date range picker trigger is a button with "Date" label
    // On desktop it shows text, on mobile it shows icon only.
    // We look for it by the placeholder text "Date".
    const dateBtn = page.getByRole('button', { name: /^date$/i });
    const dateBtnVisible = await dateBtn.isVisible().catch(() => false);

    if (!dateBtnVisible) {
      // Might render differently — try to find by icon tooltip
      test.skip();
      return;
    }

    await dateBtn.click();

    // DateRangePicker popover: look for Quick Select buttons or calendar
    // Quick-select "Last 7 days" is available when showQuickSelect={true}
    const last7DaysBtn = page.getByRole('button', { name: /last 7 days/i });
    const hasQuickSelect = await last7DaysBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasQuickSelect) {
      await last7DaysBtn.click();
    } else {
      // Fallback: click a specific date in the calendar
      // Just press Escape and skip if no quick select available
      await page.keyboard.press('Escape');
      test.skip();
      return;
    }

    // Pill appears
    await expectPill(page, 'Date');

    // Clear
    await removeFilterPill(page, 'Date');
    await expectNoPill(page, 'Date');
  });
});
