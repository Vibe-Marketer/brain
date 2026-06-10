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

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode; value: string }) => (
    <div>{children}</div>
  ),
  SelectTrigger: ({ children, className, ...props }: { children: React.ReactNode; className?: string }) => (
    <button type="button" className={className} {...props}>{children}</button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    ...props
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <input
      type="checkbox"
      checked={Boolean(checked)}
      onChange={(event) => onCheckedChange?.(event.currentTarget.checked)}
      {...props}
    />
  ),
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
  slug: 'acmecorp',
};

const mockOtherOrg = {
  id: 'org-uuid-other',
  name: 'Other Org',
  slug: 'otherorg',
};

const mockWorkspaceOrgA = {
  id: 'workspace-uuid-org-a',
  name: 'Workspace A',
};

const mockWorkspaceOrgB = {
  id: 'workspace-uuid-org-b',
  name: 'Workspace B',
};

function renderConsent(searchParamsStr = `?authorization_id=test-auth-id`) {
  return render(
    <MemoryRouter initialEntries={[`/oauth/consent${searchParamsStr}`]}>
      <Routes>
        <Route path="/oauth/consent" element={<OAuthConsentPage />} />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>,
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
  (supabase.auth.oauth.approveAuthorization as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: null,
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

describe('OAuthConsentPage subdomain pre-scoped variant', () => {
  it('keeps the organization picker for non-subdomain OAuth details', async () => {
    renderConsent();

    await waitFor(() => {
      expect(
        screen.getByText('Choose which organization to grant access to'),
      ).toBeInTheDocument();
    });

    expect(screen.queryByText('Connection URL')).not.toBeInTheDocument();
  });

  it('uses resource URL to show a pre-scoped organization connection', async () => {
    (supabase.auth.oauth.getAuthorizationDetails as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        ...mockAuthDetails,
        resource: 'https://acmecorp.callvaultai.com/mcp',
      },
      error: null,
    });

    renderConsent();

    await waitFor(() => {
      expect(screen.getByText('acmecorp.callvaultai.com/mcp')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Test Org').length).toBeGreaterThan(0);
    expect(
      screen.queryByText('Choose which organization to grant access to'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /allow access/i })).not.toBeDisabled();
  });

  it('falls back to redirect_uri subdomain when resource is absent', async () => {
    (supabase.auth.oauth.getAuthorizationDetails as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        ...mockAuthDetails,
        redirect_uri: 'https://acmecorp.callvaultai.com/oauth/callback',
      },
      error: null,
    });

    renderConsent();

    await waitFor(() => {
      expect(screen.getByText('acmecorp.callvaultai.com/mcp')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Test Org').length).toBeGreaterThan(0);
  });

  it('shows an access error and disables approval when the slug is not in the user orgs', async () => {
    (useOrganizations as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [mockOtherOrg],
      isLoading: false,
    });
    (supabase.auth.oauth.getAuthorizationDetails as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        ...mockAuthDetails,
        resource: 'https://acmecorp.callvaultai.com/mcp',
      },
      error: null,
    });

    renderConsent();

    await waitFor(() => {
      expect(
        screen.getByText("You don't have access to this organization."),
      ).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /allow access/i })).toBeDisabled();
  });
});
