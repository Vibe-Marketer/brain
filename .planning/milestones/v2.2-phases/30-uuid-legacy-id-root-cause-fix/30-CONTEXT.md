---
phase: 30
phase_name: UUID / Legacy-ID Root-Cause Fix
gathered: 2026-05-11
status: Ready for planning
mode: Interactive discuss (gsd-autonomous)
---

# Phase 30: UUID / Legacy-ID Root-Cause Fix — Context

<domain>
## Phase Boundary

Eliminate the `invalid input syntax for type uuid: "143800259"` error so that **Tag with AI** and the **Folders column** both work for Fathom-imported calls — and any other code path passing the numeric `fathom_raw_calls.recording_id` (BIGINT, e.g. `143800259`) into a UUID column gets fixed at the same time.

In scope: every code path that confuses CallVault's two parallel ID systems:

| System | Type | Lives in | Source |
|---|---|---|---|
| Canonical recording UUID | `uuid` | `recordings.id`, `workspace_entries.recording_id`, `categories.recording_id`, `tag_assignments.recording_id` | Internal — generated at insert |
| Legacy Fathom recording ID | `bigint` | `fathom_raw_calls.recording_id`, `folder_assignments.call_recording_id`, `recordings.legacy_recording_id` | Fathom API (`source_call_id`) |

Out of scope: the auth/signup flow (Phase 31), security audit findings (Phase 37/38), Fathom mirror (Phase 39), Fathom re-import (Phase 40).
</domain>

<decisions>
## Implementation Decisions

### Fix Scope — Full Sweep + Defensive Types

- Fix the two known failure paths: `auto-tag-calls` invocation flow and the Folders column query.
- **Plus** grep the entire codebase (frontend + Edge Functions) for any place that mixes `recording_id` (BIGINT) with UUID columns. Common smells: `.eq('recording_id', someNumber)` against a UUID column, `.in('recording_id', numericIds)` against `recordings`/`workspace_entries`/`tag_assignments`/`categories`.
- Add a narrow type-helper boundary so the mistake is hard to make again:
  - A small utility (e.g. `src/lib/recording-ids.ts`) exposes `toRecordingUuid(input: string | number, opts?)` that returns the canonical UUID, looking up via `recordings.legacy_recording_id` when given a number.
  - Use this helper at every site that needs to call a UUID-keyed table from a context that has the numeric ID.
- Do **not** rewrite the `folder_assignments` table — it intentionally stores `call_recording_id: bigint`. The dual-write to `workspace_entries` (which uses UUID) is the broken bridge that needs hardening, not the legacy column.

### Regression Protection — Integration Tests Against Real DB

- Add Vitest **integration tests** that hit a real (or supabase-local) DB:
  1. Seed: a recording with `id = <uuid>`, `legacy_recording_id = 143800259`, and a matching `fathom_raw_calls` row.
  2. Test: `assignCallToFolder(143800259, folderId, userId, workspaceId)` — assert `folder_assignments` AND `workspace_entries.folder_id` both updated, no UUID-type errors.
  3. Test: invoking `auto-tag-calls` with `recordingIds: [143800259]` writes `auto_tags` correctly.
  4. Test: `getFolderAssignments` returns the assignment keyed correctly for the row above.
- Mocks are explicitly rejected — prior incident showed mocked tests passed while prod migration failed for exactly this class of bug.
- Tests live alongside existing `src/services/__tests__/` and `supabase/functions/auto-tag-calls/__tests__/` patterns.

### Edge Cases Handled

- Zoom / manual-paste recordings: have `legacy_recording_id = null`. The helper must accept either a numeric legacy ID (Fathom path) OR a UUID string directly (Zoom path) and return the UUID unchanged in the latter case.
- Orphan rows in `folder_assignments` where the `recordings` row was deleted: existing `softDeleteFolder` cascade-clean stays in place; the helper returns `null` and callers skip the workspace_entries mirror gracefully (no thrown error).
- Bulk Tag-with-AI from `BulkActionToolbarEnhanced`: already filters to numeric IDs (`Number(c.recording_id)` > 0) — leave the filter, but document why it exists.

### Folders Column Specifically

- `getFolderAssignments` already keys its return map on `String(call_recording_id)` (numeric). The bug is that the **3rd-pane table** reads via `tagAssignments[call.canonical_uuid] || tagAssignments[call.recording_id]` (per `TranscriptTable.tsx:341`) — but folder lookup uses a different keying. Verify the equivalent folder lookup pathway resolves both keys consistently.
- Confirm `recordings.legacy_recording_id` is **populated for every Fathom-imported recording** in production. If a backfill gap exists, the plan must include a one-shot SQL backfill (migration) — but do this only if the audit confirms missing data, not preemptively.

### Out of Scope (Deferred)

- Migrating `folder_assignments` to UUID-based keying — large data migration, separate phase.
- Renaming `fathom_raw_calls.recording_id` to `fathom_call_id` — cosmetic, would create churn.
- ADR documenting the two-ID rule — useful but not strictly required to fix the bug; can be added as a follow-up if time permits.
</decisions>

<code_context>
## Existing Code Insights

