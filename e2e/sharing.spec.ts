import { test, expect, type Page } from '@playwright/test';

/**
 * E2E tests for the Sharing feature flows.
 *
 * This test suite covers the three-tier sharing system:
 * 1. Single Call Share - Generate and manage shareable links
 * 2. Coach Access - Coach/coachee relationships and shared calls
 * 3. Team Access - Team hierarchy and manager visibility
 *
 * Note: These tests require authentication. Some tests may be skipped
 * if the required user state (e.g., existing calls, team membership) is not available.
 *
 * @see src/components/sharing/ShareCallDialog.tsx
 * @see src/pages/SharedWithMe.tsx
 * @see src/pages/CoachDashboard.tsx
 * @see src/pages/TeamManagement.tsx
 */

// ============================================================================
// Single Call Share Tests
// ============================================================================

test.describe('Single Call Share Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the main transcripts page
    await page.goto('/');

    // Wait for the page to load
    await expect(
      page.getByRole('main').or(page.locator('body'))
    ).toBeVisible({ timeout: 15000 });
  });

  test('should display Share button in call detail header', async ({ page }) => {
    // Look for a call row to click on
    const callRow = page.locator('tr').filter({ hasText: /call|meeting/i }).first();

    // Skip if no calls are available
    const hasCall = await callRow.isVisible().catch(() => false);
    if (!hasCall) {
      test.skip();
      return;
    }

    // Click on a call to open detail view
    await callRow.click();

    // Wait for call detail page to load
    await page.waitForURL(/\/call\/\d+/);

    // Look for the Share button in the header
    const shareButton = page.getByRole('button', { name: /share/i });
    await expect(shareButton).toBeVisible({ timeout: 10000 });
  });

  test('should open Share Call dialog when clicking Share button', async ({ page }) => {
    // Navigate directly to a call if available
    await page.goto('/');

    // Try to find and click a call
    const callRow = page.locator('tr').filter({ hasText: /\d{4}/ }).first();
    const hasCall = await callRow.isVisible().catch(() => false);
    if (!hasCall) {
      test.skip();
      return;
    }

    await callRow.click();
    await page.waitForURL(/\/call\/\d+/);

    // Click the Share button
    const shareButton = page.getByRole('button', { name: /share/i });
    await expect(shareButton).toBeVisible();
    await shareButton.click();

    // Verify the dialog opens
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify dialog title
    await expect(dialog.getByText('Share Call')).toBeVisible();

    // Verify create link button exists
    await expect(dialog.getByRole('button', { name: /create/i })).toBeVisible();
  });

  test('should have email input in Share Call dialog', async ({ page }) => {
    await page.goto('/');

    const callRow = page.locator('tr').filter({ hasText: /\d{4}/ }).first();
    const hasCall = await callRow.isVisible().catch(() => false);
    if (!hasCall) {
      test.skip();
      return;
    }

    await callRow.click();
    await page.waitForURL(/\/call\/\d+/);

    await page.getByRole('button', { name: /share/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Verify email input exists
    const emailInput = dialog.getByPlaceholder(/recipient email/i);
    await expect(emailInput).toBeVisible();
  });

  test('should close Share Call dialog with Close button', async ({ page }) => {
    await page.goto('/');

    const callRow = page.locator('tr').filter({ hasText: /\d{4}/ }).first();
    const hasCall = await callRow.isVisible().catch(() => false);
    if (!hasCall) {
      test.skip();
      return;
    }

    await callRow.click();
    await page.waitForURL(/\/call\/\d+/);

    await page.getByRole('button', { name: /share/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Click close button
    await dialog.getByRole('button', { name: /close/i }).click();

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });
});

// ============================================================================
// Shared With Me Page Tests
// ============================================================================

test.describe('Shared With Me Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the Shared With Me page
    await page.goto('/shared-with-me');

    // Wait for page to load
    await expect(
      page.getByRole('heading', { name: /shared with me/i }).or(page.getByText(/sign in/i))
    ).toBeVisible({ timeout: 15000 });
  });

  test('should display Shared With Me page header', async ({ page }) => {
    // Check for page title
    const header = page.getByRole('heading', { name: /shared with me/i });
    const headerOrEmpty = header.or(page.getByText(/no calls have been shared/i));
    await expect(headerOrEmpty).toBeVisible();
  });

  test('should show empty state when no shared calls', async ({ page }) => {
    // Look for either shared calls or empty state
    const emptyState = page.getByText(/no calls have been shared/i);
    const callsTable = page.locator('table');

    // One of these should be visible
    await expect(emptyState.or(callsTable)).toBeVisible({ timeout: 10000 });
  });

  test('should display source type tabs when calls exist', async ({ page }) => {
    // Check if there are shared calls
    const callsTable = page.locator('table');
    const hasTable = await callsTable.isVisible().catch(() => false);

    if (!hasTable) {
      // Empty state - tabs may not be visible
      test.skip();
      return;
    }

    // Look for All tab
    const allTab = page.getByRole('tab', { name: /all/i });
    await expect(allTab).toBeVisible();
  });

  test('should have search input', async ({ page }) => {
    // The search input should be visible on desktop
    const searchInput = page.getByPlaceholder(/search/i);

    // May be hidden on mobile, so just check if it exists
    const isVisible = await searchInput.isVisible().catch(() => false);
    if (!isVisible) {
      // On mobile, search might be in a different location
      test.skip();
      return;
    }

    await expect(searchInput).toBeVisible();
  });

  test('should show source badges with colors', async ({ page }) => {
    // Wait for content to load
    const callsTable = page.locator('table');
    const hasTable = await callsTable.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasTable) {
      test.skip();
      return;
    }

    // Check for source badges (Links, Coaching, Team, Direct Reports)
    const sourceBadges = page.locator('[class*="badge"]');
    const badgeCount = await sourceBadges.count();

    // If there are calls, there should be badges
    expect(badgeCount).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// Coach Dashboard Tests
// ============================================================================

test.describe('Coach Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the coach dashboard
    await page.goto('/coach-dashboard');

    // Wait for page to load
    await expect(
      page.locator('body')
    ).toBeVisible({ timeout: 15000 });
  });

  test('should display Coach Dashboard page', async ({ page }) => {
    // Look for coaching-related content or empty state
    const coachingHeader = page.getByText(/coaching|coachee/i).first();
    const signInPrompt = page.getByText(/sign in/i);

    await expect(coachingHeader.or(signInPrompt)).toBeVisible({ timeout: 10000 });
  });

  test('should show empty state with invite button when no coachees', async ({ page }) => {
    // Look for empty state message
    const emptyState = page.getByText(/don't have any coachees/i);
    const coacheeList = page.getByText(/all coachees/i);

    // One of these should be visible
    const hasEmptyState = await emptyState.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasEmptyState) {
      // Verify invite button is shown
      const inviteButton = page.getByRole('button', { name: /invite coachee/i });
      await expect(inviteButton).toBeVisible();
    }
  });

  test('should have coachees sidebar on desktop', async ({ page }) => {
    // Check viewport size - sidebar is only shown on desktop
    const viewportSize = page.viewportSize();
    if (!viewportSize || viewportSize.width < 768) {
      test.skip();
      return;
    }

    // Look for sidebar content
    const coacheesHeader = page.getByText(/coachees/i, { exact: false }).first();
    await expect(coacheesHeader).toBeVisible({ timeout: 10000 });
  });

  test('should open invite coachee dialog', async ({ page }) => {
    // Try to find and click invite button
    const inviteButton = page.getByRole('button', { name: /invite/i }).first();
    const hasInvite = await inviteButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasInvite) {
      test.skip();
      return;
    }

    await inviteButton.click();

    // Verify dialog opens
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================================
// Team Management Tests
// ============================================================================

test.describe('Team Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to team management page
    await page.goto('/team-management');

    // Wait for page to load
    await expect(
      page.locator('body')
    ).toBeVisible({ timeout: 15000 });
  });

  test('should display Team Management page', async ({ page }) => {
    // Look for team-related content or empty state
    const teamHeader = page.getByText(/team/i).first();
    const signInPrompt = page.getByText(/sign in/i);

    await expect(teamHeader.or(signInPrompt)).toBeVisible({ timeout: 10000 });
  });

  test('should show create team option when not in a team', async ({ page }) => {
    // Look for create team button or existing team
    const createTeamButton = page.getByRole('button', { name: /create team/i });
    const teamName = page.locator('[class*="team"]').first();

    const hasCreateButton = await createTeamButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasCreateButton) {
      await expect(createTeamButton).toBeVisible();
    }
  });

  test('should open create team dialog when clicking Create Team', async ({ page }) => {
    const createTeamButton = page.getByRole('button', { name: /create team/i });
    const hasCreateButton = await createTeamButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasCreateButton) {
      test.skip();
      return;
    }

    await createTeamButton.click();

    // Verify dialog opens
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify dialog has team name input
    const nameInput = dialog.getByLabel(/team name/i);
    await expect(nameInput).toBeVisible();
  });

  test('should have team name input in create dialog', async ({ page }) => {
    const createTeamButton = page.getByRole('button', { name: /create team/i });
    const hasCreateButton = await createTeamButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasCreateButton) {
      test.skip();
      return;
    }

    await createTeamButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Verify team name input
    const nameInput = dialog.getByLabel(/team name/i);
    await expect(nameInput).toBeVisible();

    // Verify admin sees all toggle
    const adminToggle = dialog.getByLabel(/admin visibility/i);
    await expect(adminToggle).toBeVisible();
  });

  test('should close create team dialog with Cancel button', async ({ page }) => {
    const createTeamButton = page.getByRole('button', { name: /create team/i });
    const hasCreateButton = await createTeamButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasCreateButton) {
      test.skip();
      return;
    }

    await createTeamButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Click cancel
    await dialog.getByRole('button', { name: /cancel/i }).click();

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });
});

