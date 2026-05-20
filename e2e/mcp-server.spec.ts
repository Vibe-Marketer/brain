/**
 * MCP Server E2E Tests
 *
 * Exercises all 5 MCP tools against the live production endpoint using
 * real MCP tokens created via the service-role Supabase client.
 *
 * Strategy:
 *   - beforeAll: clean up any stale 'e2e-test-token' rows, insert fresh org-scoped token.
 *   - afterAll: delete test tokens in try/finally so they never accumulate.
 *   - mcpCall helper: POST JSON-RPC, return parsed response body.
 *   - Auth rejection, initialize, tools/list, all 5 tools, org-isolation.
 *
 * Requires (loaded via playwright.config.ts dotenv):
 *   SUPABASE_SERVICE_ROLE_KEY — service role key for token provisioning
 *   CALLVAULTAI_LOGIN        — test user email (to resolve user_id)
 *
 * @phase M002-S02
 */

import { test, expect, type APIRequestContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// ─── Constants ────────────────────────────────────────────────────────────────

const MCP_URL = 'https://vltmrnjsubfzrgrtdqey.supabase.co/functions/v1/mcp-server';
const SUPABASE_URL = 'https://vltmrnjsubfzrgrtdqey.supabase.co';
const TEST_TOKEN_NAME = 'e2e-test-token';

// ─── Shared state ─────────────────────────────────────────────────────────────

let orgScopedToken = '';
let testUserId = '';
let testOrgId = '';

type McpTextContent = { type: string; text: string };

// ─── Helper: JSON-RPC call ────────────────────────────────────────────────────

async function mcpCall(
  request: APIRequestContext,
  token: string,
  method: string,
  params: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const response = await request.post(MCP_URL, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    data: {
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    },
  });

  const text = await response.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`MCP response was not JSON: ${text.slice(0, 500)}`);
  }
}

async function mcpToolCall(
  request: APIRequestContext,
  token: string,
  name: string,
  args: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  return mcpCall(request, token, 'tools/call', { name, arguments: args });
}

function expectTextContent(body: Record<string, unknown>): string {
  expect(body).toHaveProperty('result');
  const result = body.result as Record<string, unknown>;
  expect(result).toHaveProperty('content');
  const content = result.content as McpTextContent[];
  expect(Array.isArray(content)).toBe(true);
  expect(content.length).toBeGreaterThan(0);
  expect(content[0].type).toBe('text');
  expect(typeof content[0].text).toBe('string');
  return content[0].text;
}

function extractFirstRecordingId(listCallsText: string): string | null {
  return listCallsText.match(/^ID:\s*([0-9a-f-]{36})$/im)?.[1] ?? null;
}

// ─── Helper: unauthenticated JSON-RPC call ────────────────────────────────────

async function mcpCallNoAuth(
  request: APIRequestContext,
  method: string,
  params: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const response = await request.post(MCP_URL, {
    headers: { 'Content-Type': 'application/json' },
    data: { jsonrpc: '2.0', id: 1, method, params },
  });

  const text = await response.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`MCP response was not JSON: ${text.slice(0, 500)}`);
  }
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

