import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Settings Page Object — category navigation and detail pane.
 */
export class SettingsPage extends BasePage {
  readonly categoryPane: Locator;

  constructor(page: Page) {
    super(page);
    this.categoryPane = page.getByRole('navigation', { name: /settings/i }).or(
      page.locator('[data-pane="settings-categories"]')
    ).or(
      page.locator('[aria-label*="settings"]').first()
    );
  }

  async goto() {
    await super.goto('/settings');
    await this.page.waitForURL(/\/settings/, { timeout: 30_000 });
    await this.waitForAppShell();
  }

  /** Click a settings category by name */
  async selectCategory(name: string) {
    const btn = this.page.getByRole('button', { name: new RegExp(name, 'i') }).first();
    await btn.click();
    await this.page.waitForTimeout(500);
  }

  /** Assert a settings detail pane is visible for a given category */
  async expectDetailPane(name: string) {
    const detailPane = this.page.getByRole('region', { name: new RegExp(`${name}`, 'i') }).or(
      this.page.getByRole('heading', { name: new RegExp(name, 'i') })
    );
    await expect(detailPane).toBeVisible({ timeout: 10_000 });
  }

  /** Check that a category button exists */
  async expectCategory(name: string) {
    await expect(
      this.page.getByRole('button', { name: new RegExp(name, 'i') }).first()
    ).toBeVisible({ timeout: 10_000 });
  }
}
