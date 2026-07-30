/**
 * Behavioral tests for `enforceMcpAiUsage` — the in-process quota gate used by
 * mcp-server before invoking OpenRouter.
 *
 * Phase 22 (D-09, D-10, D-11). The helper has zero external deps and accepts the
 * supabase client as a parameter, so we can drive it directly with a chainable mock.
 *
 * Validated behaviors (from CONTEXT.md + 22-01-PLAN.md):
 *  - free tier limit = 25, pro = 1000, team = 5000
 *  - Cache hits MUST NOT call this function — guaranteed by call site, not by helper
 *  - LLM-call paths MUST call this function BEFORE invoking the LLM
 *  - When usage >= limit: return { allowed: false } with quota-message containing
 *    upgrade URL
 *  - Allowed-path inserts a row into `ai_usage` with the action_type
 *  - Profile fetch error denies the call (no LLM cost on transient error)
 *  - Team tier pools usage org-wide via `get_monthly_org_ai_usage` RPC
 *  - Free/pro tier uses `get_monthly_ai_usage` RPC (per-user)
 *  - Team tier denies if user is not a member of the org
 *  - Insert error logs but does NOT deny (best-effort write)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  enforceMcpAiUsage,
  type McpAiActionType,
} from '../track-ai-usage-inline.ts';

// Polar product IDs from track-ai-usage-inline.ts
const PRO_PRODUCT_ID = '30020903-fa8f-4534-9cf1-6e9fba26584c';
const TEAM_PRODUCT_ID = '88f3f07e-afa3-4cb1-ac9d-d2429a1ce1b7';

type ProfileRow = {
  product_id: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
};

interface MockOpts {
  profile?: ProfileRow | null;
  profileError?: { message: string } | null;
  membership?: { id: string } | null;
  membershipError?: { message: string } | null;
  usageRpc?: number | null;
  usageRpcError?: { message: string } | null;
  insertError?: { message: string } | null;
}

interface InsertCall {
  user_id: string;
  org_id: string | null;
  action_type: string;
  recording_id: string | null;
  month_year: string;
  created_at: string;
}

type MockSupabase = {
  insertCalls: InsertCall[];
  rpcCalls: Array<{ name: string; params: Record<string, unknown> }>;
  from: (table: string) => unknown;
  rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

/**
 * Builds a minimal Supabase-shaped mock that exposes:
 *  - `.from('user_profiles').select('...').eq('user_id', ...).maybeSingle()` → profile / profileError
 *  - `.from('organization_memberships').select('...').eq(...).eq(...).maybeSingle()` → membership / membershipError
 *  - `.from('ai_usage').insert(row)` → captures the call, optionally returns error
 *  - `.rpc(name, params)` → captures the call, returns usageRpc / usageRpcError
 */
