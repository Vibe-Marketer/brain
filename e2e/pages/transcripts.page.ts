import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Transcripts Page Object — main dashboard interactions.
 */
export class TranscriptsPage extends BasePage {
  readonly table: Locator;
  readonly tableRows: Locator;
  readonly searchInput: Locator;
  readonly paginationPrev: Locator;
  readonly paginationNext: Locator;
  readonly columnPickerButton: Locator;
  readonly selectAllCheckbox: Locator;

  constructor(page: Page) {
    super(page);
    this.table = page.locator('table').first();
    this.tableRows = page.locator('tbody tr[role="row"]');
    this.searchInput = page.getByPlaceholder(/search/i).first();
    this.paginationPrev = page.getByRole('button', { name: /previous/i });
    this.paginationNext = page.getByRole('button', { name: /next/i });
    this.columnPickerButton = page.getByRole('button', { name: /columns/i });
    this.selectAllCheckbox = page.locator('thead input[type="checkbox"]').first();
  }

  async goto() {
    await super.goto('/transcripts');
    await this.waitForTranscripts();
  }

  /** Wait for the transcript table to be visible */
  async waitForTranscripts() {
    // Wait for either the table or an empty state to appear
    await expect(
      this.table.or(this.page.getByText(/no calls|no transcripts|get started/i).first())
    ).toBeVisible({ timeout: 20_000 });
  }

  /** Get the number of visible rows */
  async getRowCount(): Promise<number> {
    return this.tableRows.count();
  }

  /** Click on a transcript row by index (0-based) */
  async clickRow(index: number) {
    await this.tableRows.nth(index).click();
  }

  /** Select a row checkbox by index */
  async selectRow(index: number) {
    const checkbox = this.tableRows.nth(index).locator('input[type="checkbox"]');
    await checkbox.check();
  }

  /** Select all rows */
  async selectAll() {
    await this.selectAllCheckbox.check();
  }

  /** Check if bulk action toolbar is visible */
  async expectBulkToolbar() {
    await expect(
      this.page.getByText(/selected/i).first()
    ).toBeVisible({ timeout: 5_000 });
  }

  /** Check if bulk action toolbar is hidden */
  async expectNoBulkToolbar() {
    await expect(
      this.page.getByText(/\d+ selected/i).first()
    ).not.toBeVisible({ timeout: 5_000 });
  }

  /** Open column picker dropdown */
  async openColumnPicker() {
    await this.columnPickerButton.click();
  }

  /** Navigate to next page */
  async nextPage() {
    await this.paginationNext.click();
    await this.page.waitForLoadState('networkidle');
  }

  /** Navigate to previous page */
  async prevPage() {
    await this.paginationPrev.click();
    await this.page.waitForLoadState('networkidle');
  }

  /** Apply a filter by button name */
  async openFilter(name: string) {
    const filterBtn = this.page.getByRole('button', { name: new RegExp(`^${name}$`, 'i') });
    await filterBtn.click();
  }

  /** Get the export button */
  get exportButton(): Locator {
    return this.page.getByRole('button', { name: /export/i }).first();
  }

  /** Get the delete button from bulk toolbar */
  get deleteButton(): Locator {
    return this.page.getByRole('button', { name: /delete/i }).first();
  }
}
