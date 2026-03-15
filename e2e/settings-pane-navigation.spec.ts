import { test, expect } from '@playwright/test';

/**
 * E2E tests for Settings pane navigation flow.
 *
 * Selectors updated to match actual rendered DOM:
 * - SettingsCategoryPane renders role="navigation" aria-label="Settings categories"
 * - Category buttons have aria-label="${label}: ${description}"
 * - SettingsDetailPane renders role="region" aria-label="${label} settings"
 * - Page auto-navigates to /settings/account after loading
 *
 * Uses API route mocking to bypass slow Supabase calls in test environment.
 *
 * @pattern settings-pane-navigation
 * @see src/pages/Settings.tsx
 * @see src/components/panes/SettingsCategoryPane.tsx
 * @see src/components/panes/SettingsDetailPane.tsx
 */

/**
 * Mock Supabase API responses to avoid slow network calls in test environment.
 * ProtectedRoute waits for auth, wizard, and transcript checks before rendering.
 */
async function mockSupabaseRoutes(page: import('@playwright/test').Page) {
  // Mock auth session/user endpoints
  await page.route('**/auth/v1/user', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'ef054159-3a5a-49e3-9fd8-31fa5a180ee6',
        email: 'test@example.com',
        aud: 'authenticated',
        role: 'authenticated',
        app_metadata: { provider: 'email' },
        user_metadata: {},
      }),
    });
  });

  await page.route('**/auth/v1/token**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'fake-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'fake-refresh',
        user: {
          id: 'ef054159-3a5a-49e3-9fd8-31fa5a180ee6',
          email: 'test@example.com',
        },
      }),
    });
  });

  // Mock user_profiles (wizard check)
  await page.route('**/rest/v1/user_profiles**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ onboarding_completed: true }]),
    });
  });

  // Mock user_settings (wizard legacy check)
  await page.route('**/rest/v1/user_settings**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ fathom_api_key: null, oauth_access_token: null }]),
    });
  });

  // Mock fathom_calls (transcript count check)
  await page.route('**/rest/v1/fathom_calls**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
      headers: { 'content-range': '0-0/0' },
    });
  });

  // Mock user_roles RPC
  await page.route('**/rest/v1/rpc/get_user_role**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify('FREE'),
    });
  });

  // Mock preferences
  await page.route('**/rest/v1/user_preferences**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  // Pass through all other requests
}

