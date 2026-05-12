---
phase: 30
plan: 02
title: Patch confirmed bug sites + Folders column lookup
status: complete
completed: 2026-05-11
requirements:
  - BUG-01
---

# Plan 30-02 — SUMMARY

## Outcome

Routed every code path identified in `30-RESEARCH.md` through the
`toRecordingUuid` / `toRecordingUuidBatch` helper from Plan 30-01, fixing
BUG-01's two visible symptoms ("Tag with AI" failing on Fathom calls and
blank Folders column on Fathom rows). Added `legacy_recording_id` to the
`Meeting` type and the `mapRecordingToMeeting` mapper, then applied a dual-key
fallback at the TranscriptTable Folders/Tags lookup so BIGINT-keyed assignment
maps resolve correctly regardless of whether `recording_id` is a UUID or a
legacy BIGINT.

## Key Files

### key-files.modified
- `src/components/transcripts/SyncTab.tsx` — `loadTagAssignments` now resolves IDs via `toRecordingUuidBatch` before querying `call_tag_assignments`
- `src/hooks/useCallAnalytics.ts` — `call_speakers` count query now uses resolved UUIDs instead of raw `fathom_calls.recording_id` BIGINTs
- `src/components/transcript-library/TranscriptTable.tsx` — dual-key fallback for both `tagAssignments` (canonical UUID → string ID) and `folderAssignments` (string ID → `legacy_recording_id`)
- `src/types/meetings.ts` — added `legacy_recording_id?: number | null` to the `Meeting` interface
- `src/hooks/useMeetingsSync.ts` — replaced hand-rolled `/^\d+$/.test(id)` regex split with `toRecordingUuidBatch`
- `src/hooks/useWorkspaces.ts` — `mapRecordingToMeeting` now populates `legacy_recording_id` on every mapped row (null for non-Fathom)

## Verification

| Check | Result |
|-------|--------|
| `npm run type-check` | PASS (zero errors) |
| `npm run lint` on touched files | PASS (0 new warnings — 1 pre-existing `any` warning in unrelated line of meetings.ts) |
| `npx vitest run` (full suite) | PASS (789/789 — no regressions) |
| Audit: `.in('recording_id', …)` sites | All 14 sites accounted for (see Task 5 audit below) |
| Audit: `.eq('recording_id', …)` sites | All 12 sites accounted for (see Task 5 audit below) |
| Audit: local `^\d+$` regex checks remaining | 0 — fully eliminated from frontend |

## Task 5 Audit Results

### `.in('recording_id', …)` sites

| Site | Target table | Input | Status |
|------|--------------|-------|--------|
| TranscriptsTab.tsx:1174 | workspace_entries (UUID) | uuids[] (resolved) | ✓ already correct |
| TranscriptsTab.tsx:1208 | call_tag_assignments (UUID) | uuids[] (resolved) | ✓ already correct |
| TranscriptsTab.tsx:1219 | call_speakers (UUID) | uuids[] (resolved) | ✓ already correct |
| TranscriptsTab.tsx:1225 | call_participants (UUID) | uuids[] (resolved) | ✓ already correct |
| TranscriptsTab.tsx:1231 | recordings (UUID) | uuids[] (resolved) | ✓ already correct |
| SyncTab.tsx:101 | fathom_calls (BIGINT) | parseInt-mapped numerics | ✓ BIGINT target — correct |
| SyncTab.tsx:356 | call_tag_assignments (UUID) | uuids[] (helper-resolved) | ✓ **fixed in this plan** |
| SyncTabDialogs.tsx:102 | fathom_calls (BIGINT) | selectedExistingTranscripts:number[] | ✓ BIGINT target — correct |
| useMeetingsSync.ts:158 | call_tag_assignments (UUID) | uuids[] (helper-resolved) | ✓ **fixed in this plan** |
| useCallAnalytics.ts:127 | call_speakers (UUID) | speakerRecordingUuids[] (helper-resolved) | ✓ **fixed in this plan** |
| useGlobalSearch.ts:293 | call_participants (UUID) | recIds:string[] (UUIDs from RPC, JSDoc-contracted) | ✓ already correct |
| data-movement.service.ts:46 | workspace_entries (UUID) | recordingIds:string[] (UUIDs by service contract) | ✓ already correct |
| import-sources.service.ts:410 | fathom_raw_calls (BIGINT) | numericIds (numeric-filtered) | ✓ BIGINT target — correct |
| workspace-entries.service.ts:21 | workspace_entries (UUID) | recordingIds:string[] (UUIDs by service contract) | ✓ already correct |

### `.eq('recording_id', …)` sites

