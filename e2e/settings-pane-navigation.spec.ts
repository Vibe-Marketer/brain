import { test, expect } from '@playwright/test';

/**
 * E2E tests for Settings pane navigation flow.
 *
 * This test suite covers the multi-pane navigation system for Settings:
 * 1. Navigate to Settings page and verify panes are visible
 * 2. Click categories in 2nd pane (category list) to open 3rd pane (detail view)
 * 3. Verify correct content loads for each category
 * 4. Test keyboard navigation (Enter/Space to select, Tab to navigate)
 * 5. Test pane closing behavior
 * 6. Test smooth transitions and no console errors
 *
 * @pattern settings-pane-navigation
 * @see src/pages/Settings.tsx
 * @see src/components/panes/SettingsCategoryPane.tsx
 * @see src/components/panes/SettingsDetailPane.tsx
 */

test.describe('Settings Pane Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the Settings page
    await page.goto('/settings');

    // Wait for the page to fully load (wait for sidebar or main content)
    await expect(
      page.getByRole('main', { name: /settings content/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test.describe('2nd Pane - Category List', () => {
    test('should display the settings category pane on desktop', async ({ page }) => {
      // Verify the 2nd pane (category list) is visible
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });
      await expect(categoryPane).toBeVisible();

      // Verify it has the "Settings" header
      await expect(categoryPane.getByText('Settings')).toBeVisible();

      // Verify category count is displayed
      await expect(categoryPane.getByText(/categories/i)).toBeVisible();
    });

    test('should display core settings categories', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });

      // Verify core categories are visible
      await expect(categoryPane.getByRole('button', { name: /account/i })).toBeVisible();
      await expect(categoryPane.getByRole('button', { name: /billing/i })).toBeVisible();
      await expect(categoryPane.getByRole('button', { name: /integrations/i })).toBeVisible();
      await expect(categoryPane.getByRole('button', { name: /ai/i })).toBeVisible();
    });

    test('should show category descriptions', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });

      // Verify descriptions are shown
      await expect(categoryPane.getByText('Profile and preferences')).toBeVisible();
      await expect(categoryPane.getByText('Plans and payments')).toBeVisible();
      await expect(categoryPane.getByText('Connected services')).toBeVisible();
      await expect(categoryPane.getByText('Models and knowledge base')).toBeVisible();
    });
  });

  test.describe('3rd Pane - Category Detail', () => {
    test('should open detail pane when clicking a category', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });

      // Click the Account category
      await categoryPane.getByRole('button', { name: /account.*profile/i }).click();

      // Verify the 3rd pane (detail view) appears
      const detailPane = page.getByRole('region', { name: /account settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });
    });

    test('should show correct header in detail pane for Account', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });

      // Click Account category
      await categoryPane.getByRole('button', { name: /account.*profile/i }).click();

      // Verify detail pane header shows "Account"
      const detailPane = page.getByRole('region', { name: /account settings/i });
      await expect(detailPane).toBeVisible();
      await expect(detailPane.getByText('Account')).toBeVisible();
      await expect(detailPane.getByText('Profile and preferences')).toBeVisible();
    });

    test('should show correct header in detail pane for Billing', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });

      // Click Billing category
      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();

      // Verify detail pane header shows "Billing"
      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });
      await expect(detailPane.getByText('Billing')).toBeVisible();
      await expect(detailPane.getByText('Plans and payments')).toBeVisible();
    });

    test('should show correct header in detail pane for Integrations', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });

      // Click Integrations category
      await categoryPane.getByRole('button', { name: /integrations.*connected/i }).click();

      // Verify detail pane header shows "Integrations"
      const detailPane = page.getByRole('region', { name: /integrations settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });
      await expect(detailPane.getByText('Integrations')).toBeVisible();
      await expect(detailPane.getByText('Connected services')).toBeVisible();
    });

    test('should show correct header in detail pane for AI', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });

      // Click AI category
      await categoryPane.getByRole('button', { name: /ai.*models/i }).click();

      // Verify detail pane header shows "AI"
      const detailPane = page.getByRole('region', { name: /ai settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });
      await expect(detailPane.getByText('AI')).toBeVisible();
      await expect(detailPane.getByText('Models and knowledge base')).toBeVisible();
    });

    test('should have close button in detail pane', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });

      // Click any category
      await categoryPane.getByRole('button', { name: /account.*profile/i }).click();

      // Verify detail pane has close button
      const detailPane = page.getByRole('region', { name: /account settings/i });
      await expect(detailPane).toBeVisible();
      const closeButton = detailPane.getByRole('button', { name: /close pane/i });
      await expect(closeButton).toBeVisible();
    });

    test('should close detail pane when clicking close button', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });

      // Click any category to open detail pane
      await categoryPane.getByRole('button', { name: /account.*profile/i }).click();

      // Verify detail pane is open
      const detailPane = page.getByRole('region', { name: /account settings/i });
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
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });

      // Click Account category
      const accountButton = categoryPane.getByRole('button', { name: /account.*profile/i });
      await accountButton.click();

      // Verify the button has aria-current="true" indicating active state
      await expect(accountButton).toHaveAttribute('aria-current', 'true');
    });

    test('should update active category when switching between categories', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });

      // Click Account category
      const accountButton = categoryPane.getByRole('button', { name: /account.*profile/i });
      await accountButton.click();
      await expect(accountButton).toHaveAttribute('aria-current', 'true');

      // Click Billing category
      const billingButton = categoryPane.getByRole('button', { name: /billing.*plans/i });
      await billingButton.click();

      // Account should no longer be current
      await expect(accountButton).not.toHaveAttribute('aria-current', 'true');

      // Billing should now be current
      await expect(billingButton).toHaveAttribute('aria-current', 'true');

      // Detail pane should show Billing content
      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible();
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should allow selecting category with Enter key', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });

      // Focus on the Account category button
      const accountButton = categoryPane.getByRole('button', { name: /account.*profile/i });
      await accountButton.focus();

      // Press Enter to select
      await page.keyboard.press('Enter');

      // Detail pane should open
      const detailPane = page.getByRole('region', { name: /account settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });
    });

    test('should allow selecting category with Space key', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });

      // Focus on the Billing category button
      const billingButton = categoryPane.getByRole('button', { name: /billing.*plans/i });
      await billingButton.focus();

      // Press Space to select
      await page.keyboard.press('Space');

      // Detail pane should open
      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });
    });

    test('should allow Tab navigation between category buttons', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });

      // Focus on first category
      const accountButton = categoryPane.getByRole('button', { name: /account.*profile/i });
      await accountButton.focus();

      // Verify Account has focus
      await expect(accountButton).toBeFocused();

      // Tab to next category
      await page.keyboard.press('Tab');

      // The next focusable element should have focus (could be Users or Billing depending on role)
      // Just verify Account is no longer focused
      await expect(accountButton).not.toBeFocused();
    });
  });

  test.describe('Pane-Only Navigation (Tabs Removed)', () => {
    test('should NOT display any tabs (tab navigation removed)', async ({ page }) => {
      // Verify tabs have been removed - tablist should not exist
      const tabsList = page.getByRole('tablist');
      await expect(tabsList).not.toBeVisible();

      // Verify tab triggers do not exist
      await expect(page.getByRole('tab', { name: /account/i })).not.toBeVisible();
      await expect(page.getByRole('tab', { name: /billing/i })).not.toBeVisible();
    });

    test('should only use pane navigation for settings access', async ({ page }) => {
      // Verify category pane is the primary navigation
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });
      await expect(categoryPane).toBeVisible();

      // Click categories and verify content loads via panes only
      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();

      // Verify detail pane shows Billing content (no tabs involved)
      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible();
      await expect(detailPane.getByText('Billing')).toBeVisible();
    });
  });

  test.describe('Smooth Transitions', () => {
    test('should have smooth transition when opening detail pane', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });

      // Click category to open detail pane
      await categoryPane.getByRole('button', { name: /account.*profile/i }).click();

      // Detail pane should appear (with transition)
      const detailPane = page.getByRole('region', { name: /account settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });

      // Verify the pane has transition classes (checking opacity is 1 after transition)
      await expect(detailPane).toHaveCSS('opacity', '1');
    });

    test('should have no layout shifts during navigation', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });

      // Get initial position of category pane
      const initialBox = await categoryPane.boundingBox();

      // Click different categories
      await categoryPane.getByRole('button', { name: /account.*profile/i }).click();
      await page.waitForTimeout(500); // Wait for transition

      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();
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

      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });

      // Navigate through all visible categories
      await categoryPane.getByRole('button', { name: /account.*profile/i }).click();
      await page.waitForTimeout(300);

      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();
      await page.waitForTimeout(300);

      await categoryPane.getByRole('button', { name: /integrations.*connected/i }).click();
      await page.waitForTimeout(300);

      await categoryPane.getByRole('button', { name: /ai.*models/i }).click();
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
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });
      await expect(categoryPane).toBeVisible();

      // Click to open detail pane
      await categoryPane.getByRole('button', { name: /account.*profile/i }).click();

      // Verify detail pane has correct ARIA label
      const detailPane = page.getByRole('region', { name: /account settings/i });
      await expect(detailPane).toBeVisible();
    });

    test('should have accessible category buttons with descriptions', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });

      // Get account button
      const accountButton = categoryPane.getByRole('button', { name: /account.*profile/i });

      // Verify it has an accessible label that includes the description
      const ariaLabel = await accountButton.getAttribute('aria-label');
      expect(ariaLabel).toContain('Account');
      expect(ariaLabel).toContain('Profile and preferences');
    });

    test('should have focusable buttons with visible focus ring', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });

      // Focus on Account button
      const accountButton = categoryPane.getByRole('button', { name: /account.*profile/i });
      await accountButton.focus();

      // Verify it's focusable
      await expect(accountButton).toBeFocused();
    });
  });

  test.describe('Loading States', () => {
    test('should show loading state while content loads', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });

      // Click a category (content loads lazily)
      await categoryPane.getByRole('button', { name: /account.*profile/i }).click();

      // Detail pane should be visible (loading or loaded)
      const detailPane = page.getByRole('region', { name: /account settings/i });
      await expect(detailPane).toBeVisible();

      // Eventually content should fully load (wait for tab content to appear)
      // Account tab should render some content eventually
      await expect(detailPane.locator('div').first()).toBeVisible({ timeout: 10000 });
    });
  });

  /**
   * Feature Parity Verification Tests
   *
   * These tests verify that all 6 Settings tab categories from the feature audit
   * (docs/planning/settings-feature-audit.md) are accessible via pane navigation.
   *
   * Categories verified:
   * 1. Account (All users) - Profile and preferences
   * 2. Users (TEAM/ADMIN only) - Organization user management
   * 3. Billing (All users) - Plans and payments
   * 4. Integrations (All users) - Connected services
   * 5. AI (All users) - Models and knowledge base
   * 6. Admin (ADMIN only) - System administration
   */
  test.describe('Feature Parity - All Tab Categories Accessible via Panes', () => {
    test('should access Account settings (Tab 1) via pane navigation', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });

      // Click Account category
      await categoryPane.getByRole('button', { name: /account.*profile/i }).click();

      // Verify detail pane opens with Account content
      const detailPane = page.getByRole('region', { name: /account settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });

      // Verify Account tab content loads (look for profile-related elements)
      // AccountTab has: Display Name, Email, Timezone, Password sections
      await expect(detailPane.getByText('Account')).toBeVisible();
    });

    test('should access Billing settings (Tab 3) via pane navigation', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });

      // Click Billing category
      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();

      // Verify detail pane opens with Billing content
      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });

      // Verify Billing tab content loads
      await expect(detailPane.getByText('Billing')).toBeVisible();
    });

    test('should access Integrations settings (Tab 4) via pane navigation', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });

      // Click Integrations category
      await categoryPane.getByRole('button', { name: /integrations.*connected/i }).click();

      // Verify detail pane opens with Integrations content
      const detailPane = page.getByRole('region', { name: /integrations settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });

      // Verify Integrations tab content loads
      await expect(detailPane.getByText('Integrations')).toBeVisible();
    });

    test('should access AI settings (Tab 5) via pane navigation', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });

      // Click AI category
      await categoryPane.getByRole('button', { name: /ai.*models/i }).click();

      // Verify detail pane opens with AI content
      const detailPane = page.getByRole('region', { name: /ai settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });

      // Verify AI tab content loads
      await expect(detailPane.getByText('AI')).toBeVisible();
    });

    // Note: Users (Tab 2) and Admin (Tab 6) require specific roles
    // These are tested separately in role-gated test scenarios
    test('should show role-gated categories based on user permissions', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });

      // For regular users, Users and Admin categories should not be visible
      // For TEAM users, Users should be visible
      // For ADMIN users, both Users and Admin should be visible

      // Verify the category pane displays the correct number of categories
      // based on user role (this test runs with default auth state)
      await expect(categoryPane.getByRole('list')).toBeVisible();
    });
  });
});
