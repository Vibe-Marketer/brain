---
phase: 18-mcps
plan: "01"
subsystem: mcp
tags: [mcp, security, token-management, org-scoping]
dependency_graph:
  requires: []
  provides: [one-per-org-mcp-enforcement, mcp-server-verified]
  affects: [src/components/settings/MCPTab.tsx, src/services/mcp-tokens.service.ts]
tech_stack:
  added: []
  patterns: [service-layer-guard, ui-level-enforcement, count-before-insert]
key_files:
  created: []
  modified:
    - src/services/mcp-tokens.service.ts
    - src/components/settings/MCPTab.tsx
decisions:
  - "[18-01] One MCP token per org enforced at both service layer (throws descriptive error) and UI layer (disables Create button with inline message) — defense-in-depth without DB constraints"
  - "[18-01] getOrgTokenCount uses head:true count query for efficiency — no row data returned"
  - "[18-01] MCP server uses Supabase gateway JWT as pass-through — curl tests require anon key as Bearer, then custom MCP token checked against mcp_tokens table"
metrics:
  duration: "115s"
  completed: "2026-03-31"
  tasks: 2
  files_modified: 2
---

# Phase 18 Plan 01: MCP Token One-Per-Org Enforcement and Server Verification Summary

One-per-org MCP token enforcement added at service layer and UI with descriptive error messaging; MCP server verified functional at production URL with correct -32001 rejection of invalid tokens.

## Tasks Completed

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Enforce one MCP token per organization | Done | abd91acc |
| 2 | Verify MCP server org-scoping and tool functionality | Done | (no code changes — code review + curl verification) |

## What Was Built

### Task 1: One-Per-Org Enforcement

**Service layer (`src/services/mcp-tokens.service.ts`):**
- Added `getOrgTokenCount(orgId: string): Promise<number>` — uses `.select('id', { count: 'exact', head: true })` for an efficient count-only query
- Modified `createMcpToken` to call `getOrgTokenCount` before inserting; throws `'This organization already has an MCP token. Delete the existing token to create a new one.'` if count >= 1
- This acts as a server-side fallback if UI check is bypassed

**UI layer (`src/components/settings/MCPTab.tsx`):**
- `NewTokenDialog` now accepts `existingTokens: McpToken[]` prop
- Computes `hasOrgToken` from `existingTokens.some(t => t.org_id === selectedOrgId)`
- Shows inline amber warning: "This organization already has an MCP token. Delete the existing one first."
- Disables the Create Token button when `hasOrgToken` is true
- Main `MCPTab` passes its `tokens` list to `NewTokenDialog`

### Task 2: MCP Server Verification (Code Review + curl)

**Authentication behavior verified:**
- No Authorization header → Supabase gateway returns 401 before reaching function
- Valid JWT + invalid MCP token → function returns `{"jsonrpc":"2.0","id":1,"error":{"code":-32001,"message":"Invalid MCP token"}}` — correct behavior
- All routes (initialize, tools/list, tool handlers) correctly reject invalid tokens

**Org-scoping code review — all 5 tools verified:**

| Tool | Scope enforcement | Verdict |
|------|-------------------|---------|
| `search_calls` | `filter_workspace_id` = token's workspace_id for ws-scope; null for org-scope (user_id scopes via workspace_entries in global_search RPC) | PASS |
| `list_calls` | ws-scope: filters to `[mcpToken.workspace_id]`; org-scope: fetches all org workspaces by `organization_id`, verifies requested workspace belongs to org | PASS |
| `get_transcript` | Verifies user ownership via workspace_entries; additionally verifies workspace membership for ws-scoped tokens | PASS |
| `get_recording_context` | Same pattern as get_transcript | PASS |
| `list_workspaces` | ws-scope: returns only `mcpToken.workspace_id`; org-scope: filters by `organization_id` + user workspace_memberships | PASS |

**last_used_at**: Fire-and-forget async update on every request — confirmed in code (lines 196-200 of mcp-server/index.ts).

**No code changes needed for Task 2** — MCP server is correctly implemented and deployed.

## Deviations from Plan

**1. [Rule 2 - Auto] Curl test approach adjusted for Supabase gateway**
- **Found during:** Task 2
- **Issue:** The plan's curl test expected `{"jsonrpc":"2.0",...,"error":{"code":-32001,...}}` when called without Bearer token. But Supabase's edge function gateway intercepts requests without a valid JWT and returns its own 401 format before the function code runs.
- **Fix:** Tests were adjusted to use the anon JWT as the gateway pass-through, then send an invalid MCP token — this correctly triggers the -32001 path in the function code.
- **Result:** Auth rejection verified at both gateway level (401) and function level (-32001). Both behaviors are correct for MCP clients — they need to provide both a Supabase anon key (apikey header) and a valid MCP token (Authorization: Bearer).

## Known Stubs

None — both changes are fully wired and functional.

## Self-Check: PASSED

- [x] `src/services/mcp-tokens.service.ts` modified — confirmed (`getOrgTokenCount` added, `createMcpToken` enforces limit)
- [x] `src/components/settings/MCPTab.tsx` modified — confirmed (inline warning + disabled button)
- [x] Commit `abd91acc` exists — confirmed
- [x] TypeScript compiles clean — confirmed (no errors from `npx tsc --noEmit`)
- [x] Acceptance criteria:
  - `grep "already has.*MCP token" src/services/mcp-tokens.service.ts` — PASS (line 86)
  - `grep "already has.*token" src/components/settings/MCPTab.tsx` — PASS (line 345)
  - `grep "getOrgTokenCount" src/services/mcp-tokens.service.ts` — PASS (lines 60, 84)
