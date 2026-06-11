import { test, expect } from '@playwright/test';

/**
 * New-account signup E2E (ticket 3d1da686).
 *
 * Walks the REAL signup UI flow — the layer that broke twice while the bare
 * /auth/v1/signup API call stayed green. Runs logged-out (project "signup" in
 * playwright.config.ts has no storageState and no auth-setup dependency).
 *
 * Base URL is configurable via BASE_URL (defaults to localhost dev server;
 * CI points it at staging/production).
 *
 * Cleanup: the throwaway email uses the @callvault.test domain, which the
 * service-role RPC `cleanup_test_fixture_users` is allowed to hard-delete
 * (it bypasses the three protective DELETE triggers). Plain
 * /auth/v1/admin/users DELETE is blocked by `prevent_last_workspace_owner`
 * for a fresh signup, because the auto-created personal workspace has exactly
 * one owner.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.describe('new-account signup', () => {
  test('signup UI flow with a fresh email reaches the confirmation state', async ({ page }) => {
    const email = `e2e-signup-${Date.now()}@callvault.test`;
    const password = `E2e!Signup-${Date.now()}`;

    const consoleErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });

    // Capture the signup API response the SITE makes (not a bare curl).
    const signupResponsePromise = page.waitForResponse(
      (r) => r.url().includes('/auth/v1/signup') && r.request().method() === 'POST',
    );

    await page.goto('/login?signup=true');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').first().fill(password);
    await page.locator('button[type="submit"]').first().click();

    const signupResponse = await signupResponsePromise;
    expect(
      signupResponse.status(),
      `site-initiated /auth/v1/signup must succeed (body: ${await signupResponse.text().catch(() => 'unreadable')})`,
    ).toBeLessThan(300);

    // Success state: the email-confirmation screen (email confirmation is
    // enabled in production, so no session is returned on signup).
    await expect(page.getByText(`We sent a confirmation link to ${email}`)).toBeVisible({
      timeout: 15_000,
    });

    // The failure mode of this incident: a generic error toast.
    await expect(page.getByText(/unexpected error occurred/i)).toHaveCount(0);
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);

    expect(
      consoleErrors.filter((e) => !/sentry|ERR_ABORTED/i.test(e)),
      `no console errors during signup, got: ${consoleErrors.join(' | ')}`,
    ).toHaveLength(0);
  });

  test.afterAll(async ({ request }) => {
    // Best-effort cleanup of the created user via service-role RPC.
    // Skipped (with a log line) when the service key isn't configured —
    // @callvault.test users are also swept by the scheduled fixture cleanup.
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.log('signup.spec cleanup skipped: VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
      return;
    }
    try {
      const res = await request.post(`${SUPABASE_URL}/rest/v1/rpc/cleanup_test_fixture_users`, {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        data: { p_max_age_minutes: 0 },
      });
      console.log('signup.spec cleanup:', res.status(), (await res.text()).slice(0, 300));
    } catch (err) {
      console.log('signup.spec cleanup failed (non-fatal):', err);
    }
  });
});