| Site | Target table | Input | Status |
|------|--------------|-------|--------|
| useCallDetailMutations.ts:245 | fathom_transcripts (BIGINT) | call.recording_id (Fathom resync — BIGINT) | ✓ BIGINT target — correct |
| useCallDetailMutations.ts:291 | fathom_calls (BIGINT) | call.recording_id (Fathom resync — BIGINT) | ✓ BIGINT target — correct |
| useWorkspaceAssignment.ts:63 | workspace_entries (UUID) | effectiveRecordingId (resolved UUID) | ✓ already correct |
| useWorkspaceAssignment.ts:171 | workspace_entries (UUID) | effectiveRecordingId (resolved UUID) | ✓ already correct |
| personal-folders.service.ts:97 | personal_folder_recordings (UUID) | recordingId:string (UUID by contract) | ✓ already correct |
| folders.service.ts:412 | workspace_entries (UUID) | rec.id (recordings.id — UUID) | ✓ already correct |
| folders.service.ts:454 | workspace_entries (UUID) | rec.id (recordings.id — UUID) | ✓ already correct |
| folders.service.ts:517 | workspace_entries (UUID) | rec.id (recordings.id — UUID) | ✓ already correct |
| raw-calls.service.ts:46 | zoom_raw_calls (UUID) | recordingId:string (UUID) | ✓ already correct |
| raw-calls.service.ts:64 | youtube_raw_calls (UUID) | recordingId:string (UUID) | ✓ already correct |
| raw-calls.service.ts:82 | upload_raw_files (UUID) | recordingId:string (UUID) | ✓ already correct |
| personal-tags.service.ts:132 | personal_tag_recordings (UUID) | recordingId:string (UUID) | ✓ already correct |

**Audit conclusion:** Zero call sites pass a raw `(string | number)[]` of mixed/numeric values into a UUID column.

## Task 6 — SQL Probes (⚠ ESCALATION REQUIRED)

```sql
-- Probe 1
SELECT count(*) FILTER (WHERE r.id IS NULL) AS orphans,
       count(*) FILTER (WHERE r.id IS NOT NULL) AS matched,
       count(*) AS total
FROM fathom_raw_calls f LEFT JOIN recordings r ON r.legacy_recording_id = f.recording_id;
--  orphans | matched | total
-- ---------+---------+-------
--    91    |   1927  | 2018      (~4.5% orphaned)

-- Probe 2
SELECT count(*) FROM recordings
WHERE id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
--  count
-- -------
--    0
```

**Findings:**

- **91 orphan `fathom_raw_calls` rows** (~4.5% of total). These are Fathom calls
  that were fetched into `fathom_raw_calls` but never sync-inserted into
  `recordings`. The orphans span multiple users and a long time range (2025-11 →
  2026-04), so this is not a one-off failure.
- **Zero corrupt recording IDs** (Probe 2 returned 0).

**Implication for BUG-01:** This plan's fix correctly resolves the visible
symptom for the 1927 *matched* Fathom calls — they will now route through the
helper and hit the right UUID. The 91 orphans, however, will return `null`
from `toRecordingUuid` (graceful skip, no crash) but will still appear blank
in the Folders column and still fail the AI-tag flow because there is no
`recordings.id` row to attach assignments to. That is a separate data-integrity
issue — a missing backfill, not a code bug.

**Action required (escalation to user):**

Per the orchestrator's pre-execution directive ("If orphan rows > 0, PAUSE and
report findings; do NOT auto-write a migration without user approval"), I am
**halting** before Plan 30-03 to surface this finding. Two paths from here:

1. **Approve a follow-up backfill plan** (`30-04-PLAN.md`) that writes a
   one-shot Supabase migration to insert `recordings` rows for the 91 orphan
   `fathom_raw_calls`. Then re-run Plan 30-03 (integration tests).
2. **Defer the backfill** (e.g., into BACKLOG or a separate ticket) and proceed
   with Plan 30-03 against the matched-rows path. The integration test will
   only assert resolution behavior for live IDs, not for orphans.

Plan 30-02 itself is complete: the helper integration is correct, type-check
and full test suite are green, and no UUID/BIGINT mismatches remain in the
frontend.

## Deviations

- None — followed plan task-for-task. The orphan-row count is the only "out
  of expectation" finding and is being escalated to the user per directive.

## Self-Check: PASSED

- All 6 tasks executed.
- Type-check passes (zero errors).
- Full test suite passes (789/789, no regressions).
- Helper applied at every documented bug site; audit confirms no UUID/BIGINT
  mismatches remain.
- SQL probes run; orphan finding documented and escalated to user before
  proceeding to Plan 30-03.
