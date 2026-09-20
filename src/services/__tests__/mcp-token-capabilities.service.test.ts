/**
 * Tests for mcp-token-capabilities.service.ts
 *
 * Phase 23 gap coverage:
 *   - setEnabledCategories writes correct JSONB to mcp_tokens
 *   - Returns updated row
 *   - Throws on supabase error (so hook can rollback)
 *   - RLS-gated: depends on RLS policy on mcp_tokens (verified by error path —
 *     cross-user updates return PostgREST 42501 / "new row violates RLS").
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase client BEFORE importing service.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from '@/integrations/supabase/client';
import { setEnabledCategories } from '../mcp-token-capabilities.service';

const mockSupabase = supabase as unknown as {
  from: ReturnType<typeof vi.fn>;
};

/** Build a chainable, awaitable Supabase query mock. */
function makeChain(result: { data?: unknown; error?: unknown }) {
  const resolved = { data: null, error: null, ...result };
  const chain: Record<string, unknown> = {};
  const methods = ['update', 'eq', 'select'];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue(resolved);
  chain.maybeSingle = vi.fn().mockResolvedValue(resolved);
  return chain;
}

describe('setEnabledCategories', () => {
  const tokenId = 'token-id-1';

  const baseTokenRow = {
    id: tokenId,
    user_id: 'user-1',
    org_id: 'org-1',
    workspace_id: null,
    name: 'My Token',
    token: 'abc123',
    scope: 'organization',
    last_used_at: null,
    created_at: '2026-01-01',
    enabled_categories: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes a JSONB array to enabled_categories when given an array', async () => {
    const chain = makeChain({
      data: { ...baseTokenRow, enabled_categories: ['read'] },
      error: null,
    });
    mockSupabase.from.mockReturnValue(chain);

    const result = await setEnabledCategories(tokenId, ['read']);

    expect(mockSupabase.from).toHaveBeenCalledWith('mcp_tokens');
    expect((chain as any).update).toHaveBeenCalledWith({ enabled_categories: ['read'] });
    expect((chain as any).eq).toHaveBeenCalledWith('id', tokenId);
    expect(result.enabled_categories).toEqual(['read']);
  });

  it('writes null to enabled_categories when given null', async () => {
    const chain = makeChain({
      data: { ...baseTokenRow, enabled_categories: null },
      error: null,
    });
    mockSupabase.from.mockReturnValue(chain);

    await setEnabledCategories(tokenId, null);

    expect((chain as any).update).toHaveBeenCalledWith({ enabled_categories: null });
  });

  it('writes empty array when given empty array (gates ALL tools)', async () => {
    const chain = makeChain({
      data: { ...baseTokenRow, enabled_categories: [] },
      error: null,
    });
    mockSupabase.from.mockReturnValue(chain);

    await setEnabledCategories(tokenId, []);

    expect((chain as any).update).toHaveBeenCalledWith({ enabled_categories: [] });
  });

  it('throws when supabase returns an error (so hook can rollback)', async () => {
    const chain = makeChain({
      data: null,
      error: { message: 'new row violates row-level security' },
    });
    mockSupabase.from.mockReturnValue(chain);

    await expect(setEnabledCategories(tokenId, ['read'])).rejects.toThrow(
      /Failed to update token capabilities/,
    );
  });

});
