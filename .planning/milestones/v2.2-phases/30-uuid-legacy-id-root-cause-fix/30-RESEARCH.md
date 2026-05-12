---
phase: 30
phase_name: UUID / Legacy-ID Root-Cause Fix
researched: 2026-05-11
status: Research complete
---

# Phase 30 Research: UUID / Legacy-ID Root-Cause Fix

## Executive Summary

The `invalid input syntax for type uuid: "143800259"` error surfaces when Fathom-imported calls invoke "Tag with AI" or when the Folders column refreshes. Root cause: numeric `fathom_raw_calls.recording_id` (BIGINT, e.g. `143800259`) is being passed into Supabase `.eq()/.in()` filters against columns of type UUID. Postgres rejects the cast and the entire query fails — the call never resolves, downstream UI never updates.

The fix needs three legs:

1. **Centralized resolver** — a single `toRecordingUuid()` helper at `src/lib/recording-ids.ts` that accepts `string | number`, resolves via `recordings.legacy_recording_id`, and returns either a UUID string or null (for orphan rows / non-recorded sources).
2. **Audit + patch all call sites** — every codebase location that touches a UUID-keyed table (`call_tag_assignments`, `transcript_tag_assignments`, `call_speakers`, `workspace_entries`, `categories`, `tag_assignments`, `call_participants`) from a context that has a numeric ID must route through the helper. Two confirmed bug sites + one strong suspect identified below.
3. **Integration regression tests** — no mocks; tests must hit a real DB (project-local or live test project) so a Postgres type error actually fires.

## Confirmed Bug Sites

### Bug Site 1 — `src/components/transcripts/SyncTab.tsx:340-358` + caller at line 395

```ts
const loadTagAssignments = async (recordingIds: string[]) => {
  const { data } = await supabase
    .from('call_tag_assignments')          // recording_id is UUID
    .select('recording_id, tag_id')
    .in('recording_id', recordingIds)      // recordingIds comes from Fathom (numeric strings)
```

Caller: `await loadTagAssignments(unsyncedMeetings.map((m: Meeting) => m.recording_id));` — `m.recording_id` for a Fathom unsynced meeting is the numeric Fathom ID as a string. This passes `["143800259", ...]` into a UUID column → Postgres rejects → entire load fails.

**Note:** `src/hooks/useMeetingsSync.ts:145-172` already implemented a defensive filter for the SAME bug (`numericIds.filter(id => /^\d+$/.test(id))`). `SyncTab.tsx` has its own local copy without the filter — drift between two implementations.

### Bug Site 2 — `src/hooks/useCallAnalytics.ts:114-117`

```ts
const { count: speakersCount } = await supabase
  .from('call_speakers')                   // recording_id is UUID (FK to recordings.id)
  .select('*', { count: 'exact', head: true })
  .in('recording_id', callsWithInvitees.map(c => c.recording_id));
//                                                ^^^^^^^^^^^^^^^^^^
// callsWithInvitees comes from `fathom_calls` (line 95) where recording_id is BIGINT.
```

This silently fails analytics. Probably why "Calls participation rate" never renders for Fathom-heavy users.

### Bug Site 3 (Strong Suspect — the user-facing symptom path) — Folders column key mismatch

`src/components/transcript-library/TranscriptTable.tsx:341-343`:

```ts
tagAssignments={tagAssignments[call.canonical_uuid] || tagAssignments[call.recording_id] || []}
folderAssignments={folderAssignments[call.recording_id] || []}
```

`folderAssignments` is the map returned by `getFolderAssignments` (`src/services/folders.service.ts:140-156`), keyed by `String(call_recording_id)` — i.e. the legacy BIGINT. For Fathom calls, `call.recording_id` IS the BIGINT, so this should work. **HOWEVER**, the recording rows surfaced from the recordings table (which is the new canonical source) have `recording_id` set to the UUID — so the lookup misses for any call sourced from `recordings`. Three calls render with empty Folders column despite having `folder_assignments` rows.

