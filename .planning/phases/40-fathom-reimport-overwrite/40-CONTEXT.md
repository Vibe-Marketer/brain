---
phase: 40
phase_name: Fathom Re-import / Overwrite
gathered: 2026-05-11
status: Ready for planning
mode: Auto-generated (well-specified)
---

# Phase 40: Fathom Re-import / Overwrite — Context

<domain>
## Phase Boundary

Allow users to force-reimport a single Fathom call to pull in updated title, transcript, summary, and duration from Fathom — preserving the call's UUID, workspace, tags, and folder assignments. Depends on Phase 39 (mirror table is the data source).

Out of scope: bulk re-import (all calls at once), Zoom re-import, manual-paste replacement.
</domain>

<decisions>
## Implementation Decisions

### UI Placement

- "Refresh from Fathom" action exposed in the **Fathom-import-source detail panel** AND the **call detail view** (per success criterion #1).
- Detail-view button: small `<Button variant="hollow" size="sm">` with `RiRefreshLine` icon, labeled "Refresh from Fathom". Position: near the source app badge / metadata block, not in the main action row.
- Disable + show tooltip if call's `source_app !== 'fathom'`.

### Confirmation Modal

- The action is mildly destructive — overwrites title, transcript, summary, duration. User-edited fields shouldn't be silently overwritten without consent.
- Show confirmation dialog: "Refresh title, transcript, summary, and duration from Fathom? Tags, folder, and workspace assignments are preserved."
- Single confirm button, no "don't ask again" toggle (this is a per-call decision).

### Backend Flow

1. Frontend calls `POST /functions/v1/fathom-refresh` with `{ recording_id: uuid }`.
2. Edge function:
   - Verifies user has access to the recording (RLS + explicit `.eq('organization_id', orgId)`).
   - Resolves `legacy_recording_id` from `recordings.id`.
   - Calls Fathom API (or reads from `fathom_raw_calls` mirror) for latest call data.
   - **UPDATE** `recordings` SET title, full_transcript, summary, duration, synced_at = now() WHERE id = ?.
   - **INSERT or UPDATE** `fathom_raw_calls` to keep mirror in sync.
   - Returns updated recording row.
3. Frontend invalidates relevant TanStack Query keys (recording detail + list).

### Preservation Guarantees

What MUST NOT change:
- `recordings.id` (UUID)
- `recordings.organization_id`
- `recordings.owner_user_id`
- `workspace_entries.workspace_id` for this recording
- `folder_assignments.folder_id` rows for this recording's legacy_recording_id
- `tag_assignments` / `call_tag_assignments` for this recording
- `recordings.created_at`

What CAN change:
- `recordings.title`
- `recordings.full_transcript`
- `recordings.summary`
- `recordings.duration`
- `recordings.synced_at`
- `fathom_raw_calls.*` (mirror gets refreshed)

### Error Handling

- Call not found in Fathom (deleted upstream): return `HTTP 404 / FATHOM_CALL_NOT_FOUND` with message "This call was deleted in Fathom. Cannot refresh." Frontend shows toast.
- Fathom API rate limit: return `HTTP 429` with retry-after.
- Auth failure (token expired): return `HTTP 401 / FATHOM_AUTH_EXPIRED` with link to re-authorize.
- Network failure: standard 500 with retry guidance.

### Test Strategy

- **Real-DB integration test**: create a recording + folder assignment + tag, trigger refresh, verify only title/transcript/summary/duration changed.
- **Edge case test**: refresh a call that has been deleted in Fathom — verify graceful error.
- **Permissions test**: refresh a recording the user doesn't own — verify 403.
- **Dev-browser**: refresh a real Fathom call on prod, verify UI updates without page reload.

### Sequencing

1. Build `fathom-refresh` edge function.
2. Frontend: button + confirmation modal + mutation hook.
3. Cache invalidation wiring.
4. Error handling per scenario.
5. Dev-browser verification.
</decisions>

<code_context>
## Existing Code Insights

- `src/components/panels/CallDetailPanel.tsx` (or similar) — call detail view (button placement)
- `src/components/import/FathomSourceDetail.tsx` (or similar) — import source detail panel
- `supabase/functions/_shared/fathom-client.ts` — Fathom API client (already exists)
- `supabase/functions/sync-meetings/index.ts` — pattern for fetching a single Fathom call
- New: `supabase/functions/fathom-refresh/index.ts`
- New: `src/hooks/useFathomRefresh.ts` mutation hook

## Dependencies

- Phase 39 Fathom Mirror must be in place — `fathom_raw_calls` is the source of truth for the mirror; `fathom-refresh` reads from Fathom API + updates both `recordings` and `fathom_raw_calls`.
- Phase 30's `recording-ids.ts` helper — used to resolve legacy_recording_id from UUID.
</code_context>

<specifics>
- **FEAT-02** — Fathom re-import / overwrite

## Success Criteria

1. "Refresh from Fathom" exposed in Fathom import detail panel + call detail view.
2. Action updates title/transcript/summary/duration without creating a duplicate.
3. After re-import: UUID, workspace, tags, folder assignments unchanged.
4. Deleted-upstream Fathom call surfaces a clear error.
</specifics>

<canonical_refs>
- `.planning/ROADMAP.md` — Phase 40
- `.planning/REQUIREMENTS.md` — FEAT-02
- `.planning/phases/39-fathom-mirror/` — prerequisite
- `src/lib/recording-ids.ts` (Phase 30) — UUID/BIGINT helper
- `supabase/functions/_shared/fathom-client.ts` — Fathom API client
</canonical_refs>

<deferred>
## Deferred Ideas

- **Bulk re-import** — refresh N selected calls at once. v2.3.
- **Auto-refresh on Fathom webhook** — when Fathom notifies a call was updated, auto-trigger refresh. v2.3.
- **Re-import history** — show "last refreshed: X ago" + audit log. v2.3.
- **Conflict resolution** — if user has manually edited title or transcript locally, prompt before overwrite. Defer until we have edit-locally feature.
</deferred>
