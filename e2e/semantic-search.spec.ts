import { test, expect } from '@playwright/test';

/**
 * E2E tests for Semantic Search flow with relevance scoring.
 *
 * This test suite covers the semantic search functionality:
 * 1. Open global search modal with keyboard shortcut (Cmd/Ctrl+K)
 * 2. Enter a semantic search query
 * 3. Verify results include semantically similar content
 * 4. Verify relevance scores are displayed as percentages
 * 5. Verify results are sorted by relevance descending
 *
 * @pattern semantic-search
 * @see src/components/search/GlobalSearchModal.tsx
 * @see src/components/search/SearchResultItem.tsx
 * @see src/hooks/useGlobalSearch.ts
 */

/**
 * Mock semantic search response with predictable test data.
 * Includes semantically similar results for "budget concerns" query.
 */
const mockSemanticSearchResponse = {
  success: true,
  query: 'budget concerns',
  results: [
    {
      id: 'chunk-1',
      recording_id: 101,
      chunk_text: 'We need to discuss the pricing structure and see if we can find a more affordable option for our team.',
      speaker_name: 'John Smith',
      speaker_email: 'john@example.com',
      call_date: '2026-01-09T10:00:00Z',
      call_title: 'Q1 Budget Review',
      call_category: 'internal',
      topics: ['pricing', 'budget'],
      sentiment: 'neutral',
      relevance_score: 0.92,
      similarity_score: 0.88,
    },
    {
      id: 'chunk-2',
      recording_id: 102,
      chunk_text: 'The costs are getting out of hand. We really need to look at our spending and cut unnecessary expenses.',
      speaker_name: 'Jane Doe',
      speaker_email: 'jane@example.com',
      call_date: '2026-01-08T14:30:00Z',
      call_title: 'Finance Team Sync',
      call_category: 'internal',
      topics: ['costs', 'spending'],
      sentiment: 'negative',
      relevance_score: 0.87,
      similarity_score: 0.85,
    },
    {
      id: 'chunk-3',
      recording_id: 103,
      chunk_text: 'I understand the affordability is a key concern. Let me walk you through our flexible payment plans.',
      speaker_name: 'Sales Rep',
      speaker_email: 'sales@example.com',
      call_date: '2026-01-07T09:15:00Z',
      call_title: 'Customer Demo Call',
      call_category: 'sales',
      topics: ['affordability', 'payment'],
      sentiment: 'positive',
      relevance_score: 0.79,
      similarity_score: 0.75,
    },
    {
      id: 'chunk-4',
      recording_id: 104,
      chunk_text: 'The financial implications of this decision need to be carefully evaluated before we proceed.',
      speaker_name: 'CFO',
      speaker_email: 'cfo@example.com',
      call_date: '2026-01-06T16:00:00Z',
      call_title: 'Executive Strategy Meeting',
      call_category: 'internal',
      topics: ['financial', 'decision'],
      sentiment: 'neutral',
      relevance_score: 0.71,
      similarity_score: 0.68,
    },
  ],
  total: 4,
  timing: {
    embedding_ms: 150,
    search_ms: 45,
    total_ms: 195,
  },
};

