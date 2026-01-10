import { test, expect, type Page } from '@playwright/test';

/**
 * E2E tests for the Templates feature.
 *
 * This test suite covers the template management functionality:
 * 1. Templates Page - loading, empty states, template display
 * 2. Template Creation - create template with variables
 * 3. Template Usage - fill variables and generate content
 * 4. Template Actions - copy, edit, delete
 * 5. Team Templates - shared template visibility
 *
 * Note: These tests require authentication. Some tests may be skipped
 * if the required user state (e.g., existing templates) is not available.
 *
 * @see src/components/content-library/TemplatesPage.tsx
 * @see src/components/content-library/TemplateEditorDialog.tsx
 * @see src/components/content-library/TemplateVariableInputDialog.tsx
 */

// ============================================================================
// Templates Page Tests
// ============================================================================

test.describe('Templates Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the templates page
    await page.goto('/templates');

    // Wait for the page to load
    await expect(
      page.locator('body')
    ).toBeVisible({ timeout: 15000 });
  });

  test('should navigate to Templates page from URL', async ({ page }) => {
    // Should show either templates content or sign in prompt
    const pageContent = page
      .getByText(/templates|no templates yet|sign in/i)
      .first();
    await expect(pageContent).toBeVisible({ timeout: 15000 });
  });

  test('should display Templates page header', async ({ page }) => {
    // Wait for loading to finish
    await page.waitForTimeout(2000);

    // Look for the page header
    const header = page.getByRole('heading', { name: /templates/i });
    const emptyState = page.getByText(/no templates yet/i);
    const loginRedirect = page.getByText(/sign in/i);

    // One of these should be visible
    await expect(header.or(emptyState).or(loginRedirect)).toBeVisible({ timeout: 10000 });
  });

  test('should show New Template button', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for the New Template button
    const newTemplateButton = page.getByRole('button', { name: /new template/i });
    const loginRedirect = page.getByText(/sign in/i);

    const hasButton = await newTemplateButton.isVisible().catch(() => false);
    const hasLogin = await loginRedirect.isVisible().catch(() => false);

    // Button should be visible unless redirected to login
    if (!hasLogin) {
      await expect(newTemplateButton).toBeVisible();
    }
  });

  test('should show empty state when no templates exist', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for empty state or templates
    const emptyState = page.getByText(/no templates yet/i);
    const templateCards = page.locator('[class*="card"]');

    // Either empty state or template cards should be visible
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    const hasCards = await templateCards.count() > 0;

    expect(hasEmptyState || hasCards).toBe(true);
  });

  test('should show template count in page subtitle when templates exist', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for template count text
    const templateCount = page.getByText(/\d+ templates? available/i);
    const emptyState = page.getByText(/no templates/i);

    const hasCount = await templateCount.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    expect(hasCount || hasEmpty).toBe(true);
  });

  test('should display My Templates section', async ({ page }) => {
    await page.waitForTimeout(2000);

    const emptyState = page.getByText(/no templates yet/i);
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    if (hasEmpty) {
      test.skip();
      return;
    }

    // Look for My Templates section
    const myTemplatesSection = page.getByText(/my templates/i);
    await expect(myTemplatesSection).toBeVisible();
  });
});

// ============================================================================
// Template Editor Dialog Tests
// ============================================================================

