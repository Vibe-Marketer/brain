---
phase: 17-import-connector-pipeline
plan: 02
subsystem: api
tags: [supabase, edge-functions, deno, connector-pipeline, import, deduplication, youtube, zoom, fathom]

# Dependency graph
requires:
  - phase: 17-import-connector-pipeline
    plan: 01
    provides: "connector-pipeline.ts with checkDuplicate() + insertRecording() + runPipeline()"
provides:
  - "youtube-import/index.ts — rewired to use checkDuplicate() + insertRecording() via connector-pipeline"
  - "zoom-sync-meetings/index.ts — rewired to use checkDuplicate() + insertRecording() via connector-pipeline; skipped_count tracking"
  - "sync-meetings/index.ts — rewired to use checkDuplicate() + insertRecording() via connector-pipeline; skipped_count tracking"
  - "fetch-meetings/index.ts — sync-status check now queries recordings table (source_app=fathom + source_metadata external_id)"
affects:
  - 17-import-connector-pipeline (plans 03+: new connectors follow same pattern)
  - 18-import-routing-rules (reads from recordings table with normalized source_metadata)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "checkDuplicate() called at start of each connector's sync loop — fail-open, never blocks"
    - "insertRecording() replaces all ad-hoc fathom_calls writes — single insert path for all connectors"
    - "skipped_count tracked locally per sync run, written to sync_jobs at each progress update"
    - "Zoom/Fathom sync returns 'synced'|'skipped'|'failed' instead of boolean — three-state outcome"
    - "vault entry creation for explicit vault_id uses source_metadata external_id lookup post-insert"

key-files:
  created: []
  modified:
    - "supabase/functions/youtube-import/index.ts"
    - "supabase/functions/zoom-sync-meetings/index.ts"
    - "supabase/functions/sync-meetings/index.ts"
    - "supabase/functions/fetch-meetings/index.ts"

key-decisions:
  - "Zoom dedup uses Zoom meeting UUID (recordingId param) as external_id — same value as legacy fathom_calls.recording_id for Zoom"
  - "Fathom dedup uses String(recording_id) as external_id — numeric Fathom IDs cast to string for consistent source_metadata storage"
  - "Zoom sync removes fingerprint-based fuzzy dedup (queried fathom_calls which is now read-only VIEW) — exact external_id dedup via pipeline only"
  - "fathom_transcripts insert preserved in Zoom and Fathom sync functions as non-blocking supplementary write for backward compat"
  - "fetch-meetings sync-status check migrated to recordings table query — fetches all fathom recordings then extracts external_ids from source_metadata"
  - "YouTube recordingId response type changed from number to string (UUID) — callers receiving recordingId for navigation must handle UUID"

patterns-established:
  - "Three-state sync outcome: 'synced'|'skipped'|'failed' — skipped items count toward progress_current without entering failed_ids"
  - "skipped_count written to sync_jobs after every item in sync loop, not just at completion"
  - "Vault entry post-insert lookup uses source_metadata->>'external_id' filter instead of legacy_recording_id"

# Metrics
duration: 5min
completed: 2026-02-28
---

# Phase 17 Plan 02: Connector Rewire Summary

**All three existing import connectors (YouTube, Zoom, Fathom) rewired to write recordings via shared connector-pipeline.ts — broken fathom_calls VIEW writes eliminated, dedup normalized to source_metadata->>'external_id' across all sources.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-28T04:45:34Z
- **Completed:** 2026-02-28T04:50:43Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Eliminated all `fathom_calls` insert paths in YouTube, Zoom, and Fathom sync functions — these were writing to a read-only VIEW and failing silently in production
- YouTube import now uses `checkDuplicate()` + `insertRecording()` returning a UUID; removed `generateYouTubeRecordingId()` 9000000000000+ numeric ID hack
- Zoom and Fathom sync use three-state outcome (`'synced'|'skipped'|'failed'`) with `skipped_count` tracked in `sync_jobs` after every processed item
- `fetch-meetings` sync-status check migrated from `fathom_calls` to `recordings` table with `source_metadata` external_id lookup

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewire YouTube import to use shared pipeline** - `1b6f644` (feat)
2. **Task 2: Rewire Zoom and Fathom sync to use shared pipeline** - `314ad4b` (feat)

**Plan metadata:** (docs commit follows this SUMMARY)

## Files Created/Modified

- `supabase/functions/youtube-import/index.ts` — Removed `fathom_calls` duplicate check + insert; replaced with `checkDuplicate()` + `insertRecording()` from connector-pipeline; removed numeric ID hack; response `recordingId` now UUID string
- `supabase/functions/zoom-sync-meetings/index.ts` — Full rewrite of `syncZoomMeeting()`: removed fingerprint-based dedup against `fathom_calls`, replaced with `checkDuplicate()` + `insertRecording()`; added `skipped_count` tracking; removed unused dedup imports
- `supabase/functions/sync-meetings/index.ts` — Full rewrite of `syncMeeting()`: removed `fathom_calls` upsert, replaced with `checkDuplicate()` + `insertRecording()`; added `skipped_count` tracking; removed `deduplication.ts` import
- `supabase/functions/fetch-meetings/index.ts` — Replaced `fathom_calls` sync-status query with `recordings` table query filtering by `source_app='fathom'` and extracting `external_id` from `source_metadata`

