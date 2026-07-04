/**
 * MCPTab — Permissions panel + dynamic categorized tools list (Phase 23 D-09/D-11/D-12)
 *
 * Gap coverage:
 *   - 4 toggles render (Read / Write / AI / Admin) — D-09
 *   - "AI" capitalization (formatCategoryLabel via Phase 26 polish)
 *   - Dynamic tools list renders all 41 tools — D-11
 *   - Tools list contains NO `callvault/` prefix anywhere — D-11 / Phase 20
 *   - Toggling a switch invokes the mutation hook with correct value semantics:
 *       all 4 ON → null (D-09)
 *       any OFF  → array of currently-on categories
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as React from 'react';
import type { McpToken } from '@/services/mcp-tokens.service';

// ─── Mocks (must come before MCPTab import) ──────────────────────────────────

const mockSetCategoriesMutate = vi.fn();

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({ tier: 'pro', isPaid: true }),
  POLAR_PRODUCT_IDS: { PRO_MONTHLY: 'pro_monthly' },
}));

const tokenFixture: McpToken = {
  id: 'tok-1',
  user_id: 'u-1',
  org_id: 'org-1',
  workspace_id: null,
  name: 'My Token',
  token: 'abc123',
  scope: 'organization',
  last_used_at: null,
  created_at: '2026-01-01',
  enabled_categories: null,
};

vi.mock('@/hooks/useMcpTokens', () => ({
  useMcpTokensList: () => ({
    tokens: [tokenFixture],
    isLoading: false,
    error: null,
  }),
  useCreateMcpToken: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteMcpToken: () => ({ mutate: vi.fn(), isPending: false }),
  useRegenerateMcpToken: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/useMcpTokenCapabilities', () => ({
  useSetMcpTokenCategories: () => ({
    mutate: mockSetCategoriesMutate,
    isPending: false,
  }),
}));

vi.mock('@/hooks/useOrganizations', () => ({
  useOrganizations: () => ({ data: [{ id: 'org-1', name: 'Org 1' }], isLoading: false }),
}));

vi.mock('@/hooks/useOrganizationContext', () => ({
  useOrganizationContext: () => ({ activeOrgId: 'org-1' }),
}));

vi.mock('@/hooks/useWorkspaces', () => ({
  useWorkspaces: () => ({ workspaces: [], isLoading: false }),
}));

vi.mock('@/services/mcp-tokens.service', async () => {
  const actual = await vi.importActual<typeof import('@/services/mcp-tokens.service')>(
    '@/services/mcp-tokens.service',
  );
  return {
    ...actual,
    getMcpUrl: () => 'https://example.com/mcp',
  };
});

vi.mock('@/components/billing/UpgradeButton', () => ({
  UpgradeButton: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// shadcn Collapsible defaults to closed. Force it OPEN for this test by
// overriding to render the content unconditionally.
vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    <div>{children}</div>
  ),
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
    'aria-label': ariaLabel,
    disabled,
  }: {
    checked: boolean;
    onCheckedChange: (next: boolean) => void;
    'aria-label': string;
    disabled?: boolean;
  }) => (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
    >
      switch
    </button>
  ),
}));

vi.mock('@/hooks/useMcpOAuthGrants', () => ({
  useMcpOAuthGrantsList: () => ({ grants: [], isLoading: false, error: null }),
  useRevokeMcpOAuthGrant: () => ({ mutate: vi.fn(), isPending: false }),
}));

import MCPTab from '../MCPTab';

beforeEach(() => {
  mockSetCategoriesMutate.mockClear();
});

describe('MCPTab — Permissions panel renders 4 toggles (D-09)', () => {
  it('renders Read / Write / AI / Admin toggles', () => {
    render(<MCPTab />);

    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBeGreaterThanOrEqual(4);

    const labels = switches.map((s) => s.getAttribute('aria-label') || '');
    expect(labels.some((l) => /Toggle read category/i.test(l))).toBe(true);
    expect(labels.some((l) => /Toggle write category/i.test(l))).toBe(true);
    expect(labels.some((l) => /Toggle ai category/i.test(l))).toBe(true);
    expect(labels.some((l) => /Toggle admin category/i.test(l))).toBe(true);
  });

  it('all 4 toggles default ON when token.enabled_categories is null (D-09 default)', () => {
    render(<MCPTab />);
    const switches = screen.getAllByRole('switch');
    const cats = ['read', 'write', 'ai', 'admin'];
    for (const cat of cats) {
      const sw = switches.find((s) =>
        new RegExp(`Toggle ${cat} category`, 'i').test(s.getAttribute('aria-label') || ''),
      );
      expect(sw).toBeDefined();
      expect(sw!.getAttribute('aria-checked')).toBe('true');
    }
  });
});

describe('MCPTab — formatCategoryLabel renders "AI" not "Ai"', () => {
  it('shows "AI" (uppercase) somewhere in the rendered output', () => {
    const { container } = render(<MCPTab />);
    // Body text should include the "AI" label via formatCategoryLabel.
    expect(container.textContent).toMatch(/\bAI\b/);
  });

  it('does NOT display "Ai" with mixed-case for the ai category label', () => {
    const { container } = render(<MCPTab />);
    // The toggle row label and the tools section header for ai should be "AI".
    // We verify by counting "AI" matches but rejecting any visible "Ai " label
    // immediately followed by space + tool count parenthesis.
    // A literal "Ai (4)" would indicate the formatter regression.
    expect(container.textContent).not.toMatch(/\bAi\s*\(\d+\)/);
  });
});

describe('MCPTab — current connector surface', () => {
  it('renders the grouped connector sections', () => {
    render(<MCPTab />);

    expect(screen.getByRole('heading', { name: 'AI connectors' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Manual tokens' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect AI client' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create scoped token' })).toBeInTheDocument();
  });

  it('renders zero callvault/ prefixes anywhere in the panel', () => {
    const { container } = render(<MCPTab />);
    expect(container.textContent).not.toMatch(/callvault\//);
  });

  it('does not render the retired raw tool-count list', () => {
    const { container } = render(<MCPTab />);
    const text = container.textContent || '';
    expect(text).not.toMatch(/\(17\)/);
    expect(text).not.toMatch(/\(16\)/);
    expect(text).not.toMatch(/\(8\)/);
    expect(text).not.toMatch(/\(4\)/);
  });
});

describe('MCPTab — toggle persistence (D-09)', () => {
  it('toggling Admin OFF passes ["read","write","ai"] to mutation', () => {
    render(<MCPTab />);

    const switches = screen.getAllByRole('switch');
    const adminSwitch = switches.find((s) =>
      /Toggle admin category/i.test(s.getAttribute('aria-label') || ''),
    );
    expect(adminSwitch).toBeDefined();
    fireEvent.click(adminSwitch!);

    expect(mockSetCategoriesMutate).toHaveBeenCalledTimes(1);
    const args = mockSetCategoriesMutate.mock.calls[0][0];
    expect(args.tokenId).toBe('tok-1');
    // ALL_CATEGORIES order in MCPTab.tsx is ['read','write','ai','admin'].
    // After admin toggles off, the remaining true categories preserve that
    // order in the array.
    expect(args.value).toEqual(['read', 'write', 'ai']);
  });

  it('toggling a single switch never persists null when 3 remain on', () => {
    render(<MCPTab />);
    const switches = screen.getAllByRole('switch');
    const writeSwitch = switches.find((s) =>
      /Toggle write category/i.test(s.getAttribute('aria-label') || ''),
    );
    fireEvent.click(writeSwitch!);

    const args = mockSetCategoriesMutate.mock.calls[0][0];
    expect(args.value).not.toBeNull();
    expect(Array.isArray(args.value)).toBe(true);
    expect(args.value).not.toContain('write');
  });
});
