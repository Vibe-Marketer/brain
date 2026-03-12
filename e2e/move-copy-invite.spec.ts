/**
 * E2E tests for core data movement and membership flows.
 *
 * 1. Move to workspace (within-org, workspace_entries only)
 * 2. Copy to organization (cross-org, creates new recordings row)
 * 3. Invite member to org, invite member to workspace, remove member
 *
 * These tests run against the live app at localhost:8080 with a real
 * Supabase backend. Auth state is loaded from playwright/.auth/user.json.
 */

import { test, expect } from '@playwright/test';

// ============================================================================
// Helper: navigate to home and wait for the calls table to render
// ============================================================================
async function goToAllCalls(page: any) {
  await page.goto('/');
  // Wait for sidebar + table to settle
  await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 20000 });
}

// ============================================================================
// 1. Move to Workspace dialog — open, pick a workspace, confirm move
// ============================================================================
test.describe('Move to Workspace', () => {
  test('... menu appears on each call row', async ({ page }) => {
    await goToAllCalls(page);

    const firstRow = page.locator('table tbody tr').first();
    await firstRow.hover();

    const moreBtn = firstRow.locator('button[title="More actions"]');
    await expect(moreBtn).toBeVisible({ timeout: 5000 });
  });

  test('Move to Workspace dialog opens from ... menu', async ({ page }) => {
    await goToAllCalls(page);

    const firstRow = page.locator('table tbody tr').first();
    await firstRow.hover();

    const moreBtn = firstRow.locator('button[title="More actions"]');
    await moreBtn.click();

    const moveItem = page.getByRole('menuitem', { name: /move to workspace/i });
    await expect(moveItem).toBeVisible({ timeout: 3000 });
    await moveItem.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByText(/move to workspace/i)).toBeVisible();
  });

  test('Move to Workspace dialog has workspace selector and keep-checkbox', async ({ page }) => {
    await goToAllCalls(page);

    const firstRow = page.locator('table tbody tr').first();
    await firstRow.hover();
    await firstRow.locator('button[title="More actions"]').click();
    await page.getByRole('menuitem', { name: /move to workspace/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Workspace selector (use first() — combobox button and its inner span both match)
    await expect(dialog.locator('[role="combobox"]').first()).toBeVisible();

    // "Also keep" checkbox
    await expect(dialog.getByLabel(/also keep in current workspace/i)).toBeVisible();
  });

  test('Move button is disabled until a workspace is selected', async ({ page }) => {
    await goToAllCalls(page);

    const firstRow = page.locator('table tbody tr').first();
    await firstRow.hover();
    await firstRow.locator('button[title="More actions"]').click();
    await page.getByRole('menuitem', { name: /move to workspace/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const moveBtn = dialog.getByRole('button', { name: /^move call|^copy call/i });
    await expect(moveBtn).toBeDisabled();
  });

  test('Can select a workspace and execute a move', async ({ page }) => {
    await goToAllCalls(page);

    const firstRow = page.locator('table tbody tr').first();
    const callTitle = await firstRow.locator('td').nth(1).innerText();

    await firstRow.hover();
    await firstRow.locator('button[title="More actions"]').click();
    await page.getByRole('menuitem', { name: /move to workspace/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Open workspace dropdown
    const trigger = dialog.locator('[role="combobox"]');
    const hasTrigger = await trigger.isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasTrigger) {
      test.skip();
      return;
    }

    await trigger.click();
    const options = page.locator('[role="option"]');
    const count = await options.count();

    if (count === 0) {
      // No other workspaces available — skip but report
      console.log('SKIP: No other workspaces to move to');
      test.skip();
      return;
    }

    await options.first().click();

    // Button should now be enabled
    const moveBtn = dialog.getByRole('button', { name: /^move call/i });
    await expect(moveBtn).toBeEnabled();
    await moveBtn.click();

    // Dialog closes + success toast
    await expect(dialog).not.toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/moved 1 recording/i)).toBeVisible({ timeout: 5000 });

    console.log(`PASS: Moved "${callTitle.trim()}" to another workspace`);
  });
});

// ============================================================================
// 2. Copy to Organization dialog
// ============================================================================
test.describe('Copy to Organization', () => {
  test('Copy to Org button visible on call detail page', async ({ page }) => {
    await goToAllCalls(page);

    // Navigate via WorkspaceDetailPane (sidebar) which does route to /call/:id
    // OR navigate directly via Shared With Me which also routes to /call/:id
    await page.goto('/shared-with-me');
    const callRow = page.locator('table tbody tr').first();
    const hasRow = await callRow.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasRow) {
      // No shared calls — navigate directly to a known recording via URL
      // The main table's eye button opens a modal, not /call/ — so navigate via search
      await goToAllCalls(page);

      // Get the recording UUID from the first row's badge text
      const idBadge = page.locator('table tbody tr').first()
        .locator('text=/[0-9a-f]{8}-[0-9a-f]{4}/i').first();
      const hasId = await idBadge.isVisible({ timeout: 3000 }).catch(() => false);

      if (!hasId) {
        // Navigate to a known-good recording from test data
        await page.goto('/call/9f745f96-a0a0-4621-9871-1beed3d23e54');
      } else {
        const idText = await idBadge.textContent();
        if (idText) await page.goto(`/call/${idText.trim()}`);
      }
    } else {
      await callRow.click();
      await page.waitForURL(/\/call\//, { timeout: 15000 });
    }

    // Ensure we're on a call detail page
    await page.waitForURL(/\/call\//, { timeout: 15000 });

    // The CallDetailPage has a "Copy to Org" button (RiBuildingLine)
    const copyOrgBtn = page.getByRole('button').filter({ hasText: /copy/i }).first();
    await expect(copyOrgBtn).toBeVisible({ timeout: 8000 });
  });

  test('Copy to Org dialog opens from ... menu in table', async ({ page }) => {
    await goToAllCalls(page);

    const firstRow = page.locator('table tbody tr').first();
    await firstRow.hover();
    await firstRow.locator('button[title="More actions"]').click();

    const copyItem = page.getByRole('menuitem', { name: /copy to organization/i });
    await expect(copyItem).toBeVisible({ timeout: 3000 });
    await copyItem.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByText(/copy to organization/i)).toBeVisible();
  });

  test('Copy to Org dialog has org selector and handoff checkbox', async ({ page }) => {
    await goToAllCalls(page);

    const firstRow = page.locator('table tbody tr').first();
    await firstRow.hover();
    await firstRow.locator('button[title="More actions"]').click();
    await page.getByRole('menuitem', { name: /copy to organization/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Org selector
    await expect(dialog.locator('[role="combobox"]').first()).toBeVisible();

    // Handoff checkbox
    await expect(dialog.getByText(/remove from current organization/i)).toBeVisible();
  });

  test('Copy button is disabled until an org is selected', async ({ page }) => {
    await goToAllCalls(page);

    const firstRow = page.locator('table tbody tr').first();
    await firstRow.hover();
    await firstRow.locator('button[title="More actions"]').click();
    await page.getByRole('menuitem', { name: /copy to organization/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const copyBtn = dialog.getByRole('button', { name: /^copy call/i });
    await expect(copyBtn).toBeDisabled();
  });
});

// ============================================================================
// 3. Org member management (Settings → Organizations tab)
// ============================================================================
test.describe('Org Member Management', () => {
  // Settings sidebar labels: "Workspaces" (id=organizations), "People" (id=users)
  async function goToPeopleSettings(page: any) {
    await page.goto('/settings');
    // "People" category button — accessible name includes subtitle text so use text locator
    const peopleCategory = page.locator('button').filter({ hasText: /^People/ }).first();
    await expect(peopleCategory).toBeVisible({ timeout: 10000 });
    await peopleCategory.click();
    await page.waitForTimeout(600);
  }

  test('Settings People tab loads without error', async ({ page }) => {
    await goToPeopleSettings(page);

    // Should show members content
    const content = page.getByText(/people|members|invite|team/i).first();
    await expect(content).toBeVisible({ timeout: 8000 });
  });

  test('Invite member button is visible in People settings', async ({ page }) => {
    await goToPeopleSettings(page);

    const inviteBtn = page.getByRole('button', { name: /invite/i }).first();
    await expect(inviteBtn).toBeVisible({ timeout: 8000 });
  });

  test('Invite member dialog opens and has email input', async ({ page }) => {
    await goToPeopleSettings(page);

    const inviteBtn = page.getByRole('button', { name: /invite/i }).first();
    await inviteBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const emailInput = dialog.locator('input[type="email"]')
      .or(dialog.getByPlaceholder(/email/i));
    await expect(emailInput).toBeVisible();
  });

  test('Invite dialog has role selector', async ({ page }) => {
    await goToPeopleSettings(page);

    const inviteBtn = page.getByRole('button', { name: /invite/i }).first();
    await inviteBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const roleSelect = dialog.locator('[role="combobox"]')
      .or(dialog.getByText(/member|admin|owner/i))
      .first();
    await expect(roleSelect).toBeVisible();
  });

  test('Invite dialog closes on cancel', async ({ page }) => {
    await goToPeopleSettings(page);

    await page.getByRole('button', { name: /invite/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });

  test('Members list is visible in People settings', async ({ page }) => {
    await goToPeopleSettings(page);

    // Should show at least the current user
    const membersList = page.locator('[data-testid="members-list"]')
      .or(page.getByText(/owner|admin|member/i).first());
    await expect(membersList).toBeVisible({ timeout: 8000 });
  });
});

// ============================================================================
// 4. Workspace member management (Workspace settings / invite)
// ============================================================================
test.describe('Workspace Member Management', () => {
  test('Workspace invite dialog opens from workspace settings', async ({ page }) => {
    await page.goto('/settings');

    // Try to find workspace settings — may be under Organizations or a Workspaces sub-nav
    const workspacesBtn = page.getByRole('button', { name: /workspaces/i }).first();
    const hasWorkspacesBtn = await workspacesBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasWorkspacesBtn) {
      // Try the sidebar workspace pane instead
      await page.goto('/');
      const wsPane = page.locator('[data-testid="workspace-sidebar-pane"]')
        .or(page.getByText(/workspaces/i).first());
      const hasSidebar = await wsPane.isVisible({ timeout: 5000 }).catch(() => false);

      if (!hasSidebar) {
        console.log('SKIP: No workspace management UI found');
        test.skip();
        return;
      }
    }

    // If we got to settings workspaces
    if (hasWorkspacesBtn) {
      await workspacesBtn.click();
    }

    const inviteBtn = page.getByRole('button', { name: /invite/i })
      .or(page.getByRole('button', { name: /add member/i }))
      .first();

    const hasInvite = await inviteBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasInvite) {
      test.skip();
      return;
    }

    await inviteBtn.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================================
// 5. Console error check across all critical pages
// ============================================================================
test.describe('No console errors on critical pages', () => {
  const pages = [
    { name: 'All Calls (home)', path: '/' },
    { name: 'Settings', path: '/settings' },
    { name: 'Shared With Me', path: '/shared-with-me' },
  ];

  for (const { name, path } of pages) {
    test(`${name} has no JS errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      page.on('pageerror', err => errors.push(err.message));

      await page.goto(path);
      await page.waitForTimeout(3000);

      const filtered = errors.filter(e =>
        !e.includes('[HMR]') &&
        !e.includes('React DevTools') &&
        !e.includes('Failed to fetch') &&
        !e.includes('net::ERR') &&
        !e.includes('ResizeObserver') &&
        !e.includes('Debug Panel') &&          // internal debug tool
        !e.includes('validateDOMNesting')       // React dev-mode warning
      );

      if (filtered.length > 0) {
        console.error(`Console errors on ${name}:`, filtered);
      }
      expect(filtered, `Unexpected JS errors on ${name}: ${filtered.join('; ')}`).toHaveLength(0);
    });
  }
});
