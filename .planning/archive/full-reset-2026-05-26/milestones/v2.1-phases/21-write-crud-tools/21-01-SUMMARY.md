---
phase: 21-write-crud-tools
plan: 01
status: completed
date: 2026-05-07
requirements:
  - TOOL-05
files_modified:
  - supabase/migrations/20260507083233_call_notes.sql
  - supabase/functions/mcp-server/index.ts
---

# Phase 21 — Plan 01 Summary: `create_note` MCP write tool

## What shipped

1. **New `call_notes` table** (`supabase/migrations/20260507083233_call_notes.sql`)
   - Schema per D-06: `id` (UUID PK), `recording_id` (FK → recordings, CASCADE), `workspace_id` (FK → workspaces, CASCADE), `user_id` (FK → auth.users, CASCADE), `content` (TEXT), `created_at`, `updated_at` (TIMESTAMPTZ).
   - Indexes: `idx_call_notes_recording (recording_id, created_at DESC)` and `idx_call_notes_workspace (workspace_id)`.
   - RLS enabled with 5 policies mirroring the `workspace_entries` access pattern: SELECT for workspace members, SELECT for org admins, INSERT for workspace members (with `auth.uid() = user_id`), UPDATE/DELETE author-only.

2. **New `create_note` MCP tool** (`supabase/functions/mcp-server/index.ts`)
   - Tool registration block added after `untag_call` (file:line ~531 region in the registry array).
   - Case handler added immediately after `case 'untag_call'`.
   - Validates: `recording_id` required (-32602), `content` non-empty after trim (-32602), `content` ≤ 10,000 chars (-32602).
   - Workspace boundary: workspace-scoped tokens auto-resolve `workspace_id` from `mcpToken.workspace_id` (mismatch with explicit param → -32602); org-scoped tokens require an explicit `workspace_id` (-32602 if missing) that must be in the org's workspace set (-32001 otherwise).
   - Recording ownership check: `workspace_entries` lookup for `(recording_id, target_workspace_id)` (-32001 on miss).
   - Mutation: `INSERT INTO call_notes (recording_id, workspace_id, user_id, content)` with `user_id` set from `mcpToken.user_id` (D-14, server-side; never client-supplied).
   - Confirmation string per D-13: `Created note on "{title}" ({content.length} chars)`.

3. **Rewired `get_call_notes` tool** (`supabase/functions/mcp-server/index.ts`)
   - Tool description updated to reflect new return shape ("List user-authored notes…newest first, including author and timestamp").
   - Case handler now reads from `call_notes` instead of `workspace_entries.notes`.
   - Returns one block per note formatted as `## {author_email_or_uid} — {created_at}\n{content}` joined with `\n\n---\n\n`.
   - Author labels resolved via `supabase.auth.admin.getUserById(uid)` (best-effort).
   - Workspace boundary check unchanged (token-scope branching with `fetchOrgWorkspaceIds` for org tokens).

4. **Header doc-comment updated** — `create_note` listed in the file-top WRITE tool catalog.

## Evidence

| Item | File:line evidence |
|------|--------------------|
| Migration file present | `supabase/migrations/20260507083233_call_notes.sql` (94 lines, 5 policies, RLS enabled) |
| `create_note` tool registry | `supabase/functions/mcp-server/index.ts` — entry between `untag_call` and `create_share_link` |
| `case 'create_note'` handler | `supabase/functions/mcp-server/index.ts` — block immediately after `case 'untag_call'` |
| `get_call_notes` rewired | `supabase/functions/mcp-server/index.ts` — `from('call_notes').select('id, content, user_id, created_at')` |
| `workspace_entries` removed from `get_call_notes` block | `awk` extract between `case 'get_call_notes'` and `case 'list_shared_calls'` returns 0 references |

## Verify outputs

- Task 1 verify: `PASS` (migration exists, table + indexes + RLS + 5 policies + helper-function references + auth.uid check)
- Task 2 verify: `STEP1_PASS` (tool name + case + 2× `from('call_notes')` calls + confirmation string + error messages all present); `get_call_notes` block contains 0 references to `workspace_entries`
- Task 3 verify: migration applied (`Applying migration 20260507083233_call_notes.sql... Finished supabase db push.`); deploy succeeded (`Deployed Functions on project vltmrnjsubfzrgrtdqey: mcp-server`)

## Deploy output

```
$ supabase db push --include-all
Applying migration 20260507083233_call_notes.sql...
Finished supabase db push.

$ supabase functions deploy mcp-server --use-api
Uploading asset (mcp-server): supabase/functions/mcp-server/index.ts
Uploading asset (mcp-server): supabase/functions/_shared/cors.ts
Deployed Functions on project vltmrnjsubfzrgrtdqey: mcp-server
```

## Notes & deviations

- **`supabase db push` flag**: Plan said run `supabase db push`; reality required `--include-all` because the migration timestamp `20260507083233` is older than the most recently applied migration `20260507120000_recordings_paste_columns.sql`. The CLI refused to insert "before the last migration on remote" without the explicit flag. Migration filename was kept as locked in the plan frontmatter (D-06 + plan task 1).
- **Migration filename kept verbatim** — `20260507083233_call_notes.sql` matches the plan's locked artifact path exactly.
- **`workspace_entries.notes` legacy column left untouched** per D-08.
- **No changes to plan-gating, auth, or CORS** — all handled upstream of the case-blocks (D-01 pattern preserved).

## Phase 21 inventory after this plan

- 16 already-shipped write tools (backfilled inventory) + **1 new write tool: `create_note`** = **17 total write tools live**.
- 1 read tool rewired: `get_call_notes` (now reads from `call_notes` table).
- 1 new table: `call_notes` (migration applied, RLS active).
- TOOL-05 closed.

## Closes

- Requirement TOOL-05 (MCP exposes `create_note` tool to add a note to a call).
