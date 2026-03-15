import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Phase 6 — Org Isolation Tests
 *
 * Verifies that data from one org does not appear in another org's:
 *  - Tags filter popover
 *  - Folders filter popover
 *  - Contacts filter popover
 *  - Transcript table search results
 *
 * Strategy:
 *   1. Log in as the single test user (stored auth state from auth.setup.ts).
 *   2. Open the org switcher to discover all orgs available to this user.
 *   3. If only one org is found, skip gracefully.
 *   4. Switch to Org B (the second org), collect its tags/folders/contacts/titles.
 *   5. Switch back to Org A (the first org), collect the same data.
 *   6. Assert that Org A's filter popovers and search results contain ZERO
 *      items from Org B's data.
 *
 * Auth:
 *   Uses the storageState from playwright/.auth/user.json (produced by
 *   auth.setup.ts). No second set of credentials is needed.
 *
 * @phase 06-e2e-tests
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate to /transcripts and wait for the filter bar to load. */
async function goToTranscripts(page: import('@playwright/test').Page) {
  await page.goto('/transcripts');
  await page.waitForLoadState('networkidle');
  // Wait for at least one of the filter buttons to be visible
  await expect(
    page.getByRole('button', { name: /^tag$/i }).or(
      page.getByRole('button', { name: /^folder$/i })
    )
  ).toBeVisible({ timeout: 20_000 });
}

/**
 * Open the OrganizationSwitcher dropdown and return all org names listed.
 * The trigger button contains the current org name + a down-arrow icon.
 * We identify it as the button that opens the org dropdown.
 */
async function getAvailableOrgs(page: import('@playwright/test').Page): Promise<string[]> {
  // The org switcher trigger is a Button (variant="outline") in the top-bar header
  // containing either "Personal Organization" text or the active org name.
  // We click it, then collect all DropdownMenuItem texts (excluding action items).
  const trigger = page
    .locator('header')
    .getByRole('button')
    .filter({ hasText: /(Personal Organization|[A-Za-z])/ })
    .first();

  await trigger.click();

  // Wait for the dropdown content to appear
  const dropdownContent = page.locator('[data-radix-popper-content-wrapper]').last();
  await expect(dropdownContent).toBeVisible({ timeout: 10_000 });

  // Collect org names from dropdown items — exclude action items like
  // "Create Organization" and "Manage Organizations"
  const allItems = await dropdownContent.locator('[role="menuitem"]').allTextContents();
  const orgNames = allItems
    .map((t) => t.trim())
    .filter(
      (t) =>
        t &&
        !t.includes('Create Organization') &&
        !t.includes('Manage Organizations')
    );

  // Close the dropdown without selecting anything
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  return orgNames;
}

/**
 * Switch to the org with the given name via the org switcher dropdown.
 * Waits for the page to stabilise after switching.
 */
async function switchToOrg(page: import('@playwright/test').Page, orgName: string) {
  const trigger = page
    .locator('header')
    .getByRole('button')
    .filter({ hasText: /(Personal Organization|[A-Za-z])/ })
    .first();

  await trigger.click();

  const dropdownContent = page.locator('[data-radix-popper-content-wrapper]').last();
  await expect(dropdownContent).toBeVisible({ timeout: 10_000 });

  // Click the menu item that contains the org name
  await dropdownContent
    .locator('[role="menuitem"]')
    .filter({ hasText: orgName })
    .first()
    .click();

  // Give the app time to update context and re-fetch data
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1_000);
}

/** Collect all tag names visible in the Tag filter popover. */
async function collectVisibleTags(page: import('@playwright/test').Page): Promise<string[]> {
  const tagBtn = page.getByRole('button', { name: /^tag$/i });
  const visible = await tagBtn.isVisible().catch(() => false);
  if (!visible) return [];

  await tagBtn.click();
  await page.locator('input[placeholder="Search tags..."]').waitFor({ timeout: 5_000 });

  const labels = await page
    .locator('div.space-y-1\\.5 label div.font-medium')
    .allTextContents();

  await page.keyboard.press('Escape');
  return labels.filter(Boolean);
}

/** Collect all folder names visible in the Folder filter popover. */
async function collectVisibleFolders(page: import('@playwright/test').Page): Promise<string[]> {
  const folderBtn = page.getByRole('button', { name: /^folder$/i });
  const visible = await folderBtn.isVisible().catch(() => false);
  if (!visible) return [];

  await folderBtn.click();
  await page.getByText('Select Folders').waitFor({ timeout: 5_000 });

  const spans = await page
    .locator('label span.truncate')
    .allTextContents();

  await page.keyboard.press('Escape');
  return spans.filter((s) => s && s.trim() !== 'Unorganized');
}

/** Collect all contact names/emails visible in the Contacts filter popover. */
async function collectVisibleContacts(page: import('@playwright/test').Page): Promise<string[]> {
  const contactsBtn = page.getByRole('button', { name: /^contacts$/i });
  const visible = await contactsBtn.isVisible().catch(() => false);
  if (!visible) return [];

  await contactsBtn.click();
  await page.locator('input[placeholder="Search contacts..."]').waitFor({ timeout: 5_000 });

  const popoverContent = page.locator('[data-radix-popper-content-wrapper]').last();
  const names = await popoverContent.locator('label div.font-medium').allTextContents();
  const emails = await popoverContent.locator('label span.truncate').allTextContents();

  await page.keyboard.press('Escape');
  return [...names, ...emails].filter(Boolean);
}

