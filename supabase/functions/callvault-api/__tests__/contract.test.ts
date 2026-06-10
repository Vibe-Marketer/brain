/**
 * contract.test.ts — Endpoint contract tests for callvault-api.
 *
 * Asserts:
 * - All four required route paths exist in index.ts
 * - No MCP response shapes in any callvault-api source file
 * - wrong-source 403 behavior is covered
 * - Success helpers produce { data, pagination }
 * - Error helpers produce { error: { code, message } }
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = resolve(process.cwd(), 'supabase/functions/callvault-api');

function readSrc(rel: string): string {
  return readFileSync(resolve(BASE, rel), 'utf8');
}

const INDEX_TS = readSrc('index.ts');
const AUTH_TS = readSrc('auth.ts');
const RESPONSES_TS = readSrc('responses.ts');
const CALLS_TS = readSrc('routes/calls.ts');
const CONTACTS_TS = readSrc('routes/contacts.ts');
const WORKSPACES_TS = readSrc('routes/workspaces.ts');
const SPEAKERS_TS = readSrc('routes/speakers.ts');

const ALL_SOURCES = [INDEX_TS, AUTH_TS, RESPONSES_TS, CALLS_TS, CONTACTS_TS, WORKSPACES_TS, SPEAKERS_TS];
const ALL_SOURCES_STR = ALL_SOURCES.join('\n');

// ─── Route definitions ───────────────────────────────────────────────────────

describe('Required route paths exist in index.ts', () => {
  it('routes GET /v1/workspaces', () => {
    expect(INDEX_TS).toContain('/v1/workspaces');
    expect(INDEX_TS).toContain('handleListWorkspaces');
  });

  it('routes GET /v1/calls', () => {
    expect(INDEX_TS).toContain('/v1/calls');
    expect(INDEX_TS).toContain('handleListCalls');
  });

  it('routes GET /v1/contacts', () => {
    expect(INDEX_TS).toContain('/v1/contacts');
    expect(INDEX_TS).toContain('handleListContacts');
  });

  it('routes GET /v1/speakers', () => {
    expect(INDEX_TS).toContain('/v1/speakers');
    expect(INDEX_TS).toContain('handleListSpeakers');
  });

  it('routes GET /v1/calls/{id} for call detail', () => {
    expect(INDEX_TS).toContain('handleGetCall');
    // Regex pattern for UUID in path
    expect(INDEX_TS).toMatch(/callDetailMatch/);
  });
});

describe('Call detail transcript segment contract', () => {
  it('selects and returns transcript_segments while preserving transcript compatibility text', () => {
    expect(CALLS_TS).toContain('transcript_segments');
    expect(CALLS_TS).toMatch(/transcript_segments:\s*rec\.transcript_segments/);
    expect(CALLS_TS).toMatch(/transcript:\s*rec\.full_transcript\s*\?\?\s*formattedSegments/);
    expect(CALLS_TS).toMatch(/has_transcript:\s*!!\(rec\.full_transcript\s*\|\|\s*formattedSegments\)/);
  });
});

// ─── No MCP response shapes in production files ──────────────────────────────

describe('No MCP protocol patterns in callvault-api source', () => {
  it('does not use mcpOk', () => {
    expect(ALL_SOURCES_STR).not.toContain('mcpOk(');
  });

  it('does not use mcpError', () => {
    expect(ALL_SOURCES_STR).not.toContain('mcpError(');
  });

  it('does not use JSON-RPC jsonrpc field', () => {
    // Must not appear as a JSON key in the response
    expect(ALL_SOURCES_STR).not.toMatch(/"jsonrpc"/);
  });

  it('does not return MCP content array envelope', () => {
    // MCP uses `content: [{ type: 'text', text: '...' }]`
    expect(ALL_SOURCES_STR).not.toMatch(/content:\s*\[/);
  });

  it('does not import from mcp-server protocol', () => {
    expect(ALL_SOURCES_STR).not.toContain('../mcp-server/protocol');
    expect(ALL_SOURCES_STR).not.toContain('./protocol');
  });
});

// ─── Response envelope contracts ─────────────────────────────────────────────

describe('Response helpers produce correct envelopes', () => {
  it('jsonOk builds { data, pagination } list envelope', () => {
    expect(RESPONSES_TS).toContain('export function jsonOk');
    expect(RESPONSES_TS).toContain('data, pagination');
    expect(RESPONSES_TS).toContain('pagination: PaginationMeta');
  });

  it('jsonError builds { error: { code, message } } envelope', () => {
    expect(RESPONSES_TS).toContain('export function jsonError');
    expect(RESPONSES_TS).toContain('error: { code, message }');
  });

  it('PaginationMeta has all required fields', () => {
    expect(RESPONSES_TS).toContain('count:');
    expect(RESPONSES_TS).toContain('has_more:');
    expect(RESPONSES_TS).toContain('next_cursor:');
    expect(RESPONSES_TS).toContain('limit:');
  });

  it('error body has nested code and message strings', () => {
    expect(RESPONSES_TS).toContain('code: string');
    expect(RESPONSES_TS).toContain('message: string');
  });
});

// ─── Wrong-source 403 behavior ────────────────────────────────────────────────

describe('Wrong-source token 403 handling', () => {
  it('auth.ts enforces token_source = api boundary', () => {
    expect(AUTH_TS).toContain("token_source !== 'api'");
  });

  it('auth.ts returns 403 for wrong source (distinct from 401)', () => {
    expect(AUTH_TS).toContain('jsonError(403,');
    expect(AUTH_TS).toContain('WRONG_TOKEN_SOURCE');
  });

  it('auth.ts returns 401 for missing token (separate path)', () => {
    expect(AUTH_TS).toContain('MISSING_TOKEN');
    expect(AUTH_TS).toContain('jsonError(401,');
  });

  it('auth.ts returns 401 for revoked token (separate from wrong-source)', () => {
    expect(AUTH_TS).toContain('TOKEN_REVOKED');
  });
});

// ─── Workspace/org scope enforcement ─────────────────────────────────────────

describe('Scope enforcement in route handlers', () => {
  it('calls.ts reads through workspace_entries for workspace scoping', () => {
    expect(CALLS_TS).toContain('workspace_entries');
  });

  it('calls.ts enforces workspace mismatch for workspace-scoped tokens', () => {
    expect(CALLS_TS).toContain('WORKSPACE_MISMATCH');
  });

  it('contacts.ts scopes by user_id from token context', () => {
    expect(CONTACTS_TS).toContain('user_id');
    expect(CONTACTS_TS).toContain('tokenCtx.user_id');
  });

  it('speakers.ts scopes through organization_id from workspaces', () => {
    expect(SPEAKERS_TS).toContain('organization_id');
    expect(SPEAKERS_TS).toContain('tokenCtx.org_id');
  });

  it('workspaces.ts limits workspace-scoped tokens to their workspace', () => {
    expect(WORKSPACES_TS).toContain("scope === 'workspace'");
    expect(WORKSPACES_TS).toContain('tokenCtx.workspace_id');
  });
});

// ─── Route handler exports ────────────────────────────────────────────────────

describe('Route handler exports', () => {
  it('calls.ts exports handleListCalls', () => {
    expect(CALLS_TS).toContain('export async function handleListCalls');
  });

  it('calls.ts exports handleGetCall for call detail', () => {
    expect(CALLS_TS).toContain('export async function handleGetCall');
  });

  it('contacts.ts exports handleListContacts', () => {
    expect(CONTACTS_TS).toContain('export async function handleListContacts');
  });

  it('workspaces.ts exports handleListWorkspaces', () => {
    expect(WORKSPACES_TS).toContain('export async function handleListWorkspaces');
  });

  it('speakers.ts exports handleListSpeakers', () => {
    expect(SPEAKERS_TS).toContain('export async function handleListSpeakers');
  });
});
