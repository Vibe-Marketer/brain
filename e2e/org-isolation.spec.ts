import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Phase 6 — Org Isolation Tests
 *
 * Verifies that a user from Org A cannot see Org B's data in:
 *  - Tags filter popover
 *  - Folders filter popover
 *  - Contacts filter popover
 *  - Transcript table search results
 *
 * Requirements:
 *   Two separate sets of credentials must be provided via environment variables:
 *     CALLVAULTAI_LOGIN          — Org A user email
 *     CALLVAULTAI_LOGIN_PASSWORD — Org A user password
 *     CALLVAULTAI_ORG_B_LOGIN    — Org B user email
 *     CALLVAULTAI_ORG_B_PASSWORD — Org B user password
 *
 *   If either Org B credential is absent, all tests in this file are skipped
 *   gracefully. This allows the suite to run in environments with only one
 *   org's credentials available.
 *
 * Strategy:
 *   1. Log in as Org B, collect the list of tags, folders, contacts, and a
 *      unique transcript title visible to Org B.
 *   2. Log in as Org A (primary credentials, already stored in storageState).
 *   3. Assert that Org B's data does NOT appear in any filter popover or
 *      search result for the Org A session.
 *
 * @phase 06-e2e-tests
 */

// ---------------------------------------------------------------------------
// Check if Org B credentials are available
// ---------------------------------------------------------------------------
const ORG_B_LOGIN = process.env.CALLVAULTAI_ORG_B_LOGIN;
const ORG_B_PASSWORD = process.env.CALLVAULTAI_ORG_B_PASSWORD;
const ORG_A_LOGIN = process.env.CALLVAULTAI_LOGIN;
const ORG_A_PASSWORD = process.env.CALLVAULTAI_LOGIN_PASSWORD;

const hasOrgBCredentials = !!(ORG_B_LOGIN && ORG_B_PASSWORD);
const hasOrgACredentials = !!(ORG_A_LOGIN && ORG_A_PASSWORD);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  const emailInput = page.locator('input[type="email"]');
  await expect(emailInput).toBeVisible({ timeout: 20_000 });
  await emailInput.fill(email);

  const passwordInput = page.locator('input[type="password"]');
  await expect(passwordInput).toBeVisible();
  await passwordInput.fill(password);

  const signInBtn = page.getByRole('button', { name: /sign in/i }).first();
  await signInBtn.click();

  await page.waitForURL((url) => !url.toString().includes('/login'), {
    timeout: 30_000,
  });
  await expect(page.locator('nav').first()).toBeVisible({ timeout: 15_000 });
}

async function goToTranscripts(page: Page) {
  await page.goto('/transcripts');
  await page.waitForLoadState('networkidle');
  // Wait for filter bar to appear
  await expect(
    page.getByRole('button', { name: /^tag$/i }).or(
      page.getByRole('button', { name: /^folder$/i })
    )
  ).toBeVisible({ timeout: 20_000 });
}

/** Collect all tag names visible in the Tag filter popover. */
async function collectVisibleTags(page: Page): Promise<string[]> {
  const tagBtn = page.getByRole('button', { name: /^tag$/i });
  const visible = await tagBtn.isVisible().catch(() => false);
  if (!visible) return [];

  await tagBtn.click();
  await page.locator('input[placeholder="Search tags..."]').waitFor({ timeout: 5_000 });

  // Collect all tag label texts
  const labels = await page
    .locator('div.space-y-1\\.5 label div.font-medium')
    .allTextContents();

  await page.keyboard.press('Escape');
  return labels.filter(Boolean);
}