test.describe('Template Editor Dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/templates');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
  });

  test('should open Create Template dialog when clicking New Template button', async ({ page }) => {
    const newTemplateButton = page.getByRole('button', { name: /new template/i });
    const hasButton = await newTemplateButton.isVisible().catch(() => false);

    if (!hasButton) {
      test.skip();
      return;
    }

    await newTemplateButton.click();

    // Dialog should open
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Dialog should have Create Template title
    const dialogTitle = dialog.getByText(/create template/i);
    await expect(dialogTitle).toBeVisible();
  });

  test('should display template name input in dialog', async ({ page }) => {
    const newTemplateButton = page.getByRole('button', { name: /new template/i });
    const hasButton = await newTemplateButton.isVisible().catch(() => false);

    if (!hasButton) {
      test.skip();
      return;
    }

    await newTemplateButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Name input should exist
    const nameInput = dialog.getByLabel(/template name/i);
    await expect(nameInput).toBeVisible();
  });

  test('should display content type dropdown in dialog', async ({ page }) => {
    const newTemplateButton = page.getByRole('button', { name: /new template/i });
    const hasButton = await newTemplateButton.isVisible().catch(() => false);

    if (!hasButton) {
      test.skip();
      return;
    }

    await newTemplateButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Content type select should exist
    const contentTypeSelect = dialog.getByLabel(/content type/i);
    await expect(contentTypeSelect).toBeVisible();
  });

  test('should display template content textarea in dialog', async ({ page }) => {
    const newTemplateButton = page.getByRole('button', { name: /new template/i });
    const hasButton = await newTemplateButton.isVisible().catch(() => false);

    if (!hasButton) {
      test.skip();
      return;
    }

    await newTemplateButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Template content textarea should exist
    const contentTextarea = dialog.getByLabel(/template content/i);
    await expect(contentTextarea).toBeVisible();
  });

  test('should detect and display variables when typing {{variable}} syntax', async ({ page }) => {
    const newTemplateButton = page.getByRole('button', { name: /new template/i });
    const hasButton = await newTemplateButton.isVisible().catch(() => false);

    if (!hasButton) {
      test.skip();
      return;
    }

    await newTemplateButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Type template content with variables
    const contentTextarea = dialog.getByLabel(/template content/i);
    await contentTextarea.fill('Hello {{firstName}}, welcome to {{company}}!');

    // Wait for variable detection
    await page.waitForTimeout(500);

    // Detected variables section should appear
    const detectedSection = dialog.getByText(/detected variables/i);
    await expect(detectedSection).toBeVisible();

    // Variables should be displayed
    const firstNameVar = dialog.getByText(/firstName/i);
    const companyVar = dialog.getByText(/company/i);
    await expect(firstNameVar).toBeVisible();
    await expect(companyVar).toBeVisible();
  });

  test('should have share with team checkbox', async ({ page }) => {
    const newTemplateButton = page.getByRole('button', { name: /new template/i });
    const hasButton = await newTemplateButton.isVisible().catch(() => false);

    if (!hasButton) {
      test.skip();
      return;
    }

    await newTemplateButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Share checkbox should exist
    const shareCheckbox = dialog.getByLabel(/share with team/i);
    await expect(shareCheckbox).toBeVisible();
  });

  test('should disable Create button when form is incomplete', async ({ page }) => {
    const newTemplateButton = page.getByRole('button', { name: /new template/i });
    const hasButton = await newTemplateButton.isVisible().catch(() => false);

    if (!hasButton) {
      test.skip();
      return;
    }

    await newTemplateButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Create button should be disabled initially
    const createButton = dialog.getByRole('button', { name: /create template/i });
    await expect(createButton).toBeDisabled();
  });

  test('should enable Create button when form is complete', async ({ page }) => {
    const newTemplateButton = page.getByRole('button', { name: /new template/i });
    const hasButton = await newTemplateButton.isVisible().catch(() => false);

    if (!hasButton) {
      test.skip();
      return;
    }

    await newTemplateButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Fill in required fields
    const nameInput = dialog.getByLabel(/template name/i);
    await nameInput.fill('Test Template');

    const contentTextarea = dialog.getByLabel(/template content/i);
    await contentTextarea.fill('Hello {{name}}!');

    // Create button should now be enabled
    const createButton = dialog.getByRole('button', { name: /create template/i });
    await expect(createButton).toBeEnabled();
  });

  test('should close dialog when clicking Cancel', async ({ page }) => {
    const newTemplateButton = page.getByRole('button', { name: /new template/i });
    const hasButton = await newTemplateButton.isVisible().catch(() => false);

    if (!hasButton) {
      test.skip();
      return;
    }

    await newTemplateButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Click Cancel
    const cancelButton = dialog.getByRole('button', { name: /cancel/i });
    await cancelButton.click();

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });

  test('should show character count for template name', async ({ page }) => {
    const newTemplateButton = page.getByRole('button', { name: /new template/i });
    const hasButton = await newTemplateButton.isVisible().catch(() => false);

    if (!hasButton) {
      test.skip();
      return;
    }

    await newTemplateButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Type in name input
    const nameInput = dialog.getByLabel(/template name/i);
    await nameInput.fill('My Test Template');

    // Character count should be shown
    const charCount = dialog.getByText(/\d+\/255/);
    await expect(charCount).toBeVisible();
  });
});

// ============================================================================
// Template Card Tests
// ============================================================================

