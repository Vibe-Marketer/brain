---
phase: 06-launch-ux-support-rls-hygiene
plan: 06
subsystem: ui
tags: [fathom, sync-tab, connector-import, resync]
requires:
  - phase: 06-launch-ux-support-rls-hygiene
    provides: first-run import flow, support surface, and billing gates from plans 06-01..06-05
provides:
  - Fathom `updated_remotely` detection in fetch payloads for imported calls with changed provider titles
  - Sync-tab UI state, badge, and confirmation flow to apply Fathom title updates intentionally
  - UUID-only client path for `fathom-refresh` resync calls
affects: [sync-tab, fathom-refresh, import-flow]
tech-stack:
  added: []
  patterns:
    - Sync-state modeled as `available` | `imported` | `updated_remotely` across edge payload, adapter, and orchestration
    - Hook-layer cache invalidation after provider refresh mutations via `invalidateCallListCaches`
key-files:
  created: []
  modified:
    - supabase/functions/fetch-meetings/index.ts
    - src/components/connectors/registry/types.ts
    - src/components/connectors/registry/adapters/fathom.ts
    - src/hooks/useMeetingsSync.ts
    - src/hooks/useSyncTabOrchestration.ts
    - src/components/transcripts/UnsyncedMeetingsSection.tsx
    - src/components/transcript-library/TranscriptTableRow.tsx
    - src/components/transcripts/SyncTab.tsx
    - src/services/sync-tab.service.ts
    - src/types/meetings.ts
key-decisions:
  - "Ship title-change detection first for Fathom remote updates; transcript/duration-change detection remains deferred."
  - "Keep mixed selection safe by splitting `Sync Selected` and `Apply updates` instead of forcing a combined action."
patterns-established:
  - "Remote-updated calls stay visible in unsynced fetch results even when already imported."
  - "Fathom resync requires canonical UUID `recording_id` at client service boundary."
requirements-completed: [ONB-01]
duration: 4min
completed: 2026-06-01
---

# Phase 06 Plan 06: Launch UX Support RLS Hygiene Summary

**Fathom imported calls with provider-title drift now surface as `Updated remotely`, with an explicit confirmation flow to apply updates without duplicating calls or mutating local placement metadata.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-06-01T06:39:08Z
- **Completed:** 2026-06-01T06:42:32Z
- **Tasks:** 4
- **Files modified:** 10

## Accomplishments
- Extended `fetch-meetings` to emit `sync_state`, `recording_uuid`, `local_title`, and `remote_title`, deriving `updated_remotely` from title-only comparison for active imported rows.
- Carried remote-update state through connector types/adapters and Sync-tab orchestration, preserving visibility of remote-updated rows and adding refresh action plumbing.
- Added Sync-tab UX for remote updates: `Updated remotely` badge, `Apply updates` action mode, and title confirmation with `Current title` / `Fathom title`.
- Enforced UUID-only `recording_id` when invoking `fathom-refresh` from the Sync-tab service path.

## Task Commits

1. **Task 1: Return Fathom remote-change metadata from meeting fetch** - `3945698a` (feat)
2. **Task 2: Extend connector/client types and Fathom adapter for resync state** - `4a49f934` (feat)
3. **Task 3: Render `Updated remotely` rows and apply selected updates** - `18c7ec8e` (feat)
4. **Task 4: Verify local association preservation on Fathom refresh** - `ab9f69e0` (fix)

## Files Created/Modified
- `supabase/functions/fetch-meetings/index.ts` - Adds Fathom sync-state metadata and title-drift detection.
- `src/components/connectors/registry/types.ts` - Adds typed sync state and resync metadata fields.
- `src/components/connectors/registry/adapters/fathom.ts` - Maps edge payload state/UUID/title metadata into `AvailableCall`.
- `src/hooks/useSyncTabOrchestration.ts` - Keeps `updated_remotely` rows visible and adds apply-updates orchestration with hook-layer cache invalidation.
- `src/components/transcripts/UnsyncedMeetingsSection.tsx` - Adds action-copy switching and update-confirmation dialog.
- `src/components/transcript-library/TranscriptTableRow.tsx` - Renders `Updated remotely` badge in unsynced view.
- `src/services/sync-tab.service.ts` - Adds `fathom-refresh` invoker and UUID validation guard for recording IDs.

## Decisions Made
- Implemented title-only change detection in this plan (no transcript/duration change detection path added).
- Preserved local association safety by retaining existing `fathom-refresh` update-column boundaries and adding UUID input hardening at the client service boundary.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added UUID boundary validation before `fathom-refresh` invoke**
- **Found during:** Task 4
- **Issue:** Sync-tab service could theoretically forward non-UUID IDs to `fathom-refresh`, violating the canonical UUID boundary requirement.
- **Fix:** Added UUID format validation in `invokeFathomRefreshForSyncTab()` and fail-fast error.
- **Files modified:** `src/services/sync-tab.service.ts`
- **Verification:** `rg -n "fathom-refresh requires canonical UUID recording_id|recording_id" src/services/sync-tab.service.ts`
- **Commit:** `ab9f69e0`

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Required correctness hardening only; no scope creep.

## Issues Encountered
None.

## Authentication Gates
None.

## Known Stubs
None.

## Threat Flags
None.

## Verification
- `rg -n "sync_state|updated_remotely|recording_uuid|local.*title|remote.*title" supabase/functions/fetch-meetings/index.ts` ✅
- `rg -n "updated_remotely|syncState|recordingUuid|fathom-refresh|recording_id" src/components/connectors src/hooks/useSyncTabOrchestration.ts src/services/sync-tab.service.ts` ✅
- `rg -n "Updated remotely|Apply updates|Current title|Fathom title|Update from Fathom|Keep current title" src/components src/hooks && npm run build` ✅
- `rg -n "organization_id|owner_user_id|workspace_entries|folder_assignments|call_tag_assignments|call_notes|title|full_transcript|duration" supabase/functions/fathom-refresh/index.ts` ✅

## Next Phase Readiness
- Plan `06-06` implementation is complete and verified.
- Title-only remote-change detection shipped; transcript/duration change detection remains intentionally deferred.

## Self-Check: PASSED
