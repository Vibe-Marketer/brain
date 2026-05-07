/**
 * Plan 25-03 verification: per-user drag-and-drop workspace reorder.
 *
 * Run via: `npx playwright test e2e/plan-25-03-verify.spec.ts --project=chromium`
 *
 * STRUCTURAL VERIFICATION (what this test asserts):
 *  1. Login + active org has multiple workspaces
 *  2. Each workspace row has an aria-label="Reorder workspace" drag-handle button
 *  3. The handle is opacity:0 by default and opacity:1 when its row is hovered
 *  4. Clicking the row body still selects the workspace (no drag conflict)
 *  5. WorkspaceDropZone (recording → workspace drop) is structurally preserved
 *
 * PROGRAMMATIC DRAG SYNTHESIS NOTE:
 *  dnd-kit's PointerSensor does not reliably respond to Playwright-synthesized
 *  pointer events (well-documented limitation, see clauderic/dnd-kit#261).
 *  Synthesizing the actual drag-and-drop motion gesture programmatically gives
 *  flaky results in CI. Manual smoke verification is recommended for end-to-end
 *  reorder + persistence.
 */
import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/login.page';

const EMAIL = process.env.CALLVAULTAI_LOGIN || 'a@vibeos.com';
const PASSWORD = process.env.CALLVAULTAI_LOGIN_PASSWORD || 'Naegele1';