**Fix**: Apply the same dual-key fallback used for `tagAssignments`:
```ts
folderAssignments={
  folderAssignments[String(call.recording_id)] ||
  folderAssignments[String((call as any).legacy_recording_id)] ||
  []
}
```

## Reusable Patterns Found

### Pattern A — `recordings`-by-legacy-id lookup (template for the helper)

`src/services/folders.service.ts:402-418` — already does the dual-write correctly:
```ts
const { data: rec } = await supabase
  .from('recordings')
  .select('id')
  .eq('legacy_recording_id', callRecordingId)
  .maybeSingle()

if (rec && workspaceId) { /* update workspace_entries via rec.id */ }
```

This is the canonical pattern. `src/hooks/useWorkspaceAssignment.ts:29-46` does the same with a TanStack `useQuery` cache. The new `toRecordingUuid()` should expose both shapes:
- An imperative service function (for one-off calls inside mutations).
- A React hook wrapping it with TanStack Query for cache reuse (so multiple components don't re-query for the same recording).

### Pattern B — Bulk ID resolver

`src/components/transcripts/TranscriptsTab.tsx:1130-1161` (`resolveRecordingIds`) — accepts mixed `(number | string)[]`, splits by type, looks up by `legacy_recording_id` for numerics and by `id` for UUID strings, returns `{ uuid, legacyId, sourceApp }[]`. **This is the bulk variant** of the helper and is already correct; only used for the delete flow. Generalize and re-export from `src/lib/recording-ids.ts`.

### Pattern C — Defensive UUID-shape filtering

`src/hooks/useMeetingsSync.ts:150` uses a regex check: `recordingIds.filter(id => /^\d+$/.test(id))`. The helper should expose this as `isLegacyId(input)` / `isRecordingUuid(input)` for callers that want to branch without a DB lookup.

## Codebase Sweep — Full UUID/BIGINT Audit

### Definitely correct (BIGINT-keyed tables, BIGINT inputs)

- `src/services/folders.service.ts:436, 481` — `folder_assignments.call_recording_id` is BIGINT. ✓
- `src/services/import-sources.service.ts:410` — `fathom_raw_calls.recording_id` is BIGINT. ✓
- `src/components/transcripts/TranscriptsTab.tsx:1236-1241` — folder_assignments cleanup uses `legacyIds`. ✓
- `src/services/raw-calls.service.ts:24-72` — each raw table is queried with the correct ID. ✓
- `src/components/transcripts/SyncTab.tsx:100` — `fathom_calls.recording_id` is BIGINT, uses `parseInt`. ✓
- `src/hooks/useCallDetailMutations.ts:245, 291` — both target `fathom_calls`/`fathom_transcripts` (BIGINT). ✓

### Definitely correct (UUID-keyed tables, UUID inputs)

- `src/components/transcripts/TranscriptsTab.tsx:1174, 1208, 1219, 1225, 1231` — all `.in('recording_id', uuids)` after `resolveRecordingIds`. ✓
- `src/services/workspace-entries.service.ts:21` — `workspace_entries.recording_id` is UUID, caller passes UUIDs. ✓
- `src/services/data-movement.service.ts:46` — same pattern. ✓
- `src/services/folders.service.ts:412, 454, 517` — `workspace_entries.recording_id` updated via `rec.id` (UUID resolved from legacy ID). ✓
- `src/hooks/useGlobalSearch.ts:293` — `call_participants.recording_id` is UUID, caller filters to `recordings.id`. ✓
- `src/hooks/useCallDetailQueries.ts:294, 320` — uses `call.canonical_uuid` fallback. ✓
- `src/hooks/useWorkspaceAssignment.ts:63, 171` — `workspace_entries.recording_id` updated via `effectiveRecordingId` (resolved UUID). ✓
- `src/components/transcripts/TranscriptsTab.tsx:1024-1056` — `call_tag_assignments` queried with `validCalls.map(c => c.canonical_uuid).filter(Boolean)`. ✓
- `src/services/personal-tags.service.ts:132` — `personal_tag_recordings.recording_id` is UUID; caller passes UUID. ✓
- `src/services/personal-folders.service.ts:97` — same pattern. ✓

### **BUGS (confirmed)**

- `src/components/transcripts/SyncTab.tsx:340-358, 395` — Fathom numeric IDs → UUID column (`call_tag_assignments`).
- `src/hooks/useCallAnalytics.ts:114-117` — Fathom BIGINTs → UUID column (`call_speakers`).
- `src/components/transcript-library/TranscriptTable.tsx:343` — Folders column lookup doesn't fall back to `legacy_recording_id` for UUID-keyed rows.

### Open question (verify in plan via SQL)

- Are there any production rows where `recordings.legacy_recording_id IS NULL` but `fathom_raw_calls.recording_id` matches a Fathom-imported call? If yes, the helper returns `null` and those calls won't show folder assignments. The CONTEXT.md says "only execute backfill if audit finds gaps." Plan must include the SQL probe.

## Schema Reference (canonical)

| Table | `recording_id` column type | Source of truth |
|---|---|---|
| `recordings` | `id` is UUID; `legacy_recording_id` is BIGINT | — |
| `fathom_raw_calls` | `recording_id` is BIGINT | Fathom API |
| `fathom_calls` | `recording_id` is BIGINT | Fathom API |
| `fathom_transcripts` | `recording_id` is BIGINT | Fathom API |
| `zoom_raw_calls` | `recording_id` is UUID | recordings FK |
| `youtube_raw_calls` | `recording_id` is UUID | recordings FK |
| `upload_raw_files` | `recording_id` is UUID | recordings FK |
| `workspace_entries` | `recording_id` is UUID | recordings FK |
| `call_tag_assignments` | `recording_id` is UUID | recordings FK (migration 20260310125000) |
| `transcript_tag_assignments` | `recording_id` is UUID | recordings FK (migration 20260310125000) |
| `call_speakers` | `recording_id` is UUID | recordings FK |
| `call_participants` | `recording_id` is UUID | recordings FK |
| `categories` | `recording_id` is UUID | recordings FK |
| `folder_assignments` | `call_recording_id` is BIGINT | **legacy**, dual-written |
| `personal_folder_recordings` | `recording_id` is UUID | recordings FK |
| `personal_tag_recordings` | `recording_id` is UUID | recordings FK |

## Integration Test Strategy

CONTEXT explicitly rejects mocks (prior incident: mocks passed while prod failed). Available infrastructure:

- Vitest runs with stubbed Supabase env (`vitest.config.ts:13-14`). The stub uses `https://test.supabase.co` — clearly not a real DB.
- `supabase/tests/rls_permissions_test.sql` is the only existing direct-DB test, and it's pgTAP-style SQL run via `supabase test db`.
- No Supabase local stack is currently running (no `supabase start` in dev workflow per `supabase/CLAUDE.md`).

**Recommended approach for this phase:**

The fix is mostly type discipline at the boundary — the actual Postgres errors only manifest when a wrong-type value hits the wire. Two viable test layers:

1. **Unit-level (cheap)** — Test the `toRecordingUuid()` helper itself against a mocked Supabase client. Covers the resolver logic (legacy-id lookup, UUID passthrough, null on orphan). Mock is acceptable HERE because we're testing pure resolution logic, not "does Postgres accept this type."
2. **Integration-level (mandatory per CONTEXT)** — Add Vitest tests that point at the **live test project** (the Supabase project ID `vltmrnjsubfzrgrtdqey` is already in `package.json:gen:types` — there's a real project). Use a dedicated `.env.test` with a service-role key. Seed → assert → cleanup pattern.

If the live-test-project approach is rejected by Andrew (cost / risk of touching real DB), fallback is:
- Spin up `supabase start` once in CI / on-demand → run integration tests → `supabase stop`.
- Documented in `supabase/CLAUDE.md` as "test runner" path.

Plan-phase should not pick a path yet — present both options in the PLAN's `<verification>` block and let Andrew decide during execution. If Andrew is unavailable, default to **option 2 with `supabase start` locally + a guarded test file that skips when no local DB is reachable** (so CI doesn't break for contributors without Docker).

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Helper introduces a new round-trip per call | Use TanStack Query with 10-min `staleTime` (UUIDs never change). `useWorkspaceAssignment.ts:45` already does this. |
| Refactor sweep breaks Zoom/manual calls (UUID-native) | Helper accepts UUID string and returns it unchanged. Test in step "edge case A" of integration tests. |
| Orphan `folder_assignments` rows throw inside helper | Helper returns `null` for orphans. Callers skip the workspace_entries mirror with a `console.warn`, not a thrown error. |
| Test infra blockers (no local Supabase) | Plan offers two options for Andrew to pick during execution; default has `it.skipIf(!localDbReachable)` so CI stays green. |
| Backfill migration needed but not detected | Plan includes mandatory SQL probe BEFORE shipping the FE fix: `SELECT count(*) FROM fathom_raw_calls f LEFT JOIN recordings r ON r.legacy_recording_id = f.recording_id WHERE r.id IS NULL;`. If > 0, plan branches to add a one-shot backfill migration. |

## Files to Create / Modify

### Create
- `src/lib/recording-ids.ts` — `toRecordingUuid`, `toRecordingUuidBatch`, `isLegacyId`, `isRecordingUuid` helpers
- `src/lib/__tests__/recording-ids.test.ts` — Unit tests for helpers (mocks acceptable)
- `src/services/__tests__/folders.integration.test.ts` — Integration tests (real DB)
- `supabase/functions/auto-tag-calls/__tests__/auto-tag-calls.integration.test.ts` — Integration test for the edge-function path

### Modify
- `src/components/transcripts/SyncTab.tsx:340-395` — route through helper
- `src/hooks/useCallAnalytics.ts:94-120` — resolve UUIDs before querying `call_speakers`
- `src/components/transcript-library/TranscriptTable.tsx:343` — dual-key fallback for folder lookup
- Possibly `src/hooks/useMeetingsSync.ts:145-172` — replace local regex check with `isLegacyId()` from helper for DRY (optional cleanup)

### Optional (only if SQL probe finds gaps)
- `supabase/migrations/YYYYMMDDHHMMSS_backfill_legacy_recording_id.sql` — one-shot backfill

## Plan Decomposition Recommendation

This phase is small enough to fit in **one PLAN.md** but cleanly decomposes into:

1. **Plan 01 — Helper + audit** (sequential, blocking) — Build `recording-ids.ts`, audit the codebase, document the dual-ID rule in code comments. Required before any fix work.
2. **Plan 02 — Patch confirmed bug sites + Folders column** — Apply helper to SyncTab, useCallAnalytics, TranscriptTable. ~5 file mods.
3. **Plan 03 — Integration tests + verification** — Wire test infra, write 3 integration tests, run dev-browser smoke pass.

Three plans, each ~2-4 task-cards, sequential dependency chain. Total estimated implementation time: 2-4 hours of focused work.

## Validation Architecture

(Per CONTEXT.md verification strategy — no separate VALIDATION.md is needed for a bug fix.)

- **Build:** `npm run type-check && npm run build` — must complete with zero TS errors after each plan.
- **Unit:** `npm test src/lib/__tests__/recording-ids.test.ts` — must pass green.
- **Integration:** `npm test src/services/__tests__/folders.integration.test.ts` — must pass green (or skip with documented reason if no local DB).
- **Live verification:** dev-browser against `app.callvaultai.com`:
  1. Log in as Andrew.
  2. Select a Fathom-imported call.
  3. Click "Tag with AI" → assert success toast, NO console error, NO `invalid input syntax for type uuid` in network panel.
  4. Verify Folders column on that call now shows the assigned folder.
  5. Same flow on a Zoom call — must not regress.
- **Edge function logs:** `supabase functions logs auto-tag-calls --since 5m` — clean traces, no Postgres errors.

## RESEARCH COMPLETE
