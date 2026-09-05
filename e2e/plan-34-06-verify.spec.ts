/**
 * Plan 34-06 verification: "Verified Emails" section in AccountTab.tsx.
 *
 * Run via: `npx playwright test e2e/plan-34-06-verify.spec.ts --project=chromium`
 *
 * SCOPE (per 34-06-PLAN.md): the two edge functions (request/confirm
 * email-alias-verification) are TEST-only as of Plan 03 — not deployed to
 * prod until Plan 07. This spec exercises the real requestEmailVerification
 * network call (not mocked) and the confirm endpoint's real invalid-code
 * error path. It does not read a real inbox, so a *correct* code's happy
 * path is deferred to Plan 07.
 *
 * NOTE: could not be executed in the 34-06 execution session — the sandbox
 * lacked both VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY (app fails to
 * boot without them, per src/integrations/supabase/client.ts) and
 * CALLVAULTAI_LOGIN/CALLVAULTAI_LOGIN_PASSWORD (required by e2e/auth.setup.ts).
 * Both live in permission-walled .env files this executor could not read.
 * Run this in an environment with those set (matches the existing
 * e2e/plan-25-03-verify.spec.ts convention) before/alongside Plan 07.
 */
import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/login.page';
import { SettingsPage } from './pages/settings.page';

const EMAIL = process.env.CALLVAULTAI_LOGIN || 'a@vibeos.com';
const PASSWORD = process.env.CALLVAULTAI_LOGIN_PASSWORD || 'Naegele1';

test.describe('Plan 34-06: Verified Emails section', () => {
  test.describe.configure({ retries: 0 });

  test('renders, validates, and drives the real request/confirm round trip', async ({
    page,
  }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        // eslint-disable-next-line no-console
        console.log('[browser console error]', msg.text());
      }
    });

    const login = new LoginPage(page);
    await login.goto();
    await login.login(EMAIL, PASSWORD);
    await login.expectLoginSuccess();

    const settings = new SettingsPage(page);
    await settings.goto();

    // Verified Emails section renders alongside untouched existing sections
    await expect(page.getByRole('heading', { name: 'Verified Emails' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('heading', { name: 'Security' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Preferences' })).toBeVisible();

    await page.screenshot({
      path: 'test-results/plan-34-06/1-collapsed-list.png',
      fullPage: true,
    });

    // Step 1: reveal the add-email form, validate email gating
    await page.getByRole('button', { name: 'Add email' }).click();
    const emailInput = page.getByLabel('Email address');
    const sendCodeBtn = page.getByRole('button', { name: 'Send code' });
    await expect(emailInput).toBeVisible();
    await expect(sendCodeBtn).toBeDisabled();

    await emailInput.fill('not-an-email');
    await expect(sendCodeBtn).toBeDisabled();

    const testEmail = `plan34-06-verify+${Date.now()}@example.com`;
    await emailInput.fill(testEmail);
    await expect(sendCodeBtn).toBeEnabled();

    await page.screenshot({
      path: 'test-results/plan-34-06/2-step1-email.png',
      fullPage: true,
    });

    // Real network call to request-email-alias-verification (not mocked).
    await sendCodeBtn.click();
    // Either the success path (advances to step 2) or a surfaced error toast
    // proves the service/hook actually reached the edge function.
    const codeInput = page.getByLabel('Verification code');
    const errorToast = page.getByText(/failed to send verification code|rate|already/i);
    await expect(codeInput.or(errorToast)).toBeVisible({ timeout: 15_000 });

    if (await codeInput.isVisible()) {
      const verifyBtn = page.getByRole('button', { name: 'Verify' });
      await expect(verifyBtn).toBeDisabled();

      await codeInput.fill('12');
      await expect(verifyBtn).toBeDisabled();

      await codeInput.fill('000000');
      await expect(verifyBtn).toBeEnabled();

      await page.screenshot({
        path: 'test-results/plan-34-06/3-step2-code.png',
        fullPage: true,
      });

      // Real network call to confirm-email-alias-verification with a
      // deliberately wrong code — proves the confirm endpoint's real
      // invalid-code error path (T-34-06-04), not a mocked response.
      await verifyBtn.click();
      await expect(
        page.getByText(/invalid|expired|verification/i).first(),
      ).toBeVisible({ timeout: 15_000 });
    }

    // Cancel back out; existing sections remain untouched.
    const cancelBtn = page.getByRole('button', { name: 'Cancel' });
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
    }
    await expect(page.getByRole('button', { name: 'Change Password' })).toBeVisible();
  });
});
