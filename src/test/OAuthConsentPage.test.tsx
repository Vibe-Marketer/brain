/**
 * OAuthConsentPage security fields — component tests
 *
 * Covers ISC-13–19 (DCR phishing mitigation) and ISC-35–38 (workspace param injection).
 * Tests follow TDD RED/GREEN pattern: written before security fields are implemented.
 *
 * @phase 06.1
 * @plan sec-dcr-phishing
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---- module mocks (declared before imports that use them) ----

// Mock useAuth
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock useOrganizations
vi.mock('@/hooks/useOrganizations', () => ({
  useOrganizations: vi.fn(),
}));

// Mock useWorkspaces
vi.mock('@/hooks/useWorkspaces', () => ({
  useWorkspaces: vi.fn(),
}));

// Mock usePersistMcpOAuthGrant
vi.mock('@/hooks/useMcpOAuthGrants', () => ({
  usePersistMcpOAuthGrant: vi.fn(),
}));

// Mock supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      oauth: {
        getAuthorizationDetails: vi.fn(),
        approveAuthorization: vi.fn(),
        denyAuthorization: vi.fn(),
      },
    },
    from: vi.fn(),
  },
}));

// ---- lazy imports after mocks ----
import { useAuth } from '@/contexts/AuthContext';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { usePersistMcpOAuthGrant } from '@/hooks/useMcpOAuthGrants';
import { supabase } from '@/integrations/supabase/client';
import OAuthConsentPage from '@/pages/OAuthConsentPage';

// ---- test helpers ----

const TEST_CLIENT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const mockAuthDetails = {
  client: {
    id: TEST_CLIENT_ID,
    name: 'Test MCP Client',
  },
  client_id: TEST_CLIENT_ID,
  scope: 'openid email',
  redirect_uri: 'https://claude.ai/oauth/callback',
};

const mockUser = {
  id: 'user-uuid-test-123',
  email: 'test@callvaultai.com',
};

const mockOrg = {
  id: 'org-uuid-abc123',
  name: 'Test Org',
};

const mockWorkspaceOrgA = {
  id: 'workspace-uuid-org-a',
  name: 'Workspace A',
};

const mockWorkspaceOrgB = {
  id: 'workspace-uuid-org-b',
  name: 'Workspace B',
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderConsent(
  searchParamsStr = `?authorization_id=test-auth-id`,
  queryClient = makeQueryClient(),
) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/oauth/consent${searchParamsStr}`]}>
        <Routes>
          <Route path="/oauth/consent" element={<OAuthConsentPage />} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ---- common setup ----

beforeEach(() => {
  vi.clearAllMocks();

  // Default: authenticated user
  (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
    user: mockUser,
    session: { user: mockUser },
    loading: false,
  });

  // Default: one org (auto-selects)
  (useOrganizations as ReturnType<typeof vi.fn>).mockReturnValue({
    data: [mockOrg],
    isLoading: false,
  });

  // Default: workspaces for org A only
  (useWorkspaces as ReturnType<typeof vi.fn>).mockReturnValue({
    workspaces: [mockWorkspaceOrgA],
    isLoading: false,
  });

  // Default: persist grant mutation stub
  (usePersistMcpOAuthGrant as ReturnType<typeof vi.fn>).mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({}),
  });

  // Default: supabase auth returns authDetails, no redirect_url
  (supabase.auth.oauth.getAuthorizationDetails as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: mockAuthDetails,
    error: null,
  });

  // Default: mcp_oauth_client_grants count query returns 0 (first-time client)
  const mockSelectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockResolvedValue({ count: 0, error: null }),
  };
  (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(mockSelectChain);
});

// ---- test suite ----

describe('OAuthConsentPage security fields', () => {
  it('Test 1: displays truncated client_id UUID', async () => {
    renderConsent();

    // Expected: "a1b2c3d4…7890" (first 8 chars + ellipsis + last 4 chars)
    await waitFor(() => {
      expect(screen.getByText('a1b2c3d4…7890')).toBeInTheDocument();
    });
  });

  it('Test 2: shows first-time connection badge when no prior grants exist', async () => {
    // supabase.from mock already returns count=0 in beforeEach
    renderConsent();

    await waitFor(() => {
      expect(screen.getByText('First-time connection')).toBeInTheDocument();
    });
  });

  it('Test 3: shows redirect destination origin only (not full path)', async () => {
    renderConsent();

    // redirect_uri is "https://claude.ai/oauth/callback"
    // Expected: shows only origin "https://claude.ai"
    await waitFor(() => {
      expect(screen.getByText('https://claude.ai')).toBeInTheDocument();
    });
  });

  it('Test 4: always shows advisory text', async () => {
    renderConsent();

    await waitFor(() => {
      expect(
        screen.getByText(
          'Only approve if you initiated this connection from your AI client.',
        ),
      ).toBeInTheDocument();
    });
  });

  it('Test 5: workspace_id from cross-org URL param does not auto-select a workspace not in current org', async () => {
    // Workspaces only contain org-A workspace; org-B workspace is in a different org
    (useWorkspaces as ReturnType<typeof vi.fn>).mockReturnValue({
      workspaces: [mockWorkspaceOrgA],
      isLoading: false,
    });

    // Render with a workspace_id belonging to org B (not in the mocked workspaces array)
    renderConsent(
      `?authorization_id=test-auth-id&workspace_id=${mockWorkspaceOrgB.id}`,
    );

    await waitFor(() => {
      // Consent page should be visible
      expect(
        screen.queryByText('Loading authorization request...'),
      ).not.toBeInTheDocument();
    });

    // The workspace selector should not be auto-populated with the cross-org workspace
    // i.e., "Workspace B" should not appear as a selected value
    expect(screen.queryByText('Workspace B')).not.toBeInTheDocument();
  });
});
