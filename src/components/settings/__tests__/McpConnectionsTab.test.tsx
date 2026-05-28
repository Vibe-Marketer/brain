import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { McpToken } from '@/services/mcp-tokens.service'
import type { McpOAuthGrantConnection } from '@/services/mcp-oauth-grants.service'

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({ tier: 'pro', isPaid: true }),
  POLAR_PRODUCT_IDS: { PRO_MONTHLY: 'pro_monthly' },
}))

const tokenFixture: McpToken = {
  id: 'tok-1',
  user_id: 'u-1',
  org_id: 'org-1',
  workspace_id: 'ws-1',
  name: 'Manual Workspace Token',
  token: 'cv_prefix_token_12345',
  scope: 'workspace',
  last_used_at: '2026-05-27T12:00:00.000Z',
  created_at: '2026-05-01T10:00:00.000Z',
  enabled_categories: ['read', 'write', 'ai'],
}

const grantFixture: McpOAuthGrantConnection = {
  id: 'grant-1',
  client_id: 'claude-desktop',
  client_name: 'Claude Desktop',
  connection_type: 'OAuth',
  scope: 'workspace',
  org_id: 'org-1',
  org_name: 'Acme Org',
  workspace_id: 'ws-1',
  workspace_name: 'Sales Workspace',
  endpoint_url: 'https://api.callvaultai.com/mcp/w/ws-1',
  enabled_categories: ['read', 'write', 'ai'],
  last_used_at: '2026-05-28T09:00:00.000Z',
  created_at: '2026-05-20T09:00:00.000Z',
  updated_at: '2026-05-28T09:00:00.000Z',
  revoked_at: null,
}

vi.mock('@/hooks/useMcpTokens', () => ({
  useMcpTokensList: () => ({ tokens: [tokenFixture], isLoading: false, error: null }),
  useCreateMcpToken: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteMcpToken: () => ({ mutate: vi.fn(), isPending: false }),
  useRegenerateMcpToken: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/hooks/useMcpOAuthGrants', () => ({
  useMcpOAuthGrantsList: () => ({ grants: [grantFixture], isLoading: false, error: null }),
  useRevokeMcpOAuthGrant: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/hooks/useMcpTokenCapabilities', () => ({
  useSetMcpTokenCategories: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/hooks/useOrganizations', () => ({
  useOrganizations: () => ({ data: [{ id: 'org-1', name: 'Acme Org' }], isLoading: false }),
}))

vi.mock('@/hooks/useWorkspaces', () => ({
  useWorkspaces: () => ({ workspaces: [{ id: 'ws-1', name: 'Sales Workspace' }], isLoading: false }),
}))

vi.mock('@/services/mcp-tokens.service', async () => {
  const actual = await vi.importActual<typeof import('@/services/mcp-tokens.service')>('@/services/mcp-tokens.service')
  return {
    ...actual,
    getMcpUrl: () => 'https://api.callvaultai.com/mcp',
  }
})

vi.mock('@/components/billing/UpgradeButton', () => ({
  UpgradeButton: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import MCPTab from '../MCPTab'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MCPTab grouped AI connectors surface', () => {
  it('renders AI connectors heading and places OAuth section before manual token section', () => {
    render(<MCPTab />)

    expect(screen.getByRole('heading', { name: 'AI connectors' })).toBeInTheDocument()

    const oauthHeading = screen.getByRole('heading', { name: 'Connected AI clients' })
    const manualHeading = screen.getByRole('heading', { name: 'Manual token connectors' })
    expect(oauthHeading.compareDocumentPosition(manualHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps manual token actions visible while OAuth is primary', () => {
    render(<MCPTab />)

    expect(screen.getByRole('button', { name: 'Create scoped token' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Regenerate token Manual Workspace Token/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Delete token Manual Workspace Token/i })).toBeInTheDocument()
  })

  it('renders permission refresh/reconnect note and avoids positive AI-powered copy', () => {
    render(<MCPTab />)

    expect(
      screen.getByText(
        'Changes take effect on CallVault immediately. Some AI clients may need a refresh or reconnect before their tool list updates.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/AI-powered/i)).not.toBeInTheDocument()
  })

  it('renders OAuth row details with endpoint and revoke action', () => {
    render(<MCPTab />)

    expect(screen.getByText('Claude Desktop')).toBeInTheDocument()
    expect(screen.getByText('OAuth')).toBeInTheDocument()
    expect(screen.getByText('Sales Workspace')).toBeInTheDocument()
    expect(screen.getByText('https://api.callvaultai.com/mcp/w/ws-1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Revoke AI client Claude Desktop/i })).toBeInTheDocument()
  })
})
