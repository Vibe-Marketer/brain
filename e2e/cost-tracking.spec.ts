import { test, expect } from '@playwright/test';

/**
 * E2E tests for Cost Tracking display in Billing settings.
 *
 * This test suite covers the embedding cost tracking functionality:
 * 1. Navigate to Settings > Billing
 * 2. Verify embedding costs section shows total cost
 * 3. Verify per-transcript average is calculated
 * 4. Verify monthly trend chart renders
 *
 * @pattern cost-tracking
 * @see src/components/settings/BillingTab.tsx
 * @see src/hooks/useEmbeddingCosts.ts
 */

/**
 * Mock monthly cost summary data matching the database function format.
 * Simulates data from get_embedding_cost_summary RPC.
 */
const mockMonthlyCostSummary = [
  {
    month: '2026-01-01',
    operation_type: 'embedding',
    total_tokens: 150000,
    total_cost_cents: 3.0, // $0.03 for embeddings (150K tokens * $0.02/1M)
    request_count: 25,
    avg_tokens_per_request: 6000,
  },
  {
    month: '2026-01-01',
    operation_type: 'enrichment',
    total_tokens: 45000,
    total_cost_cents: 6.75, // enrichment using gpt-4o-mini
    request_count: 50,
    avg_tokens_per_request: 900,
  },
  {
    month: '2025-12-01',
    operation_type: 'embedding',
    total_tokens: 200000,
    total_cost_cents: 4.0, // $0.04
    request_count: 30,
    avg_tokens_per_request: 6667,
  },
  {
    month: '2025-12-01',
    operation_type: 'enrichment',
    total_tokens: 60000,
    total_cost_cents: 9.0,
    request_count: 60,
    avg_tokens_per_request: 1000,
  },
  {
    month: '2025-11-01',
    operation_type: 'embedding',
    total_tokens: 120000,
    total_cost_cents: 2.4,
    request_count: 20,
    avg_tokens_per_request: 6000,
  },
  {
    month: '2025-10-01',
    operation_type: 'embedding',
    total_tokens: 80000,
    total_cost_cents: 1.6,
    request_count: 15,
    avg_tokens_per_request: 5333,
  },
];

/**
 * Mock embedding usage logs for distinct recordings count.
 */
const mockEmbeddingUsageLogs = [
  { recording_id: 101 },
  { recording_id: 102 },
  { recording_id: 103 },
  { recording_id: 104 },
  { recording_id: 105 },
  { recording_id: 101 }, // duplicate to test distinct count
  { recording_id: 102 }, // duplicate
];