## Decisions Made

- **Zoom dedup key**: Used Zoom meeting UUID (the `recordingId` string parameter) as `external_id`. This is the same unique identifier Zoom assigns each recording session and was previously stored as `fathom_calls.recording_id` for Zoom recordings.
- **Fathom dedup key**: Used `String(recording_id)` (numeric Fathom call ID cast to string) as `external_id`. Consistent with how the pipeline stores all external IDs as strings in `source_metadata`.
- **Removed Zoom fingerprint dedup**: The existing fuzzy fingerprint dedup queried `fathom_calls` which is now a read-only VIEW. Removed entirely — the pipeline's exact `external_id` dedup is sufficient and prevents the broken VIEW query.
- **fathom_transcripts preserved**: Both Zoom and Fathom sync still insert transcript segments into `fathom_transcripts` as a non-blocking supplementary write. This maintains backward compatibility with any UI or queries that read from `fathom_transcripts`.
- **YouTube recordingId type**: Changed from `number` to `string` (UUID) in `ImportResponse`. Any frontend code that navigated using the numeric `recordingId` must now handle UUIDs — this is the correct behavior for the new recordings table.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zoom fingerprint dedup removal**
- **Found during:** Task 2 (Rewire Zoom sync)
- **Issue:** `findPotentialDuplicates()` queried `.from('fathom_calls')` with a time-window filter. Since `fathom_calls` is now a read-only VIEW, this query could return unexpected results. Additionally, the function called `handleDuplicateMerge()` which also wrote back to `fathom_calls` via `.update()` — both broken paths.
- **Fix:** Removed `findPotentialDuplicates()`, `handleDuplicateMerge()`, `updateMergedFrom()`, `shouldNewMeetingBePrimary()`, `reconstructFingerprint()`, and all fingerprint dedup imports (`generateFingerprint`, `generateFingerprintString`, `checkMatch`, etc.). The pipeline's `checkDuplicate()` provides correct dedup via `external_id`.
- **Files modified:** `supabase/functions/zoom-sync-meetings/index.ts`
- **Verification:** grep confirms zero `fathom_calls` references remain; `checkDuplicate()` used in `syncZoomMeeting()`
- **Committed in:** `314ad4b` (Task 2 commit)

**2. [Rule 1 - Bug] fetch-meetings sync-status query rewrite**
- **Found during:** Task 2 (checking all fathom_calls references)
- **Issue:** `fetch-meetings` queried `fathom_calls` to determine which meetings were already synced (used to show checkmarks in the UI). Since connectors no longer write to `fathom_calls`, this check would always return "not synced" for newly imported meetings.
- **Fix:** Replaced with `recordings` table query filtering `source_app='fathom'` and extracting `source_metadata.external_id` values to build the synced set.
- **Files modified:** `supabase/functions/fetch-meetings/index.ts`
- **Verification:** grep confirms no `fathom_calls` select queries remain; recordings query uses correct `source_metadata` path
- **Committed in:** `314ad4b` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs)
**Impact on plan:** Both auto-fixes required for correctness. Zoom fingerprint dedup removal was blocking (it would write back to the read-only VIEW). fetch-meetings fix was functionally required (UI sync indicators would all show "not synced" without it). No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three connectors are now on the shared pipeline — Plan 03 (file-upload connector) can follow the same `checkDuplicate()` + `insertRecording()` pattern
- `skipped_count` is tracked in `sync_jobs` for Plan 04 (Import Hub UI) to display "Skipped N duplicates" in completion toasts
- `recordings` table now receives all new imports from all connectors — Phase 18 (Import Routing Rules) can filter by `source_app` and `source_metadata` fields

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `supabase/functions/youtube-import/index.ts` — zero fathom_calls refs | CONFIRMED (grep count 0) |
| `supabase/functions/zoom-sync-meetings/index.ts` — zero fathom_calls writes | CONFIRMED (grep count 0) |
| `supabase/functions/sync-meetings/index.ts` — zero fathom_calls inserts | CONFIRMED (grep count 0) |
| `supabase/functions/fetch-meetings/index.ts` — zero fathom_calls inserts | CONFIRMED (grep count 0) |
| All 3 write connectors import connector-pipeline | CONFIRMED |
| `checkDuplicate` used in all 3 write connectors | CONFIRMED |
| `insertRecording` used in all 3 write connectors | CONFIRMED |
| `skipped_count` tracked in zoom-sync-meetings | CONFIRMED (3 occurrences) |
| `skipped_count` tracked in sync-meetings | CONFIRMED (4 occurrences) |
| `EdgeRuntime.waitUntil` preserved in zoom-sync-meetings | CONFIRMED (1 occurrence) |
| `sync_jobs` progress tracking preserved in zoom-sync-meetings | CONFIRMED (4 occurrences) |
| Task 1 commit `1b6f644` exists | CONFIRMED |
| Task 2 commit `314ad4b` exists | CONFIRMED |

---
*Phase: 17-import-connector-pipeline*
*Completed: 2026-02-28*