**Reusable patterns:**
- `src/services/folders.service.ts:402-418` already shows the correct pattern: lookup recordings row by `legacy_recording_id`, then update `workspace_entries.recording_id` via the resolved UUID. This is the template to generalize.
- `src/components/transcript-library/BulkActionToolbarEnhanced.tsx:243-253` already filters to numeric IDs before calling `autoTagCalls()`. The filter is correct — the bug is downstream of it.

**Symptomatic files (the failing surfaces):**
- `src/lib/api-client.ts:149` — `autoTagCalls(recordingIds: number[])` — types are correct, but production logs show numeric IDs reaching a UUID column somewhere in the chain.
- `supabase/functions/auto-tag-calls/index.ts:566-573` — the actual write happens against `fathom_raw_calls.recording_id` (BIGINT) which is correct. So the UUID error is NOT here — it's likely a downstream invalidation or query in the front-end after success.
- `src/components/transcripts/TranscriptsTab.tsx:1174,1208,1219,1225,1231` — multiple `.in('recording_id', uuids)` against tables that should be UUID-keyed. Confirm each query targets a UUID column with UUID values.

**Possible bug source candidates (need verification during plan-phase research):**
1. Post-success cache invalidation in `TagDropdown`/`useFolders` calling a UUID-keyed query with a numeric ID after the tag write returns.
2. `useGlobalSearch.ts:334` — `sourceCallId: String(rec.legacy_recording_id ?? rec.id)` — search result navigation might trigger a downstream query with the wrong type.
3. A migration-era data row where `recordings.id` was incorrectly set to a numeric string (verify via SQL: `SELECT id FROM recordings WHERE id !~ '^[0-9a-f-]{36}$' LIMIT 5;`).

**Reference architecture docs:**
- `.planning/codebase/CHAT_SCHEMA_ANALYSIS.md` — has the schema map of which columns use UUID vs BIGINT.
- `.planning/codebase/CONCERNS.md` — likely already calls out this dual-ID issue.
</code_context>

<specifics>
## Specific Requirements (from REQUIREMENTS.md)

- **BUG-01** — Fix `invalid input syntax for type uuid: "143800259"` error on assignment loading — code path is passing the numeric Fathom `source_call_id` where a recording UUID is required. **This fix unblocks two visible symptoms: (a) auto-AI-tags failing on "Tag with AI", (b) Folders column blank for most calls.**

## Success Criteria (from ROADMAP.md)

1. "Tag with AI" completes successfully for any call — no `invalid input syntax for type uuid: "143800259"` error in logs.
2. The Folders column in the 3rd-pane table shows the correct folder assignment for calls imported from Fathom.
3. No regression on calls imported from Zoom or manual paste (UUID-native sources unaffected).

## Verification Strategy

- **Live verification (mandatory):** dev-browser against `app.callvaultai.com` — log in as Andrew, find a Fathom-imported call, click "Tag with AI" → assert success toast and no console error; verify the Folders column populates with the assigned folder.
- **Browser console:** no `invalid input syntax for type uuid` errors during the full session.
- **Edge function logs:** `supabase functions logs auto-tag-calls --since 5m` shows clean traces.
- **Integration tests:** pass green in `npm test`.
</specifics>

<canonical_refs>
## Canonical References (MANDATORY READING for downstream agents)

- `.planning/ROADMAP.md` — Phase 30 section (success criteria locked)
- `.planning/REQUIREMENTS.md` — BUG-01 definition
- `.planning/codebase/ARCHITECTURE.md` — overall data flow
- `.planning/codebase/CHAT_SCHEMA_ANALYSIS.md` — schema with UUID vs BIGINT columns
- `.planning/codebase/CONCERNS.md` — known data integrity concerns
- `supabase/CLAUDE.md` — DB conventions (snake_case, RLS, deploy via `--use-api`)
- `src/CLAUDE.md` — frontend conventions (TanStack Query keys, service+hook split)
- `src/services/folders.service.ts` — current dual-write pattern (template for the fix)
- `supabase/functions/auto-tag-calls/index.ts` — current auto-tag implementation
- `src/lib/api-client.ts` — Edge function invocation surface

## QA Sweep Cross-Reference (Phase 29)

Phase 29's QA catalog should be scanned during plan-phase research for any QA-NN entry that mentions a `uuid` error, a "Tag with AI" failure, or a blank Folders column — these are additional symptoms of the same root cause that should be closed by this fix.
</canonical_refs>

<deferred>
## Deferred Ideas

- **Migrate `folder_assignments` to UUID keying** — would eliminate the legacy bridge entirely but requires a large data migration. Capture as v2.3 candidate.
- **ADR — Two-ID System** — document the canonical-UUID vs legacy-BIGINT rule formally in `docs/adr/`. Useful for new contributors. Not blocking; can ship in Phase 41 (tech debt closure) or post-milestone.
- **Rename `fathom_raw_calls.recording_id` → `fathom_call_id`** — clearer naming but a large rename with high churn. Skip for now.
- **`recordings.legacy_recording_id` backfill** — only execute if the audit during plan-phase finds Fathom calls with `legacy_recording_id IS NULL`. If everything's already populated, skip.
</deferred>