/** Collect all folder names visible in the Folder filter popover. */
async function collectVisibleFolders(page: Page): Promise<string[]> {
  const folderBtn = page.getByRole('button', { name: /^folder$/i });
  const visible = await folderBtn.isVisible().catch(() => false);
  if (!visible) return [];

  await folderBtn.click();
  await page.getByText('Select Folders').waitFor({ timeout: 5_000 });

  // Folder labels are <span class="truncate"> inside label elements (excluding "Unorganized")
  const spans = await page
    .locator('label span.truncate')
    .allTextContents();

  await page.keyboard.press('Escape');
  return spans.filter((s) => s && s.trim() !== 'Unorganized');
}

/** Collect all contact names/emails visible in the Contacts filter popover. */
async function collectVisibleContacts(page: Page): Promise<string[]> {
  const contactsBtn = page.getByRole('button', { name: /^contacts$/i });
  const visible = await contactsBtn.isVisible().catch(() => false);
  if (!visible) return [];

  await contactsBtn.click();
  await page.locator('input[placeholder="Search contacts..."]').waitFor({ timeout: 5_000 });

  // Contact labels show name (font-medium) + email, or just email
  const popoverContent = page.locator('[data-radix-popper-content-wrapper]').last();
  const names = await popoverContent.locator('label div.font-medium').allTextContents();
  const emails = await popoverContent.locator('label span.truncate').allTextContents();

  await page.keyboard.press('Escape');
  return [...names, ...emails].filter(Boolean);
}

