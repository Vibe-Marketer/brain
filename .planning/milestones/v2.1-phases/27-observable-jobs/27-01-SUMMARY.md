---
phase: 27-observable-jobs
plan: 01
subsystem: ui
tags: [react, realtime, supabase, sync-jobs, hook, postgres_changes, tdd]

requires:
  - phase: 24-sync-status-foundation
    provides: additive sync_jobs columns (source_app, organization_id, TEXT[] id arrays, status enum), org-scoped RLS, sync_jobs in supabase_realtime + CROSS_ORG_TABLES
  - phase: 26-unified-import-surface
    provides: shared <ImportSurface sourceApp organizationId> both Import + Sync tabs render; PRESERVED useSyncTabState.ts as the lift source
provides:
  - "src/hooks/useSyncJobs.ts — one shared Realtime+poll sync-jobs hook returning activeJobs/terminalJobs as string-id SyncJob[]"
  - "string[] id typing end-to-end (recording_ids/synced_ids/failed_ids) matching live TEXT[] columns"
  - "client-side source_app + organizationId narrowing on top of user-OR-org RLS (no hardcoded 'fathom')"
  - "removal of the 8s terminal-job auto-dismiss — failed/completed_with_errors persist until explicit dismissal"
affects: [27-03 (SyncJobBanner consumes activeJobs/terminalJobs), 27-02 (heartbeat/reaper writes the rows this reads), 29 (partial-success uses failed_ids)]

tech-stack:
  added: []
  patterns:
    - "Hybrid Realtime-primary + polling-fallback subscription lifted to a provider-agnostic hook"
    - "Scope predicate held in a ref so source_app/org narrowing updates without re-subscribing the channel"
    - "DELETE Realtime events only drop locally; INSERT/UPDATE drive status truth (RLS-bypass safe)"

key-files:
  created:
    - src/hooks/useSyncJobs.ts
    - src/hooks/__tests__/useSyncJobs.test.ts
  modified: []

key-decisions:
  - "Channel keeps user_id=eq as the ONLY postgres_changes predicate; source_app/org narrowing is client-side ON TOP of RLS (the real isolation boundary), per RESEARCH Pattern 1"
  - "Dropped the SyncTab-specific removeNewlySyncedMeetings/processedSyncedIdsRef + Set<number> logic entirely — out of this hook's responsibility and the source of the numeric-coercion landmine"
  - "Cast poll result via `as unknown as SyncJob[]` — generated supabase row type (metadata: Json, fewer columns) is structurally close but not directly assignable; ids remain opaque strings, no coercion"
  - "Legacy NULL-org rows stay visible when organizationId is set (matches OR-combined RLS)"

patterns-established:
  - "Pattern 1: One shared hook feeds both <ImportSurface> tabs — durable DB-backed job state, not volatile per-surface useState"
  - "Pattern 2: Realtime is primary (10s backup poll while SUBSCRIBED); polling is fallback (2s on CLOSED/CHANNEL_ERROR); cleanup always removeChannel + clearInterval"

requirements-completed: [JOB-01, JOB-03, JOB-04]

duration: ~15min
completed: 2026-06-23
---

# Phase 27 Plan 01: Shared useSyncJobs Hook Summary

**One shared Realtime+poll `useSyncJobs({ sourceApp, organizationId })` hook returning string-id `activeJobs`/`terminalJobs` from `sync_jobs`, fixing the number[]→string[] and hardcoded-"fathom" carry-forwards and deleting the 8s terminal auto-dismiss.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-06-23
- **Tasks:** 2 (TDD: RED then GREEN)
- **Files modified:** 2 (both created)

## Accomplishments
- JOB-01: a single provider-agnostic hook both the Import tab and Sync tab `<ImportSurface>` instances can consume for refresh-surviving, observable job status.
- JOB-04: lifted the proven hybrid Realtime `postgres_changes` subscription (primary) + polling fallback (10s backup while SUBSCRIBED, 2s on CLOSED/CHANNEL_ERROR) with proper `removeChannel` + `clearInterval` cleanup.
- JOB-03: removed the unconditional 8-second `recentlyCompletedJobs` auto-dismiss — `failed`/`completed_with_errors` jobs now persist in `terminalJobs` until explicit dismissal (owned by the Plan 27-03 banner).
- Fixed the two Phase-26 carry-forward landmines: id arrays are `string[]` end-to-end (no `parseInt`/`Number`/`Set<number>`), and rows are filtered by the real per-surface `source_app` + `organizationId` (no hardcoded `"fathom"`).

## Task Commits

Each task was committed atomically (TDD):

