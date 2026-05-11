# Phase 21 Discussion Log

**Date:** 2026-05-07
**Mode:** Default discuss (interactive, hybrid backfill + forward decisions)

## Summary

Phase 21 is partially shipped — 16 write tools live (tag, folder, share-link, org/workspace CRUD, recording rename/delete/move/copy), 1 remains (`create_note`). Discussion covered both backfilling decisions for the shipped portion AND making forward decisions for `create_note`.

## Areas Discussed

### Area 1: `create_note` storage model

**Question:** How should `create_note` store notes?

**Options presented:**
1. Use existing `workspace_entries.notes` (append) — ~30 min, no migration
2. Use existing `workspace_entries.notes` (replace) — ~15 min, no migration
3. New `call_notes` table — ~3-4 hrs
4. JSONB array on `workspace_entries.notes` — ~2 hrs

**User answer:** "what's the best long term option"

**Investigation triggered:** Searched frontend for any UI surface reading `workspace_entries.notes`. Found `useWorkspaces.ts:272` exposes it on the WorkspaceRecording shape but no UI component renders it. Confirmed no in-app dependency on the legacy column.

**Recommendation given:** Option 3 (new `call_notes` table) — best long-term because:
- Per-note ownership (author + timestamp)
- Atomic per-row writes, no lost-update races
- Natural CRUD for future `edit_note` / `delete_note` / `list_notes` without MCP API breaks
- No backwards-compat risk (no UI depends on the legacy column)
- Cost is real (~3-4 hrs vs ~1 hr) but this is a customer-facing API surface — locking into single-blob semantics now would force a breaking change later

**Trade-off table presented to user.**

### Area 2: Org-scoped token handling

**Question:** How should the MCP tool scope notes for org-scoped tokens?

**Options presented:**
1. Require `workspace_id` parameter (recommended)
2. Auto-pick first workspace_entry for the recording

**User answer:** Option 1 — Require `workspace_id` parameter.

**Decision logged:** D-11 / D-12 in CONTEXT.md.

### Area 3: Backfill scope

**Question:** Backfill the 2/3 already-shipped portion?

**Options presented:**
1. Yes — write CONTEXT + SUMMARY for shipped tools, then plan create_note (recommended)
2. No — just create CONTEXT for create_note, skip backfill

**User answer:** Option 1 — Yes, full backfill.

**Decision logged:** This CONTEXT.md and the corresponding SUMMARY.md document both the shipped tools and the forward `create_note` decisions.

### Area 4: Confirmation of scope expansion (1 hr → 3-4 hrs)

**Question:** Confirm: ship `create_note` against a new `call_notes` table?

**Options presented:**
1. Yes — new `call_notes` table, leave legacy column untouched (recommended)
2. Yes, but also drop the legacy column in same migration
3. No — stay with append-on-string

**User answer:** Option 1 — new `call_notes` table, leave legacy column untouched.

**Decision logged:** D-06 through D-14 in CONTEXT.md. Legacy column drop deferred to a future cleanup phase.

## Deferred Ideas

- `edit_note` / `delete_note` / `list_notes` MCP tools (future maintenance phase)
- Drop `workspace_entries.notes` legacy column (future cleanup phase)
- In-app notes UI on the recording detail page (future UI phase)
- Note attribution in MCP client responses (enhancement to a future `list_notes` tool)
- Markdown / rich-text in notes (deferred — plain TEXT for v1)

## Claude's Discretion (not asked, decided per established patterns)

- Tool name `create_note` — matches spec TOOL-05 exactly.
- Error codes — `-32602` invalid params, `-32603` internal, `-32001` access denied. Already locked in Phase 20.
- Response format — plain-text confirmation string with recording title. Already locked.
- RLS policy shape — mirror `workspace_entries`. Already standard for this project.
- Index strategy — `(recording_id, created_at DESC)` for fetching by call; `(workspace_id)` for cleanup. Standard.
- User attribution — `mcpToken.user_id` is the author. The token IS the auth boundary; no per-call author override.
