import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import MCPTab from '../MCPTab'
import McpSetupSnippets from '../McpSetupSnippets'

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode; value: string }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}))

vi.mock('@/components/ui/switch', () => ({
  Switch: () => <input type="checkbox" />,
}))

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({ tier: 'pro', isPaid: true }),
  POLAR_PRODUCT_IDS: { PRO_MONTHLY: 'pro_monthly' },
}))

vi.mock('@/hooks/useMcpTokens', () => ({
  useMcpTokensList: () => ({
    tokens: [
      {
        id: 'tok-org',
        user_id: 'u-1',
        org_id: 'org-1',
        workspace_id: null,
        name: 'Org Token',
        token: 'cv_org_token_abc123',
        scope: 'organization',
        last_used_at: null,
        created_at: '2026-05-01T10:00:00.000Z',
        enabled_categories: ['read', 'write', 'ai'],
      },
      {
        id: 'tok-ws',
        user_id: 'u-1',
        org_id: 'org-1',
        workspace_id: 'ws-1',
        name: 'Workspace Token',
        token: 'cv_ws_token_abc123',
        scope: 'workspace',
        last_used_at: null,
        created_at: '2026-05-01T10:00:00.000Z',
        enabled_categories: ['read', 'write', 'ai'],
      },
    ],
    tokenConnections: [
      {
        id: 'tok-ws',
        user_id: 'u-1',
        org_id: 'org-1',
        workspace_id: 'ws-1',
        name: 'Workspace Token',
        token: 'cv_ws_token_abc123',
        scope: 'workspace',
        last_used_at: null,
        created_at: '2026-05-01T10:00:00.000Z',
        enabled_categories: ['read', 'write', 'ai'],
        connection_type: 'Manual token',
        scope_label: 'Workspace',
        endpoint_url: 'https://mcp.callvaultai.com/w/ws-1',
        resource_url: 'https://mcp.callvaultai.com/w/ws-1',
        token_preview: 'cv_ws_to...c123',
        categories_summary: 'Read, Write, AI',
      },
    ],
    isLoading: false,
    error: null,
  }),
  useCreateMcpToken: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteMcpToken: () => ({ mutate: vi.fn(), isPending: false }),
  useRegenerateMcpToken: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/hooks/useMcpOAuthGrants', () => ({
  useMcpOAuthGrantsList: () => ({ grants: [], isLoading: false, error: null }),
  useRevokeMcpOAuthGrant: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/hooks/useMcpTokenCapabilities', () => ({
  useSetMcpTokenCategories: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/hooks/useOrganizations', () => ({
  useOrganizations: () => ({ data: [{ id: 'org-1', name: 'Acme Org', slug: 'acme' }], isLoading: false }),
}))

vi.mock('@/hooks/useOrganizationContext', () => ({
  useOrganizationContext: () => ({ activeOrgId: 'org-1' }),
}))

vi.mock('@/hooks/useWorkspaces', () => ({
  useWorkspaces: () => ({ workspaces: [{ id: 'ws-1', name: 'Sales Workspace', slug: 'sales' }], isLoading: false }),
}))

vi.mock('@/components/billing/UpgradeButton', () => ({
  UpgradeButton: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

describe('Mcp setup snippets and provider actions', () => {
  it('uses public MCP endpoints only for org and workspace scope', () => {
    render(<MCPTab />)

    expect(screen.getByText('https://mcp.callvaultai.com')).toBeInTheDocument()
    expect(screen.getByText('https://acme.callvaultai.com/mcp')).toBeInTheDocument()
    expect(screen.getByText('https://acme-sales.callvaultai.com/mcp')).toBeInTheDocument()
    expect(screen.queryByText(/functions\/v1\/mcp-server/i)).not.toBeInTheDocument()
  })

  it('keeps setup values compact and removes provider-card clutter', () => {
    render(<MCPTab />)

    expect(screen.getByRole('heading', { name: 'Setup values' })).toBeInTheDocument()
    expect(screen.queryByText(/Perplexity fallback credentials/i)).not.toBeInTheDocument()
    expect(screen.queryByText('ChatGPT')).not.toBeInTheDocument()
    expect(screen.queryByText('Gemini')).not.toBeInTheDocument()
    expect(screen.queryByText('Manus')).not.toBeInTheDocument()
  })

  it('keeps manual token fallback visible', () => {
    render(<MCPTab />)
    expect(screen.getByRole('heading', { name: 'Manual tokens' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Create scoped token' }).length).toBeGreaterThan(0)
  })

  it('renders simple and organization endpoints when only orgSlug is provided', () => {
    render(<McpSetupSnippets orgSlug="acme" />)

    expect(screen.getByText('https://mcp.callvaultai.com')).toBeInTheDocument()
    expect(screen.getByText('https://acme.callvaultai.com/mcp')).toBeInTheDocument()
    expect(screen.queryByText('Workspace endpoint')).not.toBeInTheDocument()
  })

  it('renders only the simple endpoint when no slugs or workspace are provided', () => {
    render(<McpSetupSnippets />)

    expect(screen.getByText('https://mcp.callvaultai.com')).toBeInTheDocument()
    expect(screen.queryByText('Organization endpoint')).not.toBeInTheDocument()
    expect(screen.queryByText('Workspace endpoint')).not.toBeInTheDocument()
  })
})