/** Collect all visible transcript titles from the table first page. */
async function collectTranscriptTitles(page: import('@playwright/test').Page): Promise<string[]> {
  const titleCells = page.locator('tbody tr[role="row"] td:nth-child(2)');
  return titleCells.allTextContents();
}

// ---------------------------------------------------------------------------
// Org discovery — shared across all tests in this file
// ---------------------------------------------------------------------------

/**
 * Discover which orgs are available to the test user, then return:
 *   { orgAName, orgBName } if two or more orgs exist, or null if only one.
 *
 * We treat the first org in the list as "Org A" and the second as "Org B".
 */
async function discoverOrgs(
  page: import('@playwright/test').Page
): Promise<{ orgAName: string; orgBName: string } | null> {
  await page.goto('/transcripts');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('header')).toBeVisible({ timeout: 15_000 });

  const orgs = await getAvailableOrgs(page);

  if (orgs.length < 2) {
    return null;
  }

  return { orgAName: orgs[0], orgBName: orgs[1] };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

test.describe('Org Isolation — Cross-org data leakage check', () => {
  // All tests in this suite use the pre-authenticated storageState
  // (set by auth.setup.ts). No separate login step needed.

  test('Org A user cannot see Org B tags in filter popover', async ({ page }) => {
    const orgs = await discoverOrgs(page);
    if (!orgs) {
      test.skip(true, 'Test user only has one org — cannot verify cross-org isolation');
      return;
    }

    const { orgAName, orgBName } = orgs;

    // --- Collect Org B's tags ---
    await switchToOrg(page, orgBName);
    await goToTranscripts(page);
    const orgBTags = await collectVisibleTags(page);

    if (orgBTags.length === 0) {
      test.skip(true, 'Org B has no tags — cannot verify tag isolation');
      return;
    }

    // --- Switch to Org A and check its tags ---
    await switchToOrg(page, orgAName);
    await goToTranscripts(page);
    const orgATags = await collectVisibleTags(page);

    // Assert that none of Org B's tags appear in Org A's filter popover
    for (const orgBTag of orgBTags) {
      expect(
        orgATags,
        `Org A should not see Org B tag: "${orgBTag}"`
      ).not.toContain(orgBTag);
    }
  });

  test('Org A user cannot see Org B folders in filter popover', async ({ page }) => {
    const orgs = await discoverOrgs(page);
    if (!orgs) {
      test.skip(true, 'Test user only has one org — cannot verify cross-org isolation');
      return;
    }

    const { orgAName, orgBName } = orgs;

    // --- Collect Org B's folders ---
    await switchToOrg(page, orgBName);
    await goToTranscripts(page);
    const orgBFolders = await collectVisibleFolders(page);

    if (orgBFolders.length === 0) {
      test.skip(true, 'Org B has no folders — cannot verify folder isolation');
      return;
    }

    // --- Switch to Org A and check its folders ---
    await switchToOrg(page, orgAName);
    await goToTranscripts(page);
    const orgAFolders = await collectVisibleFolders(page);

    for (const orgBFolder of orgBFolders) {
      expect(
        orgAFolders,
        `Org A should not see Org B folder: "${orgBFolder}"`
      ).not.toContain(orgBFolder);
    }
  });

  test('Org A user cannot see Org B contacts in filter popover', async ({ page }) => {
    const orgs = await discoverOrgs(page);
    if (!orgs) {
      test.skip(true, 'Test user only has one org — cannot verify cross-org isolation');
      return;
    }

    const { orgAName, orgBName } = orgs;

    // --- Collect Org B's contacts ---
    await switchToOrg(page, orgBName);
    await goToTranscripts(page);
    const orgBContacts = await collectVisibleContacts(page);

    if (orgBContacts.length === 0) {
      test.skip(true, 'Org B has no contacts — cannot verify contact isolation');
      return;
    }

    // --- Switch to Org A and check its contacts ---
    await switchToOrg(page, orgAName);
    await goToTranscripts(page);
    const orgAContacts = await collectVisibleContacts(page);

    for (const orgBContact of orgBContacts) {
      expect(
        orgAContacts,
        `Org A should not see Org B contact: "${orgBContact}"`
      ).not.toContain(orgBContact);
    }
  });

  test('Org A user cannot see Org B transcripts in search results', async ({ page }) => {
    const orgs = await discoverOrgs(page);
    if (!orgs) {
      test.skip(true, 'Test user only has one org — cannot verify cross-org isolation');
      return;
    }

    const { orgAName, orgBName } = orgs;

    // --- Collect Org B's transcript titles ---
    await switchToOrg(page, orgBName);
    await goToTranscripts(page);
    const orgBTitles = await collectTranscriptTitles(page);

    if (orgBTitles.length === 0) {
      test.skip(true, 'Org B has no transcripts — cannot verify transcript isolation');
      return;
    }

    const canaryTitle = orgBTitles[0].trim();
    if (!canaryTitle) {
      test.skip(true, 'Org B transcript title is empty — cannot use as canary');
      return;
    }

    // --- Switch to Org A and search for the Org B canary title ---
    await switchToOrg(page, orgAName);
    await goToTranscripts(page);

    const searchInput = page.locator('input[placeholder="Search"]');
    const hasSearch = await searchInput.isVisible().catch(() => false);

    if (hasSearch) {
      await searchInput.fill(canaryTitle);
      await page.waitForTimeout(1_500); // Let search debounce settle

      const orgATitles = await collectTranscriptTitles(page);
      const exactMatch = orgATitles.some((t) => t.trim() === canaryTitle);

      expect(
        exactMatch,
        `Org A search results must not contain Org B transcript: "${canaryTitle}"`
      ).toBe(false);
    }
  });
});