function buildMockSupabase(opts: MockOpts = {}): MockSupabase {
  const insertCalls: InsertCall[] = [];
  const rpcCalls: Array<{ name: string; params: Record<string, unknown> }> = [];

  // Chainable select-eq-maybeSingle helper for both profile and membership
  function makeSelectChain(result: { data: unknown; error: unknown }) {
    const chain = {
      select: (_cols: string) => ({
        eq: (_col: string, _val: unknown) => ({
          eq: (_col2: string, _val2: unknown) => ({
            maybeSingle: async () => result,
          }),
          maybeSingle: async () => result,
        }),
      }),
    };
    return chain;
  }

  return {
    insertCalls,
    rpcCalls,
    from(table: string) {
      if (table === 'user_profiles') {
        return makeSelectChain({
          data: opts.profile === undefined ? null : opts.profile,
          error: opts.profileError ?? null,
        });
      }
      if (table === 'organization_memberships') {
        return makeSelectChain({
          data: opts.membership === undefined ? null : opts.membership,
          error: opts.membershipError ?? null,
        });
      }
      if (table === 'ai_usage') {
        return {
          insert: async (row: InsertCall) => {
            insertCalls.push(row);
            return { error: opts.insertError ?? null };
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
    async rpc(name: string, params: Record<string, unknown>) {
      rpcCalls.push({ name, params });
      return {
        data: opts.usageRpc ?? null,
        error: opts.usageRpcError ?? null,
      };
    },
  };
}

const baseParams = {
  userId: 'user-123',
  orgId: null,
  actionType: 'mcp_action_items' as McpAiActionType,
  recordingId: 'rec-abc',
};

describe('enforceMcpAiUsage — free tier (no product_id)', () => {
  it('allows the call when usage is below 25', async () => {
    const supabase = buildMockSupabase({
      profile: { product_id: null, subscription_status: null, current_period_end: null },
      usageRpc: 10,
    });
    const result = await enforceMcpAiUsage({ supabase, ...baseParams });
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.tier).toBe('free');
      expect(result.limit).toBe(25);
      expect(result.usage).toBe(11); // returned as usage+1 per helper contract
    }
  });

  // TEMPORARILY SKIPPED (2026-07-30, ticket 81e9ee1b): FREE_PRO_FOR_ALL_ENABLED
  // in track-ai-usage-inline.ts bypasses the quota cutoff for everyone. Delete
  // .skip and restore once that flag flips back to false.
  it.skip('denies the call exactly at the 25-call limit', async () => {
    const supabase = buildMockSupabase({
      profile: { product_id: null, subscription_status: null, current_period_end: null },
      usageRpc: 25,
    });
    const result = await enforceMcpAiUsage({ supabase, ...baseParams });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toMatch(/25\/25/);
      expect(result.reason).toMatch(/free plan/);
      expect(result.reason).toMatch(/https:\/\/app\.callvaultai\.com\/settings\/billing/);
    }
  });

  it.skip('denies when usage exceeds limit (overflow)', async () => {
    const supabase = buildMockSupabase({
      profile: { product_id: null, subscription_status: null, current_period_end: null },
      usageRpc: 26,
    });
    const result = await enforceMcpAiUsage({ supabase, ...baseParams });
    expect(result.allowed).toBe(false);
  });

  it('uses get_monthly_ai_usage RPC (per-user, NOT per-org)', async () => {
    const supabase = buildMockSupabase({
      profile: { product_id: null, subscription_status: null, current_period_end: null },
      usageRpc: 0,
    });
    await enforceMcpAiUsage({ supabase, ...baseParams });
    expect(supabase.rpcCalls).toHaveLength(1);
    expect(supabase.rpcCalls[0].name).toBe('get_monthly_ai_usage');
    expect(supabase.rpcCalls[0].params).toMatchObject({ p_user_id: 'user-123' });
  });

  it('inserts an ai_usage row on allowed call with correct action_type', async () => {
    const supabase = buildMockSupabase({
      profile: { product_id: null, subscription_status: null, current_period_end: null },
      usageRpc: 0,
    });
    await enforceMcpAiUsage({
      supabase,
      ...baseParams,
      actionType: 'mcp_ask_call',
      recordingId: 'rec-xyz',
    });
    expect(supabase.insertCalls).toHaveLength(1);
    expect(supabase.insertCalls[0]).toMatchObject({
      user_id: 'user-123',
      action_type: 'mcp_ask_call',
      recording_id: 'rec-xyz',
      org_id: null,
    });
    // month_year is YYYY-MM
    expect(supabase.insertCalls[0].month_year).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('enforceMcpAiUsage — pro tier', () => {
  it('treats Polar pro product as pro tier with 1000 limit', async () => {
    const supabase = buildMockSupabase({
      profile: {
        product_id: PRO_PRODUCT_ID,
        subscription_status: 'active',
        current_period_end: '2030-01-01T00:00:00Z',
      },
      usageRpc: 999,
    });
    const result = await enforceMcpAiUsage({ supabase, ...baseParams });
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.tier).toBe('pro');
      expect(result.limit).toBe(1000);
    }
  });

  // TEMPORARILY SKIPPED (2026-07-30, ticket 81e9ee1b): quota cutoff is bypassed.
  it.skip('denies pro at 1000 calls', async () => {
    const supabase = buildMockSupabase({
      profile: {
        product_id: PRO_PRODUCT_ID,
        subscription_status: 'active',
        current_period_end: '2030-01-01T00:00:00Z',
      },
      usageRpc: 1000,
    });
    const result = await enforceMcpAiUsage({ supabase, ...baseParams });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toMatch(/1000\/1000/);
      expect(result.reason).toMatch(/pro plan/);
    }
  });

  // Tier classification (not the quota cutoff) — still real logic, observed via
  // the allowed path since FREE_PRO_FOR_ALL_ENABLED bypasses denial (ticket 81e9ee1b).
  it('treats expired pro-trial as free tier', async () => {
    const supabase = buildMockSupabase({
      profile: {
        product_id: 'pro-trial',
        subscription_status: 'trialing',
        current_period_end: '2020-01-01T00:00:00Z', // expired
      },
      usageRpc: 26,
    });
    const result = await enforceMcpAiUsage({ supabase, ...baseParams });
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.tier).toBe('free');
      expect(result.limit).toBe(25);
    }
  });

  it('treats canceled pro-trial as free tier', async () => {
    const supabase = buildMockSupabase({
      profile: {
        product_id: 'pro-trial',
        subscription_status: 'canceled',
        current_period_end: '2030-01-01T00:00:00Z',
      },
      usageRpc: 26,
    });
    const result = await enforceMcpAiUsage({ supabase, ...baseParams });
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.tier).toBe('free');
      expect(result.limit).toBe(25);
    }
  });

  it('treats active trialing pro-trial as pro tier', async () => {
    const supabase = buildMockSupabase({
      profile: {
        product_id: 'pro-trial',
        subscription_status: 'trialing',
        current_period_end: '2030-01-01T00:00:00Z',
      },
      usageRpc: 30,
    });
    const result = await enforceMcpAiUsage({ supabase, ...baseParams });
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.tier).toBe('pro');
      expect(result.limit).toBe(1000);
    }
  });
});