test.describe('Plan 25-03: workspace reorder structural verification', () => {
  test.describe.configure({ retries: 0 });

  test('drag handles render, hover affordance works, row click still selects workspace', async ({
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

    const workspacesHeader = page.getByText(/your workspaces/i);
    await expect(workspacesHeader).toBeVisible({ timeout: 20_000 });

    // Switch orgs until we land on one with multiple workspaces.
    const findHandlesOrSwitchOrg = async () => {
      const dragHandles = page.getByRole('button', { name: /reorder workspace/i });
      const initialCount = await dragHandles.count();
      if (initialCount >= 2) return initialCount;

      const orgTrigger = page
        .locator('div')
        .filter({ has: page.getByText(/^ORGANIZATION$/) })
        .getByRole('button')
        .first();
      const optionLocator = page.getByRole('option');

      for (let i = 0; i < 6; i++) {
        await orgTrigger.click({ timeout: 5_000 }).catch(() => {});
        await page.waitForTimeout(400);
        const optionCount = await optionLocator.count();
        if (optionCount === 0) break;
        const idx = Math.min(i, optionCount - 1);
        await optionLocator.nth(idx).click({ timeout: 5_000 }).catch(() => {});
        await page.waitForTimeout(1500);
        const newCount = await dragHandles.count();
        if (newCount >= 2) return newCount;
      }
      return await dragHandles.count();
    };

    const handleCount = await findHandlesOrSwitchOrg();
    // eslint-disable-next-line no-console
    console.log(`drag handles found: ${handleCount}`);
    expect(handleCount).toBeGreaterThanOrEqual(2);
    const dragHandles = page.getByRole('button', { name: /reorder workspace/i });

    // ─── Assertion 1: handle starts hidden (opacity 0) ──────────────────
    const initialOpacity = await page.evaluate(() => {
      const h = document.querySelector(
        'button[aria-label="Reorder workspace"]',
      ) as HTMLElement | null;
      if (!h) return -1;
      return parseFloat(window.getComputedStyle(h).opacity);
    });
    // eslint-disable-next-line no-console
    console.log(`initial handle opacity: ${initialOpacity}`);
    // Handle should be hidden by default — opacity 0 from the group-hover/sortable rule.
    expect(initialOpacity).toBeLessThan(0.5);

    // ─── Assertion 2: handle becomes visible on hover ───────────────────
    const firstHandle = dragHandles.first();
    await firstHandle.scrollIntoViewIfNeeded();
    const firstBox = await firstHandle.boundingBox();
    if (!firstBox) throw new Error('first handle has no bounding box');
    await page.mouse.move(
      firstBox.x + firstBox.width / 2,
      firstBox.y + firstBox.height / 2,
    );
    await page.waitForTimeout(400);

    const hoveredOpacity = await page.evaluate(() => {
      const h = document.querySelector(
        'button[aria-label="Reorder workspace"]',
      ) as HTMLElement | null;
      if (!h) return -1;
      return parseFloat(window.getComputedStyle(h).opacity);
    });
    // eslint-disable-next-line no-console
    console.log(`hovered handle opacity: ${hoveredOpacity}`);
    expect(hoveredOpacity).toBeGreaterThan(0.5);

    // ─── Assertion 3: capture workspace order via the handle wrappers ───
    const captureOrder = async () =>
      page.evaluate(() => {
        const handles = Array.from(
          document.querySelectorAll('button[aria-label="Reorder workspace"]'),
        );
        return handles
          .map((h) => {
            const wrapper = h.parentElement;
            if (!wrapper) return '';
            const span = wrapper.querySelector(
              'span.text-xs.font-bold.uppercase, span.font-bold.uppercase',
            );
            return (span?.textContent || '').trim();
          })
          .filter((t) => t.length > 0);
      });

    const order = await captureOrder();
    // eslint-disable-next-line no-console
    console.log('workspace order:', order);
    expect(order.length).toBeGreaterThanOrEqual(2);
    // Names should be unique strings
    expect(new Set(order).size).toBe(order.length);

    // ─── Assertion 4: WorkspaceDropZone children are still present ──────
    // The DropZone wraps the WorkspaceListItem, which renders a [role="button"]
    // for click-to-select. There should be at least as many list-item buttons
    // as there are drag handles.
    const wsRowButtons = await page.evaluate(() => {
      // Find buttons with aria-label="Reorder workspace" and look for the
      // sibling [role="button"] (the WorkspaceListItem row).
      const handles = Array.from(
        document.querySelectorAll('button[aria-label="Reorder workspace"]'),
      );
      return handles
        .map((h) => {
          const wrapper = h.parentElement;
          if (!wrapper) return false;
          // The WorkspaceDropZone renders a div whose child is the row [role=button]
          return Boolean(wrapper.querySelector('[role="button"]'));
        })
        .every((v) => v === true);
    });
    expect(wsRowButtons).toBe(true);

    // ─── Assertion 5: clicking the row body still selects the workspace ─
    // (Drag handle and row body are separate hit zones — handle drag does
    // NOT swallow row clicks. Active workspace gets the `bg-muted` highlight
    // class plus the `border-vibe-orange/40` icon-frame border.)
    const getActiveWorkspaceName = () =>
      page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('[role="button"]'));
        const active = rows.find((r) => {
          const cls = (r as HTMLElement).className;
          return (
            typeof cls === 'string' &&
            cls.includes('bg-muted') &&
            cls.includes('border')
          );
        });
        if (!active) return null;
        const span = active.querySelector(
          'span.font-bold.uppercase, span.text-xs.font-bold',
        );
        return (span?.textContent || '').trim() || null;
      });

    const activeBefore = await getActiveWorkspaceName();

    // Click the SECOND workspace row by text (e.g. "AI SIMPLE FOUNDERS").
    // We look up the workspace name from `order[1]` and click the row containing it.
    const secondName = order[1];
    const secondRow = page
      .locator('[role="button"]')
      .filter({ hasText: new RegExp(`^\\s*${secondName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i') })
      .first();
    // Fallback: just locate by visible text near the workspace section
    await page
      .getByText(new RegExp(`^${secondName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'))
      .first()
      .click({ timeout: 5_000 })
      .catch(async () => {
        await secondRow.click({ timeout: 5_000 }).catch(() => {});
      });
    await page.waitForTimeout(1000);

    const activeAfter = await getActiveWorkspaceName();
    // eslint-disable-next-line no-console
    console.log(`active workspace before: ${activeBefore} | after: ${activeAfter}`);
    // Click should set an active workspace (different from before, OR a new
    // one if nothing was active).
    expect(activeAfter).toBeTruthy();
    expect(activeAfter).not.toBe(activeBefore);

    // ─── Final screenshot for the SUMMARY ───────────────────────────────
    await page.screenshot({
      path: '/tmp/plan-25-03-screenshots/sidebar-with-handles.png',
      fullPage: false,
    });
  });
});
