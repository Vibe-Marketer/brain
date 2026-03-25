import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Base Page Object — shared helpers for all page objects.
 */
export class BasePage {
  readonly page: Page;
  readonly sidebar: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebar = page.locator('nav').first();
  }

  /** Navigate to a route and wait for network idle */
  async goto(path: string) {
    await this.page.goto(path);
    await this.page.waitForLoadState('networkidle');
  }

  /** Wait for the app shell to be ready (sidebar visible) */
  async waitForAppShell() {
    await expect(this.sidebar).toBeVisible({ timeout: 20_000 });
  }

  /** Click a sidebar navigation item by accessible name */
  async navigateTo(name: string) {
    // Sidebar nav items are buttons or links with the given text
    const navItem = this.page.locator('nav').getByText(name, { exact: false }).first();
    await navItem.click();
    await this.page.waitForLoadState('networkidle');
  }

  /** Open global search with Cmd+K */
  async openGlobalSearch() {
    await this.page.keyboard.press('Meta+k');
  }

  /** Close any open modal/dialog with Escape */
  async pressEscape() {
    await this.page.keyboard.press('Escape');
  }

  /** Collect console errors during a callback */
  async collectConsoleErrors(fn: () => Promise<void>): Promise<string[]> {
    const errors: string[] = [];
    const handler = (msg: import('@playwright/test').ConsoleMessage) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    };
    this.page.on('console', handler);
    await fn();
    this.page.off('console', handler);
    return errors.filter(
      (e) =>
        !e.includes('[HMR]') &&
        !e.includes('React DevTools') &&
        !e.includes('Download the React DevTools')
    );
  }
}