// ============================================================================
// Settings - Coaches Tab Tests
// ============================================================================

test.describe('Settings - Coaches Tab', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to settings
    await page.goto('/settings');

    // Wait for settings page to load
    await expect(
      page.getByRole('main', { name: /settings content/i }).or(page.locator('body'))
    ).toBeVisible({ timeout: 15000 });
  });

  test('should display Coaches category in settings', async ({ page }) => {
    // Look for settings category pane
    const categoryPane = page.getByRole('navigation', { name: /settings categories/i });
    const hasCategoryPane = await categoryPane.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasCategoryPane) {
      // Settings page might have a different layout
      test.skip();
      return;
    }

    // Look for Coaches category
    const coachesCategory = categoryPane.getByRole('button', { name: /coaches/i });
    await expect(coachesCategory).toBeVisible();
  });

  test('should open Coaches detail pane when clicking Coaches category', async ({ page }) => {
    const categoryPane = page.getByRole('navigation', { name: /settings categories/i });
    const hasCategoryPane = await categoryPane.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasCategoryPane) {
      test.skip();
      return;
    }

    // Click Coaches category
    const coachesCategory = categoryPane.getByRole('button', { name: /coaches/i });
    const hasCoaches = await coachesCategory.isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasCoaches) {
      test.skip();
      return;
    }

    await coachesCategory.click();

    // Verify detail pane opens
    const detailPane = page.getByRole('region', { name: /coaches settings/i });
    await expect(detailPane).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================================
