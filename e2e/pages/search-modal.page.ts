import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Global Search Modal Page Object.
 */
export class SearchModal {
  readonly page: Page;
  readonly modal: Locator;
  readonly searchInput: Locator;
  readonly resultItems: Locator;
  readonly emptyState: Locator;
  readonly tooShortMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = page.getByRole('dialog').filter({ hasText: /search/i }).or(
      page.locator('[data-search-modal]')
    ).or(
      page.locator('[class*="search"]').locator('[role="dialog"]')
    );
    this.searchInput = page.getByRole('dialog').locator('input').first();
    this.resultItems = page.getByRole('dialog').locator('[class*="result"], [role="option"], [role="listitem"]');
    this.emptyState = page.getByRole('dialog').getByText(/no results/i);
    this.tooShortMessage = page.getByRole('dialog').getByText(/type.*more|at least|too short/i);
  }

  async open() {
    await this.page.keyboard.press('Meta+k');
    // Wait for the search input to appear in the dialog
    await expect(this.searchInput).toBeVisible({ timeout: 5_000 });
  }

  async close() {
    await this.page.keyboard.press('Escape');
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    // Wait for search results to load
    await this.page.waitForTimeout(500);
  }

  async expectResults() {
    await expect(this.resultItems.first()).toBeVisible({ timeout: 10_000 });
  }

  async expectNoResults() {
    await expect(this.emptyState).toBeVisible({ timeout: 10_000 });
  }

  async clickFirstResult() {
    await this.resultItems.first().click();
  }
}
