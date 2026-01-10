import { test, expect } from '@playwright/test';

/**
 * E2E tests for Citation Pills display in Chat.
 *
 * This test suite covers the citation/sources functionality in the AI chat:
 * 1. Navigate to chat page
 * 2. Ask question about transcripts
 * 3. Verify citation pills appear below AI response
 * 4. Click citation pill to navigate to source call
 *
 * @pattern chat-citation-pills
 * @see src/pages/Chat.tsx
 * @see src/components/chat/source.tsx
 */

/**
 * Mock SSE stream response following AI SDK v5 Data Stream Protocol.
 * Simulates a complete chat response with tool call results that include sources.
 */
function createMockChatStream(): string {
  const messageId = 'mock-message-id';
  const toolCallId = 'mock-tool-call-1';
  const textId = 'mock-text-id';

  // Tool result with sources (simulating searchTranscriptsByQuery response)
  const toolResult = {
    results: [
      {
        index: 1,
        recording_id: 101,
        call_title: 'Q1 Budget Planning Meeting',
        call_date: '2026-01-09T10:00:00Z',
        speaker: 'John Smith',
        category: 'internal',
        text: 'We discussed the budget allocation for Q1 and identified key areas for cost reduction.',
        relevance: '92%',
      },
      {
        index: 2,
        recording_id: 102,
        call_title: 'Finance Team Sync',
        call_date: '2026-01-08T14:30:00Z',
        speaker: 'Jane Doe',
        category: 'internal',
        text: 'The finance team reviewed the quarterly projections and spending trends.',
        relevance: '87%',
      },
      {
        index: 3,
        recording_id: 103,
        call_title: 'Customer Pricing Call',
        call_date: '2026-01-07T09:15:00Z',
        speaker: 'Sales Rep',
        category: 'sales',
        text: 'Customer expressed concerns about affordability and asked about payment plans.',
        relevance: '79%',
      },
    ],
    total_found: 3,
    reranked: 3,
    returned: 3,
  };

  // Build SSE events following AI SDK v5 protocol
  const events = [
    // Step 1: Message start
    { type: 'start', messageId },
    { type: 'start-step' },

    // Tool call streaming
    { type: 'tool-input-start', toolCallId, toolName: 'searchTranscriptsByQuery' },
    { type: 'tool-input-delta', toolCallId, inputTextDelta: '{"query":"budget","limit":10}' },
    {
      type: 'tool-input-available',
      toolCallId,
      toolName: 'searchTranscriptsByQuery',
      input: { query: 'budget', limit: 10 },
    },
    { type: 'tool-output-available', toolCallId, output: toolResult },

    // Finish first step
    { type: 'finish-step' },

    // Step 2: Assistant text response
    { type: 'start-step' },
    { type: 'text-start', id: textId },
    { type: 'text-delta', id: textId, delta: 'Based on my search of your transcripts, I found ' },
    { type: 'text-delta', id: textId, delta: 'several discussions about budget. Here are the key findings:\n\n' },
    { type: 'text-delta', id: textId, delta: '1. In the **Q1 Budget Planning Meeting**, you discussed budget allocation ' },
    { type: 'text-delta', id: textId, delta: 'and identified key areas for cost reduction.\n\n' },
    { type: 'text-delta', id: textId, delta: '2. The **Finance Team Sync** covered quarterly projections and spending trends.\n\n' },
    { type: 'text-delta', id: textId, delta: '3. A customer expressed affordability concerns in the **Customer Pricing Call**.' },
    { type: 'text-end', id: textId },
    { type: 'finish-step' },

    // Final finish
    { type: 'finish' },
  ];

  // Convert to SSE format
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('') + 'data: [DONE]\n\n';
}

