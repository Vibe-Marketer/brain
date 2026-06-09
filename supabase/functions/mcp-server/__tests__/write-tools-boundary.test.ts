/**
 * Phase 21 Nyquist coverage — write CRUD tools.
 *
 * These tests exercise the BEHAVIORAL CONTRACT of four write tools shipped in
 * Phase 21 plus the post-execution PII fix (commit 6f9a11f3) on get_call_notes.
 *
 * Tools covered:
 *   - create_note (TOOL-05) — content + boundary validation
 *   - get_call_notes (post-fix) — reads from call_notes, redacted authors,
 *     no email leakage, single batched user_profiles query, 50-note cap
 *   - tag_call (TOOL-06) — personal_tags ownership check
 *   - add_call_to_folder + remove_call_from_folder (TOOL-07) — cross-org boundary
 *
 * Strategy: this file follows the same pattern as
 *   supabase/functions/fetch-meetings/__tests__/rate-limit.test.ts
 * — reimplementing the case-handler logic in test scope and running it against
 * a deeply-mocked supabase client. To prevent drift between the test copy and
 * the deployed code, every test that exercises behavior is paired with an
 * anchor assertion that reads the real index.ts and verifies the boundary
 * check / branch / error message is present. If the implementation drifts
 * (someone removes the check), the anchor assertion fails — even if the
 * behavioral copy still passes.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildManualMcpSourceMetadata,
  formatIngestMarkdownSummary,
  normalizeIngestPayload,
  normalizeTagNames as normalizeIngestTagNames,
  resolveSpeakerMatches,
} from '../tools/write/_ingest_helpers.ts';

// ─── Anchor: read the real implementation once ──────────────────────────────
const INDEX_TS = readFileSync(
  resolve(__dirname, '../index.ts'),
  'utf-8',
);
const WRITE_ACCESS_TS = readFileSync(
  resolve(__dirname, '../tools/write/_access.ts'),
  'utf-8',
);
const REGISTRY_TS = readFileSync(
  resolve(__dirname, '../tools/registry.ts'),
  'utf-8',
);
const EXTRACTED_TOOL_PATHS: Record<string, string> = {
  create_workspace: resolve(__dirname, '../tools/admin/create_workspace.ts'),
  get_call_notes: resolve(__dirname, '../tools/read/get_call_notes.ts'),
  add_call_to_folder: resolve(__dirname, '../tools/write/add_call_to_folder.ts'),
  create_note: resolve(__dirname, '../tools/write/create_note.ts'),
  remove_call_from_folder: resolve(__dirname, '../tools/write/remove_call_from_folder.ts'),
  tag_call: resolve(__dirname, '../tools/write/tag_call.ts'),
};

// Pull the bytes of a single case-block out of the real file so we can run
// regexes scoped to a single tool. This protects anchor assertions from
// false-positive matches in unrelated tools.
function caseBlock(toolName: string): string {
  const start = INDEX_TS.indexOf(`case '${toolName}':`);
  if (start === -1) {
    const extractedPath = EXTRACTED_TOOL_PATHS[toolName];
    if (!extractedPath) throw new Error(`case block for ${toolName} not found in index.ts`);
    const source = readFileSync(extractedPath, 'utf-8');
    return source.includes('verifyRecordingAccess') ? `${source}\n${WRITE_ACCESS_TS}` : source;
  }
  // Find the next case-block sibling — look for "      case '" at column 6 (matches actual indentation)
  const after = INDEX_TS.indexOf(`\n      case '`, start + 5);
  // Or end of switch (default: / closing brace)
  const sliceEnd = after === -1 ? INDEX_TS.length : after;
  return INDEX_TS.slice(start, sliceEnd);
}

// ─── Mock JSON-RPC envelope helpers (mirrors mcp-server/index.ts:100-126) ───
type McpToken = {
  id: string;
  user_id: string;
  org_id: string | null;
  workspace_id: string | null;
  scope: 'workspace' | 'organization';
};

type RpcResult =
  | { kind: 'ok'; text: string; id: string | number | null }
  | { kind: 'error'; code: number; message: string; id: string | number | null };

function mcpOk(id: string | number | null, text: string): RpcResult {
  return { kind: 'ok', text, id };
}
function mcpError(
  id: string | number | null,
  code: number,
  message: string,
): RpcResult {
  return { kind: 'error', code, message, id };
}

describe('create_workspace — membership contract anchors', () => {
  it('adds the creator as workspace_owner, not legacy owner', () => {
    const block = caseBlock('create_workspace');

    expect(block).toContain("role: 'workspace_owner'");
    expect(block).not.toContain("role: 'owner'");
  });

  it('returns an error and deletes the workspace if membership creation fails', () => {
    const block = caseBlock('create_workspace');

    expect(block).toMatch(/mcp-server create_workspace membership error/);
    expect(block).toMatch(/\.from\(['"]workspaces['"]\)[\s\S]*\.delete\(\)[\s\S]*\.eq\(['"]id['"],\s*ws\.id\)/);
    expect(block).toContain('Failed to create workspace membership');
  });

  it('rejects live test/debug artifact workspace names before insert', () => {
    const block = caseBlock('create_workspace');

    expect(block).toContain('isTestArtifactWorkspaceName');
    expect(block).toContain('Workspace name looks like a test/debug artifact');
    expect(block).toMatch(/\^mcp debug temp \\d\{10,\}\$/);
    expect(block).toMatch(/\^debug mcp workspace \\d\{10,\}\$/);
    expect(block).toMatch(/do-not-touch/);
    expect(block).toMatch(/\.insert\(\{/);
  });
});

// ─── Mock supabase client builder ────────────────────────────────────────────
//
// Implements just enough of the supabase fluent query API to satisfy the
// case-handler call patterns. Every call records its filter chain so tests
// can assert what the implementation queried.
type Filter = { op: string; col: string; val: unknown };
type QueryRecord = {
  table: string;
  selectCols?: string;
  filters: Filter[];
  ordered?: { col: string; asc: boolean };
  limited?: number;
  insertedRows?: unknown[];
  upsertedRows?: { rows: unknown[]; opts: unknown }[];
  deleted?: boolean;
};

interface MockShape {
  // table -> rows present
  rows: Record<string, Record<string, unknown>[]>;
  // table -> error to return on the next call (consumed once)
  errors: Record<string, { message: string } | null>;
  // recorded queries for assertions
  queries: QueryRecord[];
  // auth.admin.getUserById behaviour
  authUsers: Record<string, { email: string | null }>;
}

function createMockSupabase(initial: Partial<MockShape> = {}) {
  const state: MockShape = {
    rows: initial.rows ?? {},
    errors: initial.errors ?? {},
    queries: [],
    authUsers: initial.authUsers ?? {},
  };

  function from(table: string) {
    const rec: QueryRecord = { table, filters: [] };
    state.queries.push(rec);

    const builder = {
      select(cols: string) {
        rec.selectCols = cols;
        return builder;
      },
      eq(col: string, val: unknown) {
        rec.filters.push({ op: 'eq', col, val });
        return builder;
      },
      in(col: string, val: unknown[]) {
        rec.filters.push({ op: 'in', col, val });
        return builder;
      },
      order(col: string, opts: { ascending: boolean }) {
        rec.ordered = { col, asc: opts.ascending };
        return builder;
      },
      limit(n: number) {
        rec.limited = n;
        return builder;
      },
      // Mutation methods
      insert(rows: unknown) {
        rec.insertedRows = Array.isArray(rows) ? rows : [rows];
        const err = state.errors[table];
        if (err) {
          state.errors[table] = null;
          return Promise.resolve({ data: null, error: err });
        }
        // record into rows
        const arr = state.rows[table] ?? [];
        for (const r of rec.insertedRows!) arr.push(r as Record<string, unknown>);
        state.rows[table] = arr;
        return Promise.resolve({ data: null, error: null });
      },
      upsert(rows: unknown, opts: unknown) {
        rec.upsertedRows = [{ rows: Array.isArray(rows) ? rows : [rows], opts }];
        const err = state.errors[table];
        if (err) {
          state.errors[table] = null;
          return Promise.resolve({ data: null, error: err });
        }
        return Promise.resolve({ data: null, error: null });
      },
      delete() {
        rec.deleted = true;
        return builder;
      },
      // Resolution helpers
      maybeSingle() {
        return resolve_(true);
      },
      single() {
        return resolve_(false);
      },
      then(onFulfilled: (v: { data: unknown; error: unknown }) => unknown) {
        // Used when the chain resolves without maybeSingle/single (list reads).
        return resolve_('list').then(onFulfilled);
      },
    };

    function resolve_(mode: true | false | 'list') {
      const err = state.errors[table];
      if (err) {
        state.errors[table] = null;
        return Promise.resolve({ data: null, error: err });
      }
      const tableRows = state.rows[table] ?? [];
      const matched = tableRows.filter((r) =>
        rec.filters.every((f) => {
          if (f.op === 'eq') return (r as Record<string, unknown>)[f.col] === f.val;
          if (f.op === 'in')
            return (f.val as unknown[]).includes(
              (r as Record<string, unknown>)[f.col],
            );
          return false;
        }),
      );
      if (mode === 'list') return Promise.resolve({ data: matched, error: null });
      if (mode === true) {
        return Promise.resolve({ data: matched[0] ?? null, error: null });
      }
      // single() — error if not exactly one
      if (matched.length === 0) {
        return Promise.resolve({
          data: null,
          error: { message: 'no rows', code: 'PGRST116' },
        });
      }
      return Promise.resolve({ data: matched[0], error: null });
    }

    return builder;
  }

  const auth = {
    admin: {
      getUserById(uid: string) {
        const user = state.authUsers[uid] ?? null;
        return Promise.resolve({ data: { user } });
      },
    },
  };

  return { client: { from, auth }, state };
}

// ─── Behavioral simulators ──────────────────────────────────────────────────
// These reimplement the case-handler logic. Each is paired with anchor tests
// further down that assert the real index.ts contains the same checks.

async function fetchOrgWorkspaceIds(
  client: { from: (t: string) => any },
  orgId: string,
): Promise<{ ids: string[] | null; error: boolean }> {
  const { data, error } = await client
    .from('workspaces')
    .select('id')
    .eq('organization_id', orgId);
  if (error) return { ids: null, error: true };
  return { ids: (data ?? []).map((w: { id: string }) => w.id), error: false };
}

async function simulateCreateNote(
  params: Record<string, unknown>,
  mcpToken: McpToken,
  client: { from: (t: string) => any },
  id: string | number = 1,
): Promise<RpcResult> {
  const recordingId =
    typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
  const rawContent = typeof params.content === 'string' ? params.content : '';
  const content = rawContent.trim();
  const explicitWorkspaceId =
    typeof params.workspace_id === 'string' ? params.workspace_id.trim() : '';

  if (!recordingId) return mcpError(id, -32602, 'recording_id is required');
  if (!content)
    return mcpError(id, -32602, 'content is required and cannot be empty');
  if (content.length > 10_000)
    return mcpError(id, -32602, 'content exceeds 10,000 character limit');

  let targetWorkspaceId: string;
  if (mcpToken.scope === 'workspace') {
    targetWorkspaceId = mcpToken.workspace_id!;
    if (explicitWorkspaceId && explicitWorkspaceId !== targetWorkspaceId) {
      return mcpError(
        id,
        -32602,
        'workspace_id does not match the workspace this token is scoped to',
      );
    }
  } else {
    if (!explicitWorkspaceId) {
      return mcpError(
        id,
        -32602,
        'workspace_id is required for organization-scoped tokens',
      );
    }
    const { ids: orgWsIds, error: wsErr } = await fetchOrgWorkspaceIds(
      client,
      mcpToken.org_id!,
    );
    if (wsErr || !orgWsIds || orgWsIds.length === 0) {
      return mcpError(id, -32603, 'Failed to resolve organization workspaces');
    }
    if (!orgWsIds.includes(explicitWorkspaceId)) {
      return mcpError(id, -32001, 'workspace_id is not in this organization');
    }
    targetWorkspaceId = explicitWorkspaceId;
  }

  const { data: entry } = await client
    .from('workspace_entries')
    .select('recording_id')
    .eq('recording_id', recordingId)
    .eq('workspace_id', targetWorkspaceId)
    .maybeSingle();
  if (!entry) {
    return mcpError(id, -32001, 'Recording not found or not accessible');
  }

  const { error: insertError } = await client.from('call_notes').insert({
    recording_id: recordingId,
    workspace_id: targetWorkspaceId,
    user_id: mcpToken.user_id,
    content,
  });
  if (insertError) {
    return mcpError(id, -32603, `Failed to create note: ${(insertError as { message: string }).message}`);
  }

  const { data: rec } = await client
    .from('recordings')
    .select('title')
    .eq('id', recordingId)
    .maybeSingle();

  return mcpOk(
    id,
    `Created note on "${(rec as { title?: string } | null)?.title || 'Untitled'}" (${content.length} chars)`,
  );
}

async function simulateGetCallNotes(
  params: Record<string, unknown>,
  mcpToken: McpToken,
  client: { from: (t: string) => any },
  id: string | number = 1,
): Promise<RpcResult> {
  const recordingId =
    typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
  if (!recordingId) return mcpError(id, -32602, 'recording_id is required');

  let wsIds: string[];
  if (mcpToken.scope === 'workspace') {
    wsIds = [mcpToken.workspace_id!];
  } else {
    const { ids, error: wsErr } = await fetchOrgWorkspaceIds(client, mcpToken.org_id!);
    if (wsErr || !ids)
      return mcpError(id, -32603, 'Failed to resolve organization workspaces');
    wsIds = ids;
  }
  if (wsIds.length === 0)
    return mcpError(id, -32001, 'Recording not found or not accessible');

  const NOTE_LIMIT = 50;

  const { data: notes, error: notesError } = await client
    .from('call_notes')
    .select('id, content, user_id, created_at')
    .eq('recording_id', recordingId)
    .in('workspace_id', wsIds)
    .order('created_at', { ascending: false })
    .limit(NOTE_LIMIT);
  if (notesError)
    return mcpError(id, -32603, `Failed to fetch notes: ${(notesError as { message: string }).message}`);

  const { data: rec } = await client
    .from('recordings')
    .select('title')
    .eq('id', recordingId)
    .maybeSingle();

  type NoteRow = { id: string; content: string; user_id: string; created_at: string };
  const noteRows = (notes ?? []) as NoteRow[];

  if (noteRows.length === 0) {
    return mcpOk(id, `No notes found for: ${(rec as { title?: string } | null)?.title || recordingId}`);
  }

  const authorIds = Array.from(new Set(noteRows.map((n) => n.user_id)));
  const redact = (uid: string) => `User ${uid.slice(0, 8)}`;
  const authorLabel = new Map<string, string>();
  const { data: profiles } = await client
    .from('user_profiles')
    .select('user_id, display_name')
    .in('user_id', authorIds);
  for (const p of (profiles ?? []) as { user_id: string; display_name: string | null }[]) {
    if (p.display_name && p.display_name.trim())
      authorLabel.set(p.user_id, p.display_name.trim());
  }
  for (const uid of authorIds) {
    if (!authorLabel.has(uid)) authorLabel.set(uid, redact(uid));
  }

  return mcpOk(
    id,
    `# Notes: ${(rec as { title?: string } | null)?.title || 'Untitled'}\n\n` +
      noteRows
        .map(
          (n) =>
            `## ${authorLabel.get(n.user_id) || redact(n.user_id)} — ${n.created_at}\n${n.content}`,
        )
        .join('\n\n---\n\n'),
  );
}

async function simulateTagCall(
  params: Record<string, unknown>,
  mcpToken: McpToken,
  client: { from: (t: string) => any },
  id: string | number = 1,
): Promise<RpcResult> {
  const recordingId =
    typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
  const tagId = typeof params.tag_id === 'string' ? params.tag_id.trim() : '';
  if (!recordingId) return mcpError(id, -32602, 'recording_id is required');
  if (!tagId) return mcpError(id, -32602, 'tag_id is required');

  const { data: tagCheck } = await client
    .from('personal_tags')
    .select('id, name')
    .eq('id', tagId)
    .eq('user_id', mcpToken.user_id)
    .maybeSingle();
  if (!tagCheck)
    return mcpError(id, -32001, 'Tag not found or not accessible');

  if (mcpToken.scope === 'workspace') {
    const { data: access } = await client
      .from('workspace_entries')
      .select('recording_id')
      .eq('recording_id', recordingId)
      .eq('workspace_id', mcpToken.workspace_id!)
      .maybeSingle();
    if (!access)
      return mcpError(id, -32001, 'Recording not found or not accessible');
  } else {
    const { ids: orgWsIds, error: wsErr } = await fetchOrgWorkspaceIds(client, mcpToken.org_id!);
    if (wsErr || !orgWsIds || orgWsIds.length === 0)
      return mcpError(id, -32001, 'Recording not found or not accessible');
    const { data: access } = await client
      .from('workspace_entries')
      .select('recording_id')
      .eq('recording_id', recordingId)
      .in('workspace_id', orgWsIds)
      .maybeSingle();
    if (!access)
      return mcpError(id, -32001, 'Recording not found or not accessible');
  }

  const { error: insertErr } = await client
    .from('personal_tag_recordings')
    .upsert(
      { user_id: mcpToken.user_id, tag_id: tagId, recording_id: recordingId },
      { onConflict: 'tag_id,recording_id' },
    );
  if (insertErr)
    return mcpError(id, -32603, `Failed to tag call: ${(insertErr as { message: string }).message}`);

  return mcpOk(id, `Tagged call with "${(tagCheck as { name: string }).name}"`);
}

async function simulateAddCallToFolder(
  params: Record<string, unknown>,
  mcpToken: McpToken,
  client: { from: (t: string) => any },
  id: string | number = 1,
): Promise<RpcResult> {
  const recordingId =
    typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
  const folderId = typeof params.folder_id === 'string' ? params.folder_id.trim() : '';
  if (!recordingId) return mcpError(id, -32602, 'recording_id is required');
  if (!folderId) return mcpError(id, -32602, 'folder_id is required');

  const { data: folderCheck } = await client
    .from('personal_folders')
    .select('id, name')
    .eq('id', folderId)
    .eq('user_id', mcpToken.user_id)
    .maybeSingle();
  if (!folderCheck)
    return mcpError(id, -32001, 'Folder not found or not accessible');

  if (mcpToken.scope === 'workspace') {
    const { data: access } = await client
      .from('workspace_entries')
      .select('recording_id')
      .eq('recording_id', recordingId)
      .eq('workspace_id', mcpToken.workspace_id!)
      .maybeSingle();
    if (!access)
      return mcpError(id, -32001, 'Recording not found or not accessible');
  } else {
    const { ids: orgWsIds, error: wsErr } = await fetchOrgWorkspaceIds(client, mcpToken.org_id!);
    if (wsErr || !orgWsIds || orgWsIds.length === 0)
      return mcpError(id, -32001, 'Recording not found or not accessible');
    const { data: access } = await client
      .from('workspace_entries')
      .select('recording_id')
      .eq('recording_id', recordingId)
      .in('workspace_id', orgWsIds)
      .maybeSingle();
    if (!access)
      return mcpError(id, -32001, 'Recording not found or not accessible');
  }

  const { error: insertErr } = await client
    .from('personal_folder_recordings')
    .upsert(
      { user_id: mcpToken.user_id, folder_id: folderId, recording_id: recordingId },
      { onConflict: 'folder_id,recording_id' },
    );
  if (insertErr)
    return mcpError(id, -32603, `Failed to add call to folder: ${(insertErr as { message: string }).message}`);

  return mcpOk(id, `Added call to folder "${(folderCheck as { name: string }).name}"`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Test fixtures: realistic ids
// ──────────────────────────────────────────────────────────────────────────────
const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';
const ORG_A = 'aaaaaaaa-1111-1111-1111-111111111111';
const ORG_B = 'bbbbbbbb-2222-2222-2222-222222222222';
const WS_A1 = 'aaaaaaaa-aaaa-1111-1111-111111111111';
const WS_A2 = 'aaaaaaaa-aaaa-2222-2222-222222222222';
const WS_B1 = 'bbbbbbbb-bbbb-1111-1111-111111111111';
const REC_A1 = 'cccc1111-cccc-1111-1111-111111111111'; // in workspace WS_A1 (org A)
const REC_B1 = 'dddd2222-dddd-2222-2222-222222222222'; // in workspace WS_B1 (org B)
const TAG_A = 'eeee1111-eeee-1111-1111-111111111111'; // owned by USER_A
const TAG_B = 'eeee2222-eeee-2222-2222-222222222222'; // owned by USER_B
const FOLDER_A = 'ffff1111-ffff-1111-1111-111111111111'; // owned by USER_A

function tokenWorkspace(): McpToken {
  return {
    id: 'token-1',
    user_id: USER_A,
    org_id: ORG_A,
    workspace_id: WS_A1,
    scope: 'workspace',
  };
}
function tokenOrg(): McpToken {
  return {
    id: 'token-2',
    user_id: USER_A,
    org_id: ORG_A,
    workspace_id: null,
    scope: 'organization',
  };
}

function baseFixtures() {
  return {
    rows: {
      workspaces: [
        { id: WS_A1, organization_id: ORG_A },
        { id: WS_A2, organization_id: ORG_A },
        { id: WS_B1, organization_id: ORG_B },
      ],
      workspace_entries: [
        { recording_id: REC_A1, workspace_id: WS_A1 },
        { recording_id: REC_B1, workspace_id: WS_B1 },
      ],
      recordings: [
        { id: REC_A1, title: 'Org A Sales Call' },
        { id: REC_B1, title: 'Org B Internal Call' },
      ],
      personal_tags: [
        { id: TAG_A, user_id: USER_A, name: 'Important' },
        { id: TAG_B, user_id: USER_B, name: 'Other Users Tag' },
      ],
      personal_folders: [
        { id: FOLDER_A, user_id: USER_A, name: 'Q3 Calls' },
      ],
      call_notes: [] as Record<string, unknown>[],
      user_profiles: [
        { user_id: USER_A, display_name: 'Andrew Naegele' },
        // USER_B has no display_name → must redact to "User <8char>"
        { user_id: USER_B, display_name: null },
      ],
    },
    authUsers: {
      [USER_A]: { email: 'andrew@example.com' },
      [USER_B]: { email: 'phil@example.com' },
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// TOOL-05: create_note
// ──────────────────────────────────────────────────────────────────────────────
describe('TOOL-05 create_note — content + boundary validation', () => {
  let mock: ReturnType<typeof createMockSupabase>;
  beforeEach(() => {
    mock = createMockSupabase(baseFixtures());
  });

  it('rejects missing recording_id with -32602', async () => {
    const r = await simulateCreateNote(
      { content: 'hi' },
      tokenWorkspace(),
      mock.client,
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') {
      expect(r.code).toBe(-32602);
      expect(r.message).toMatch(/recording_id is required/);
    }
  });

  it('rejects empty content with -32602', async () => {
    const r = await simulateCreateNote(
      { recording_id: REC_A1, content: '   ' },
      tokenWorkspace(),
      mock.client,
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') {
      expect(r.code).toBe(-32602);
      expect(r.message).toBe('content is required and cannot be empty');
    }
  });

  it('accepts content of exactly 10,000 chars (boundary)', async () => {
    const content = 'a'.repeat(10_000);
    const r = await simulateCreateNote(
      { recording_id: REC_A1, content },
      tokenWorkspace(),
      mock.client,
    );
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.text).toBe('Created note on "Org A Sales Call" (10000 chars)');
    }
  });

  it('rejects content of 10,001 chars with -32602', async () => {
    const content = 'a'.repeat(10_001);
    const r = await simulateCreateNote(
      { recording_id: REC_A1, content },
      tokenWorkspace(),
      mock.client,
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') {
      expect(r.code).toBe(-32602);
      expect(r.message).toBe('content exceeds 10,000 character limit');
    }
  });

  it('org-scoped token without workspace_id returns -32602', async () => {
    const r = await simulateCreateNote(
      { recording_id: REC_A1, content: 'hi' },
      tokenOrg(),
      mock.client,
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') {
      expect(r.code).toBe(-32602);
      expect(r.message).toBe(
        'workspace_id is required for organization-scoped tokens',
      );
    }
  });

  it('org-scoped token with cross-org workspace_id returns -32001', async () => {
    // WS_B1 belongs to ORG_B, not the token's ORG_A
    const r = await simulateCreateNote(
      { recording_id: REC_B1, content: 'hi', workspace_id: WS_B1 },
      tokenOrg(),
      mock.client,
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') {
      expect(r.code).toBe(-32001);
      expect(r.message).toBe('workspace_id is not in this organization');
    }
  });

  it('workspace-scoped token rejects mismatched explicit workspace_id with -32602', async () => {
    const r = await simulateCreateNote(
      { recording_id: REC_A1, content: 'hi', workspace_id: WS_A2 },
      tokenWorkspace(), // scoped to WS_A1
      mock.client,
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') {
      expect(r.code).toBe(-32602);
      expect(r.message).toMatch(
        /workspace_id does not match the workspace this token is scoped to/,
      );
    }
  });

  it('cross-workspace recording_id returns -32001 (no insert)', async () => {
    // workspace-scoped to WS_A1, but try to write to REC_B1 which is in WS_B1
    const r = await simulateCreateNote(
      { recording_id: REC_B1, content: 'hi' },
      tokenWorkspace(),
      mock.client,
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') {
      expect(r.code).toBe(-32001);
      expect(r.message).toBe('Recording not found or not accessible');
    }
    // Verify no row landed in call_notes
    expect(mock.state.rows.call_notes ?? []).toHaveLength(0);
  });

  it('happy path: inserts into call_notes with token user_id as author', async () => {
    const r = await simulateCreateNote(
      { recording_id: REC_A1, content: 'My note' },
      tokenWorkspace(),
      mock.client,
    );
    expect(r.kind).toBe('ok');
    expect(mock.state.rows.call_notes).toHaveLength(1);
    const note = mock.state.rows.call_notes[0] as Record<string, unknown>;
    expect(note.recording_id).toBe(REC_A1);
    expect(note.workspace_id).toBe(WS_A1);
    expect(note.user_id).toBe(USER_A); // server-side author from token
    expect(note.content).toBe('My note');
  });

  it('does NOT allow client to override author by passing user_id in params', async () => {
    // Adversarial: client tries to set user_id as USER_B in params.
    // Per D-14, the server must use mcpToken.user_id, not params.user_id.
    const r = await simulateCreateNote(
      { recording_id: REC_A1, content: 'forged', user_id: USER_B },
      tokenWorkspace(),
      mock.client,
    );
    expect(r.kind).toBe('ok');
    const note = mock.state.rows.call_notes[0] as Record<string, unknown>;
    expect(note.user_id).toBe(USER_A); // NOT USER_B
  });
});

// Anchor — drift detection on the real index.ts
describe('TOOL-05 create_note — anchor (real index.ts contains the boundary checks)', () => {
  it('case block exists and inserts into call_notes', () => {
    const block = caseBlock('create_note');
    expect(block).toMatch(/from\(['"]call_notes['"]\)\s*\.insert/);
  });
  it('uses mcpToken.user_id for author (D-14)', () => {
    const block = caseBlock('create_note');
    expect(block).toMatch(/user_id:\s*mcpToken\.user_id/);
    // Must NOT take user_id from params
    expect(block).not.toMatch(/user_id:\s*params\.user_id/);
  });
  it('enforces 10,000 char cap', () => {
    const block = caseBlock('create_note');
    expect(block).toMatch(/content\.length\s*>\s*10[_,]?000/);
    expect(block).toMatch(/exceeds 10,000 character limit/);
  });
  it('rejects empty trimmed content with the locked message', () => {
    const block = caseBlock('create_note');
    expect(block).toMatch(/content is required and cannot be empty/);
    expect(block).toMatch(/rawContent\.trim\(\)/);
  });
  it('requires workspace_id for org-scoped tokens', () => {
    const block = caseBlock('create_note');
    expect(block).toMatch(/workspace_id is required for organization-scoped tokens/);
  });
  it('rejects workspace_id outside the org with -32001', () => {
    const block = caseBlock('create_note');
    expect(block).toMatch(/orgWsIds\.includes\(explicitWorkspaceId\)/);
    expect(block).toMatch(/workspace_id is not in this organization/);
  });
  it('verifies recording exists in the target workspace before insert', () => {
    const block = caseBlock('create_note');
    expect(block).toMatch(/from\(['"]workspace_entries['"]\)/);
    expect(block).toMatch(/eq\(['"]recording_id['"]/);
    expect(block).toMatch(/eq\(['"]workspace_id['"]/);
    expect(block).toMatch(/Recording not found or not accessible/);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// get_call_notes — post-PII fix (commit 6f9a11f3)
// ──────────────────────────────────────────────────────────────────────────────
describe('get_call_notes — post-PII fix: redacted authors, no email leak, batched query, 50-cap', () => {
  let mock: ReturnType<typeof createMockSupabase>;
  let fixtures: ReturnType<typeof baseFixtures>;

  beforeEach(() => {
    fixtures = baseFixtures();
    mock = createMockSupabase(fixtures);
  });

  it('reads from call_notes (not workspace_entries.notes)', async () => {
    fixtures.rows.call_notes = [
      {
        id: 'n1',
        recording_id: REC_A1,
        workspace_id: WS_A1,
        user_id: USER_A,
        content: 'hello',
        created_at: '2026-05-07T12:00:00Z',
      },
    ];
    await simulateGetCallNotes({ recording_id: REC_A1 }, tokenWorkspace(), mock.client);
    const tablesQueried = mock.state.queries.map((q) => q.table);
    expect(tablesQueried).toContain('call_notes');
    // No SELECT against workspace_entries.notes — recording lookup is via 'recordings' for title
    const wsQueries = mock.state.queries.filter((q) => q.table === 'workspace_entries');
    expect(wsQueries).toHaveLength(0);
  });

  it('does NOT include note authors emails in the response (PII fix)', async () => {
    fixtures.rows.call_notes = [
      {
        id: 'n1',
        recording_id: REC_A1,
        workspace_id: WS_A1,
        user_id: USER_A,
        content: 'note from A',
        created_at: '2026-05-07T12:00:00Z',
      },
    ];
    const r = await simulateGetCallNotes(
      { recording_id: REC_A1 },
      tokenWorkspace(),
      mock.client,
    );
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      // Email of USER_A would be 'andrew@example.com' from auth.admin.getUserById
      // Post-fix: must NOT appear in the response.
      expect(r.text).not.toMatch(/andrew@example\.com/);
      expect(r.text).not.toMatch(/@example\.com/);
      expect(r.text).toContain('Andrew Naegele'); // display_name from user_profiles
    }
  });

  it('does NOT call auth.admin.getUserById (post-fix uses user_profiles)', async () => {
    let calls = 0;
    const wrappedClient = {
      ...mock.client,
      auth: {
        admin: {
          getUserById(uid: string) {
            calls++;
            return mock.client.auth.admin.getUserById(uid);
          },
        },
      },
    };
    fixtures.rows.call_notes = [
      {
        id: 'n1',
        recording_id: REC_A1,
        workspace_id: WS_A1,
        user_id: USER_A,
        content: 'x',
        created_at: '2026-05-07T12:00:00Z',
      },
    ];
    await simulateGetCallNotes({ recording_id: REC_A1 }, tokenWorkspace(), wrappedClient);
    expect(calls).toBe(0); // post-fix path does not hit auth.admin
  });

  it('uses a single batched user_profiles query (not per-user fan-out)', async () => {
    // 5 distinct authors
    const authorIds = [
      '00000001-0000-0000-0000-000000000000',
      '00000002-0000-0000-0000-000000000000',
      '00000003-0000-0000-0000-000000000000',
      '00000004-0000-0000-0000-000000000000',
      '00000005-0000-0000-0000-000000000000',
    ];
    fixtures.rows.call_notes = authorIds.map((uid, i) => ({
      id: `note-${i}`,
      recording_id: REC_A1,
      workspace_id: WS_A1,
      user_id: uid,
      content: `note ${i}`,
      created_at: `2026-05-07T${10 + i}:00:00Z`,
    }));
    fixtures.rows.user_profiles = authorIds.map((uid) => ({
      user_id: uid,
      display_name: null,
    }));

    await simulateGetCallNotes({ recording_id: REC_A1 }, tokenWorkspace(), mock.client);

    const profileQueries = mock.state.queries.filter(
      (q) => q.table === 'user_profiles',
    );
    expect(profileQueries).toHaveLength(1); // one batched query, not 5
    // The single query uses .in('user_id', [...])
    const inFilter = profileQueries[0].filters.find(
      (f) => f.op === 'in' && f.col === 'user_id',
    );
    expect(inFilter).toBeDefined();
    expect((inFilter!.val as unknown[]).length).toBe(5);
  });

  it('falls back to "User <8char>" when display_name is null/empty', async () => {
    fixtures.rows.call_notes = [
      {
        id: 'n1',
        recording_id: REC_A1,
        workspace_id: WS_A1,
        user_id: USER_B, // display_name is null in fixtures
        content: 'phil note',
        created_at: '2026-05-07T12:00:00Z',
      },
    ];
    const r = await simulateGetCallNotes(
      { recording_id: REC_A1 },
      tokenWorkspace(),
      mock.client,
    );
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      // First 8 chars of USER_B: '22222222'
      expect(r.text).toContain('User 22222222');
      // Email must not leak even in fallback
      expect(r.text).not.toMatch(/phil@example\.com/);
    }
  });

  it('caps response at 50 notes', async () => {
    fixtures.rows.call_notes = Array.from({ length: 200 }, (_, i) => ({
      id: `n${i}`,
      recording_id: REC_A1,
      workspace_id: WS_A1,
      user_id: USER_A,
      content: `note ${i}`,
      created_at: `2026-05-07T00:${String(i % 60).padStart(2, '0')}:00Z`,
    }));
    await simulateGetCallNotes({ recording_id: REC_A1 }, tokenWorkspace(), mock.client);
    const callNotesQuery = mock.state.queries.find((q) => q.table === 'call_notes');
    expect(callNotesQuery?.limited).toBe(50);
  });

  it('orders notes newest-first', async () => {
    fixtures.rows.call_notes = [
      {
        id: 'n1',
        recording_id: REC_A1,
        workspace_id: WS_A1,
        user_id: USER_A,
        content: 'older',
        created_at: '2026-05-07T10:00:00Z',
      },
      {
        id: 'n2',
        recording_id: REC_A1,
        workspace_id: WS_A1,
        user_id: USER_A,
        content: 'newer',
        created_at: '2026-05-07T12:00:00Z',
      },
    ];
    await simulateGetCallNotes({ recording_id: REC_A1 }, tokenWorkspace(), mock.client);
    const q = mock.state.queries.find((qq) => qq.table === 'call_notes');
    expect(q?.ordered).toEqual({ col: 'created_at', asc: false });
  });

  it('respects org-scope: workspace fan-out via fetchOrgWorkspaceIds', async () => {
    fixtures.rows.call_notes = [
      {
        id: 'n1',
        recording_id: REC_A1,
        workspace_id: WS_A1,
        user_id: USER_A,
        content: 'hi',
        created_at: '2026-05-07T12:00:00Z',
      },
    ];
    await simulateGetCallNotes({ recording_id: REC_A1 }, tokenOrg(), mock.client);
    const q = mock.state.queries.find((qq) => qq.table === 'call_notes');
    const inFilter = q?.filters.find(
      (f) => f.op === 'in' && f.col === 'workspace_id',
    );
    // org A has WS_A1 + WS_A2, both in the IN list — and WS_B1 must NOT be
    expect(inFilter?.val).toEqual([WS_A1, WS_A2]);
  });
});

describe('get_call_notes — anchor (real index.ts contains PII fix patterns)', () => {
  it('queries call_notes (not workspace_entries.notes)', () => {
    const block = caseBlock('get_call_notes');
    expect(block).toMatch(/from\(['"]call_notes['"]\)/);
    expect(block).not.toMatch(/workspace_entries/);
  });
  it('uses user_profiles for author label (PII fix)', () => {
    const block = caseBlock('get_call_notes');
    expect(block).toMatch(/from\(['"]user_profiles['"]\)/);
    expect(block).toMatch(/display_name/);
  });
  it('does NOT call auth.admin.getUserById in the get_call_notes block (PII fix)', () => {
    const block = caseBlock('get_call_notes');
    expect(block).not.toMatch(/auth\.admin\.getUserById/);
    expect(block).not.toMatch(/authUser\?\.email/);
  });
  it('caps notes at 50 (NOTE_LIMIT)', () => {
    const block = caseBlock('get_call_notes');
    expect(block).toMatch(/NOTE_LIMIT\s*=\s*50/);
    expect(block).toMatch(/\.limit\(NOTE_LIMIT\)/);
  });
  it('uses single batched .in("user_id", authorIds) query', () => {
    const block = caseBlock('get_call_notes');
    expect(block).toMatch(/\.in\(['"]user_id['"]\s*,\s*authorIds\)/);
  });
  it('redacts unknown authors as "User <8char>" prefix', () => {
    const block = caseBlock('get_call_notes');
    expect(block).toMatch(/redact[\s\S]*uid\.slice\(0,\s*8\)/);
    expect(block).toMatch(/`User\s\$\{uid\.slice\(0,\s*8\)\}`/);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// TOOL-06: tag_call (personal_tags ownership check + cross-org boundary)
// ──────────────────────────────────────────────────────────────────────────────
describe('TOOL-06 tag_call — ownership + cross-org boundary', () => {
  let mock: ReturnType<typeof createMockSupabase>;
  let fixtures: ReturnType<typeof baseFixtures>;
  beforeEach(() => {
    fixtures = baseFixtures();
    mock = createMockSupabase(fixtures);
  });

  it('rejects with -32001 when tag belongs to a different user', async () => {
    // USER_A's token tries to apply USER_B's tag
    const r = await simulateTagCall(
      { recording_id: REC_A1, tag_id: TAG_B },
      tokenWorkspace(),
      mock.client,
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') {
      expect(r.code).toBe(-32001);
      expect(r.message).toBe('Tag not found or not accessible');
    }
  });

  it('rejects cross-workspace recording with -32001 (workspace-scoped token)', async () => {
    // tag is owned by USER_A, but recording REC_B1 lives in WS_B1 (org B), token is on WS_A1
    const r = await simulateTagCall(
      { recording_id: REC_B1, tag_id: TAG_A },
      tokenWorkspace(),
      mock.client,
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') {
      expect(r.code).toBe(-32001);
      expect(r.message).toBe('Recording not found or not accessible');
    }
  });

  it('rejects cross-org recording with -32001 (org-scoped token)', async () => {
    // org-scoped token on ORG_A, tries to tag REC_B1 which is in ORG_B
    const r = await simulateTagCall(
      { recording_id: REC_B1, tag_id: TAG_A },
      tokenOrg(),
      mock.client,
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') {
      expect(r.code).toBe(-32001);
      expect(r.message).toBe('Recording not found or not accessible');
    }
  });

  it('happy path: upserts personal_tag_recordings with token user_id', async () => {
    const r = await simulateTagCall(
      { recording_id: REC_A1, tag_id: TAG_A },
      tokenWorkspace(),
      mock.client,
    );
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.text).toMatch(/Tagged call with "Important"/);
    }
    const q = mock.state.queries.find(
      (qq) => qq.table === 'personal_tag_recordings',
    );
    expect(q?.upsertedRows?.[0].rows).toEqual([
      { user_id: USER_A, tag_id: TAG_A, recording_id: REC_A1 },
    ]);
  });

  it('rejects missing tag_id with -32602', async () => {
    const r = await simulateTagCall(
      { recording_id: REC_A1 },
      tokenWorkspace(),
      mock.client,
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') {
      expect(r.code).toBe(-32602);
      expect(r.message).toBe('tag_id is required');
    }
  });
});

describe('TOOL-06 tag_call — anchor', () => {
  it('verifies tag.user_id ownership before allowing the mutation', () => {
    const block = caseBlock('tag_call');
    expect(block).toMatch(/from\(['"]personal_tags['"]\)/);
    expect(block).toMatch(/eq\(['"]user_id['"]\s*,\s*mcpToken\.user_id\)/);
    expect(block).toMatch(/Tag not found or not accessible/);
  });
  it('inserts/upserts into personal_tag_recordings with mcpToken.user_id', () => {
    const block = caseBlock('tag_call');
    expect(block).toMatch(/from\(['"]personal_tag_recordings['"]\)/);
    expect(block).toMatch(/user_id:\s*mcpToken\.user_id/);
  });
  it('verifies recording boundary by token scope (workspace_entries lookup)', () => {
    const block = caseBlock('tag_call');
    expect(block).toMatch(/from\(['"]workspace_entries['"]\)/);
    expect(block).toMatch(/mcpToken\.scope === ['"]workspace['"]/);
    expect(block).toMatch(/fetchOrgWorkspaceIds/);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// TOOL-07: add_call_to_folder + remove_call_from_folder — cross-org boundary
// ──────────────────────────────────────────────────────────────────────────────
describe('TOOL-07 add_call_to_folder — cross-org boundary', () => {
  let mock: ReturnType<typeof createMockSupabase>;
  let fixtures: ReturnType<typeof baseFixtures>;
  beforeEach(() => {
    fixtures = baseFixtures();
    mock = createMockSupabase(fixtures);
  });

  it('rejects cross-org recording_id with -32001 (workspace-scoped token)', async () => {
    const r = await simulateAddCallToFolder(
      { recording_id: REC_B1, folder_id: FOLDER_A },
      tokenWorkspace(),
      mock.client,
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') {
      expect(r.code).toBe(-32001);
      expect(r.message).toBe('Recording not found or not accessible');
    }
  });

  it('rejects cross-org recording_id with -32001 (org-scoped token)', async () => {
    const r = await simulateAddCallToFolder(
      { recording_id: REC_B1, folder_id: FOLDER_A },
      tokenOrg(),
      mock.client,
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') {
      expect(r.code).toBe(-32001);
      expect(r.message).toBe('Recording not found or not accessible');
    }
  });

  it('rejects folder owned by different user with -32001', async () => {
    // FOLDER_A is owned by USER_A — token is for a different user
    const otherUserToken: McpToken = { ...tokenWorkspace(), user_id: USER_B };
    const r = await simulateAddCallToFolder(
      { recording_id: REC_A1, folder_id: FOLDER_A },
      otherUserToken,
      mock.client,
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') {
      expect(r.code).toBe(-32001);
      expect(r.message).toBe('Folder not found or not accessible');
    }
  });

  it('happy path: upserts personal_folder_recordings with token user_id', async () => {
    const r = await simulateAddCallToFolder(
      { recording_id: REC_A1, folder_id: FOLDER_A },
      tokenWorkspace(),
      mock.client,
    );
    expect(r.kind).toBe('ok');
    const q = mock.state.queries.find(
      (qq) => qq.table === 'personal_folder_recordings',
    );
    expect(q?.upsertedRows?.[0].rows).toEqual([
      { user_id: USER_A, folder_id: FOLDER_A, recording_id: REC_A1 },
    ]);
  });
});

describe('TOOL-07 add_call_to_folder — anchor', () => {
  it('verifies folder.user_id ownership before allowing the mutation', () => {
    const block = caseBlock('add_call_to_folder');
    expect(block).toMatch(/from\(['"]personal_folders['"]\)/);
    expect(block).toMatch(/eq\(['"]user_id['"]\s*,\s*mcpToken\.user_id\)/);
    expect(block).toMatch(/Folder not found or not accessible/);
  });
  it('verifies recording boundary by token scope', () => {
    const block = caseBlock('add_call_to_folder');
    expect(block).toMatch(/from\(['"]workspace_entries['"]\)/);
    expect(block).toMatch(/fetchOrgWorkspaceIds/);
  });
  it('inserts/upserts into personal_folder_recordings with mcpToken.user_id', () => {
    const block = caseBlock('add_call_to_folder');
    expect(block).toMatch(/from\(['"]personal_folder_recordings['"]\)/);
    expect(block).toMatch(/user_id:\s*mcpToken\.user_id/);
  });
});

describe('TOOL-07 remove_call_from_folder — anchor', () => {
  it('verifies folder.user_id ownership before delete', () => {
    const block = caseBlock('remove_call_from_folder');
    expect(block).toMatch(/from\(['"]personal_folders['"]\)/);
    expect(block).toMatch(/eq\(['"]user_id['"]\s*,\s*mcpToken\.user_id\)/);
    expect(block).toMatch(/Folder not found or not accessible/);
  });
  it('scopes the delete to the token user (defense-in-depth)', () => {
    const block = caseBlock('remove_call_from_folder');
    expect(block).toMatch(/from\(['"]personal_folder_recordings['"]\)\s*\.delete/);
    // The delete must be filtered by user_id — not just folder_id+recording_id
    expect(block).toMatch(/eq\(['"]user_id['"]\s*,\s*mcpToken\.user_id\)/);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Phase 04 Wave 0: ingest + follow-up write tool contract tests
// ──────────────────────────────────────────────────────────────────────────────

type IngestSpeaker = { name?: string; email?: string };

function normalizeTagNames(tagNames: string[]): string[] {
  return Array.from(
    new Set(
      tagNames
        .map((name) => name.trim().toLowerCase())
        .filter((name) => name.length > 0),
    ),
  );
}

function summarizeSpeakerAmbiguity(speakers: IngestSpeaker[]): {
  matched: number;
  created: number;
  unresolved: number;
  text: string;
} {
  let unresolved = 0;
  for (const speaker of speakers) {
    if (!speaker.name && !speaker.email) unresolved += 1;
  }
  const matched = speakers.length - unresolved;
  const created = matched;
  const text = unresolved > 0
    ? 'Need clarification for unresolved speakers: please provide first name, last name, email, role/company, or notes.'
    : 'All speakers were matched or created.';
  return { matched, created, unresolved, text };
}

function appendTranscript(existing: string, appendText: string): string {
  if (!existing) return appendText.trim();
  return `${existing}\n\n${appendText.trim()}`;
}

function mergeMetadata(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  return { ...existing, ...incoming };
}

function dedupSpeakerRows(rows: Array<{ name: string; email: string | null }>) {
  const seen = new Set<string>();
  const deduped: Array<{ name: string; email: string | null; participant_type: 'speaker' }> = [];
  for (const row of rows) {
    const key = `${row.name.trim().toLowerCase()}|${(row.email ?? '').trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({ ...row, participant_type: 'speaker' });
  }
  return deduped;
}

describe('Phase 04 ingest/follow-up contract — boundary behavior', () => {
  it('append_to_transcript tool is implemented and registered with append-first semantics', () => {
    const toolPath = resolve(__dirname, '../tools/write/append_to_transcript.ts');
    const toolSource = readFileSync(toolPath, 'utf-8');

    expect(REGISTRY_TS).toContain("import { appendToTranscriptTool } from './write/append_to_transcript.ts';");
    expect(REGISTRY_TS).toContain('appendToTranscriptTool');
    expect(toolSource).toContain("definition: { name: 'append_to_transcript' }");
    expect(toolSource).toContain('resolveTargetWorkspace');
    expect(toolSource).toContain('verifyRecordingInWorkspace');
    expect(toolSource).toContain('append_text');
    expect(toolSource).toContain("from('recordings')");
    expect(toolSource).toContain('full_transcript');
    expect(toolSource).toContain('const nextTranscript');
    expect(toolSource).not.toContain('replace_existing');
  });

  it('update_call_metadata tool is implemented and registered with merge-only semantics', () => {
    const toolPath = resolve(__dirname, '../tools/write/update_call_metadata.ts');
    const toolSource = readFileSync(toolPath, 'utf-8');

    expect(REGISTRY_TS).toContain("import { updateCallMetadataTool } from './write/update_call_metadata.ts';");
    expect(REGISTRY_TS).toContain('updateCallMetadataTool');
    expect(toolSource).toContain("definition: { name: 'update_call_metadata' }");
    expect(toolSource).toContain('resolveTargetWorkspace');
    expect(toolSource).toContain('verifyRecordingInWorkspace');
    expect(toolSource).toContain("from('recordings')");
    expect(toolSource).toContain('source_metadata');
    expect(toolSource).toContain('mergedSourceMetadata');
    expect(toolSource).toContain('{ ...existingSourceMetadata, ...incomingSourceMetadata }');
    expect(toolSource).not.toContain('.delete(');
  });

  it('deduplicates tags case-insensitively during ingest', () => {
    expect(normalizeTagNames(['Urgent', 'urgent', '  URGENT  ', 'Customer'])).toEqual([
      'urgent',
      'customer',
    ]);
  });

  it('reports ambiguous speakers with clarification prompt text', () => {
    const summary = summarizeSpeakerAmbiguity([
      { name: 'Jane Doe' },
      {},
      { email: 'speaker@example.com' },
    ]);
    expect(summary.matched).toBe(2);
    expect(summary.created).toBe(2);
    expect(summary.unresolved).toBe(1);
    expect(summary.text).toMatch(/Need clarification for unresolved speakers/);
  });

  it('append_to_transcript appends instead of replacing existing transcript content', () => {
    const merged = appendTranscript('  Line A\n', 'Line B');
    expect(merged).toContain('  Line A\n');
    expect(merged).toContain('Line A');
    expect(merged).toContain('Line B');
    expect(merged).toMatch(/Line A[\s\S]*Line B/);
  });

  it('follow-up tools enforce explicit workspace target resolution', () => {
    for (const fileName of [
      'append_to_transcript.ts',
      'update_call_metadata.ts',
      'set_speakers.ts',
    ]) {
      const toolSource = readFileSync(
        resolve(__dirname, `../tools/write/${fileName}`),
        'utf-8',
      );
      expect(toolSource).toContain('resolveTargetWorkspace');
      expect(toolSource).toContain('verifyRecordingInWorkspace');
      expect(toolSource).toContain('explicitWorkspaceId');
    }
  });

  it('update_call_metadata merges fields instead of wiping existing metadata', () => {
    const merged = mergeMetadata(
      { client: 'Cursor', original_url: 'https://example.com', keep: true },
      { title_hint: 'QBR', client: 'Claude Desktop' },
    );
    expect(merged).toEqual({
      client: 'Claude Desktop',
      original_url: 'https://example.com',
      keep: true,
      title_hint: 'QBR',
    });
  });

  it('set_speakers contract is idempotent for repeated equivalent payloads', () => {
    const round1 = dedupSpeakerRows([
      { name: 'Jane Doe', email: 'jane@example.com' },
      { name: 'Jane Doe', email: 'JANE@example.com' },
    ]);
    const round2 = dedupSpeakerRows([
      ...round1.map((row) => ({ name: row.name, email: row.email })),
      { name: 'Jane Doe', email: 'jane@example.com' },
    ]);
    expect(round1).toHaveLength(1);
    expect(round2).toHaveLength(1);
    expect(round2[0].participant_type).toBe('speaker');
  });
});

describe('Phase 04 ingest helpers', () => {
  it('normalizes tag names with case-insensitive deduplication', () => {
    expect(normalizeIngestTagNames(['Demo', 'demo', ' DEMO ', 'Client'])).toEqual([
      'demo',
      'client',
    ]);
  });

  it('maps source_date to recording_start_time and preserves source_date', () => {
    const sourceDate = '2026-05-29T10:15:00.000Z';
    const normalized = normalizeIngestPayload({
      transcript: 'call notes',
      title: 'Quarterly review',
      source_date: sourceDate,
    });
    expect(normalized.recording_start_time).toBe(sourceDate);
    expect(normalized.source_date).toBe(sourceDate);
  });

  it('keeps Manual MCP Import as visible provenance while preserving client metadata', () => {
    const metadata = buildManualMcpSourceMetadata({
      client_name: 'Claude Desktop',
      provider_name: 'Anthropic',
      original_url: 'https://example.com/call',
      og_title: 'Call page',
      transcript: 'hello',
      source_date: '2026-05-29T10:15:00.000Z',
    });
    expect(metadata.visible_source_label).toBe('Manual MCP Import');
    expect(metadata.client_name).toBe('Claude Desktop');
    expect(metadata.provider_name).toBe('Anthropic');
    expect(metadata.original_url).toBe('https://example.com/call');
  });

  it('marks low-context when transcript text is missing', () => {
    const metadata = buildManualMcpSourceMetadata({
      title: 'Link only import',
      transcript: ' ',
    });
    expect(metadata.low_context).toBe(true);
  });

  it('includes explicit share URL state in ingest markdown summaries', () => {
    expect(formatIngestMarkdownSummary({
      recordingId: 'rec-1',
      workspaceId: 'workspace-1',
      organizationId: 'org-1',
    })).toMatch(/Share URL: none/);
    expect(formatIngestMarkdownSummary({
      recordingId: 'rec-1',
      workspaceId: 'workspace-1',
      organizationId: 'org-1',
      recordingUrl: 'https://example.com/share',
    })).toMatch(/Share URL: https:\/\/example\.com\/share/);
  });

  it('reports ambiguous speaker matches without throwing', () => {
    const summary = resolveSpeakerMatches(
      [{ name: 'Alex Kim' }],
      [
        { id: 'spk-1', name: 'Alex Kim', email: null },
        { id: 'spk-2', name: 'Alex Kim', email: null },
      ],
    );
    expect(summary.ambiguous).toHaveLength(1);
    expect(summary.unresolved).toHaveLength(0);
  });
});
