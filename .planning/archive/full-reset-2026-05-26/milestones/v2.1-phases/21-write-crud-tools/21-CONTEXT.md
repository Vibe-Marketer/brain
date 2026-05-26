# Phase 21: Write CRUD Tools - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning (1 plan: TOOL-05 `create_note`) + retroactive backfill of 16 already-shipped write tools
**Source:** `/gsd-discuss-phase 21` — combined backfill + forward-decision discussion

> **Hybrid phase.** 16 write tools shipped without GSD plan tracking (alongside Phase 18 baseline + commit `03904178` 2026-04-15 expansion + later additions). 1 write tool (`create_note`) remains. This CONTEXT.md backfills decisions for the shipped tools AND captures forward decisions for `create_note`. Plan-phase will produce 1 PLAN: `21-01-PLAN.md` for `create_note`.

<domain>
## Phase Boundary

Users' MCP clients can organize calls by adding notes, applying tags, and moving calls to folders — with strict org/workspace boundary enforcement on every tool invocation.

**Boundary:**
- IN SCOPE: Write tools that mutate organizational metadata on existing recordings (notes, tags, folder assignments). Plus the bonus write tools shipped beyond spec (rename/delete/move/copy calls; folder/tag/share-link/org/workspace creation).
- OUT OF SCOPE: AI-powered analysis tools (Phase 22). Management UI for tool toggling (Phase 23). Recording creation from external sources (Phase 24 covers paste-source). Embedding/vector pipeline (architectural constraint).

</domain>

<decisions>
## Implementation Decisions

### Backfilled — patterns shipped in 16 already-live write tools

These decisions are already encoded in `supabase/functions/mcp-server/index.ts` and govern any new write tool added in this phase or later (Phase 22+):

- **D-01:** Every write tool follows the same case-block shape: parse + validate params with explicit `mcpError(id, -32602, ...)` for missing/invalid input, run org/workspace boundary check via `mcpToken.scope` branch, run the mutation, return `mcpOk` with a human-readable success string.
- **D-02:** Org boundary check pattern: workspace-scoped tokens query `workspace_entries` with `.eq('workspace_id', mcpToken.workspace_id!)`; org-scoped tokens use `fetchOrgWorkspaceIds(supabase, mcpToken.org_id!)` then `.in('workspace_id', orgWsIds)`. Never trust client-supplied recording_ids without ownership check.
- **D-03:** User-owned resources (tags, share links) verify `.eq('user_id', mcpToken.user_id)` before allowing the mutation. `personal_tags` is the canonical example — `tag_call` rejects attempts to apply tags owned by other users.
- **D-04:** Mutations return a confirmation string with the recording title and the action taken (e.g., `Tagged "{title}" with "{tagName}"`). Helps MCP clients render conversational responses.
- **D-05:** Error code conventions — `-32602` for invalid params, `-32603` for internal/Supabase errors, `-32001` for ownership/access denial.

### Forward decision — `create_note` storage model

After investigating the existing `workspace_entries.notes` column and confirming **no in-app UI currently reads it**, the decision is to ship `create_note` against a new dedicated `call_notes` table rather than appending to the legacy column.

- **D-06: New `call_notes` table.** Schema:
  ```sql
  CREATE TABLE call_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX idx_call_notes_recording ON call_notes(recording_id, created_at DESC);
  CREATE INDEX idx_call_notes_workspace ON call_notes(workspace_id);
  ```
  Reasoning: per-note ownership (author/timestamp), atomic per-row writes (no lost-update races), natural CRUD semantics for future `delete_note` / `edit_note` / `list_notes` tools without an MCP API break.

- **D-07: RLS policies match the workspace_entries pattern** — users can SELECT/INSERT/UPDATE/DELETE notes only for recordings in workspaces they belong to via `workspace_memberships`. Service-role-only from the edge function (mcp-server runs as service role and validates token scope manually — same pattern as the existing write tools).

- **D-08: Leave `workspace_entries.notes` column untouched.** It's legacy data that no UI reads. A future cleanup phase can drop it after a back-migration. Doing it in this phase increases blast radius without benefit.

- **D-09: Update `get_call_notes` MCP read tool to query `call_notes` (new table).** Currently it reads from `workspace_entries.notes`. Behavior change: returns array of {id, content, author, created_at} instead of a single string per workspace. Acceptable break since this is pre-launch — no customer-facing MCP server exists yet.

### Forward decision — `create_note` MCP tool shape

- **D-10: Tool name: `create_note`** (matches spec TOOL-05).
- **D-11: Parameters:**
  - `recording_id` (required, UUID) — the call to attach the note to
  - `content` (required, string, max 10,000 chars) — the note text
  - `workspace_id` (optional, UUID) — required when called by an org-scoped token; ignored when called by a workspace-scoped token (auto-resolved from `mcpToken.workspace_id`)
  Reasoning: explicit > implicit when there's ambiguity. A recording can be in multiple workspaces (shared/copied), so the server must know where to file the note.
- **D-12: Validation:**
  - `content` trimmed; reject empty after trim
  - Length cap 10,000 characters (Zod or manual check) — prevents abuse, matches reasonable note size
  - `workspace_id` MUST be in the org's workspace set when token is org-scoped
  - `recording_id` MUST exist in `workspace_entries` for the resolved `workspace_id`