test.beforeAll(async ({}, workerInfo) => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    test.skip(true, 'SUPABASE_SERVICE_ROLE_KEY is not set');
    return;
  }

  const testEmail = process.env.CALLVAULTAI_LOGIN;
  if (!testEmail) {
    test.skip(true, 'CALLVAULTAI_LOGIN is not set');
    return;
  }

  // Use a per-worker token name to prevent race conditions when multiple
  // Playwright workers each run beforeAll concurrently.
  const workerTokenName = `${TEST_TOKEN_NAME}-w${workerInfo.workerIndex}`;

  const supabase = createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false },
  });

  // auth.users isn't directly accessible via JS client; use admin API
  const adminRes = await supabase.auth.admin.listUsers({ perPage: 500 });
  if (adminRes.error) throw new Error(`Failed to list users: ${adminRes.error.message}`);

  const user = adminRes.data.users.find((u) => u.email === testEmail);
  if (!user) throw new Error(`Test user not found for email: ${testEmail}`);
  testUserId = user.id;

  // Find the first org this user belongs to
  const { data: membership, error: memErr } = await supabase
    .from('organization_memberships')
    .select('organization_id')
    .eq('user_id', testUserId)
    .limit(1)
    .maybeSingle();

  if (memErr || !membership) {
    throw new Error(`Test user has no organization membership: ${memErr?.message ?? 'no rows'}`);
  }
  testOrgId = membership.organization_id as string;

  // Clean up any stale tokens for this worker
  await supabase
    .from('mcp_tokens')
    .delete()
    .eq('user_id', testUserId)
    .eq('name', workerTokenName);

  // Insert a fresh org-scoped token
  const { data: newToken, error: insertErr } = await supabase
    .from('mcp_tokens')
    .insert({
      user_id: testUserId,
      org_id: testOrgId,
      workspace_id: null,
      scope: 'organization',
      name: workerTokenName,
    })
    .select('token')
    .single();

  if (insertErr || !newToken) {
    throw new Error(`Failed to create test MCP token: ${insertErr?.message ?? 'no row returned'}`);
  }

  orgScopedToken = newToken.token as string;
});

test.afterAll(async ({}, workerInfo) => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || !testUserId) return;

  const workerTokenName = `${TEST_TOKEN_NAME}-w${workerInfo.workerIndex}`;

  const supabase = createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false },
  });

  try {
    await supabase
      .from('mcp_tokens')
      .delete()
      .eq('user_id', testUserId)
      .eq('name', workerTokenName);
  } catch {
    // Non-fatal — stale tokens will be cleaned up on the next test run
  }
});

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('MCP Server — auth', () => {
  test('rejects request with no Authorization header', async ({ request }) => {
    const body = await mcpCallNoAuth(request, 'initialize');
    expect(body).toHaveProperty('error');
    const error = body.error as Record<string, unknown>;
    expect(error.code).toBe(-32001);
  });

  test('rejects request with invalid token', async ({ request }) => {
    const body = await mcpCall(request, 'invalid-token-xyz', 'initialize');
    expect(body).toHaveProperty('error');
    const error = body.error as Record<string, unknown>;
    expect(error.code).toBe(-32001);
  });
});

test.describe('MCP Server — protocol', () => {
  test('initialize returns protocolVersion', async ({ request }) => {
    const body = await mcpCall(request, orgScopedToken, 'initialize');
    expect(body).toHaveProperty('result');
    const result = body.result as Record<string, unknown>;
    expect(result).toHaveProperty('protocolVersion');
    expect(result.protocolVersion).toBe('2024-11-05');
    expect(result).toHaveProperty('capabilities');
    expect(result).toHaveProperty('serverInfo');
  });

  test('tools/list returns tool definitions', async ({ request }) => {
    const body = await mcpCall(request, orgScopedToken, 'tools/list');
    expect(body).toHaveProperty('result');
    const result = body.result as Record<string, unknown>;
    expect(result).toHaveProperty('tools');
    const tools = result.tools as Array<{ name?: string }>;
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        'search_calls',
        'list_calls',
        'get_transcript',
        'get_recording_context',
        'list_workspaces',
      ]),
    );
  });
});