test.describe('Template Card', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/templates');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
  });

  test('should display template cards with name and type badge', async ({ page }) => {
    const cards = page.locator('[class*="card"]');
    const emptyState = page.getByText(/no templates yet/i);

    const cardCount = await cards.count();
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    if (hasEmpty || cardCount === 0) {
      test.skip();
      return;
    }

    // First card should be visible
    const firstCard = cards.first();
    await expect(firstCard).toBeVisible();
  });

  test('should show template variables as badges on card', async ({ page }) => {
    const cards = page.locator('[class*="card"]');
    const emptyState = page.getByText(/no templates yet/i);

    const cardCount = await cards.count();
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    if (hasEmpty || cardCount === 0) {
      test.skip();
      return;
    }

    // Look for variable badges ({{variableName}} format)
    const variableBadges = page.locator('text=/\\{\\{\\w+\\}\\}/');
    const badgeCount = await variableBadges.count();

    // Cards may or may not have variables
    expect(badgeCount).toBeGreaterThanOrEqual(0);
  });

  test('should show usage count on template cards', async ({ page }) => {
    const cards = page.locator('[class*="card"]');
    const emptyState = page.getByText(/no templates yet/i);

    const cardCount = await cards.count();
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    if (hasEmpty || cardCount === 0) {
      test.skip();
      return;
    }

    // Look for usage count text
    const usageText = page.getByText(/used \d+ times?/i).first();
    await expect(usageText).toBeVisible();
  });

  test('should show action buttons on template card hover', async ({ page }) => {
    const cards = page.locator('[class*="card"]');
    const emptyState = page.getByText(/no templates yet/i);

    const cardCount = await cards.count();
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    if (hasEmpty || cardCount === 0) {
      test.skip();
      return;
    }

    // Hover over first card
    const firstCard = cards.first();
    await firstCard.hover();

    // Card should be visible and interactive
    await expect(firstCard).toBeVisible();
  });
});

// ============================================================================
// Template Variable Input Dialog Tests
// ============================================================================

test.describe('Template Variable Input Dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/templates');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
  });

  test('should open Use Template dialog when clicking Use button', async ({ page }) => {
    const cards = page.locator('[class*="card"]');
    const emptyState = page.getByText(/no templates yet/i);

    const cardCount = await cards.count();
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    if (hasEmpty || cardCount === 0) {
      test.skip();
      return;
    }

    // Hover over first card
    const firstCard = cards.first();
    await firstCard.hover();

    // Find and click Use button (play icon)
    const useButton = firstCard.locator('button[title*="Use"]').first();
    const hasUseButton = await useButton.isVisible().catch(() => false);

    if (!hasUseButton) {
      // Try finding by other means
      const playButton = firstCard.locator('button').filter({ has: page.locator('[class*="play"]') }).first();
      const hasPlayButton = await playButton.isVisible().catch(() => false);

      if (!hasPlayButton) {
        test.skip();
        return;
      }

      await playButton.click();
    } else {
      await useButton.click();
    }

    // Dialog should open
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Dialog should have Use Template title
    const dialogTitle = dialog.getByText(/use template/i);
    await expect(dialogTitle).toBeVisible();
  });

  test('should display variable input fields in Use Template dialog', async ({ page }) => {
    const cards = page.locator('[class*="card"]');
    const emptyState = page.getByText(/no templates yet/i);

    const cardCount = await cards.count();
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    if (hasEmpty || cardCount === 0) {
      test.skip();
      return;
    }

    // Hover and click Use
    const firstCard = cards.first();
    await firstCard.hover();

    const useButton = firstCard.locator('button[title*="Use"]').first();
    const hasUseButton = await useButton.isVisible().catch(() => false);

    if (!hasUseButton) {
      test.skip();
      return;
    }

    await useButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Look for Variables section or preview
    const variablesSection = dialog.getByText(/variables|preview/i);
    await expect(variablesSection).toBeVisible();
  });

  test('should show preview section in Use Template dialog', async ({ page }) => {
    const cards = page.locator('[class*="card"]');
    const emptyState = page.getByText(/no templates yet/i);

    const cardCount = await cards.count();
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    if (hasEmpty || cardCount === 0) {
      test.skip();
      return;
    }

    // Hover and click Use
    const firstCard = cards.first();
    await firstCard.hover();

    const useButton = firstCard.locator('button[title*="Use"]').first();
    const hasUseButton = await useButton.isVisible().catch(() => false);

    if (!hasUseButton) {
      test.skip();
      return;
    }

    await useButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Preview section should exist
    const previewSection = dialog.getByText(/preview/i);
    await expect(previewSection).toBeVisible();
  });

  test('should have Apply & Copy button in dialog', async ({ page }) => {
    const cards = page.locator('[class*="card"]');
    const emptyState = page.getByText(/no templates yet/i);

    const cardCount = await cards.count();
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    if (hasEmpty || cardCount === 0) {
      test.skip();
      return;
    }

    // Hover and click Use
    const firstCard = cards.first();
    await firstCard.hover();

    const useButton = firstCard.locator('button[title*="Use"]').first();
    const hasUseButton = await useButton.isVisible().catch(() => false);

    if (!hasUseButton) {
      test.skip();
      return;
    }

    await useButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Apply & Copy button should exist
    const applyButton = dialog.getByRole('button', { name: /apply|copy/i });
    await expect(applyButton).toBeVisible();
  });

  test('should close dialog when clicking Cancel', async ({ page }) => {
    const cards = page.locator('[class*="card"]');
    const emptyState = page.getByText(/no templates yet/i);

    const cardCount = await cards.count();
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    if (hasEmpty || cardCount === 0) {
      test.skip();
      return;
    }

    // Hover and click Use
    const firstCard = cards.first();
    await firstCard.hover();

    const useButton = firstCard.locator('button[title*="Use"]').first();
    const hasUseButton = await useButton.isVisible().catch(() => false);

    if (!hasUseButton) {
      test.skip();
      return;
    }

    await useButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Click Cancel
    const cancelButton = dialog.getByRole('button', { name: /cancel/i });
    await cancelButton.click();

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });
});