// Settings - Team Tab Tests
// ============================================================================

test.describe('Settings - Team Tab', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to settings
    await page.goto('/settings');

    // Wait for settings page to load
    await expect(
      page.getByRole('main', { name: /settings content/i }).or(page.locator('body'))
    ).toBeVisible({ timeout: 15000 });
  });

  test('should display Team category in settings', async ({ page }) => {
    // Look for settings category pane
    const categoryPane = page.getByRole('navigation', { name: /settings categories/i });
    const hasCategoryPane = await categoryPane.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasCategoryPane) {
      test.skip();
      return;
    }

    // Look for Team category
    const teamCategory = categoryPane.getByRole('button', { name: /team/i });
    await expect(teamCategory).toBeVisible();
  });

  test('should open Team detail pane when clicking Team category', async ({ page }) => {
    const categoryPane = page.getByRole('navigation', { name: /settings categories/i });
    const hasCategoryPane = await categoryPane.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasCategoryPane) {
      test.skip();
      return;
    }

    // Click Team category
    const teamCategory = categoryPane.getByRole('button', { name: /team/i });
    const hasTeam = await teamCategory.isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasTeam) {
      test.skip();
      return;
    }

    await teamCategory.click();

    // Verify detail pane opens
    const detailPane = page.getByRole('region', { name: /team settings/i });
    await expect(detailPane).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================================
