/**
 * Shared mock data for E2E tests using API route mocking.
 */

export const mockUser = {
  id: 'ef054159-3a5a-49e3-9fd8-31fa5a180ee6',
  email: 'test@callvault.app',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: { provider: 'email' },
  user_metadata: {},
};

export const mockToken = {
  access_token: 'fake-token',
  token_type: 'bearer',
  expires_in: 3600,
  refresh_token: 'fake-refresh',
  user: { id: mockUser.id, email: mockUser.email },
};

export const mockUserProfile = [{ onboarding_completed: true }];

export const mockUserSettings = [
  { fathom_api_key: null, oauth_access_token: null },
];

export const mockTranscripts = Array.from({ length: 5 }, (_, i) => ({
  id: i + 1,
  recording_id: i + 1,
  title: `Test Call ${i + 1}`,
  created_at: new Date(2026, 2, 20 - i).toISOString(),
  duration_seconds: (i + 1) * 600,
  source: ['fathom', 'zoom', 'youtube', 'upload', 'fathom'][i],
  participants: [`user${i}@example.com`, `host@example.com`],
  summary: `Summary of test call ${i + 1}`,
  transcript: `This is the transcript content for call ${i + 1}.`,
}));

export const mockFolders = [
  { id: 'folder-1', name: 'Sales', color: '#FF6B35', parent_id: null },
  { id: 'folder-2', name: 'Support', color: '#4A90D9', parent_id: null },
  { id: 'folder-3', name: 'Q1 Pipeline', color: '#7C3AED', parent_id: 'folder-1' },
];

export const mockTags = [
  { id: 'tag-1', name: 'Important', color: '#EF4444' },
  { id: 'tag-2', name: 'Follow-up', color: '#F59E0B' },
  { id: 'tag-3', name: 'Demo', color: '#10B981' },
];

export const mockWorkspaces = [
  { id: 'ws-1', name: 'My Workspace', is_default: true },
  { id: 'ws-2', name: 'Team Workspace', is_default: false },
];

/**
 * Setup common API mocks for tests that don't need live data.
 */
export async function setupApiMocks(page: import('@playwright/test').Page) {
  await page.route('**/auth/v1/user', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockUser),
    });
  });

  await page.route('**/auth/v1/token**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockToken),
    });
  });

  await page.route('**/rest/v1/user_profiles**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockUserProfile),
    });
  });

  await page.route('**/rest/v1/user_settings**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockUserSettings),
    });
  });

  await page.route('**/rest/v1/fathom_calls**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockTranscripts),
      headers: { 'content-range': `0-${mockTranscripts.length - 1}/${mockTranscripts.length}` },
    });
  });

  await page.route('**/rest/v1/rpc/get_user_role**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify('FREE'),
    });
  });

  await page.route('**/rest/v1/user_preferences**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/rest/v1/folders**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockFolders),
    });
  });

  await page.route('**/rest/v1/tags**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockTags),
    });
  });
}