/** Collect all visible transcript titles from the table first page. */
async function collectTranscriptTitles(page: Page): Promise<string[]> {
  // Transcript title cells are in <td> elements in tbody rows.
  // The title link/button is inside the first data cell.
  const titleCells = page.locator('tbody tr[role="row"] td:nth-child(2)');
  return titleCells.allTextContents();
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

test.describe('Org Isolation — Cross-org data leakage check', () => {
  test.beforeEach(async ({}) => {
    if (!hasOrgBCredentials) {
      test.skip();
    }
  });

  test('Org A user cannot see Org B tags in filter popover', async ({
    browser,
  }) => {
    if (!hasOrgBCredentials || !hasOrgACredentials) {
      test.skip();
      return;
    }

    // --- Step 1: Collect Org B's tags ---
    const orgBContext: BrowserContext = await browser.newContext();
    const orgBPage = await orgBContext.newPage();

    await loginAs(orgBPage, ORG_B_LOGIN!, ORG_B_PASSWORD!);
    await goToTranscripts(orgBPage);
    const orgBTags = await collectVisibleTags(orgBPage);

    await orgBContext.close();

    if (orgBTags.length === 0) {
      // Org B has no tags — cannot verify isolation, skip
      test.skip();
      return;
    }

    // --- Step 2: Check Org A's tags (uses auth from storageState) ---
    // The storageState for Org A was set by auth.setup.ts and is injected
    // automatically because this project depends on the 'setup' project.
    // We need a fresh context without storageState to re-login as Org A here,
    // OR we rely on the default page fixture which already has Org A's auth.
    //
    // Since we've already verified Org B tags exist, now we verify they don't
    // appear for Org A. The page fixture already has Org A's auth state.

    const orgAContext: BrowserContext = await browser.newContext({
      storageState: path.join(__dirname, '../playwright/.auth/user.json'),
    });
    const orgAPage = await orgAContext.newPage();

    await goToTranscripts(orgAPage);
    const orgATags = await collectVisibleTags(orgAPage);

    await orgAContext.close();

    // Assert that none of Org B's tags appear in Org A's filter popover
    for (const orgBTag of orgBTags) {
      expect(
        orgATags,
        `Org A should not see Org B tag: "${orgBTag}"`
      ).not.toContain(orgBTag);
    }
  });

  test('Org A user cannot see Org B folders in filter popover', async ({
    browser,
  }) => {
    if (!hasOrgBCredentials || !hasOrgACredentials) {
      test.skip();
      return;
    }

    // Collect Org B's folders
    const orgBContext: BrowserContext = await browser.newContext();
    const orgBPage = await orgBContext.newPage();

    await loginAs(orgBPage, ORG_B_LOGIN!, ORG_B_PASSWORD!);
    await goToTranscripts(orgBPage);
    const orgBFolders = await collectVisibleFolders(orgBPage);

    await orgBContext.close();

    if (orgBFolders.length === 0) {
      test.skip();
      return;
    }

    // Check Org A's folders
    const orgAContext: BrowserContext = await browser.newContext({
      storageState: path.join(__dirname, '../playwright/.auth/user.json'),
    });
    const orgAPage = await orgAContext.newPage();

    await goToTranscripts(orgAPage);
    const orgAFolders = await collectVisibleFolders(orgAPage);

    await orgAContext.close();

    for (const orgBFolder of orgBFolders) {
      expect(
        orgAFolders,
        `Org A should not see Org B folder: "${orgBFolder}"`
      ).not.toContain(orgBFolder);
    }
  });

  test('Org A user cannot see Org B contacts in filter popover', async ({
    browser,
  }) => {
    if (!hasOrgBCredentials || !hasOrgACredentials) {
      test.skip();
      return;
    }

    // Collect Org B's contacts
    const orgBContext: BrowserContext = await browser.newContext();
    const orgBPage = await orgBContext.newPage();

    await loginAs(orgBPage, ORG_B_LOGIN!, ORG_B_PASSWORD!);
    await goToTranscripts(orgBPage);
    const orgBContacts = await collectVisibleContacts(orgBPage);

    await orgBContext.close();

    if (orgBContacts.length === 0) {
      test.skip();
      return;
    }

    // Check Org A's contacts
    const orgAContext: BrowserContext = await browser.newContext({
      storageState: path.join(__dirname, '../playwright/.auth/user.json'),
    });
    const orgAPage = await orgAContext.newPage();

    await goToTranscripts(orgAPage);
    const orgAContacts = await collectVisibleContacts(orgAPage);

    await orgAContext.close();

    for (const orgBContact of orgBContacts) {
      expect(
        orgAContacts,
        `Org A should not see Org B contact: "${orgBContact}"`
      ).not.toContain(orgBContact);
    }
  });

  test('Org A user cannot see Org B transcripts in search results', async ({
    browser,
  }) => {
    if (!hasOrgBCredentials || !hasOrgACredentials) {
      test.skip();
      return;
    }

    // Collect Org B's transcript titles
    const orgBContext: BrowserContext = await browser.newContext();
    const orgBPage = await orgBContext.newPage();

    await loginAs(orgBPage, ORG_B_LOGIN!, ORG_B_PASSWORD!);
    await goToTranscripts(orgBPage);
    const orgBTitles = await collectTranscriptTitles(orgBPage);

    await orgBContext.close();

    if (orgBTitles.length === 0) {
      test.skip();
      return;
    }

    // Take the first Org B title as our canary
    const canaryTitle = orgBTitles[0].trim();
    if (!canaryTitle) {
      test.skip();
      return;
    }

    // Check Org A's search results for the canary title
    const orgAContext: BrowserContext = await browser.newContext({
      storageState: path.join(__dirname, '../playwright/.auth/user.json'),
    });
    const orgAPage = await orgAContext.newPage();

    await goToTranscripts(orgAPage);

    // Search for the Org B transcript title
    const searchInput = orgAPage.locator('input[placeholder="Search"]');
    const hasSearch = await searchInput.isVisible().catch(() => false);

    if (hasSearch) {
      await searchInput.fill(canaryTitle);
      await orgAPage.waitForTimeout(1_500); // Let search debounce settle

      const orgATitles = await collectTranscriptTitles(orgAPage);

      // None of the results for Org A should exactly match the canary title
      const exactMatch = orgATitles.some(
        (t) => t.trim() === canaryTitle
      );

      expect(
        exactMatch,
        `Org A search results must not contain Org B transcript: "${canaryTitle}"`
      ).toBe(false);
    }

    await orgAContext.close();
  });
});