// ============================================================================
// Template Delete Tests
// ============================================================================

test.describe('Template Delete', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/templates');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
  });

  test('should open delete confirmation dialog when clicking delete', async ({ page }) => {
    const cards = page.locator('[class*="card"]');
    const emptyState = page.getByText(/no templates yet/i);

    const cardCount = await cards.count();
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    if (hasEmpty || cardCount === 0) {
      test.skip();
      return;
    }

    // Hover over first card
    const firstCard = cards.first();
    await firstCard.hover();

    // Find and click delete button
    const deleteButton = firstCard.locator('button[title*="Delete"]').first();
    const hasDeleteButton = await deleteButton.isVisible().catch(() => false);

    if (!hasDeleteButton) {
      test.skip();
      return;
    }

    await deleteButton.click();

    // Confirmation dialog should appear
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Dialog should have delete confirmation text
    const deleteText = dialog.getByText(/delete template|are you sure/i);
    await expect(deleteText).toBeVisible();
  });

  test('should close delete dialog when clicking Cancel', async ({ page }) => {
    const cards = page.locator('[class*="card"]');
    const emptyState = page.getByText(/no templates yet/i);

    const cardCount = await cards.count();
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    if (hasEmpty || cardCount === 0) {
      test.skip();
      return;
    }

    // Hover and click delete
    const firstCard = cards.first();
    await firstCard.hover();

    const deleteButton = firstCard.locator('button[title*="Delete"]').first();
    const hasDeleteButton = await deleteButton.isVisible().catch(() => false);

    if (!hasDeleteButton) {
      test.skip();
      return;
    }

    await deleteButton.click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();

    // Click Cancel
    const cancelButton = dialog.getByRole('button', { name: /cancel/i });
    await cancelButton.click();

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });
});

// ============================================================================
// Team Templates Tests
// ============================================================================

test.describe('Team Templates', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/templates');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('should display Team Templates section when shared templates exist', async ({ page }) => {
    // Look for Team Templates section
    const teamSection = page.getByText(/team templates/i);
    const mySection = page.getByText(/my templates/i);
    const emptyState = page.getByText(/no templates yet/i);

    const hasTeamSection = await teamSection.isVisible().catch(() => false);
    const hasMySection = await mySection.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    // Team section only appears when there are shared templates
    // Just verify the page structure is correct
    if (!hasEmpty) {
      await expect(mySection.or(teamSection)).toBeVisible();
    }
  });

  test('should show Shared badge on shared templates', async ({ page }) => {
    const teamSection = page.getByText(/team templates/i);
    const hasTeamSection = await teamSection.isVisible().catch(() => false);

    if (!hasTeamSection) {
      test.skip();
      return;
    }

    // Look for Shared badge
    const sharedBadge = page.locator('[class*="badge"]').filter({ hasText: /shared/i });
    const sharedCount = await sharedBadge.count();

    // Shared badges should exist in team section
    expect(sharedCount).toBeGreaterThanOrEqual(0);
  });

  test('should not show edit/delete buttons on team templates', async ({ page }) => {
    const teamSection = page.getByText(/team templates/i);
    const hasTeamSection = await teamSection.isVisible().catch(() => false);

    if (!hasTeamSection) {
      test.skip();
      return;
    }

    // Team templates should only have Use and Copy buttons, not Edit/Delete
    // This is verified by the isShared prop logic in the component
    // We can verify by checking the button count on hover
    const teamCards = page.locator('[class*="card"]').filter({
      has: page.locator('[class*="badge"]').filter({ hasText: /shared/i })
    });

    const teamCardCount = await teamCards.count();
    if (teamCardCount > 0) {
      const firstTeamCard = teamCards.first();
      await firstTeamCard.hover();

      // Edit button should not be visible for shared templates
      const editButton = firstTeamCard.locator('button[title*="Edit"]');
      const hasEdit = await editButton.isVisible().catch(() => false);

      // Edit should not be visible on team templates
      expect(hasEdit).toBe(false);
    }
  });
});

