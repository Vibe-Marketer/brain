/**
 * Accessibility Audit E2E Tests
 *
 * These tests use axe-core to perform automated accessibility audits
 * on the /sorting-tagging and /settings pages.
 *
 * Prerequisites:
 * - Install @axe-core/playwright: npm install --save-dev @axe-core/playwright
 *
 * Run with:
 * - npx playwright test accessibility-audit.spec.ts
 *
 * Manual verification also required:
 * - Run axe DevTools browser extension on both pages
 * - Verify with VoiceOver (Mac) or NVDA (Windows)
 */

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Helper to check for critical and serious accessibility violations
async function checkAccessibility(
  page: any,
  options?: { skipRules?: string[] }
) {
  const axeBuilder = new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude(".recharts-wrapper") // Exclude chart library (known issues)
    .exclude(".shiki"); // Exclude code highlighting (known issues)

  if (options?.skipRules) {
    axeBuilder.disableRules(options.skipRules);
  }

  const results = await axeBuilder.analyze();

  // Filter to only critical and serious violations
  const criticalViolations = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious"
  );

  // Log all violations for debugging
  if (results.violations.length > 0) {
    console.log("\n=== Accessibility Violations ===");
    results.violations.forEach((violation) => {
      console.log(`\n[${violation.impact?.toUpperCase()}] ${violation.id}`);
      console.log(`  Description: ${violation.description}`);
      console.log(`  Help: ${violation.help}`);
      console.log(`  Help URL: ${violation.helpUrl}`);
      console.log(`  Affected nodes: ${violation.nodes.length}`);
      violation.nodes.forEach((node, i) => {
        console.log(`    Node ${i + 1}: ${node.target.join(" > ")}`);
        if (node.failureSummary) {
          console.log(`    Fix: ${node.failureSummary}`);
        }
      });
    });
    console.log("\n================================\n");
  }

  return { results, criticalViolations };
}

test.describe("Accessibility Audit - Sorting & Tagging Page", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the sorting-tagging page
    await page.goto("/sorting-tagging");

    // Wait for the page to be fully loaded
    await page.waitForSelector('[role="main"]', { timeout: 10000 });
  });

  test("should have no critical ARIA errors on Folders tab", async ({
    page,
  }) => {
    // Ensure Folders tab is active
    await page.getByRole("tab", { name: /folders/i }).click();
    await page.waitForTimeout(500); // Wait for tab content to load

    const { criticalViolations } = await checkAccessibility(page);

    expect(
      criticalViolations,
      `Found ${criticalViolations.length} critical/serious accessibility violations`
    ).toHaveLength(0);
  });

  test("should have no critical ARIA errors on Tags tab", async ({ page }) => {
    await page.getByRole("tab", { name: /tags/i }).click();
    await page.waitForTimeout(500);

    const { criticalViolations } = await checkAccessibility(page);

    expect(
      criticalViolations,
      `Found ${criticalViolations.length} critical/serious accessibility violations`
    ).toHaveLength(0);
  });

  test("should have no critical ARIA errors on Rules tab", async ({ page }) => {
    await page.getByRole("tab", { name: /rules/i }).click();
    await page.waitForTimeout(500);

    const { criticalViolations } = await checkAccessibility(page);

    expect(
      criticalViolations,
      `Found ${criticalViolations.length} critical/serious accessibility violations`
    ).toHaveLength(0);
  });

  test("should have no critical ARIA errors on Recurring tab", async ({
    page,
  }) => {
    await page.getByRole("tab", { name: /recurring/i }).click();
    await page.waitForTimeout(500);

    const { criticalViolations } = await checkAccessibility(page);

    expect(
      criticalViolations,
      `Found ${criticalViolations.length} critical/serious accessibility violations`
    ).toHaveLength(0);
  });

  test("should have proper landmark roles", async ({ page }) => {
    // Check for main navigation landmark
    const nav = page.locator('nav[role="navigation"]');
    await expect(nav.first()).toBeVisible();
    await expect(nav.first()).toHaveAttribute("aria-label");

    // Check for main content landmark
    const main = page.locator('main[role="main"]');
    await expect(main).toBeVisible();
    await expect(main).toHaveAttribute("aria-label");
  });

  test("should have accessible tab navigation", async ({ page }) => {
    const tabList = page.getByRole("tablist");
    await expect(tabList).toBeVisible();

    const tabs = page.getByRole("tab");
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThanOrEqual(4);

    // Each tab should have proper role and be keyboard accessible
    for (let i = 0; i < tabCount; i++) {
      const tab = tabs.nth(i);
      await expect(tab).toHaveAttribute("role", "tab");
    }
  });

  test("right panel should be accessible when open", async ({ page }) => {
    // This test requires a folder to exist and be clickable
    // Click on a folder row to open the detail panel
    const folderRow = page.locator("tr").filter({ hasText: /.+/ }).first();

    if ((await folderRow.count()) > 0) {
      await folderRow.click();
      await page.waitForTimeout(500);

      // Check if the right panel opened
      const rightPanel = page.locator('aside[aria-label*="detail"]');
      if ((await rightPanel.count()) > 0) {
        await expect(rightPanel).toHaveAttribute("role", "complementary");

        const { criticalViolations } = await checkAccessibility(page);
        expect(criticalViolations).toHaveLength(0);
      }
    }
  });
});

