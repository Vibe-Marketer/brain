import { test, expect } from '@playwright/test';

/**
 * Analytics page navigation tests — categories, detail panes, data rendering.
 */

test.describe('Analytics Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    await page.waitForURL(/\/analytics/, { timeout: 30_000 });
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 20_000 });
  });

  test('should display analytics page', async ({ page }) => {
    await expect(
      page.getByText(/analytics/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('should show Overview category', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /overview/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('should show Call Duration category', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /duration/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('should show Participation category', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /participation|speakers/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('should show Talk Time category', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /talk.*time|engagement/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('should show Tags & Categories category', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /tags|categories/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('should show Content Created category', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /content/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('should open detail pane when clicking Overview', async ({ page }) => {
    await page.getByRole('button', { name: /overview/i }).first().click();
    await page.waitForTimeout(1_000);

    // Detail pane or content should render
    const detail = page.getByRole('region', { name: /overview/i }).or(
      page.getByRole('heading', { name: /overview/i })
    );
    await expect(detail.first()).toBeVisible({ timeout: 10_000 });
  });

  test('should open detail pane when clicking Duration', async ({ page }) => {
    await page.getByRole('button', { name: /duration/i }).first().click();
    await page.waitForTimeout(1_000);

    const detail = page.getByRole('region', { name: /duration/i }).or(
      page.getByRole('heading', { name: /duration/i })
    );
    await expect(detail.first()).toBeVisible({ timeout: 10_000 });
  });

  test('should navigate via URL to specific analytics category', async ({ page }) => {
    await page.goto('/analytics/overview');
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByText(/overview/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('should not have console errors during navigation', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    // Navigate through all categories
    const categories = ['overview', 'duration', 'participation', 'talk.*time', 'tags', 'content'];
    for (const cat of categories) {
      const btn = page.getByRole('button', { name: new RegExp(cat, 'i') }).first();
      const isVisible = await btn.isVisible().catch(() => false);
      if (isVisible) {
        await btn.click();
        await page.waitForTimeout(500);
      }
    }

    const realErrors = errors.filter(
      (e) =>
        !e.includes('[HMR]') &&
        !e.includes('React DevTools') &&
        !e.includes('Download the React DevTools')
    );
    expect(realErrors).toHaveLength(0);
  });
});