describe('enforceMcpAiUsage — team tier (org-pooled)', () => {
  it('uses get_monthly_org_ai_usage RPC when team tier with orgId', async () => {
    const supabase = buildMockSupabase({
      profile: {
        product_id: TEAM_PRODUCT_ID,
        subscription_status: 'active',
        current_period_end: '2030-01-01T00:00:00Z',
      },
      membership: { id: 'mem-1' },
      usageRpc: 100,
    });
    await enforceMcpAiUsage({ supabase, ...baseParams, orgId: 'org-foo' });
    expect(supabase.rpcCalls).toHaveLength(1);
    expect(supabase.rpcCalls[0].name).toBe('get_monthly_org_ai_usage');
    expect(supabase.rpcCalls[0].params).toMatchObject({ p_org_id: 'org-foo' });
  });

  it('denies team tier user who is not a member of the org', async () => {
    const supabase = buildMockSupabase({
      profile: {
        product_id: TEAM_PRODUCT_ID,
        subscription_status: 'active',
        current_period_end: '2030-01-01T00:00:00Z',
      },
      membership: null,
    });
    const result = await enforceMcpAiUsage({ supabase, ...baseParams, orgId: 'org-foo' });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toMatch(/not a member/i);
    }
    // Should not have called RPC — short-circuit before usage check
    expect(supabase.rpcCalls).toHaveLength(0);
  });

  // TEMPORARILY SKIPPED (2026-07-30, ticket 81e9ee1b): quota cutoff is bypassed.
  it.skip('denies at team-tier 5000 limit', async () => {
    const supabase = buildMockSupabase({
      profile: {
        product_id: TEAM_PRODUCT_ID,
        subscription_status: 'active',
        current_period_end: '2030-01-01T00:00:00Z',
      },
      membership: { id: 'mem-1' },
      usageRpc: 5000,
    });
    const result = await enforceMcpAiUsage({ supabase, ...baseParams, orgId: 'org-foo' });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toMatch(/5000\/5000/);
      expect(result.reason).toMatch(/team plan/);
    }
  });

  it('inserts row with effectiveOrgId for team tier', async () => {
    const supabase = buildMockSupabase({
      profile: {
        product_id: TEAM_PRODUCT_ID,
        subscription_status: 'active',
        current_period_end: '2030-01-01T00:00:00Z',
      },
      membership: { id: 'mem-1' },
      usageRpc: 0,
    });
    await enforceMcpAiUsage({ supabase, ...baseParams, orgId: 'org-foo' });
    expect(supabase.insertCalls).toHaveLength(1);
    expect(supabase.insertCalls[0].org_id).toBe('org-foo');
  });

  it('does NOT pool by org for free tier even when orgId is provided', async () => {
    const supabase = buildMockSupabase({
      profile: { product_id: null, subscription_status: null, current_period_end: null },
      usageRpc: 0,
    });
    await enforceMcpAiUsage({ supabase, ...baseParams, orgId: 'org-foo' });
    // Per-user RPC, not per-org
    expect(supabase.rpcCalls[0].name).toBe('get_monthly_ai_usage');
    // Insert row org_id is null because effectiveOrgId is only set for team tier
    expect(supabase.insertCalls[0].org_id).toBe(null);
  });
});

