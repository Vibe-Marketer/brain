import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OAuthConsentPage from '@/pages/OAuthConsentPage';

const mockGetAuthorizationDetails = vi.fn();
const mockApproveAuthorization = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    loading: false,
  }),
}));

vi.mock('@/hooks/useOrganizations', () => ({
  useOrganizations: () => ({
    data: [{ id: 'org-1', name: 'Acme Org' }],
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useWorkspaces', () => ({
  useWorkspaces: () => ({
    workspaces: [{ id: 'ws-1', name: 'Sales Workspace', organization_id: 'org-1' }],
    isLoading: false,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
	    auth: {
	      oauth: {
	        getAuthorizationDetails: (...args: unknown[]) => mockGetAuthorizationDetails(...args),
	        approveAuthorization: (...args: unknown[]) => mockApproveAuthorization(...args),
	        denyAuthorization: vi.fn(),
	      },
	    },
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

const renderConsent = (url = '/oauth/consent?authorization_id=auth-1') =>
  {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/oauth/consent" element={<OAuthConsentPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

describe('OAuthConsentPage workspace scope behavior', () => {
	  beforeEach(() => {
	    vi.clearAllMocks();
	    mockApproveAuthorization.mockResolvedValue({
	      data: { redirect_url: 'https://www.perplexity.ai/rest/connections/oauth_callback?code=test&state=test' },
	      error: null,
	    });
	    mockGetAuthorizationDetails.mockResolvedValue({
      data: {
        client: { name: 'Claude Desktop' },
        scope: 'openid email profile',
        redirect_uri: 'https://example.com/callback',
      },
      error: null,
    });
  });

  it('defaults to organization scope with workspace option off', async () => {
    renderConsent();

    await waitFor(() => {
      expect(
        screen.getByText(/By default, this client can access non-admin MCP tools across this organization/i),
      ).toBeInTheDocument();
    });

    const checkbox = screen.getByRole('checkbox', {
      name: /Limit this AI connection to one workspace/i,
    });
    expect(checkbox).not.toBeChecked();
    expect(
      screen.getByText(/When enabled, this client can only see calls and tools for the selected workspace/i),
    ).toBeInTheDocument();
  });

  it('requires workspace selection before approval when workspace scope is enabled', async () => {
    const user = userEvent.setup();
    renderConsent();

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /Limit this AI connection to one workspace/i })).toBeInTheDocument();
    });

    const approveButton = screen.getByRole('button', { name: /Allow access/i });
    expect(approveButton).toBeEnabled();

    await user.click(screen.getByRole('checkbox', { name: /Limit this AI connection to one workspace/i }));

    expect(
      screen.getByText(/When enabled, this client can only see calls and tools for the selected workspace/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Allow workspace access/i })).toBeDisabled();
  });

	  it('preselects workspace scope and workspace for workspace entrypoints', async () => {
    mockGetAuthorizationDetails.mockResolvedValue({
      data: {
        client: { name: 'Cursor' },
        scope: 'openid email profile',
        redirect_uri: 'https://example.com/callback',
        workspace_id: 'ws-1',
      },
      error: null,
    });

    renderConsent('/oauth/consent?authorization_id=auth-2&workspace_id=ws-1');

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /Limit this AI connection to one workspace/i })).toBeChecked();
    });

    expect(screen.getAllByText(/Sales Workspace/i).length).toBeGreaterThan(0);
	    expect(screen.getByRole('button', { name: /Allow workspace access/i })).toBeEnabled();
	  });

	  it('approves with explicit redirect handling to avoid transient error state', async () => {
	    const assign = vi.fn();
	    const originalLocation = window.location;
	    Object.defineProperty(window, 'location', {
	      configurable: true,
	      value: { ...originalLocation, assign },
	    });
	    const user = userEvent.setup();

	    renderConsent();

	    await waitFor(() => {
	      expect(screen.getByRole('button', { name: /Allow access/i })).toBeEnabled();
	    });

	    await user.click(screen.getByRole('button', { name: /Allow access/i }));

	    await waitFor(() => {
	      expect(mockApproveAuthorization).toHaveBeenCalledWith('auth-1', {
	        skipBrowserRedirect: true,
	      });
	    });
	    expect(assign).toHaveBeenCalledWith(
	      'https://www.perplexity.ai/rest/connections/oauth_callback?code=test&state=test',
	    );
	    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();

	    Object.defineProperty(window, 'location', {
	      configurable: true,
	      value: originalLocation,
	    });
	  });
	});