1. **Task 1: Wave 0 RED — useSyncJobs unit test scaffold** - `44c783e3` (test)
2. **Task 2: GREEN — implement useSyncJobs** - `7a20c8d8` (feat)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified
- `src/hooks/useSyncJobs.ts` - Shared Realtime+poll sync-jobs hook; exports `SyncJob` interface (string[] id arrays) and `useSyncJobs({ sourceApp, organizationId })` returning `{ activeJobs, terminalJobs }`.
- `src/hooks/__tests__/useSyncJobs.test.ts` - 5 unit tests: source_app filter, string-id passthrough, no-8s-dismiss for failures, channel lifecycle (subscribe + removeChannel on unmount), 2000ms poll fallback on CHANNEL_ERROR. Uses a `vi.hoisted` mock supabase client (thenable query chain + capturable channel/subscribe).

## Decisions Made
- Kept `user_id=eq` as the single channel predicate; narrowed source_app/org client-side on top of RLS (RESEARCH Pattern 1). RLS user-OR-org is the isolation boundary; the client filter is UI scoping only.
- Held the scope predicate in `matchesScopeRef` so changing `sourceApp`/`organizationId` re-narrows results without tearing down and re-subscribing the Realtime channel.
- Dropped the SyncTab-specific meeting-removal machinery (`removeNewlySyncedMeetings`, `processedSyncedIdsRef`, `Set<number>`) — it carried the numeric-coercion bug and is not this hook's responsibility.
- Cast the poll result via `as unknown as SyncJob[]` (per tsc guidance) because the generated supabase row type does not sufficiently overlap with `SyncJob`; ids stay opaque strings.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vi.mock hoisting TDZ + tsc cast**
- **Found during:** Task 2 (GREEN)
- **Issue:** (a) The first test draft referenced top-level spy consts inside the hoisted `vi.mock` factory → "Cannot access 'removeChannelSpy' before initialization". (b) `tsc -p tsconfig.app.json` flagged a non-overlapping cast from the generated `sync_jobs` row type to `SyncJob`.
- **Fix:** (a) Moved shared mutable state + spies into `vi.hoisted(() => ({...}))` and referenced them as `h.*` inside the factory. (b) Cast the poll result through `unknown` first, with a comment noting ids remain opaque strings.
- **Files modified:** src/hooks/__tests__/useSyncJobs.test.ts, src/hooks/useSyncJobs.ts
- **Verification:** 5/5 tests green; `tsc -p tsconfig.app.json --noEmit` reports zero errors referencing `useSyncJobs.ts`.
- **Committed in:** `7a20c8d8` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — test/typing mechanics, not behavior).
**Impact on plan:** No scope creep. Hook behavior matches the plan contract exactly.

## Issues Encountered
- None beyond the blocking test/typing mechanics above.

## Grep / Build Gates (verified)
- `grep '"fathom"\|parseInt\|Number(\|Set<number>'` on `useSyncJobs.ts` → 0 matches.
- `removeChannel` present (1) and `clearInterval` present (3) in cleanup path.
- `tsc -p tsconfig.app.json --noEmit` → zero errors referencing `useSyncJobs.ts` (pre-existing unrelated errors in other files deferred per 26-04).
- `rtk proxy npx vitest run src/hooks/__tests__/useSyncJobs.test.ts` → 5 passed.

## Threat Model Compliance
- **T-27-01-I (info disclosure):** channel `user_id=eq` filter + RLS retained as the isolation boundary; source_app/org narrowing is additive client-side scoping, never a substitute.
- **T-27-01-I2 (DELETE bypasses RLS):** DELETE events only drop a row locally; status truth is driven by INSERT/UPDATE only.
- **T-27-01-T (id coercion):** ids stay opaque `string[]`; grep gate confirms no `parseInt`/`Number`/`Set<number>`.

## Next Phase Readiness
- `useSyncJobs` is ready for Plan 27-03 to consume (`activeJobs`/`terminalJobs`) for the sticky-failure banner + per-provider chips.
- Plan 27-02 writes the heartbeat/reaper rows this hook reads — no client change needed there.
- This plan did NOT mount the hook in `<ImportSurface>` (27-03) and did NOT touch the DB/edge function (27-02), per scope.

## Self-Check: PASSED
- FOUND: src/hooks/useSyncJobs.ts
- FOUND: src/hooks/__tests__/useSyncJobs.test.ts
- FOUND commit: 44c783e3 (RED)
- FOUND commit: 7a20c8d8 (GREEN)

---
*Phase: 27-observable-jobs*
*Completed: 2026-06-23*