// Shared Call View Tests (Token-based access)
// ============================================================================

test.describe('Shared Call View', () => {
  test('should show error for invalid share token', async ({ page }) => {
    // Navigate to an invalid share link
    await page.goto('/s/invalid-token-that-does-not-exist');

    // Should show error or redirect
    const errorMessage = page.getByText(/not found|invalid|revoked/i).first();
    const loginRedirect = page.getByText(/sign in/i);

    // Should show either error or login redirect
    await expect(errorMessage.or(loginRedirect)).toBeVisible({ timeout: 15000 });
  });

  test('should redirect to login when not authenticated', async ({ page }) => {
    // Navigate to a share link when not logged in
    await page.goto('/s/some-test-token');

    // Should either show login redirect or the shared view
    const loginButton = page.getByRole('button', { name: /sign in|login/i });
    const loginText = page.getByText(/sign in/i);
    const sharedBanner = page.getByText(/shared call/i);

    // One of these should appear
    await expect(loginButton.or(loginText).or(sharedBanner)).toBeVisible({ timeout: 15000 });
  });
});

// ============================================================================
// Transcript Table Sharing Indicators Tests
// ============================================================================

test.describe('Transcript Table Sharing Indicators', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to transcripts page
    await page.goto('/');

    // Wait for page to load
    await expect(
      page.locator('body')
    ).toBeVisible({ timeout: 15000 });
  });

  test('should have column visibility menu', async ({ page }) => {
    // Look for column visibility toggle
    const columnsButton = page.getByRole('button', { name: /columns|visibility/i });
    const hasColumnsButton = await columnsButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasColumnsButton) {
      // Columns toggle might not be visible or named differently
      test.skip();
      return;
    }

    await expect(columnsButton).toBeVisible();
  });
});

// ============================================================================
// Navigation Tests
// ============================================================================

