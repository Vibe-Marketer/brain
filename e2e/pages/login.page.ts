import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Login Page Object — handles authentication form interactions.
 */
export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[type="email"]');
    this.passwordInput = page.locator('input[type="password"]');
    this.signInButton = page.getByRole('button', { name: /sign in/i }).first();
  }

  async goto() {
    await this.page.goto('/login');
    await expect(this.emailInput).toBeVisible({ timeout: 20_000 });
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }

  async expectLoginSuccess() {
    await this.page.waitForURL((url) => !url.toString().includes('/login'), {
      timeout: 30_000,
    });
    await expect(this.page.locator('nav').first()).toBeVisible({ timeout: 15_000 });
  }

  async expectErrorMessage() {
    // Supabase auth errors show in an alert or toast
    const errorMsg = this.page
      .getByText(/invalid|incorrect|error|failed/i)
      .first();
    await expect(errorMsg).toBeVisible({ timeout: 10_000 });
  }
}