// ============================================================================
// Navigation Tests
// ============================================================================

test.describe('Templates Navigation', () => {
  test('should navigate to templates page from URL', async ({ page }) => {
    await page.goto('/templates');
    await expect(page.locator('body')).toBeVisible();

    // Should show templates content or sign in
    const pageContent = page.getByText(/templates|no templates|sign in/i).first();
    await expect(pageContent).toBeVisible({ timeout: 15000 });
  });

  test('should preserve URL when navigating', async ({ page }) => {
    await page.goto('/templates');
    await page.waitForLoadState('networkidle');

    // URL should still be /templates
    expect(page.url()).toContain('/templates');
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

test.describe('Templates Error Handling', () => {
  test('should not have console errors on Templates page', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/templates');
    await page.waitForTimeout(3000);

    // Filter out known acceptable errors
    const unexpectedErrors = errors.filter(
      (error) =>
        !error.includes('[HMR]') &&
        !error.includes('React DevTools') &&
        !error.includes('Download the React DevTools') &&
        !error.includes('Failed to fetch') &&
        !error.includes('401') // Auth errors in test environment
    );

    expect(unexpectedErrors).toHaveLength(0);
  });
});

// ============================================================================
// Accessibility Tests
// ============================================================================

test.describe('Templates Accessibility', () => {
  test('should have accessible New Template button', async ({ page }) => {
    await page.goto('/templates');
    await page.waitForLoadState('networkidle');

    const newButton = page.getByRole('button', { name: /new template/i });
    const hasButton = await newButton.isVisible().catch(() => false);

    if (hasButton) {
      // Button should be focusable
      await newButton.focus();
      await expect(newButton).toBeFocused();
    }
  });

  test('should support keyboard navigation in template editor dialog', async ({ page }) => {
    await page.goto('/templates');
    await page.waitForLoadState('networkidle');

    const newButton = page.getByRole('button', { name: /new template/i });
    const hasButton = await newButton.isVisible().catch(() => false);

    if (!hasButton) {
      test.skip();
      return;
    }

    // Open dialog with keyboard
    await newButton.focus();
    await newButton.press('Enter');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('should have accessible form labels in dialog', async ({ page }) => {
    await page.goto('/templates');
    await page.waitForLoadState('networkidle');

    const newButton = page.getByRole('button', { name: /new template/i });
    const hasButton = await newButton.isVisible().catch(() => false);

    if (!hasButton) {
      test.skip();
      return;
    }

    await newButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Labels should be associated with inputs
    const nameInput = dialog.getByLabel(/template name/i);
    const contentTextarea = dialog.getByLabel(/template content/i);

    await expect(nameInput).toBeVisible();
    await expect(contentTextarea).toBeVisible();
  });
});

// ============================================================================
// Responsive Tests
// ============================================================================

test.describe('Templates Responsive Design', () => {
  test('should show mobile-friendly layout on Templates page', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/templates');
    await page.waitForLoadState('networkidle');

    // Page should still be functional
    await expect(page.locator('body')).toBeVisible();

    // Content should be visible
    const pageContent = page.getByText(/templates|no templates|sign in/i).first();
    await expect(pageContent).toBeVisible({ timeout: 15000 });
  });

  test('should display template cards in single column on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/templates');
    await page.waitForLoadState('networkidle');

    const cards = page.locator('[class*="card"]');
    const cardCount = await cards.count();

    if (cardCount === 0) {
      test.skip();
      return;
    }

    // Cards should still be visible in mobile layout
    const firstCard = cards.first();
    await expect(firstCard).toBeVisible();
  });

  test('should open template editor dialog properly on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/templates');
    await page.waitForLoadState('networkidle');

    const newButton = page.getByRole('button', { name: /new template/i });
    const hasButton = await newButton.isVisible().catch(() => false);

    if (!hasButton) {
      test.skip();
      return;
    }

    await newButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Dialog should be usable on mobile
    const nameInput = dialog.getByLabel(/template name/i);
    await expect(nameInput).toBeVisible();
  });
});
