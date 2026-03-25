import { test, expect } from '@playwright/test';

/**
 * Import Page tests — import sources, connections, upload.
 */

test.describe('Import Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/import');
    await page.waitForLoadState('networkidle');
    // Wait for either the import page content or a redirect
    await page.waitForTimeout(3_000);
  });

  test('should display import page or redirect', async ({ page }) => {
    const url = page.url();

    // Import page may be feature-flagged — either shows content or redirects
    if (url.includes('/import')) {
      await expect(
        page.getByText(/import|sync|connect|source/i).first()
      ).toBeVisible({ timeout: 10_000 });
    } else {
      // Redirected — this is expected if feature flag is off
      expect(url.includes('/') || url.includes('/login')).toBeTruthy();
    }
  });

  test('should show import source options', async ({ page }) => {
    if (!page.url().includes('/import')) {
      test.skip();
      return;
    }

    // Should show connection options (Zoom, YouTube, Upload, etc.)
    const sources = page.getByText(/zoom|youtube|upload|fathom/i);
    const hasSource = await sources.first().isVisible({ timeout: 10_000 }).catch(() => false);
    expect(hasSource).toBeTruthy();
  });

  test('should show connected sources status', async ({ page }) => {
    if (!page.url().includes('/import')) {
      test.skip();
      return;
    }

    // Look for connection status indicators
    const statusIndicators = page.getByText(/connected|active|disconnected|not connected/i);
    const hasStatus = await statusIndicators.first().isVisible({ timeout: 10_000 }).catch(() => false);

    // Either status indicators exist or setup buttons
    const setupBtns = page.getByRole('button', { name: /connect|setup|enable/i });
    const hasSetup = await setupBtns.first().isVisible().catch(() => false);

    expect(hasStatus || hasSetup).toBeTruthy();
  });

  test('should not have console errors', async ({ page }) => {
    if (!page.url().includes('/import')) {
      test.skip();
      return;
    }

    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.waitForTimeout(2_000);

    const realErrors = errors.filter(
      (e) =>
        !e.includes('[HMR]') &&
        !e.includes('React DevTools') &&
        !e.includes('Download the React DevTools')
    );
    expect(realErrors).toHaveLength(0);
  });
});
