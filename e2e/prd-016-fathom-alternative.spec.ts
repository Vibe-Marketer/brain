import { test, expect } from '@playwright/test';

/**
 * PRD-016: Verify Fathom alternative promotion in Google Meet wizard
 */
test.describe('PRD-016: Google Meet Fathom Alternative', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the app
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check if we need to login (look for sign in button or form)
    const signInButton = page.getByRole('button', { name: /sign in/i });
    const isLoginPage = await signInButton.isVisible().catch(() => false);

    if (isLoginPage) {
      // Fill in login credentials
      await page.getByRole('textbox', { name: /email/i }).fill('a@vibeos.com');
      await page.getByRole('textbox', { name: /password/i }).fill('Naegele1');
      await page.getByRole('button', { name: /sign in/i }).click();

      // Wait for redirect after login
      await page.waitForURL((url) => !url.pathname.includes('login'), { timeout: 15000 });
      await page.waitForLoadState('networkidle');
    }
  });

  test('should show Fathom alternative in Google Meet wizard step 2', async ({ page }) => {
    // Navigate to Settings > Integrations
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click on Integrations category
    await page.locator('text=Integrations').first().click();
    await page.waitForTimeout(2000);

    // Find the Google Meet section and scroll it into view
    const googleMeetHeading = page.getByRole('heading', { name: 'Google Meet Integration' });
    await googleMeetHeading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Find the Connect button that's inside the Google Meet section
    // The structure has the heading, then a card with the Connect button
    // We need to find the Connect button that follows the Google Meet heading
    const googleMeetSection = page.locator('div').filter({ has: googleMeetHeading }).first();

    // Try to find Connect button within the Google Meet section
    let connectButton = googleMeetSection.getByRole('button', { name: 'Connect' });

    // If not found in section, find by looking at all Connect buttons and clicking the one for Google Meet
    if (!(await connectButton.isVisible({ timeout: 2000 }).catch(() => false))) {
      // The page has multiple Connect buttons - find the one near Google Meet text
      // Based on the DOM structure, it's the first Connect button (Fathom shows Reconnect)
      connectButton = page.getByRole('button', { name: 'Connect', exact: true }).first();
    }

    await expect(connectButton).toBeVisible({ timeout: 5000 });
    await connectButton.click();

    // Wait for dialog to open - the wizard is a Dialog component
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Click Next to proceed to step 2 (Important Information)
    const nextButton = dialog.getByRole('button', { name: /next/i });
    await expect(nextButton).toBeVisible({ timeout: 5000 });
    await nextButton.click();

    // Verify we're on step 2 - should show Recording Requirements warning
    await expect(dialog.getByText('Recording Requirements', { exact: true })).toBeVisible({ timeout: 5000 });

    // Verify the Fathom alternative section is visible
    await expect(dialog.getByText('Have a personal Google account?')).toBeVisible();
    await expect(dialog.getByText(/Connect Fathom instead/i)).toBeVisible();

    // Verify the Fathom sign-up link exists with correct href
    const fathomLink = dialog.getByRole('link', { name: /sign up for fathom/i });
    await expect(fathomLink).toBeVisible();
    await expect(fathomLink).toHaveAttribute('href', 'https://vibelinks.co/fathom');
    await expect(fathomLink).toHaveAttribute('target', '_blank');

    // Take a screenshot for verification
    await page.screenshot({ path: 'e2e/screenshots/prd-016-fathom-alternative.png', fullPage: false });

    console.log('✅ PRD-016 verification complete: Fathom alternative is visible with correct link');
  });
});