test.describe('Semantic Search with Relevance Scoring', () => {
  test.beforeEach(async ({ page }) => {
    // Set up API mock for semantic search before navigation
    await page.route('**/functions/v1/semantic-search', async (route) => {
      const request = route.request();
      const postData = request.postDataJSON();

      // Return mock response for any query
      if (postData?.query) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...mockSemanticSearchResponse,
            query: postData.query,
          }),
        });
      } else {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Query string is required' }),
        });
      }
    });

    // Navigate to the home page (search modal is global)
    await page.goto('/');

    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');
  });

  test.describe('Search Modal Interaction', () => {
    test('should open search modal with keyboard shortcut', async ({ page }) => {
      // Press Cmd/Ctrl+K to open search modal
      await page.keyboard.press('Meta+k');

      // Verify the search dialog appears
      const searchDialog = page.getByRole('dialog');
      await expect(searchDialog).toBeVisible({ timeout: 5000 });

      // Verify search input is visible and focused
      const searchInput = searchDialog.locator('input[type="search"]');
      await expect(searchInput).toBeVisible();
      await expect(searchInput).toBeFocused();
    });

    test('should close search modal with Escape key', async ({ page }) => {
      // Open search modal
      await page.keyboard.press('Meta+k');

      const searchDialog = page.getByRole('dialog');
      await expect(searchDialog).toBeVisible();

      // Press Escape to close
      await page.keyboard.press('Escape');

      // Verify modal is closed
      await expect(searchDialog).not.toBeVisible({ timeout: 3000 });
    });

    test('should show initial state before searching', async ({ page }) => {
      // Open search modal
      await page.keyboard.press('Meta+k');

      const searchDialog = page.getByRole('dialog');
      await expect(searchDialog).toBeVisible();

      // Verify initial state message is shown
      await expect(searchDialog.getByText('Search your calls')).toBeVisible();
      await expect(
        searchDialog.getByText('Search across transcripts, insights, and quotes')
      ).toBeVisible();
    });
  });

  test.describe('Semantic Search Query', () => {
    test('should return semantically similar results for "budget concerns"', async ({ page }) => {
      // Open search modal
      await page.keyboard.press('Meta+k');

      const searchDialog = page.getByRole('dialog');
      await expect(searchDialog).toBeVisible();

      // Enter semantic query
      const searchInput = searchDialog.locator('input[type="search"]');
      await searchInput.fill('budget concerns');

      // Wait for search results to load
      await page.waitForResponse(
        (response) =>
          response.url().includes('semantic-search') && response.status() === 200
      );

      // Verify results include semantically similar content
      // These results don't contain exact phrase "budget concerns"
      // but are semantically related (pricing, costs, affordability)
      await expect(searchDialog.getByText(/pricing structure/i)).toBeVisible();
      await expect(searchDialog.getByText(/costs are getting/i)).toBeVisible();
      await expect(searchDialog.getByText(/affordability/i)).toBeVisible();
      await expect(searchDialog.getByText(/financial implications/i)).toBeVisible();
    });

    test('should display result count in footer', async ({ page }) => {
      // Open search modal
      await page.keyboard.press('Meta+k');

      const searchDialog = page.getByRole('dialog');
      const searchInput = searchDialog.locator('input[type="search"]');
      await searchInput.fill('budget concerns');

      // Wait for results
      await page.waitForResponse(
        (response) =>
          response.url().includes('semantic-search') && response.status() === 200
      );

      // Verify result count is displayed
      await expect(searchDialog.getByText('4 results')).toBeVisible();
    });
  });

  test.describe('Relevance Score Display', () => {
    test('should display relevance scores as percentages', async ({ page }) => {
      // Open search modal
      await page.keyboard.press('Meta+k');

      const searchDialog = page.getByRole('dialog');
      const searchInput = searchDialog.locator('input[type="search"]');
      await searchInput.fill('budget concerns');

      // Wait for results
      await page.waitForResponse(
        (response) =>
          response.url().includes('semantic-search') && response.status() === 200
      );

      // Verify relevance scores are displayed as percentages
      // Expected scores: 92%, 87%, 79%, 71% (based on mock data)
      await expect(searchDialog.getByText('92%')).toBeVisible();
      await expect(searchDialog.getByText('87%')).toBeVisible();
      await expect(searchDialog.getByText('79%')).toBeVisible();
      await expect(searchDialog.getByText('71%')).toBeVisible();
    });

    test('should display relevance score badge with correct styling', async ({ page }) => {
      // Open search modal
      await page.keyboard.press('Meta+k');

      const searchDialog = page.getByRole('dialog');
      const searchInput = searchDialog.locator('input[type="search"]');
      await searchInput.fill('budget concerns');

      // Wait for results
      await page.waitForResponse(
        (response) =>
          response.url().includes('semantic-search') && response.status() === 200
      );

      // Find the relevance score badges
      const scoreBadge = searchDialog.locator('span:text("92%")');
      await expect(scoreBadge).toBeVisible();

      // Verify badge has appropriate styling (muted, rounded)
      await expect(scoreBadge).toHaveClass(/rounded/);
    });
  });

  test.describe('Results Sorting', () => {
    test('should display results sorted by relevance descending', async ({ page }) => {
      // Open search modal
      await page.keyboard.press('Meta+k');

      const searchDialog = page.getByRole('dialog');
      const searchInput = searchDialog.locator('input[type="search"]');
      await searchInput.fill('budget concerns');

      // Wait for results
      await page.waitForResponse(
        (response) =>
          response.url().includes('semantic-search') && response.status() === 200
      );

      // Get all result items in order
      const resultItems = searchDialog.locator('[role="button"]');

      // Verify the first result is the highest relevance (92%)
      const firstResult = resultItems.first();
      await expect(firstResult).toContainText('92%');
      await expect(firstResult).toContainText('pricing structure');

      // Verify the last result is the lowest relevance (71%)
      const lastResult = resultItems.last();
      await expect(lastResult).toContainText('71%');
      await expect(lastResult).toContainText('financial implications');
    });

    test('should maintain sort order after displaying results', async ({ page }) => {
      // Open search modal
      await page.keyboard.press('Meta+k');

      const searchDialog = page.getByRole('dialog');
      const searchInput = searchDialog.locator('input[type="search"]');
      await searchInput.fill('budget concerns');

      // Wait for results
      await page.waitForResponse(
        (response) =>
          response.url().includes('semantic-search') && response.status() === 200
      );

      // Get all percentage badges
      const percentageBadges = searchDialog.locator('span').filter({ hasText: /%$/ });
      const badgeTexts = await percentageBadges.allTextContents();

      // Convert to numbers for comparison
      const percentages = badgeTexts
        .map((text) => parseInt(text.replace('%', '')))
        .filter((num) => !isNaN(num));

      // Verify they are in descending order
      for (let i = 0; i < percentages.length - 1; i++) {
        expect(percentages[i]).toBeGreaterThanOrEqual(percentages[i + 1]);
      }
    });
  });

  test.describe('Result Item Details', () => {
    test('should display source call information', async ({ page }) => {
      // Open search modal
      await page.keyboard.press('Meta+k');

      const searchDialog = page.getByRole('dialog');
      const searchInput = searchDialog.locator('input[type="search"]');
      await searchInput.fill('budget concerns');

      // Wait for results
      await page.waitForResponse(
        (response) =>
          response.url().includes('semantic-search') && response.status() === 200
      );

      // Verify source call titles are displayed
      await expect(searchDialog.getByText('Q1 Budget Review')).toBeVisible();
      await expect(searchDialog.getByText('Finance Team Sync')).toBeVisible();
      await expect(searchDialog.getByText('Customer Demo Call')).toBeVisible();
      await expect(searchDialog.getByText('Executive Strategy Meeting')).toBeVisible();
    });

    test('should display speaker names when available', async ({ page }) => {
      // Open search modal
      await page.keyboard.press('Meta+k');

      const searchDialog = page.getByRole('dialog');
      const searchInput = searchDialog.locator('input[type="search"]');
      await searchInput.fill('budget concerns');

      // Wait for results
      await page.waitForResponse(
        (response) =>
          response.url().includes('semantic-search') && response.status() === 200
      );

      // Verify speaker names are displayed
      await expect(searchDialog.getByText('John Smith')).toBeVisible();
      await expect(searchDialog.getByText('Jane Doe')).toBeVisible();
    });

    test('should display result type badge (Transcript)', async ({ page }) => {
      // Open search modal
      await page.keyboard.press('Meta+k');

      const searchDialog = page.getByRole('dialog');
      const searchInput = searchDialog.locator('input[type="search"]');
      await searchInput.fill('budget concerns');

      // Wait for results
      await page.waitForResponse(
        (response) =>
          response.url().includes('semantic-search') && response.status() === 200
      );

      // Verify Transcript badges are shown
      const transcriptBadges = searchDialog.locator('text=Transcript');
      await expect(transcriptBadges.first()).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to call detail when clicking result', async ({ page }) => {
      // Open search modal
      await page.keyboard.press('Meta+k');

      const searchDialog = page.getByRole('dialog');
      const searchInput = searchDialog.locator('input[type="search"]');
      await searchInput.fill('budget concerns');

      // Wait for results
      await page.waitForResponse(
        (response) =>
          response.url().includes('semantic-search') && response.status() === 200
      );

      // Click the first result
      const firstResult = searchDialog.locator('[role="button"]').first();
      await firstResult.click();

      // Verify modal closes
      await expect(searchDialog).not.toBeVisible({ timeout: 3000 });

      // Verify navigation occurred (URL should contain call ID)
      await expect(page).toHaveURL(/\/call\/\d+/);
    });

    test('should navigate to first result with Enter key', async ({ page }) => {
      // Open search modal
      await page.keyboard.press('Meta+k');

      const searchDialog = page.getByRole('dialog');
      const searchInput = searchDialog.locator('input[type="search"]');
      await searchInput.fill('budget concerns');

      // Wait for results
      await page.waitForResponse(
        (response) =>
          response.url().includes('semantic-search') && response.status() === 200
      );

      // Press Enter to select first result
      await page.keyboard.press('Enter');

      // Verify modal closes and navigation occurred
      await expect(searchDialog).not.toBeVisible({ timeout: 3000 });
      await expect(page).toHaveURL(/\/call\/\d+/);
    });
  });

  test.describe('Edge Cases', () => {
    test('should show minimum character message for short query', async ({ page }) => {
      // Open search modal
      await page.keyboard.press('Meta+k');

      const searchDialog = page.getByRole('dialog');
      const searchInput = searchDialog.locator('input[type="search"]');

      // Type single character (below minimum)
      await searchInput.fill('b');

      // Verify minimum character message
      await expect(
        searchDialog.getByText('Keep typing... (minimum 2 characters)')
      ).toBeVisible();
    });

    test('should handle empty results gracefully', async ({ page }) => {
      // Override mock for empty results
      await page.route('**/functions/v1/semantic-search', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            query: 'xyznonexistent',
            results: [],
            total: 0,
            timing: { embedding_ms: 100, search_ms: 20, total_ms: 120 },
          }),
        });
      });

      // Open search modal
      await page.keyboard.press('Meta+k');

      const searchDialog = page.getByRole('dialog');
      const searchInput = searchDialog.locator('input[type="search"]');
      await searchInput.fill('xyznonexistent');

      // Wait for response
      await page.waitForResponse(
        (response) =>
          response.url().includes('semantic-search') && response.status() === 200
      );

      // Verify empty state message
      await expect(searchDialog.getByText('No results found')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have accessible search input', async ({ page }) => {
      // Open search modal
      await page.keyboard.press('Meta+k');

      const searchDialog = page.getByRole('dialog');

      // Verify dialog has proper accessibility
      await expect(searchDialog).toBeVisible();

      // Verify search input has proper type
      const searchInput = searchDialog.locator('input[type="search"]');
      await expect(searchInput).toBeVisible();
      await expect(searchInput).toHaveAttribute('type', 'search');
    });

    test('should have accessible result items', async ({ page }) => {
      // Open search modal
      await page.keyboard.press('Meta+k');

      const searchDialog = page.getByRole('dialog');
      const searchInput = searchDialog.locator('input[type="search"]');
      await searchInput.fill('budget concerns');

      // Wait for results
      await page.waitForResponse(
        (response) =>
          response.url().includes('semantic-search') && response.status() === 200
      );

      // Verify result items have button role (for accessibility)
      const resultItems = searchDialog.locator('[role="button"]');
      await expect(resultItems.first()).toBeVisible();

      // Verify result items have aria-label
      const firstResult = resultItems.first();
      await expect(firstResult).toHaveAttribute('aria-label', /Transcript:/);
    });

    test('should support keyboard navigation', async ({ page }) => {
      // Open search modal
      await page.keyboard.press('Meta+k');

      const searchDialog = page.getByRole('dialog');
      const searchInput = searchDialog.locator('input[type="search"]');
      await searchInput.fill('budget concerns');

      // Wait for results
      await page.waitForResponse(
        (response) =>
          response.url().includes('semantic-search') && response.status() === 200
      );

      // Verify Tab navigation tip is shown
      await expect(searchDialog.getByText('Tab')).toBeVisible();
      await expect(searchDialog.getByText('to navigate')).toBeVisible();

      // Verify Enter navigation tip is shown
      await expect(searchDialog.getByText('Enter')).toBeVisible();
      await expect(searchDialog.getByText('to select')).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should not have console errors during search', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      // Open search modal
      await page.keyboard.press('Meta+k');

      const searchDialog = page.getByRole('dialog');
      const searchInput = searchDialog.locator('input[type="search"]');
      await searchInput.fill('budget concerns');

      // Wait for results
      await page.waitForResponse(
        (response) =>
          response.url().includes('semantic-search') && response.status() === 200
      );

      // Wait for UI to settle
      await page.waitForTimeout(500);

      // Filter out known expected warnings/errors
      const unexpectedErrors = errors.filter(
        (error) =>
          !error.includes('[HMR]') &&
          !error.includes('React DevTools') &&
          !error.includes('Download the React DevTools') &&
          !error.includes('Failed to load resource') // Network errors from auth
      );

      // No unexpected console errors
      expect(unexpectedErrors).toHaveLength(0);
    });
  });
});