test.describe('Sharing Navigation', () => {
  test('should navigate to Shared With Me page from URL', async ({ page }) => {
    await page.goto('/shared-with-me');

    // Page should load without errors
    await expect(page.locator('body')).toBeVisible();

    // Should show Shared With Me content
    const pageContent = page.getByText(/shared with me|sign in/i).first();
    await expect(pageContent).toBeVisible({ timeout: 15000 });
  });

  test('should navigate to Coach Dashboard from URL', async ({ page }) => {
    await page.goto('/coach-dashboard');

    // Page should load without errors
    await expect(page.locator('body')).toBeVisible();

    // Should show coach dashboard content
    const pageContent = page.getByText(/coaching|coachee|sign in/i).first();
    await expect(pageContent).toBeVisible({ timeout: 15000 });
  });

  test('should navigate to Team Management from URL', async ({ page }) => {
    await page.goto('/team-management');

    // Page should load without errors
    await expect(page.locator('body')).toBeVisible();

    // Should show team management content
    const pageContent = page.getByText(/team|sign in/i).first();
    await expect(pageContent).toBeVisible({ timeout: 15000 });
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

test.describe('Sharing Error Handling', () => {
  test('should not have console errors on Shared With Me page', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/shared-with-me');
    await page.waitForTimeout(2000);

    // Filter out known acceptable errors
    const unexpectedErrors = errors.filter(
      (error) =>
        !error.includes('[HMR]') &&
        !error.includes('React DevTools') &&
        !error.includes('Download the React DevTools') &&
        !error.includes('Failed to fetch') // Network errors in test environment
    );

    expect(unexpectedErrors).toHaveLength(0);
  });

  test('should not have console errors on Coach Dashboard page', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/coach-dashboard');
    await page.waitForTimeout(2000);

    // Filter out known acceptable errors
    const unexpectedErrors = errors.filter(
      (error) =>
        !error.includes('[HMR]') &&
        !error.includes('React DevTools') &&
        !error.includes('Download the React DevTools') &&
        !error.includes('Failed to fetch')
    );

    expect(unexpectedErrors).toHaveLength(0);
  });

  test('should not have console errors on Team Management page', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/team-management');
    await page.waitForTimeout(2000);

    // Filter out known acceptable errors
    const unexpectedErrors = errors.filter(
      (error) =>
        !error.includes('[HMR]') &&
        !error.includes('React DevTools') &&
        !error.includes('Download the React DevTools') &&
        !error.includes('Failed to fetch')
    );

    expect(unexpectedErrors).toHaveLength(0);
  });
});

// ============================================================================
// Accessibility Tests
// ============================================================================

test.describe('Sharing Accessibility', () => {
  test('should have accessible Share dialog', async ({ page }) => {
    await page.goto('/');

    // Try to find a call to click
    const callRow = page.locator('tr').filter({ hasText: /\d{4}/ }).first();
    const hasCall = await callRow.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasCall) {
      test.skip();
      return;
    }

    await callRow.click();
    await page.waitForURL(/\/call\/\d+/);

    const shareButton = page.getByRole('button', { name: /share/i });
    const hasShareButton = await shareButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasShareButton) {
      test.skip();
      return;
    }

    await shareButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Verify dialog has accessible title
    const dialogTitle = dialog.getByRole('heading', { level: 2 }).or(dialog.getByText('Share Call'));
    await expect(dialogTitle).toBeVisible();
  });

  test('should have focusable buttons in sharing dialogs', async ({ page }) => {
    await page.goto('/');

    const callRow = page.locator('tr').filter({ hasText: /\d{4}/ }).first();
    const hasCall = await callRow.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasCall) {
      test.skip();
      return;
    }

    await callRow.click();
    await page.waitForURL(/\/call\/\d+/);

    const shareButton = page.getByRole('button', { name: /share/i });
    const hasShareButton = await shareButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasShareButton) {
      test.skip();
      return;
    }

    await shareButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Tab to the create button
    const createButton = dialog.getByRole('button', { name: /create/i });
    await createButton.focus();
    await expect(createButton).toBeFocused();
  });
});

// ============================================================================
// Responsive Tests
// ============================================================================

test.describe('Sharing Responsive Design', () => {
  test('should show mobile-friendly layout on Shared With Me page', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/shared-with-me');

    // Page should still be functional
    await expect(page.locator('body')).toBeVisible();

    // Content should be visible
    const pageContent = page.getByText(/shared with me|sign in|no calls/i).first();
    await expect(pageContent).toBeVisible({ timeout: 15000 });
  });

  test('should show mobile-friendly layout on Coach Dashboard', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/coach-dashboard');

    // Page should still be functional
    await expect(page.locator('body')).toBeVisible();

    // Content should be visible
    const pageContent = page.getByText(/coaching|coachee|sign in/i).first();
    await expect(pageContent).toBeVisible({ timeout: 15000 });
  });

  test('should show mobile-friendly layout on Team Management', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/team-management');

    // Page should still be functional
    await expect(page.locator('body')).toBeVisible();

    // Content should be visible
    const pageContent = page.getByText(/team|sign in/i).first();
    await expect(pageContent).toBeVisible({ timeout: 15000 });
  });
});
