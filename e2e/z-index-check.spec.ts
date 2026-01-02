import { test, expect } from '@playwright/test';

test.describe('Z-Index Layout Checks', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept Supabase API calls globally
    await page.route('**/rest/v1/**', async (route) => {
      const url = route.request().url();
      
      if (url.includes('fathom_calls')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              recording_id: 1,
              title: 'Test Call 1',
              created_at: new Date().toISOString(),
              duration: 1800,
              calendar_invitees: [],
              user_id: '123'
            }
          ]),
          headers: { 'content-range': '0-0/1' }
        });
      }
      
      if (url.includes('user_profiles')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ onboarding_completed: true })
        });
      }

      if (url.includes('user_settings')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ host_email: 'test@example.com', fathom_api_key: 'fake' })
        });
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    // Mock Auth explicitly via window object if possible, or just intercepts
    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '123',
          email: 'test@example.com',
          aud: 'authenticated',
          role: 'authenticated'
        })
      });
    });

    await page.route('**/auth/v1/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'fake',
          user: { id: '123', email: 'test@example.com' }
        })
      });
    });
  });

  test('bulk action toolbar should be above sidebar', async ({ page }) => {
    // Set a wider viewport so center is clear
    await page.setViewportSize({ width: 1200, height: 800 });
    
    // Navigate to transcripts
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Try to bypass any auth loading by forcing session in localStorage
    await page.evaluate(() => {
      const session = {
        access_token: 'fake',
        refresh_token: 'fake',
        expires_in: 3600,
        token_type: 'bearer',
        user: { id: '123', email: 'test@example.com' }
      };
      window.localStorage.setItem('supabase.auth.token', JSON.stringify(session));
    });

    // Reload to pick up session
    await page.reload();

    // Wait for table - longer timeout for app boot
    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 20000 });

    // Select the first transcript row checkbox
    // nth(0) is header, nth(1) is first row
    const firstRowCheckbox = page.locator('tbody tr').first().locator('button[role="checkbox"], input[type="checkbox"]');
    await firstRowCheckbox.click();

    // Wait for toolbar
    const toolbar = page.locator('div.fixed.bottom-24');
    await expect(toolbar).toBeVisible();

    // Check overlap with sidebar (approx 0-350px)
    // Toolbar is centered. Viewport 1200 -> Center 600.
    // If toolbar width is 800, it spans 200 to 1000.
    // X=300 should be both in Sidebar and Toolbar.
    const checkX = 300;
    
    // Get toolbar bounding box to find Y
    const box = await toolbar.boundingBox();
    if (!box) throw new Error('No toolbar box');
    const checkY = box.y + box.height / 2;

    const topElement = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return {
        tagName: el?.tagName,
        className: el?.className,
        isToolbar: !!el?.closest('.fixed.bottom-24')
      };
    }, { x: checkX, y: checkY });

    console.log('Top element at intersection:', topElement);
    
    // Assertion: The element at the overlap point should be part of the toolbar
    expect(topElement.isToolbar).toBe(true);
  });
});