- **D-13: Return value:** human-readable string `Created note on "{title}" ({n} chars)` — matches D-04 convention. Internal `note_id` is not returned in plain text (MCP clients don't need it for now; future `delete_note` will accept `note_id` and a separate `list_notes` will return them).
- **D-14: User attribution:** `user_id` is set from `mcpToken.user_id` — the token owner is the author. Not exposed to MCP client (the MCP token is the authentication boundary, not a per-call author override).

### Phase 21 inventory — what's shipping in this phase total

After plan execution, Phase 21 will have:
- 16 already-shipped write tools (backfilled, no new code)
- 1 new write tool: `create_note` (1 plan: `21-01-PLAN.md`)
- 1 new table: `call_notes` (in the same plan's migration)
- 1 modified read tool: `get_call_notes` (read from new table; in same plan)

</decisions>

<canonical_refs>
## Canonical References

- `supabase/functions/mcp-server/index.ts` — single-file edge function. Existing write tools live at lines 364-560 (rename, delete, move/copy, folder CRUD, tag CRUD, share links, org/workspace creation). Existing `get_call_notes` read tool at line 339.
- `.planning/phases/20-read-crud-tools/20-CONTEXT.md` — locked decisions for org/workspace isolation pattern, error codes, response format. All apply unchanged here.
- `.planning/phases/19-provisioning-foundation/19-CONTEXT.md` — token scope semantics (`organization` vs `workspace`), plan gating chain (`create_note` will be plan-gated like every other tool).
- `.planning/REQUIREMENTS.md` — TOOL-05 (pending), TOOL-06 ✅, TOOL-07 ✅.
- `.planning/ROADMAP.md` — Phase 21 entry. **Note:** roadmap mentions "writes to call_notes table" in the spec — this CONTEXT.md formalizes that table as a real new migration. The original spec note was forward-looking, not factual.
- `supabase/CLAUDE.md` — migration conventions (kebab-case folder names; YYYYMMDDHHMMSS_descriptive_name.sql; RLS-on-by-default; standard headers), Zod input validation pattern, JWT auth pattern.
- `src/CLAUDE.md` — confirms no frontend code consumes `workspace_entries.notes` today (only `useWorkspaces.ts:272` exposes it on the WorkspaceRecording shape, which is unused by UI surfaces).

</canonical_refs>

<code_context>
## Reusable Patterns (from already-shipped write tools)

The `create_note` plan should mirror these patterns one-for-one — they're proven and locked:

1. **Param parsing block** — `const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';` then `if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);`
2. **Workspace boundary resolution** — copy from `tag_call` (lines ~509-540): branch on `mcpToken.scope`, use `fetchOrgWorkspaceIds()` for org-scoped path.
3. **Recording ownership check** — query `workspace_entries` with `.eq('recording_id', X).eq('workspace_id', Y).maybeSingle()` and reject with `-32001` if not found.
4. **Mutation** — single `supabase.from('call_notes').insert({...}).select('id').single()` call. On error, return `-32603` with the supabase error message.
5. **Response** — fetch the recording's title for the success message: `Created note on "{title}" ({content.length} chars)`.

## RLS pattern reference

`call_notes` RLS policies mirror `workspace_entries` (in `supabase/migrations/`):
- SELECT: user is a member of the workspace OR the org owning the workspace (org-scoping via `workspace_memberships` + `organization_memberships`).
- INSERT: same SELECT predicate, plus `auth.uid() = user_id`.
- UPDATE/DELETE: author-only — `auth.uid() = user_id`.

(Edge function uses service role and validates manually; RLS is defense-in-depth for any future client-side query.)

</code_context>

<deferred>
## Deferred Ideas (Not in This Phase)

- **`edit_note` / `delete_note` / `list_notes` MCP tools** — natural follow-ups now that `call_notes` is a real table. Defer to a maintenance phase or Phase 23 if a customer requests them. The schema supports them without further migration.
- **Drop `workspace_entries.notes` legacy column** — defer to a cleanup phase. No active reader; safe to leave.
- **In-app notes UI on the recording detail page** — frontend work, scope creep for Phase 21. Belongs in a UI phase if/when product wants notes visible inside CallVault itself.
- **Note attribution in MCP client responses** — currently `create_note` returns a confirmation string only. If MCP clients want to display "noted by {name}" in responses, that's a `list_notes` enhancement, not part of `create_note`.
- **Markdown / rich-text in notes** — content is plain TEXT for now. If the UI later renders notes, consider promoting to markdown via a separate column or convention.

</deferred>

<spec_lock>
## Locked Requirements (from REQUIREMENTS.md)

- **TOOL-05 (pending → in-progress):** MCP exposes `create_note` tool to add a note to a call → satisfied by D-06 through D-14 (new `call_notes` table + tool implementation).
- **TOOL-06 ✅ (already shipped):** MCP exposes `add_tag` tool → shipped as `tag_call` at `mcp-server/index.ts:508` + `untag_call` at `:520`. No further work.
- **TOOL-07 ✅ (already shipped):** MCP exposes `move_to_folder` tool → shipped as `add_call_to_folder` at `mcp-server/index.ts:447` + `remove_call_from_folder` at `:459`. No further work.

</spec_lock>