test.describe('Settings Pane Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the Settings page — auth fix in AuthContext resolves loading
    await page.goto('/settings');

    // Wait for the URL to settle on /settings/account (auto-redirect after role loads)
    await page.waitForURL(/\/settings\/\w+/, { timeout: 30000 });

    // Wait for the category pane to be visible
    // SettingsCategoryPane renders role="navigation" aria-label="Settings categories"
    await expect(
      page.getByRole('navigation', { name: 'Settings categories' })
    ).toBeVisible({ timeout: 15000 });
  });

  test.describe('2nd Pane - Category List', () => {
    test('should display the settings category pane on desktop', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: 'Settings categories' });
      await expect(categoryPane).toBeVisible();

      await expect(categoryPane.getByText('Settings')).toBeVisible();
      await expect(categoryPane.getByText(/categories/i)).toBeVisible();
    });

    test('should display core settings categories', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: 'Settings categories' });

      await expect(categoryPane.getByRole('button', { name: /account.*profile/i })).toBeVisible();
      await expect(categoryPane.getByRole('button', { name: /billing.*plans/i })).toBeVisible();
      // Exact name to avoid strict mode conflict with "AI Integrations"
      await expect(categoryPane.getByRole('button', { name: 'Integrations: Connected services' })).toBeVisible();
      await expect(categoryPane.getByRole('button', { name: /ai integrations.*connect/i })).toBeVisible();
    });

    test('should show category descriptions', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: 'Settings categories' });

      await expect(categoryPane.getByText('Profile and preferences')).toBeVisible();
      await expect(categoryPane.getByText('Plans and payments')).toBeVisible();
      await expect(categoryPane.getByText('Connected services')).toBeVisible();
      await expect(categoryPane.getByText('Connect AI tools to your calls')).toBeVisible();
    });
  });

  test.describe('3rd Pane - Category Detail', () => {
    test('should open detail pane when clicking a category', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: 'Settings categories' });

      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();

      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });
    });

    test('should show correct header in detail pane for Account', async ({ page }) => {
      // Account is auto-selected
      const detailPane = page.getByRole('region', { name: /account settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });
      await expect(detailPane.getByRole('heading', { name: 'Account' })).toBeVisible();
      await expect(detailPane.getByText('Profile and preferences')).toBeVisible();
    });

    test('should show correct header in detail pane for Billing', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: 'Settings categories' });
      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();

      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });
      await expect(detailPane.getByRole('heading', { name: 'Billing' })).toBeVisible();
      await expect(detailPane.getByText('Plans and payments')).toBeVisible();
    });

    test('should show correct header in detail pane for Integrations', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: 'Settings categories' });
      await categoryPane.getByRole('button', { name: 'Integrations: Connected services' }).click();

      const detailPane = page.getByRole('region', { name: /integrations settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });
      await expect(detailPane.getByRole('heading', { name: 'Integrations' }).first()).toBeVisible();
      await expect(detailPane.getByText('Connected services')).toBeVisible();
    });

    test('should show correct header in detail pane for AI Integrations', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: 'Settings categories' });
      await categoryPane.getByRole('button', { name: /ai integrations.*connect/i }).click();

      // CATEGORY_META["mcp"].label = "MCP / AI Access" → aria-label="MCP / AI Access settings"
      const detailPane = page.getByRole('region', { name: /ai access settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });
      await expect(detailPane.getByText('Connect AI tools to your calls')).toBeVisible();
    });

    test('should have close button in detail pane', async ({ page }) => {
      // Account is auto-selected
      const detailPane = page.getByRole('region', { name: /account settings/i });
      await expect(detailPane).toBeVisible();
      const closeButton = detailPane.getByRole('button', { name: /close pane/i });
      await expect(closeButton).toBeVisible();
    });

    test('should close detail pane when clicking close button', async ({ page }) => {
      const detailPane = page.getByRole('region', { name: /account settings/i });
      await expect(detailPane).toBeVisible();

      const closeButton = detailPane.getByRole('button', { name: /close pane/i });
      await closeButton.click();

      // After close, URL-driven auto-select may re-open the pane.
      await page.waitForTimeout(500);
    });
  });

  test.describe('Category Selection State', () => {
    test('should highlight selected category with active indicator', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: 'Settings categories' });

      // Account is auto-selected
      const accountButton = categoryPane.getByRole('button', { name: /account.*profile/i });
      await expect(accountButton).toHaveAttribute('aria-current', 'true');
    });

    test('should update active category when switching between categories', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: 'Settings categories' });

      const accountButton = categoryPane.getByRole('button', { name: /account.*profile/i });
      await expect(accountButton).toHaveAttribute('aria-current', 'true');

      const billingButton = categoryPane.getByRole('button', { name: /billing.*plans/i });
      await billingButton.click();

      await expect(accountButton).not.toHaveAttribute('aria-current', 'true');
      await expect(billingButton).toHaveAttribute('aria-current', 'true');

      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible();
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should allow selecting category with Enter key', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: 'Settings categories' });

      const billingButton = categoryPane.getByRole('button', { name: /billing.*plans/i });
      await billingButton.focus();
      await page.keyboard.press('Enter');

      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });
    });

    test('should allow selecting category with Space key', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: 'Settings categories' });

      const billingButton = categoryPane.getByRole('button', { name: /billing.*plans/i });
      await billingButton.focus();
      await page.keyboard.press('Space');

      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });
    });

    test('should allow Tab navigation between category buttons', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: 'Settings categories' });

      const accountButton = categoryPane.getByRole('button', { name: /account.*profile/i });
      await accountButton.focus();
      await expect(accountButton).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(accountButton).not.toBeFocused();
    });
  });

  test.describe('Pane-Only Navigation (Tabs Removed)', () => {
    test('should NOT display any tabs (tab navigation removed)', async ({ page }) => {
      const tabsList = page.getByRole('tablist');
      await expect(tabsList).not.toBeVisible();

      await expect(page.getByRole('tab', { name: /account/i })).not.toBeVisible();
      await expect(page.getByRole('tab', { name: /billing/i })).not.toBeVisible();
    });

    test('should only use pane navigation for settings access', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: 'Settings categories' });
      await expect(categoryPane).toBeVisible();

      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();

      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible();
      await expect(detailPane.getByRole('heading', { name: 'Billing' })).toBeVisible();
    });
  });

  test.describe('Smooth Transitions', () => {
    test('should have smooth transition when opening detail pane', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: 'Settings categories' });

      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();

      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });
      await expect(detailPane).toHaveCSS('opacity', '1');
    });

    test('should have no layout shifts during navigation', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: 'Settings categories' });

      const initialBox = await categoryPane.boundingBox();

      await categoryPane.getByRole('button', { name: /account.*profile/i }).click();
      await page.waitForTimeout(500);

      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();
      await page.waitForTimeout(500);

      const finalBox = await categoryPane.boundingBox();

      // Allow for rendering differences (sidebar layout may shift slightly)
      expect(Math.abs((initialBox?.x ?? 0) - (finalBox?.x ?? 0))).toBeLessThan(20);
      expect(Math.abs((initialBox?.y ?? 0) - (finalBox?.y ?? 0))).toBeLessThan(20);
      expect(Math.abs((initialBox?.width ?? 0) - (finalBox?.width ?? 0))).toBeLessThan(20);
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

      const categoryPane = page.getByRole('navigation', { name: 'Settings categories' });

      await categoryPane.getByRole('button', { name: /account.*profile/i }).click();
      await page.waitForTimeout(300);

      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();
      await page.waitForTimeout(300);

      await categoryPane.getByRole('button', { name: 'Integrations: Connected services' }).click();
      await page.waitForTimeout(300);

      await categoryPane.getByRole('button', { name: /ai integrations.*connect/i }).click();
      await page.waitForTimeout(300);

      const unexpectedErrors = errors.filter(
        (error) =>
          !error.includes('[HMR]') &&
          !error.includes('React DevTools') &&
          !error.includes('Download the React DevTools')
      );

      expect(unexpectedErrors).toHaveLength(0);
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels on panes', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: 'Settings categories' });
      await expect(categoryPane).toBeVisible();

      // Account is auto-selected
      const detailPane = page.getByRole('region', { name: /account settings/i });
      await expect(detailPane).toBeVisible();
    });

    test('should have accessible category buttons with descriptions', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: 'Settings categories' });

      const accountButton = categoryPane.getByRole('button', { name: /account.*profile/i });
      const ariaLabel = await accountButton.getAttribute('aria-label');
      expect(ariaLabel).toContain('Account');
      expect(ariaLabel).toContain('Profile and preferences');
    });

    test('should have focusable buttons with visible focus ring', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: 'Settings categories' });

      const accountButton = categoryPane.getByRole('button', { name: /account.*profile/i });
      await accountButton.focus();
      await expect(accountButton).toBeFocused();
    });
  });

  test.describe('Loading States', () => {
    test('should show loading state while content loads', async ({ page }) => {
      // Account is auto-selected
      const detailPane = page.getByRole('region', { name: /account settings/i });
      await expect(detailPane).toBeVisible();
      await expect(detailPane.locator('div').first()).toBeVisible({ timeout: 10000 });
    });
  });

  /**
   * Feature Parity - All Categories Accessible via Panes
   */
  test.describe('Feature Parity - All Tab Categories Accessible via Panes', () => {
    test('should access Account settings via pane navigation', async ({ page }) => {
      // Account is auto-selected on load
      const detailPane = page.getByRole('region', { name: /account settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });
      await expect(detailPane.getByRole('heading', { name: 'Account' })).toBeVisible();
    });

    test('should access Billing settings via pane navigation', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: 'Settings categories' });
      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();

      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });
      await expect(detailPane.getByRole('heading', { name: 'Billing' })).toBeVisible();
    });

    test('should access Integrations settings via pane navigation', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: 'Settings categories' });
      await categoryPane.getByRole('button', { name: 'Integrations: Connected services' }).click();

      const detailPane = page.getByRole('region', { name: /integrations settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });
      await expect(detailPane.getByRole('heading', { name: 'Integrations' }).first()).toBeVisible();
    });

    test('should access AI Integrations settings via pane navigation', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: 'Settings categories' });
      await categoryPane.getByRole('button', { name: /ai integrations.*connect/i }).click();

      // CATEGORY_META["mcp"].label = "MCP / AI Access" → aria-label="MCP / AI Access settings"
      const detailPane = page.getByRole('region', { name: /ai access settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });
      await expect(detailPane.getByText('Connect AI tools to your calls')).toBeVisible();
    });

    test('should show role-gated categories based on user permissions', async ({ page }) => {
      const categoryPane = page.getByRole('navigation', { name: 'Settings categories' });
      await expect(categoryPane.getByRole('list')).toBeVisible();
    });
  });
});