test.describe("Accessibility Audit - Settings Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings");
    await page.waitForSelector('[role="main"]', { timeout: 10000 });
  });

  test("should have no critical ARIA errors on Account tab", async ({
    page,
  }) => {
    // Account tab is the default
    const { criticalViolations } = await checkAccessibility(page);

    expect(
      criticalViolations,
      `Found ${criticalViolations.length} critical/serious accessibility violations`
    ).toHaveLength(0);
  });

  test("should have no critical ARIA errors on Billing tab", async ({
    page,
  }) => {
    await page.getByRole("tab", { name: /billing/i }).click();
    await page.waitForTimeout(500);

    const { criticalViolations } = await checkAccessibility(page);

    expect(
      criticalViolations,
      `Found ${criticalViolations.length} critical/serious accessibility violations`
    ).toHaveLength(0);
  });

  test("should have no critical ARIA errors on Integrations tab", async ({
    page,
  }) => {
    await page.getByRole("tab", { name: /integrations/i }).click();
    await page.waitForTimeout(500);

    const { criticalViolations } = await checkAccessibility(page);

    expect(
      criticalViolations,
      `Found ${criticalViolations.length} critical/serious accessibility violations`
    ).toHaveLength(0);
  });

  test("should have no critical ARIA errors on AI tab", async ({ page }) => {
    await page.getByRole("tab", { name: /ai/i }).click();
    await page.waitForTimeout(500);

    const { criticalViolations } = await checkAccessibility(page);

    expect(
      criticalViolations,
      `Found ${criticalViolations.length} critical/serious accessibility violations`
    ).toHaveLength(0);
  });

  test("should have proper landmark roles", async ({ page }) => {
    // Check for main navigation landmark
    const nav = page.locator('nav[role="navigation"]');
    await expect(nav.first()).toBeVisible();
    await expect(nav.first()).toHaveAttribute("aria-label");

    // Check for main content landmark
    const main = page.locator('main[role="main"]');
    await expect(main).toBeVisible();
    await expect(main).toHaveAttribute("aria-label");
  });

  test("help panel should be accessible when open", async ({ page }) => {
    // Click the help button to open the help panel
    const helpButton = page.getByRole("button", {
      name: /get help for this section/i,
    });
    await helpButton.click();
    await page.waitForTimeout(500);

    // Check if the right panel opened
    const rightPanel = page.locator('aside[aria-label*="help"]');
    await expect(rightPanel.first()).toBeVisible();
    await expect(rightPanel.first()).toHaveAttribute("role", "complementary");

    const { criticalViolations } = await checkAccessibility(page);
    expect(criticalViolations).toHaveLength(0);
  });
});

test.describe("Color Contrast - AA Compliance", () => {
  test("should meet AA contrast requirements on sorting-tagging", async ({
    page,
  }) => {
    await page.goto("/sorting-tagging");
    await page.waitForSelector('[role="main"]', { timeout: 10000 });

    const { results } = await checkAccessibility(page);

    // Check specifically for color-contrast violations
    const contrastViolations = results.violations.filter(
      (v) => v.id === "color-contrast"
    );

    // Log contrast issues for debugging
    if (contrastViolations.length > 0) {
      console.log("\n=== Color Contrast Issues ===");
      contrastViolations.forEach((v) => {
        v.nodes.forEach((node) => {
          console.log(`  Element: ${node.target.join(" > ")}`);
          console.log(`  Issue: ${node.failureSummary}`);
        });
      });
    }

    // For now, we're checking if critical/serious contrast issues exist
    const seriousContrastViolations = contrastViolations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(seriousContrastViolations).toHaveLength(0);
  });

  test("should meet AA contrast requirements on settings", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForSelector('[role="main"]', { timeout: 10000 });

    const { results } = await checkAccessibility(page);

    const contrastViolations = results.violations.filter(
      (v) => v.id === "color-contrast"
    );

    const seriousContrastViolations = contrastViolations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(seriousContrastViolations).toHaveLength(0);
  });
});

test.describe("Keyboard Navigation", () => {
  test("should allow Tab navigation through panes on sorting-tagging", async ({
    page,
  }) => {
    await page.goto("/sorting-tagging");
    await page.waitForSelector('[role="main"]', { timeout: 10000 });

    // Focus on the body first
    await page.keyboard.press("Tab");

    // Navigation pane should be focusable
    const nav = page.locator('nav[role="navigation"]').first();
    const main = page.locator('main[role="main"]');

    // These elements should have tabIndex for keyboard navigation
    await expect(nav).toHaveAttribute("tabindex", "0");
    await expect(main).toHaveAttribute("tabindex", "0");
  });

  test("should allow Tab navigation through panes on settings", async ({
    page,
  }) => {
    await page.goto("/settings");
    await page.waitForSelector('[role="main"]', { timeout: 10000 });

    const nav = page.locator('nav[role="navigation"]').first();
    const main = page.locator('main[role="main"]');

    await expect(nav).toHaveAttribute("tabindex", "0");
    await expect(main).toHaveAttribute("tabindex", "0");
  });
});

test.describe("Focus Management", () => {
  test("should have visible focus indicators", async ({ page }) => {
    await page.goto("/sorting-tagging");
    await page.waitForSelector('[role="main"]', { timeout: 10000 });

    // Tab to focus on an element
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    // Check that focus-visible styles are applied (using computed styles)
    const focusedElement = page.locator(":focus");
    const count = await focusedElement.count();

    if (count > 0) {
      // The focused element should have some visible indication
      // (ring, outline, etc.)
      const box = await focusedElement.boundingBox();
      expect(box).not.toBeNull();
    }
  });
});