test.describe('MCP Server — tools', () => {
  test('list_workspaces returns content', async ({ request }) => {
    const body = await mcpToolCall(request, orgScopedToken, 'list_workspaces');
    expectTextContent(body);
  });

  test('list_calls returns content', async ({ request }) => {
    const body = await mcpToolCall(request, orgScopedToken, 'list_calls', { limit: 5 });
    expectTextContent(body);
  });

  test("search_calls with query 'meeting' returns content", async ({ request }) => {
    const body = await mcpToolCall(request, orgScopedToken, 'search_calls', {
      query: 'meeting',
      limit: 5,
    });
    expectTextContent(body);
  });

  test('get_transcript returns content or -32001 when no recordings available', async ({
    request,
  }) => {
    // First: fetch a real recording_id from list_calls
    const listBody = await mcpToolCall(request, orgScopedToken, 'list_calls', { limit: 1 });
    const recordingId = listBody.result ? extractFirstRecordingId(expectTextContent(listBody)) : null;

    const id = recordingId ?? '00000000-0000-0000-0000-000000000000';
    const body = await mcpToolCall(request, orgScopedToken, 'get_transcript', {
      recording_id: id,
    });

    if (recordingId) {
      // Real recording: should succeed
      expectTextContent(body);
    } else {
      // No recordings — expect access-denied or not-found error
      expect(body).toHaveProperty('error');
      const error = body.error as Record<string, unknown>;
      expect(error.code).toBe(-32001);
    }
  });

  test('get_recording_context returns content or -32001 when no recordings available', async ({
    request,
  }) => {
    const listBody = await mcpToolCall(request, orgScopedToken, 'list_calls', { limit: 1 });
    const recordingId = listBody.result ? extractFirstRecordingId(expectTextContent(listBody)) : null;

    const id = recordingId ?? '00000000-0000-0000-0000-000000000000';
    const body = await mcpToolCall(request, orgScopedToken, 'get_recording_context', {
      recording_id: id,
    });

    if (recordingId) {
      expectTextContent(body);
    } else {
      expect(body).toHaveProperty('error');
      const error = body.error as Record<string, unknown>;
      expect(error.code).toBe(-32001);
    }
  });
});

test.describe('MCP Server — org isolation', () => {
  test('org-scoped token cannot access recordings from a different org', async ({ request }) => {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(SUPABASE_URL, serviceKey, {
      auth: { persistSession: false },
    });

    // Check if test user belongs to multiple orgs
    const { data: memberships, error: memErr } = await supabase
      .from('organization_memberships')
      .select('organization_id')
      .eq('user_id', testUserId);

    if (memErr) throw new Error(`Failed to query org memberships: ${memErr.message}`);

    const orgIds = (memberships ?? []).map((m) => m.organization_id as string);

    if (orgIds.length < 2) {
      test.skip(
        true,
        'HUMAN_NEEDED: test account has only one org — multi-org isolation cannot be automated; verify manually that search_calls with an org-scoped token does not return recordings from a different org',
      );
      return;
    }

    const otherOrgId = orgIds.find((id) => id !== testOrgId)!;

    // Create a second token scoped to the other org
    const { data: token2Row, error: t2Err } = await supabase
      .from('mcp_tokens')
      .insert({
        user_id: testUserId,
        org_id: otherOrgId,
        workspace_id: null,
        scope: 'organization',
        name: `${TEST_TOKEN_NAME}-org2`,
      })
      .select('token')
      .single();

    if (t2Err || !token2Row) {
      throw new Error(`Failed to create second org token: ${t2Err?.message ?? 'no row'}`);
    }

    const token2 = token2Row.token as string;

    try {
      // Find a recording in the first org's workspaces
      const { data: ws1 } = await supabase
        .from('workspaces')
        .select('id')
        .eq('organization_id', testOrgId);

      const ws1Ids = (ws1 ?? []).map((w) => w.id as string);

      if (ws1Ids.length === 0) {
        test.skip(true, 'First org has no workspaces — cannot test recording isolation');
        return;
      }

      const { data: entries } = await supabase
        .from('workspace_entries')
        .select('recording_id')
        .in('workspace_id', ws1Ids)
        .limit(1)
        .maybeSingle();

      if (!entries?.recording_id) {
        test.skip(true, 'First org has no recordings — cannot test recording isolation');
        return;
      }

      const targetRecordingId = entries.recording_id as string;

      // Attempt to access first-org recording via second-org token — must be denied
      const body = await mcpToolCall(request, token2, 'get_transcript', {
        recording_id: targetRecordingId,
      });

      expect(
        body,
        'Org 2 token must not return transcript for Org 1 recording',
      ).toHaveProperty('error');
      const error = body.error as Record<string, unknown>;
      expect(error.code).toBe(-32001);
    } finally {
      // Clean up second token
      await supabase
        .from('mcp_tokens')
        .delete()
        .eq('user_id', testUserId)
        .eq('name', `${TEST_TOKEN_NAME}-org2`);
    }
  });
});