describe('enforceMcpAiUsage — error handling', () => {
  it('denies when profile fetch errors', async () => {
    const supabase = buildMockSupabase({
      profileError: { message: 'connection refused' },
    });
    const result = await enforceMcpAiUsage({ supabase, ...baseParams });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason.toLowerCase()).toMatch(/subscription/);
    }
  });

  it('denies when usage RPC errors', async () => {
    const supabase = buildMockSupabase({
      profile: { product_id: null, subscription_status: null, current_period_end: null },
      usageRpcError: { message: 'rpc unavailable' },
    });
    const result = await enforceMcpAiUsage({ supabase, ...baseParams });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason.toLowerCase()).toMatch(/quota/);
    }
  });

  it('denies when team-tier membership check errors', async () => {
    const supabase = buildMockSupabase({
      profile: {
        product_id: TEAM_PRODUCT_ID,
        subscription_status: 'active',
        current_period_end: '2030-01-01T00:00:00Z',
      },
      membershipError: { message: 'db down' },
    });
    const result = await enforceMcpAiUsage({ supabase, ...baseParams, orgId: 'org-foo' });
    expect(result.allowed).toBe(false);
  });

  it('returns allowed=true even when ai_usage insert fails (best-effort write)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const supabase = buildMockSupabase({
      profile: { product_id: null, subscription_status: null, current_period_end: null },
      usageRpc: 5,
      insertError: { message: 'insert constraint violated' },
    });
    const result = await enforceMcpAiUsage({ supabase, ...baseParams });
    expect(result.allowed).toBe(true);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('null profile (user with no row) defaults to free tier', async () => {
    const supabase = buildMockSupabase({
      profile: null,
      usageRpc: 0,
    });
    const result = await enforceMcpAiUsage({ supabase, ...baseParams });
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.tier).toBe('free');
      expect(result.limit).toBe(25);
    }
  });
});

describe('enforceMcpAiUsage — quota message format (D-10)', () => {
  // TEMPORARILY SKIPPED (2026-07-30, ticket 81e9ee1b): quota cutoff is bypassed,
  // so denial (and this message) never fires while FREE_PRO_FOR_ALL_ENABLED is true.
  it.skip('quota message includes upgrade URL on every plan tier denial', async () => {
    for (const [tierName, productId, limit] of [
      ['free', null, 25],
      ['pro', PRO_PRODUCT_ID, 1000],
      ['team', TEAM_PRODUCT_ID, 5000],
    ] as const) {
      const supabase = buildMockSupabase({
        profile: {
          product_id: productId,
          subscription_status: productId ? 'active' : null,
          current_period_end: '2030-01-01T00:00:00Z',
        },
        membership: tierName === 'team' ? { id: 'm' } : undefined,
        usageRpc: limit,
      });
      const result = await enforceMcpAiUsage({ supabase, ...baseParams, orgId: tierName === 'team' ? 'org-x' : null });
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain('https://app.callvaultai.com/settings/billing');
        expect(result.reason).toContain(`${limit}/${limit}`);
        expect(result.reason).toMatch(new RegExp(`${tierName} plan`, 'i'));
      }
    }
  });
});

describe('enforceMcpAiUsage — action_type whitelist (compile-time)', () => {
  it('McpAiActionType type union includes all four MCP action types', () => {
    // This is a compile-time check — if any of these strings cease to be valid,
    // the test file won't type-check and vitest will refuse to run it.
    const types: McpAiActionType[] = [
      'mcp_action_items',
      'mcp_ask_call',
      'mcp_sentiment',
      'mcp_coaching',
    ];
    expect(types).toHaveLength(4);
  });
});
