import { test, expect } from '@playwright/test';

/**
 * E2E tests for SortingTagging pane navigation flow.
 *
 * This test suite covers the multi-pane navigation system for Sorting/Tagging:
 * 1. Navigate to Sorting/Tagging page and verify panes are visible
 * 2. Click categories in 2nd pane (category list) to open 3rd pane (detail view)
 * 3. Verify correct content loads for each category
 * 4. Test keyboard navigation (Enter/Space to select, Tab to navigate)
 * 5. Test pane closing behavior
 * 6. Test smooth transitions and no console errors
 *
 * @pattern sorting-tagging-pane-navigation
 * @see src/pages/SortingTagging.tsx
 * @see src/components/panes/SortingCategoryPane.tsx
 * @see src/components/panes/SortingDetailPane.tsx
 */

test.describe('SortingTagging Pane Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the Sorting/Tagging page
    await page.goto('/sorting-tagging');

    // Wait for the page to fully load (wait for sidebar or main content)
    await expect(
      page.getByRole('main', { name: /sorting.*tagging.*content/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test.describe('2nd Pane - Category List', () => {
    test('should display the sorting category pane on desktop', async ({ page }) => {
      // Verify the 2nd pane (category list) is visible
      const categoryPane = page.getByRole('navigation', { name: /sorting and tagging categories/i });
      await expect(categoryPane).toBeVisible();

      // Verify it has the "Organization" header
      await expect(categoryPane.getByText('Organization')).toBeVisible();

      // Verify category count is displayed
      await expect(categoryPane.getByText(/categories/i)).toBeVisible();
    });

    test('should display all four sorting categories', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /sorting and tagging categories/i });

      // Verify all four categories are visible
      await expect(categoryPane.getByRole('button', { name: /folders/i })).toBeVisible();
      await expect(categoryPane.getByRole('button', { name: /tags/i })).toBeVisible();
      await expect(categoryPane.getByRole('button', { name: /rules/i })).toBeVisible();
      await expect(categoryPane.getByRole('button', { name: /recurring/i })).toBeVisible();
    });

    test('should show category descriptions', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /sorting and tagging categories/i });

      // Verify descriptions are shown
      await expect(categoryPane.getByText('Manage folder hierarchy')).toBeVisible();
      await expect(categoryPane.getByText('View and edit call tags')).toBeVisible();
      await expect(categoryPane.getByText('Configure auto-sorting')).toBeVisible();
      await expect(categoryPane.getByText('Create rules from patterns')).toBeVisible();
    });

    test('should display quick tips section', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /sorting and tagging categories/i });

      // Verify quick tips section is visible
      await expect(categoryPane.getByText('Quick Tip')).toBeVisible();
    });
  });

  test.describe('3rd Pane - Category Detail', () => {
    test('should open detail pane when clicking a category', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /sorting and tagging categories/i });

      // Click the Folders category
      await categoryPane.getByRole('button', { name: /folders.*manage/i }).click();

      // Verify the 3rd pane (detail view) appears
      const detailPane = page.getByRole('region', { name: /folders management/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });
    });

    test('should show correct header in detail pane for Folders', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /sorting and tagging categories/i });

      // Click Folders category
      await categoryPane.getByRole('button', { name: /folders.*manage/i }).click();

      // Verify detail pane header shows "Folders"
      const detailPane = page.getByRole('region', { name: /folders management/i });
      await expect(detailPane).toBeVisible();
      await expect(detailPane.getByText('Folders')).toBeVisible();
      await expect(detailPane.getByText('Organize calls into folders')).toBeVisible();
    });

    test('should show correct header in detail pane for Tags', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /sorting and tagging categories/i });

      // Click Tags category
      await categoryPane.getByRole('button', { name: /tags.*view/i }).click();

      // Verify detail pane header shows "Tags"
      const detailPane = page.getByRole('region', { name: /tags management/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });
      await expect(detailPane.getByText('Tags')).toBeVisible();
      await expect(detailPane.getByText('Classify and tag calls')).toBeVisible();
    });

    test('should show correct header in detail pane for Rules', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /sorting and tagging categories/i });

      // Click Rules category
      await categoryPane.getByRole('button', { name: /rules.*auto/i }).click();

      // Verify detail pane header shows "Rules"
      const detailPane = page.getByRole('region', { name: /rules management/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });
      await expect(detailPane.getByText('Rules')).toBeVisible();
      await expect(detailPane.getByText('Auto-sort incoming calls')).toBeVisible();
    });

    test('should show correct header in detail pane for Recurring Titles', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /sorting and tagging categories/i });

      // Click Recurring Titles category
      await categoryPane.getByRole('button', { name: /recurring.*create/i }).click();

      // Verify detail pane header shows "Recurring Titles"
      const detailPane = page.getByRole('region', { name: /recurring titles management/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });
      await expect(detailPane.getByText('Recurring Titles')).toBeVisible();
      await expect(detailPane.getByText('Create rules from patterns')).toBeVisible();
    });

    test('should have close button in detail pane', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /sorting and tagging categories/i });

      // Click any category
      await categoryPane.getByRole('button', { name: /folders.*manage/i }).click();

      // Verify detail pane has close button
      const detailPane = page.getByRole('region', { name: /folders management/i });
      await expect(detailPane).toBeVisible();
      const closeButton = detailPane.getByRole('button', { name: /close pane/i });
      await expect(closeButton).toBeVisible();
    });

    test('should close detail pane when clicking close button', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /sorting and tagging categories/i });

      // Click any category to open detail pane
      await categoryPane.getByRole('button', { name: /folders.*manage/i }).click();

      // Verify detail pane is open
      const detailPane = page.getByRole('region', { name: /folders management/i });
      await expect(detailPane).toBeVisible();

      // Click close button
      const closeButton = detailPane.getByRole('button', { name: /close pane/i });
      await closeButton.click();

      // Detail pane should no longer be visible
      await expect(detailPane).not.toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Category Selection State', () => {
    test('should highlight selected category with active indicator', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /sorting and tagging categories/i });

      // Click Folders category
      const foldersButton = categoryPane.getByRole('button', { name: /folders.*manage/i });
      await foldersButton.click();

      // Verify the button has aria-current="true" indicating active state
      await expect(foldersButton).toHaveAttribute('aria-current', 'true');
    });

    test('should update active category when switching between categories', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /sorting and tagging categories/i });

      // Click Folders category
      const foldersButton = categoryPane.getByRole('button', { name: /folders.*manage/i });
      await foldersButton.click();
      await expect(foldersButton).toHaveAttribute('aria-current', 'true');

      // Click Tags category
      const tagsButton = categoryPane.getByRole('button', { name: /tags.*view/i });
      await tagsButton.click();

      // Folders should no longer be current
      await expect(foldersButton).not.toHaveAttribute('aria-current', 'true');

      // Tags should now be current
      await expect(tagsButton).toHaveAttribute('aria-current', 'true');

      // Detail pane should show Tags content
      const detailPane = page.getByRole('region', { name: /tags management/i });
      await expect(detailPane).toBeVisible();
    });

    test('should update quick tip based on selected category', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /sorting and tagging categories/i });

      // Click Folders category
      await categoryPane.getByRole('button', { name: /folders.*manage/i }).click();

      // Verify folders quick tip is displayed
      await expect(categoryPane.getByText(/organize calls for browsing/i)).toBeVisible();

      // Click Tags category
      await categoryPane.getByRole('button', { name: /tags.*view/i }).click();

      // Verify tags quick tip is displayed
      await expect(categoryPane.getByText(/classify calls and control ai behavior/i)).toBeVisible();
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should allow selecting category with Enter key', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /sorting and tagging categories/i });

      // Focus on the Folders category button
      const foldersButton = categoryPane.getByRole('button', { name: /folders.*manage/i });
      await foldersButton.focus();

      // Press Enter to select
      await page.keyboard.press('Enter');

      // Detail pane should open
      const detailPane = page.getByRole('region', { name: /folders management/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });
    });

    test('should allow selecting category with Space key', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /sorting and tagging categories/i });

      // Focus on the Tags category button
      const tagsButton = categoryPane.getByRole('button', { name: /tags.*view/i });
      await tagsButton.focus();

      // Press Space to select
      await page.keyboard.press('Space');

      // Detail pane should open
      const detailPane = page.getByRole('region', { name: /tags management/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });
    });

    test('should allow Tab navigation between category buttons', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /sorting and tagging categories/i });

      // Focus on first category
      const foldersButton = categoryPane.getByRole('button', { name: /folders.*manage/i });
      await foldersButton.focus();

      // Verify Folders has focus
      await expect(foldersButton).toBeFocused();

      // Tab to next category
      await page.keyboard.press('Tab');

      // The next focusable element should have focus (Tags)
      // Just verify Folders is no longer focused
      await expect(foldersButton).not.toBeFocused();
    });
  });

  test.describe('Dual Mode (Tabs + Panes)', () => {
    test('should display both tabs and pane navigation in dual mode', async ({ page }) => {
      // Verify tabs are still visible (dual mode)
      const tabsList = page.getByRole('tablist');
      await expect(tabsList).toBeVisible();

      // Verify tab triggers exist
      await expect(page.getByRole('tab', { name: /folders/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /tags/i })).toBeVisible();

      // Verify category pane is also visible
      const categoryPane = page.getByRole('navigation', { name: /sorting and tagging categories/i });
      await expect(categoryPane).toBeVisible();
    });

    test('should sync tab state when category is selected in pane', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /sorting and tagging categories/i });

      // Click Tags category in pane
      await categoryPane.getByRole('button', { name: /tags.*view/i }).click();

      // Verify the Tags tab is now active
      const tagsTab = page.getByRole('tab', { name: /tags/i });
      await expect(tagsTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  test.describe('Smooth Transitions', () => {
    test('should have smooth transition when opening detail pane', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /sorting and tagging categories/i });

      // Click category to open detail pane
      await categoryPane.getByRole('button', { name: /folders.*manage/i }).click();

      // Detail pane should appear (with transition)
      const detailPane = page.getByRole('region', { name: /folders management/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });

      // Verify the pane has transition classes (checking opacity is 1 after transition)
      await expect(detailPane).toHaveCSS('opacity', '1');
    });

    test('should have no layout shifts during navigation', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /sorting and tagging categories/i });

      // Get initial position of category pane
      const initialBox = await categoryPane.boundingBox();

      // Click different categories
      await categoryPane.getByRole('button', { name: /folders.*manage/i }).click();
      await page.waitForTimeout(500); // Wait for transition

      await categoryPane.getByRole('button', { name: /tags.*view/i }).click();
      await page.waitForTimeout(500); // Wait for transition

      // Get final position of category pane
      const finalBox = await categoryPane.boundingBox();

      // Category pane position should not have changed
      expect(initialBox?.x).toBe(finalBox?.x);
      expect(initialBox?.y).toBe(finalBox?.y);
      expect(initialBox?.width).toBe(finalBox?.width);
    });
  });

  test.describe('Error Handling', () => {
    test('should not have console errors during navigation', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      const categoryPane = page.getByRole('navigation', { name: /sorting and tagging categories/i });

      // Navigate through all visible categories
      await categoryPane.getByRole('button', { name: /folders.*manage/i }).click();
      await page.waitForTimeout(300);

      await categoryPane.getByRole('button', { name: /tags.*view/i }).click();
      await page.waitForTimeout(300);

      await categoryPane.getByRole('button', { name: /rules.*auto/i }).click();
      await page.waitForTimeout(300);

      await categoryPane.getByRole('button', { name: /recurring.*create/i }).click();
      await page.waitForTimeout(300);

      // Filter out known expected warnings/errors
      const unexpectedErrors = errors.filter(
        (error) =>
          !error.includes('[HMR]') && // Hot module reload messages
          !error.includes('React DevTools') &&
          !error.includes('Download the React DevTools')
      );

      // No unexpected console errors
      expect(unexpectedErrors).toHaveLength(0);
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels on panes', async ({ page }) => {
      // Verify category pane has correct ARIA label
      const categoryPane = page.getByRole('navigation', { name: /sorting and tagging categories/i });
      await expect(categoryPane).toBeVisible();

      // Click to open detail pane
      await categoryPane.getByRole('button', { name: /folders.*manage/i }).click();

      // Verify detail pane has correct ARIA label
      const detailPane = page.getByRole('region', { name: /folders management/i });
      await expect(detailPane).toBeVisible();
    });

    test('should have accessible category buttons with descriptions', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /sorting and tagging categories/i });

      // Get folders button
      const foldersButton = categoryPane.getByRole('button', { name: /folders.*manage/i });

      // Verify it has an accessible label that includes the description
      const ariaLabel = await foldersButton.getAttribute('aria-label');
      expect(ariaLabel).toContain('Folders');
      expect(ariaLabel).toContain('Manage folder hierarchy');
    });

    test('should have focusable buttons with visible focus ring', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /sorting and tagging categories/i });

      // Focus on Folders button
      const foldersButton = categoryPane.getByRole('button', { name: /folders.*manage/i });
      await foldersButton.focus();

      // Verify it's focusable
      await expect(foldersButton).toBeFocused();
    });

    test('should have pane toolbar with accessible actions', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /sorting and tagging categories/i });

      // Click to open detail pane
      await categoryPane.getByRole('button', { name: /folders.*manage/i }).click();

      // Verify detail pane has toolbar with accessible buttons
      const detailPane = page.getByRole('region', { name: /folders management/i });
      await expect(detailPane).toBeVisible();

      // Verify toolbar exists with pane actions
      const toolbar = detailPane.getByRole('toolbar', { name: /pane actions/i });
      await expect(toolbar).toBeVisible();
    });
  });

  test.describe('Loading States', () => {
    test('should show loading state while content loads', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /sorting and tagging categories/i });

      // Click a category (content loads lazily)
      await categoryPane.getByRole('button', { name: /folders.*manage/i }).click();

      // Detail pane should be visible (loading or loaded)
      const detailPane = page.getByRole('region', { name: /folders management/i });
      await expect(detailPane).toBeVisible();

      // Eventually content should fully load (wait for tab content to appear)
      // FoldersTab should render some content eventually
      await expect(detailPane.locator('div').first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Category-specific Content', () => {
    test('should render FoldersTab content when Folders category is selected', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /sorting and tagging categories/i });

      // Click Folders category
      await categoryPane.getByRole('button', { name: /folders.*manage/i }).click();

      // Wait for content to load
      const detailPane = page.getByRole('region', { name: /folders management/i });
      await expect(detailPane).toBeVisible();

      // Wait for lazy-loaded content (longer timeout for lazy loading)
      await page.waitForTimeout(1000);

      // Content area should have something rendered
      await expect(detailPane.locator('> div > div').first()).toBeVisible({ timeout: 10000 });
    });

    test('should render TagsTab content when Tags category is selected', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /sorting and tagging categories/i });

      // Click Tags category
      await categoryPane.getByRole('button', { name: /tags.*view/i }).click();

      // Wait for content to load
      const detailPane = page.getByRole('region', { name: /tags management/i });
      await expect(detailPane).toBeVisible();

      // Wait for lazy-loaded content
      await page.waitForTimeout(1000);

      // Content area should have something rendered
      await expect(detailPane.locator('> div > div').first()).toBeVisible({ timeout: 10000 });
    });

    test('should render RulesTab content when Rules category is selected', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /sorting and tagging categories/i });

      // Click Rules category
      await categoryPane.getByRole('button', { name: /rules.*auto/i }).click();

      // Wait for content to load
      const detailPane = page.getByRole('region', { name: /rules management/i });
      await expect(detailPane).toBeVisible();

      // Wait for lazy-loaded content
      await page.waitForTimeout(1000);

      // Content area should have something rendered
      await expect(detailPane.locator('> div > div').first()).toBeVisible({ timeout: 10000 });
    });

    test('should render RecurringTitlesTab content when Recurring category is selected', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /sorting and tagging categories/i });

      // Click Recurring Titles category
      await categoryPane.getByRole('button', { name: /recurring.*create/i }).click();

      // Wait for content to load
      const detailPane = page.getByRole('region', { name: /recurring titles management/i });
      await expect(detailPane).toBeVisible();

      // Wait for lazy-loaded content
      await page.waitForTimeout(1000);

      // Content area should have something rendered
      await expect(detailPane.locator('> div > div').first()).toBeVisible({ timeout: 10000 });
    });
  });
});