test.describe('Chat Citation Pills Display', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the chat-stream API before navigation
    await page.route('**/functions/v1/chat-stream', async (route) => {
      const mockStream = createMockChatStream();

      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'x-vercel-ai-ui-message-stream': 'v1',
        },
        body: mockStream,
      });
    });

    // Navigate to chat page
    await page.goto('/chat');

    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');
  });

  test.describe('Citation Pills Visibility', () => {
    test('should display citation pills after AI response with sources', async ({ page }) => {
      // Find the chat input
      const chatInput = page.locator('textarea[placeholder*="Ask about your transcripts"]');
      await expect(chatInput).toBeVisible({ timeout: 10000 });

      // Type a question about transcripts
      await chatInput.fill('What was discussed about the budget?');

      // Submit the message
      const sendButton = page.getByRole('button', { name: /send/i });
      await sendButton.click();

      // Wait for response to complete
      await page.waitForResponse(
        (response) =>
          response.url().includes('chat-stream') && response.status() === 200
      );

      // Wait for the response to render (give time for SSE to process)
      await page.waitForTimeout(1000);

      // Verify citation pills container appears with "Sources:" label
      await expect(page.getByText('Sources:')).toBeVisible({ timeout: 10000 });

      // Verify numbered citation pills appear (1, 2, 3)
      const citationPills = page.locator('button').filter({ hasText: /^[123]$/ });
      await expect(citationPills).toHaveCount(3);
    });

    test('should display correct number of citation pills based on sources', async ({ page }) => {
      // Send a message to trigger the mock response
      const chatInput = page.locator('textarea[placeholder*="Ask about your transcripts"]');
      await chatInput.fill('Tell me about budget discussions');
      await page.getByRole('button', { name: /send/i }).click();

      // Wait for response
      await page.waitForResponse(
        (response) => response.url().includes('chat-stream') && response.status() === 200
      );
      await page.waitForTimeout(1000);

      // Verify we have exactly 3 citation pills (matching our mock data)
      const sourcesContainer = page.locator('text=Sources:').locator('..');
      await expect(sourcesContainer).toBeVisible();

      // Each source should be rendered as a numbered button
      const pillButtons = sourcesContainer.locator('button');
      await expect(pillButtons).toHaveCount(3);
    });

    test('should position citation pills below the AI response', async ({ page }) => {
      // Send message
      const chatInput = page.locator('textarea[placeholder*="Ask about your transcripts"]');
      await chatInput.fill('Budget information please');
      await page.getByRole('button', { name: /send/i }).click();

      await page.waitForResponse(
        (response) => response.url().includes('chat-stream') && response.status() === 200
      );
      await page.waitForTimeout(1000);

      // Verify assistant message text appears
      await expect(page.getByText(/Based on my search of your transcripts/)).toBeVisible();

      // Verify sources appear after the text
      const sourcesLabel = page.getByText('Sources:');
      await expect(sourcesLabel).toBeVisible();

      // Get bounding boxes to verify positioning
      const textElement = page.getByText(/Based on my search of your transcripts/);
      const sourcesElement = sourcesLabel;

      const textBox = await textElement.boundingBox();
      const sourcesBox = await sourcesElement.boundingBox();

      // Sources should be below the text (higher y value)
      expect(sourcesBox!.y).toBeGreaterThan(textBox!.y);
    });
  });

  test.describe('Citation Pill Interaction', () => {
    test('should show hover card when hovering over citation pill', async ({ page }) => {
      // Send message
      const chatInput = page.locator('textarea[placeholder*="Ask about your transcripts"]');
      await chatInput.fill('What about budget?');
      await page.getByRole('button', { name: /send/i }).click();

      await page.waitForResponse(
        (response) => response.url().includes('chat-stream') && response.status() === 200
      );
      await page.waitForTimeout(1000);

      // Hover over the first citation pill
      const firstPill = page.locator('button').filter({ hasText: '1' }).first();
      await firstPill.hover();

      // Wait for hover card to appear (150ms delay in component)
      await page.waitForTimeout(300);

      // Verify hover card shows call details
      await expect(page.getByText('Q1 Budget Planning Meeting')).toBeVisible();
      await expect(page.getByText('John Smith')).toBeVisible();
      await expect(page.getByText('View full call')).toBeVisible();
    });

    test('should display speaker name in hover card', async ({ page }) => {
      const chatInput = page.locator('textarea[placeholder*="Ask about your transcripts"]');
      await chatInput.fill('Budget info');
      await page.getByRole('button', { name: /send/i }).click();

      await page.waitForResponse(
        (response) => response.url().includes('chat-stream') && response.status() === 200
      );
      await page.waitForTimeout(1000);

      // Hover over second citation pill
      const secondPill = page.locator('button').filter({ hasText: '2' }).first();
      await secondPill.hover();
      await page.waitForTimeout(300);

      // Verify speaker from second source
      await expect(page.getByText('Jane Doe')).toBeVisible();
    });

    test('should display date in hover card', async ({ page }) => {
      const chatInput = page.locator('textarea[placeholder*="Ask about your transcripts"]');
      await chatInput.fill('Budget details');
      await page.getByRole('button', { name: /send/i }).click();

      await page.waitForResponse(
        (response) => response.url().includes('chat-stream') && response.status() === 200
      );
      await page.waitForTimeout(1000);

      // Hover over first citation
      const firstPill = page.locator('button').filter({ hasText: '1' }).first();
      await firstPill.hover();
      await page.waitForTimeout(300);

      // Verify date appears (formatted as "Jan 9, 2026")
      await expect(page.getByText(/Jan 9, 2026/)).toBeVisible();
    });
  });

  test.describe('Citation Pill Navigation', () => {
    test('should trigger call detail dialog when clicking citation pill', async ({ page }) => {
      // Mock the fathom_calls API for call details
      await page.route('**/rest/v1/fathom_calls*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());

        // Check if this is a single call fetch
        if (url.searchParams.get('recording_id')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              recording_id: 101,
              title: 'Q1 Budget Planning Meeting',
              created_at: '2026-01-09T10:00:00Z',
              summary: 'Discussion of Q1 budget allocation and cost reduction strategies.',
              recorded_by_name: 'John Smith',
              url: 'https://fathom.video/call/101',
            }),
          });
        } else {
          await route.continue();
        }
      });

      const chatInput = page.locator('textarea[placeholder*="Ask about your transcripts"]');
      await chatInput.fill('Budget discussion');
      await page.getByRole('button', { name: /send/i }).click();

      await page.waitForResponse(
        (response) => response.url().includes('chat-stream') && response.status() === 200
      );
      await page.waitForTimeout(1000);

      // Click the first citation pill
      const firstPill = page.locator('button').filter({ hasText: '1' }).first();
      await firstPill.click();

      // Verify the call detail dialog opens (dialog role appears)
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 5000 });
    });

    test('should be able to click "View full call" from hover card', async ({ page }) => {
      // Mock the fathom_calls API
      await page.route('**/rest/v1/fathom_calls*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            recording_id: 101,
            title: 'Q1 Budget Planning Meeting',
            created_at: '2026-01-09T10:00:00Z',
            summary: 'Budget discussion summary.',
            recorded_by_name: 'John Smith',
          }),
        });
      });

      const chatInput = page.locator('textarea[placeholder*="Ask about your transcripts"]');
      await chatInput.fill('Budget');
      await page.getByRole('button', { name: /send/i }).click();

      await page.waitForResponse(
        (response) => response.url().includes('chat-stream') && response.status() === 200
      );
      await page.waitForTimeout(1000);

      // Hover to open card, then click the "View full call" button
      const firstPill = page.locator('button').filter({ hasText: '1' }).first();
      await firstPill.hover();
      await page.waitForTimeout(300);

      // Click the "View full call" action in the hover card
      const viewCallButton = page.getByText('View full call');
      await viewCallButton.click();

      // Verify dialog opens
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Citation Pills Styling', () => {
    test('should display citation pills as rounded badges', async ({ page }) => {
      const chatInput = page.locator('textarea[placeholder*="Ask about your transcripts"]');
      await chatInput.fill('Budget');
      await page.getByRole('button', { name: /send/i }).click();

      await page.waitForResponse(
        (response) => response.url().includes('chat-stream') && response.status() === 200
      );
      await page.waitForTimeout(1000);

      // Verify first pill has rounded styling
      const firstPill = page.locator('button').filter({ hasText: '1' }).first();
      await expect(firstPill).toHaveClass(/rounded/);
    });

    test('should display microphone icon on citation pills', async ({ page }) => {
      const chatInput = page.locator('textarea[placeholder*="Ask about your transcripts"]');
      await chatInput.fill('Budget');
      await page.getByRole('button', { name: /send/i }).click();

      await page.waitForResponse(
        (response) => response.url().includes('chat-stream') && response.status() === 200
      );
      await page.waitForTimeout(1000);

      // Check for SVG icon inside citation pills (mic icon)
      const sourcesContainer = page.locator('text=Sources:').locator('..');
      const svgIcons = sourcesContainer.locator('svg');

      // Should have at least 3 icons (one per citation)
      const iconCount = await svgIcons.count();
      expect(iconCount).toBeGreaterThanOrEqual(3);
    });
  });

  test.describe('Error Handling', () => {
    test('should not have console errors during citation display', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      const chatInput = page.locator('textarea[placeholder*="Ask about your transcripts"]');
      await chatInput.fill('Budget info');
      await page.getByRole('button', { name: /send/i }).click();

      await page.waitForResponse(
        (response) => response.url().includes('chat-stream') && response.status() === 200
      );
      await page.waitForTimeout(1000);

      // Verify citations appear
      await expect(page.getByText('Sources:')).toBeVisible();

      // Filter out known expected warnings/errors
      const unexpectedErrors = errors.filter(
        (error) =>
          !error.includes('[HMR]') &&
          !error.includes('React DevTools') &&
          !error.includes('Download the React DevTools') &&
          !error.includes('Failed to load resource') &&
          !error.includes('net::')
      );

      // No unexpected console errors
      expect(unexpectedErrors).toHaveLength(0);
    });
  });

  test.describe('Accessibility', () => {
    test('should have accessible citation pill buttons', async ({ page }) => {
      const chatInput = page.locator('textarea[placeholder*="Ask about your transcripts"]');
      await chatInput.fill('Budget');
      await page.getByRole('button', { name: /send/i }).click();

      await page.waitForResponse(
        (response) => response.url().includes('chat-stream') && response.status() === 200
      );
      await page.waitForTimeout(1000);

      // Citation pills should be buttons (clickable)
      const sourcesContainer = page.locator('text=Sources:').locator('..');
      const pillButtons = sourcesContainer.locator('button');

      // Verify they are valid buttons
      const count = await pillButtons.count();
      expect(count).toBe(3);

      // Verify first pill can receive focus
      await pillButtons.first().focus();
      await expect(pillButtons.first()).toBeFocused();
    });

    test('should support keyboard interaction on citation pills', async ({ page }) => {
      // Mock call detail API
      await page.route('**/rest/v1/fathom_calls*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            recording_id: 101,
            title: 'Q1 Budget Planning Meeting',
            created_at: '2026-01-09T10:00:00Z',
            summary: 'Budget discussion.',
            recorded_by_name: 'John Smith',
          }),
        });
      });

      const chatInput = page.locator('textarea[placeholder*="Ask about your transcripts"]');
      await chatInput.fill('Budget');
      await page.getByRole('button', { name: /send/i }).click();

      await page.waitForResponse(
        (response) => response.url().includes('chat-stream') && response.status() === 200
      );
      await page.waitForTimeout(1000);

      // Focus on first citation pill
      const sourcesContainer = page.locator('text=Sources:').locator('..');
      const firstPill = sourcesContainer.locator('button').first();
      await firstPill.focus();

      // Press Enter to activate
      await page.keyboard.press('Enter');

      // Verify dialog opens
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    });
  });
});
