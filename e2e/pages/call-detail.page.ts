import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Call Detail Pane Object — detail view for a single call.
 */
export class CallDetailPane {
  readonly page: Page;
  readonly pane: Locator;
  readonly closeButton: Locator;
  readonly title: Locator;

  constructor(page: Page) {
    this.page = page;
    // The detail pane is typically the rightmost region or a dialog
    this.pane = page.locator('[data-pane="detail"]').or(
      page.getByRole('dialog').first()
    ).or(
      page.locator('[class*="detail"]').first()
    );
    this.closeButton = page.getByRole('button', { name: /close/i }).first();
    this.title = page.locator('h1, h2, h3').first();
  }

  async expectVisible() {
    await expect(this.pane).toBeVisible({ timeout: 10_000 });
  }

  async expectHidden() {
    await expect(this.pane).not.toBeVisible({ timeout: 5_000 });
  }

  async close() {
    await this.closeButton.click();
  }
}
