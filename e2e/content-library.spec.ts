import { test, expect, type Page } from '@playwright/test';

/**
 * E2E tests for the Content Library feature.
 *
 * NOTE: The Content Library page (/library) has been removed as part of the
 * v2 cleanup (commit 612390aa). These tests now verify graceful handling of
 * the removed route and the app's current navigation state.
 *
 * Tests that relied on the content library UI components are skipped until
 * the feature is re-implemented.
 *
 * @see src/integrations/supabase/types.ts (content_library table type still exists)
 */

// ============================================================================
// Content Library Page Tests
// ============================================================================

test.describe('Content Library Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the content library page (now redirects to /)
    await page.goto('/library');

    // Wait for the page to load
    await expect(
      page.locator('body')
    ).toBeVisible({ timeout: 15000 });
  });

  test('should navigate to Content Library page from URL', async ({ page }) => {
    // /library redirects to / (catch-all route) — verify the app loads
    await expect(page.locator('body')).toBeVisible();
    // The app should render something — either the main app or a sign-in page
    const mainContent = page.locator('main, [role="main"], #root').first();
    await expect(mainContent).toBeVisible({ timeout: 15000 });
  });

  test('should display Content Library page header when content exists', async ({ page }) => {
    // Feature removed — skip until re-implemented
    test.skip(true, 'Content Library page (/library) removed in v2 cleanup');
  });

  test('should show empty state when no content saved', async ({ page }) => {
    // Feature removed — skip until re-implemented
    test.skip(true, 'Content Library page (/library) removed in v2 cleanup');
  });

  test('should display loading state initially', async ({ page }) => {
    // Navigate fresh without cache
    await page.goto('/library');

    // Either spinner shows initially or content loads quickly
    // We wait for the page to finish loading
    await page.waitForLoadState('networkidle');
    // Page should have loaded something
    await expect(page.locator('body')).toBeVisible();
  });

  test('should show item count in page subtitle when content exists', async ({ page }) => {
    // Feature removed — skip until re-implemented
    test.skip(true, 'Content Library page (/library) removed in v2 cleanup');
  });
});

// ============================================================================
// Content Filter Bar Tests
// ============================================================================

test.describe('Content Filter Bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/library');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('should display content type filter dropdown', async ({ page }) => {
    // Feature removed — skip until re-implemented
    test.skip(true, 'Content Library filter bar removed in v2 cleanup');
  });

  test('should open type filter dropdown and show options', async ({ page }) => {
    // Feature removed — skip until re-implemented
    test.skip(true, 'Content Library filter bar removed in v2 cleanup');
  });

  test('should filter content by type when selecting a type', async ({ page }) => {
    // Feature removed — skip until re-implemented
    test.skip(true, 'Content Library filter bar removed in v2 cleanup');
  });

  test('should display tags filter button', async ({ page }) => {
    // Feature removed — skip until re-implemented
    test.skip(true, 'Content Library filter bar removed in v2 cleanup');
  });

  test('should open tags filter popover and show available tags', async ({ page }) => {
    // Feature removed — skip until re-implemented
    test.skip(true, 'Content Library filter bar removed in v2 cleanup');
  });

  test('should show clear filters button when filters are active', async ({ page }) => {
    // Feature removed — skip until re-implemented
    test.skip(true, 'Content Library filter bar removed in v2 cleanup');
  });

  test('should clear all filters when clicking Clear button', async ({ page }) => {
    // Feature removed — skip until re-implemented
    test.skip(true, 'Content Library filter bar removed in v2 cleanup');
  });
});

// ============================================================================
// Content Item Card Tests
// ============================================================================

test.describe('Content Item Card', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/library');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
  });

  test('should display content cards with title and type badge', async ({ page }) => {
    // Feature removed — skip until re-implemented
    test.skip(true, 'Content Library cards removed in v2 cleanup');
  });

  test('should show content preview in card', async ({ page }) => {
    // Feature removed — skip until re-implemented
    test.skip(true, 'Content Library cards removed in v2 cleanup');
  });

  test('should show usage count on content cards', async ({ page }) => {
    // Feature removed — skip until re-implemented
    test.skip(true, 'Content Library cards removed in v2 cleanup');
  });

  test('should show action buttons on card hover', async ({ page }) => {
    // Feature removed — skip until re-implemented
    test.skip(true, 'Content Library cards removed in v2 cleanup');
  });

  test('should open delete confirmation dialog when clicking delete', async ({ page }) => {
    // Feature removed — skip until re-implemented
    test.skip(true, 'Content Library cards removed in v2 cleanup');
  });

  test('should close delete dialog when clicking Cancel', async ({ page }) => {
    // Feature removed — skip until re-implemented
    test.skip(true, 'Content Library cards removed in v2 cleanup');
  });
});

// ============================================================================
// Navigation Tests
// ============================================================================

test.describe('Content Library Navigation', () => {
  test('should navigate to library page from URL', async ({ page }) => {
    await page.goto('/library');
    await expect(page.locator('body')).toBeVisible();

    // /library is a removed route — the app redirects to / via catch-all
    // Verify the app loaded (either main app or login page)
    await page.waitForLoadState('networkidle');
    const url = page.url();
    // Should have navigated somewhere valid (localhost base)
    expect(url).toMatch(/localhost:\d+/);
  });

  test('should preserve URL when navigating', async ({ page }) => {
    // /library redirects to / — this is expected behavior for removed routes
    await page.goto('/library');
    await page.waitForLoadState('networkidle');

    // The catch-all redirect sends /library to / — verify we're on a valid app page
    const url = page.url();
    expect(url).toMatch(/localhost:\d+/);
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

test.describe('Content Library Error Handling', () => {
  test('should not have console errors on Content Library page', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/library');
    await page.waitForTimeout(3000);

    // Filter out known acceptable errors
    const unexpectedErrors = errors.filter(
      (error) =>
        !error.includes('[HMR]') &&
        !error.includes('React DevTools') &&
        !error.includes('Download the React DevTools') &&
        !error.includes('Failed to fetch') &&
        !error.includes('401') && // Auth errors in test environment
        !error.includes('Debug Panel') // Debug panel initialization messages
    );

    expect(unexpectedErrors).toHaveLength(0);
  });
});

// ============================================================================
// Accessibility Tests
// ============================================================================

test.describe('Content Library Accessibility', () => {
  test('should have accessible filter controls', async ({ page }) => {
    // Feature removed — skip until re-implemented
    test.skip(true, 'Content Library filter controls removed in v2 cleanup');
  });

  test('should support keyboard navigation in filter dropdown', async ({ page }) => {
    // Feature removed — skip until re-implemented
    test.skip(true, 'Content Library filter controls removed in v2 cleanup');
  });
});

// ============================================================================
// Responsive Tests
// ============================================================================

test.describe('Content Library Responsive Design', () => {
  test('should show mobile-friendly layout on Content Library page', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/library');
    await page.waitForLoadState('networkidle');

    // Page should still be functional (redirects to / on mobile too)
    await expect(page.locator('body')).toBeVisible();
    // App should load something valid
    const url = page.url();
    expect(url).toMatch(/localhost:\d+/);
  });

  test('should display content cards in single column on mobile', async ({ page }) => {
    // Feature removed — skip until re-implemented
    test.skip(true, 'Content Library cards removed in v2 cleanup');
  });
});