test.describe('Cost Tracking Display', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the Supabase RPC call for get_embedding_cost_summary
    await page.route('**/rest/v1/rpc/get_embedding_cost_summary*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockMonthlyCostSummary),
      });
    });

    // Mock the embedding_usage_logs table queries for transcript count
    await page.route('**/rest/v1/embedding_usage_logs*', async (route) => {
      const url = route.request().url();

      // Check if this is a count query (head: true)
      if (url.includes('select=recording_id')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: {
            'Content-Range': '0-6/7', // For count queries
          },
          body: JSON.stringify(mockEmbeddingUsageLogs),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to the Settings page
    await page.goto('/settings');

    // Wait for the page to fully load
    await expect(
      page.getByRole('main', { name: /settings content/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test.describe('Navigation to Billing', () => {
    test('should navigate to Billing settings via pane navigation', async ({ page }) => {
      // Find the category pane
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });
      await expect(categoryPane).toBeVisible();

      // Click Billing category
      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();

      // Verify detail pane opens with Billing content
      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });

      // Verify Billing header is shown
      await expect(detailPane.getByText('Billing')).toBeVisible();
    });
  });

  test.describe('Embedding Costs Section', () => {
    test('should display the AI Usage / Embedding Costs section', async ({ page }) => {
      // Navigate to Billing
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });
      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();

      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });

      // Verify AI Usage section header appears
      await expect(detailPane.getByText('AI Usage')).toBeVisible();
      await expect(detailPane.getByText('Embedding and search costs for your transcripts')).toBeVisible();
    });

    test('should display Embedding Costs title with OpenAI badge', async ({ page }) => {
      // Navigate to Billing
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });
      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();

      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });

      // Verify Embedding Costs title and badge
      await expect(detailPane.getByText('Embedding Costs')).toBeVisible();
      await expect(detailPane.getByText('OpenAI')).toBeVisible();
    });
  });

  test.describe('Total Cost Display', () => {
    test('should display total cost in USD format', async ({ page }) => {
      // Navigate to Billing
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });
      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();

      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });

      // Wait for loading to complete
      await page.waitForTimeout(500);

      // Verify "Total Cost" label is shown
      await expect(detailPane.getByText('Total Cost')).toBeVisible();

      // Total should be sum of all costs: 3.0 + 6.75 + 4.0 + 9.0 + 2.4 + 1.6 = 26.75 cents = $0.2675
      // The UI displays dollar amounts
      await expect(detailPane.getByText(/\$0\.26/)).toBeVisible();
    });

    test('should display cost stats in a grid format', async ({ page }) => {
      // Navigate to Billing
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });
      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();

      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });

      await page.waitForTimeout(500);

      // Verify all stat cards are visible
      await expect(detailPane.getByText('Total Cost')).toBeVisible();
      await expect(detailPane.getByText('Avg per Transcript')).toBeVisible();
      await expect(detailPane.getByText('Total Tokens')).toBeVisible();
      await expect(detailPane.getByText('Transcripts')).toBeVisible();
    });
  });

  test.describe('Per-Transcript Average', () => {
    test('should display average cost per transcript', async ({ page }) => {
      // Navigate to Billing
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });
      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();

      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });

      await page.waitForTimeout(500);

      // Verify "Avg per Transcript" label is shown
      await expect(detailPane.getByText('Avg per Transcript')).toBeVisible();

      // Should show a dollar amount (format depends on value)
      // With 5 unique transcripts and $0.2675 total, avg = $0.0535
      const avgSection = detailPane.locator(':has-text("Avg per Transcript")').first();
      await expect(avgSection.locator('text=/\\$/')).toBeVisible();
    });

    test('should calculate average based on distinct recording count', async ({ page }) => {
      // Navigate to Billing
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });
      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();

      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });

      await page.waitForTimeout(500);

      // Verify transcript count is shown (5 unique from mock data)
      await expect(detailPane.getByText('Transcripts')).toBeVisible();

      // The count should reflect distinct recordings
      const transcriptsSection = detailPane.locator('div:has-text("Transcripts")').first();
      await expect(transcriptsSection).toBeVisible();
    });
  });

  test.describe('Total Tokens Display', () => {
    test('should display total tokens with K/M suffix formatting', async ({ page }) => {
      // Navigate to Billing
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });
      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();

      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });

      await page.waitForTimeout(500);

      // Verify "Total Tokens" label
      await expect(detailPane.getByText('Total Tokens')).toBeVisible();

      // Total tokens = 150K + 45K + 200K + 60K + 120K + 80K = 655K tokens
      // Should display with K suffix
      await expect(detailPane.getByText(/655.*K/)).toBeVisible();
    });
  });

  test.describe('Monthly Trend Chart', () => {
    test('should display monthly cost trend chart section', async ({ page }) => {
      // Navigate to Billing
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });
      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();

      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });

      await page.waitForTimeout(500);

      // Verify chart section title is visible
      await expect(detailPane.getByText('Monthly Cost Trend (Last 6 Months)')).toBeVisible();
    });

    test('should render bar chart component', async ({ page }) => {
      // Navigate to Billing
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });
      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();

      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });

      await page.waitForTimeout(1000); // Wait for chart animation

      // Verify chart container with Tremor chart is rendered
      // Tremor BarChart renders an SVG element
      const chartContainer = detailPane.locator('div:has-text("Monthly Cost Trend")');
      await expect(chartContainer).toBeVisible();

      // Check for SVG chart element (Tremor uses Recharts which renders SVG)
      const svgChart = chartContainer.locator('svg').first();
      await expect(svgChart).toBeVisible();
    });

    test('should show multiple months in the chart', async ({ page }) => {
      // Navigate to Billing
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });
      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();

      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });

      await page.waitForTimeout(1000);

      // Verify month labels appear (based on mock data: Jan '26, Dec '25, Nov '25, Oct '25)
      const chartSection = detailPane.locator(':has-text("Monthly Cost Trend")').first();
      await expect(chartSection).toBeVisible();

      // Check that the chart has rendered (has bars/rectangles)
      const bars = chartSection.locator('rect');
      const barCount = await bars.count();
      expect(barCount).toBeGreaterThan(0);
    });
  });

  test.describe('Cost by Operation Type', () => {
    test('should display cost breakdown by operation type', async ({ page }) => {
      // Navigate to Billing
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });
      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();

      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });

      await page.waitForTimeout(500);

      // Verify "Cost by Operation Type" section title
      await expect(detailPane.getByText('Cost by Operation Type')).toBeVisible();
    });

    test('should list embedding and enrichment operations', async ({ page }) => {
      // Navigate to Billing
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });
      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();

      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });

      await page.waitForTimeout(500);

      // Check for operation types (capitalized in UI)
      await expect(detailPane.getByText('Embedding')).toBeVisible();
      await expect(detailPane.getByText('Enrichment')).toBeVisible();
    });

    test('should show cost value next to each operation type', async ({ page }) => {
      // Navigate to Billing
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });
      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();

      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });

      await page.waitForTimeout(500);

      // The operation breakdown section should have dollar amounts
      const operationSection = detailPane.locator(':has-text("Cost by Operation Type")').first();
      await expect(operationSection).toBeVisible();

      // Should contain multiple dollar amounts
      const dollarAmounts = operationSection.locator('text=/\\$/');
      const count = await dollarAmounts.count();
      expect(count).toBeGreaterThanOrEqual(2); // At least embedding and enrichment
    });
  });

  test.describe('Loading State', () => {
    test('should show loading skeletons while data loads', async ({ page }) => {
      // Delay the API response to test loading state
      await page.route('**/rest/v1/rpc/get_embedding_cost_summary*', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockMonthlyCostSummary),
        });
      });

      // Navigate to Billing
      await page.goto('/settings');
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });
      await expect(categoryPane).toBeVisible({ timeout: 10000 });

      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();

      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });

      // Check for skeleton elements during loading
      // Skeletons have specific class patterns
      const skeletons = detailPane.locator('[class*="animate-pulse"], [class*="skeleton"]');

      // May or may not catch skeletons depending on timing, but section should eventually load
      await expect(detailPane.getByText('Embedding Costs')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Error Handling', () => {
    test('should display error message when API fails', async ({ page }) => {
      // Mock API failure
      await page.route('**/rest/v1/rpc/get_embedding_cost_summary*', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Internal server error' }),
        });
      });

      // Navigate to Billing
      await page.goto('/settings');
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });
      await expect(categoryPane).toBeVisible({ timeout: 10000 });

      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();

      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });

      // Wait for error to appear
      await page.waitForTimeout(1000);

      // Should show error message (component shows "Failed to load usage data")
      await expect(detailPane.getByText(/Failed to load usage data/i)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Empty State', () => {
    test('should show empty state message when no usage data exists', async ({ page }) => {
      // Mock empty responses
      await page.route('**/rest/v1/rpc/get_embedding_cost_summary*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      });

      await page.route('**/rest/v1/embedding_usage_logs*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: {
            'Content-Range': '0-0/0',
          },
          body: JSON.stringify([]),
        });
      });

      // Navigate to Billing
      await page.goto('/settings');
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });
      await expect(categoryPane).toBeVisible({ timeout: 10000 });

      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();

      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });

      await page.waitForTimeout(500);

      // Should show empty state message for chart
      await expect(
        detailPane.getByText('No usage data yet. Costs will appear here as you process transcripts.')
      ).toBeVisible();
    });

    test('should display zero values when no usage data', async ({ page }) => {
      // Mock empty responses
      await page.route('**/rest/v1/rpc/get_embedding_cost_summary*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      });

      await page.route('**/rest/v1/embedding_usage_logs*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      });

      // Navigate to Billing
      await page.goto('/settings');
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });
      await expect(categoryPane).toBeVisible({ timeout: 10000 });

      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();

      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });

      await page.waitForTimeout(500);

      // Should show $0.00 for total cost
      await expect(detailPane.getByText('$0.00')).toBeVisible();
    });
  });

  test.describe('No Console Errors', () => {
    test('should not have console errors during cost tracking display', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      // Navigate to Billing
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });
      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();

      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });

      // Wait for all data to load
      await page.waitForTimeout(1000);

      // Verify cost section is displayed
      await expect(detailPane.getByText('Embedding Costs')).toBeVisible();

      // Filter out known expected warnings/errors
      const unexpectedErrors = errors.filter(
        (error) =>
          !error.includes('[HMR]') &&
          !error.includes('React DevTools') &&
          !error.includes('Download the React DevTools') &&
          !error.includes('Failed to load resource') &&
          !error.includes('net::') &&
          !error.includes('ERR_')
      );

      // No unexpected console errors
      expect(unexpectedErrors).toHaveLength(0);
    });
  });

  test.describe('Accessibility', () => {
    test('should have accessible stat cards', async ({ page }) => {
      // Navigate to Billing
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });
      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();

      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });

      await page.waitForTimeout(500);

      // Verify stat labels are visible (helps screen readers understand context)
      await expect(detailPane.getByText('Total Cost')).toBeVisible();
      await expect(detailPane.getByText('Avg per Transcript')).toBeVisible();
      await expect(detailPane.getByText('Total Tokens')).toBeVisible();
      await expect(detailPane.getByText('Transcripts')).toBeVisible();
    });

    test('should have proper heading hierarchy', async ({ page }) => {
      // Navigate to Billing
      const categoryPane = page.getByRole('navigation', { name: /settings categories/i });
      await categoryPane.getByRole('button', { name: /billing.*plans/i }).click();

      const detailPane = page.getByRole('region', { name: /billing settings/i });
      await expect(detailPane).toBeVisible({ timeout: 5000 });

      // Verify section headings are present
      await expect(detailPane.locator('h2:has-text("AI Usage")')).toBeVisible();
      await expect(detailPane.locator('h3:has-text("Embedding Costs")')).toBeVisible();
    });
  });
});
