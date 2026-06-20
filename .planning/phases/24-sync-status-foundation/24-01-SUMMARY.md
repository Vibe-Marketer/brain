---
phase: 24-sync-status-foundation
plan: 01
subsystem: api
tags: [supabase, recordings, sync-status, source_call_id, react-hooks, idempotency]

# Dependency graph
requires:
  - phase: pre-24 (v2.0 codebase)
    provides: recordings.(source_app, source_call_id) TEXT columns, connector-pipeline checkDuplicate pattern, sync_jobs.error column
provides:
  - getSyncStatusForExternalIds — single canonical, provider-agnostic synced-signal reader on recordings.(source_app, source_call_id) as TEXT, no numeric coercion
  - SyncTab synced-signal rewired off the Fathom-only parseInt path
  - cancelSyncJob writes the real sync_jobs.error column
affects: [25-durable-selection, 26-unified-import-surface, 27-observable-jobs, 28-server-side-sync-all, 29-partial-success-retry]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Canonical-read / source-detail-write: status read only from recordings; provider tables (fathom_calls) demoted to write-only detail"
    - "External ids kept as TEXT end to end across the React-hook -> service -> recordings boundary (no parseInt/Number coercion)"

key-files:
  created:
    - src/services/sync-status.service.ts
    - src/services/__tests__/sync-status.service.test.ts
  modified:
    - src/hooks/useSyncTabStateBridge.ts
    - src/hooks/useSyncTabState.ts
    - src/services/sync-tab.service.ts

key-decisions:
  - "Thread sourceApp through the checkSyncStatus contract and pass the literal \"fathom\" at the single invocation (SyncTab is Fathom-only today; no orchestration sourceApp exists to derive)"
  - "Reader is owner_user_id-scoped with an optional organizationId filter (parity with connector-pipeline checkDuplicate)"
  - "Unit test is a pure-source assertion (reads the file via node:fs) — proves absence of numeric coercion without a DB mock, per RESEARCH Wave 0 gaps"

patterns-established:
  - "Canonical synced-signal reader: getSyncStatusForExternalIds(sourceApp, externalIds, opts?) -> Map<source_call_id, { recordingUuid, hasWorkspaceEntries }>"
  - "Source-grep invariant test guards against regressing the parseInt-on-id bug class"

requirements-completed: [IMP-01]

# Metrics
duration: 9min
completed: 2026-06-20
---

# Phase 24 Plan 01: Sync-Status Foundation Summary

**Single canonical provider-agnostic synced-signal reader on `recordings.(source_app, source_call_id)` as TEXT (no coercion), replacing the Fathom-only `parseInt` path that silently dropped every UUID-id provider; plus the `cancelSyncJob` `error`-column fix.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-06-20T06:17:54Z
- **Completed:** 2026-06-20T06:26:20Z
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- New `getSyncStatusForExternalIds(sourceApp, externalIds, opts?)` reader queries `recordings` with `.in("source_call_id", externalIds)` — ids stay strings, so Zoom (UUID), Fathom (BIGINT-as-string), and pasted recordings all resolve from one query.
- Batched `workspace_entries` existence check surfaces the re-importable signal (`hasWorkspaceEntries`), mirroring `connector-pipeline.checkDuplicate`.
- Rewired the single broken call site: `checkSyncStatus` now takes a leading `sourceApp` arg threaded through the bridge, the `UseSyncTabStateProps` interface, and the one invocation (passing literal `"fathom"`).
- Deleted the Fathom-only `checkSyncedRecordingIds` (the `Number.parseInt(externalId)` bug) — zero dangling references.
- Fixed the latent `cancelSyncJob` bug: writes the real `error` column instead of the nonexistent `error_message` (PostgREST was silently dropping it).

## Task Commits

1. **Task 1 (RED): failing source-assertion test** - `d1e93e0` (test)
2. **Task 1 (GREEN): getSyncStatusForExternalIds reader** - `cafa7f3` (feat)
3. **Task 2: rewire call site + signature, delete old reader, fix error column** - `828ac94` (fix)

_TDD task 1 produced test -> feat commits; no refactor commit needed (clean first pass)._

## Files Created/Modified

- `src/services/sync-status.service.ts` - NEW: canonical reader on recordings.(source_app, source_call_id) TEXT, fail-open, owner-scoped + optional org filter.
- `src/services/__tests__/sync-status.service.test.ts` - NEW: pure-source unit assertions (no parseInt, no Number(, TEXT IN present, export present).
- `src/hooks/useSyncTabStateBridge.ts` - imports the new reader; checkSyncStatus now `(sourceApp, recordingIds)`.
- `src/hooks/useSyncTabState.ts` - UseSyncTabStateProps.checkSyncStatus gains a leading sourceApp arg; the single invocation passes `"fathom"`.
- `src/services/sync-tab.service.ts` - deleted checkSyncedRecordingIds; cancelSyncJob writes `error` not `error_message`.

## Decisions Made

- **sourceApp = literal "fathom" at the invocation.** Per RESEARCH and the interfaces block, no `source_app` value exists anywhere in `useSyncTabState.ts` / `useSyncTabOrchestration.ts` — SyncTab is Fathom-only today. Threading a non-existent "orchestration current sourceApp" was explicitly avoided; the contract is provider-agnostic but the call site passes the only provider it serves.
- **owner_user_id scope with optional org filter** for parity with `connector-pipeline.checkDuplicate`.
- **Pure-source unit test** (reads the service file via `node:fs`) rather than a DB mock — RESEARCH flagged that mocked tests passed for this exact bug class in the Phase 30/BUG-01 incident, so the absence-of-coercion guard is enforced at the source level. Real-DB cross-provider proof lands in Plan 04's integration test.

## Deviations from Plan

None — plan executed exactly as written. (The reader's docstring was worded to avoid the literal substrings `parseInt` / `Number(` so the source-grep gate and `grep -nE "parseInt|Number\("` acceptance criterion stay clean; this is a wording choice within the planned files, not a scope change.)

## Issues Encountered

- **RTK was filtering vitest/tsc/grep output to "PASS (0) FAIL (0)"** (untrusted project filters at `.rtk/filters.toml`, not enabled). Worked around by running verification through `rtk proxy` (unfiltered passthrough) — no functional impact.

## Verification

- `npx vitest run src/services/__tests__/sync-status.service.test.ts` — 4/4 pass.
- `grep -nE "parseInt|Number\("` src/services/sync-status.service.ts — no matches (exit 1).
- `grep -c 'in("source_call_id"'` — 1; `grep -c "export async function getSyncStatusForExternalIds"` — 1.
- `grep -rn "checkSyncedRecordingIds" src/` — no matches (exit 1).
- `grep -c 'checkSyncStatusRef.current("fathom"' src/hooks/useSyncTabState.ts` — 1.
- `grep -c "sourceApp: string, recordingIds: string[]" src/hooks/useSyncTabState.ts` — 1.
- `grep -vE '^\s*//' src/services/sync-tab.service.ts | grep -c "error_message"` — 0; `grep -c 'error: "Cancelled by user"'` — 1.
- `tsc -p tsconfig.app.json`: all 24-01 files (sync-status.service.ts, useSyncTabStateBridge.ts, and the changed checkSyncStatus prop+invocation) report ZERO errors. The signature change propagated cleanly.

## Out-of-Scope (Deferred)

Pre-existing `tsc`/unit failures in files NOT touched by this plan were logged to
`.planning/phases/24-sync-status-foundation/deferred-items.md` and left untouched
(SCOPE BOUNDARY): panelStore/preferencesStore/types tsc errors; pre-existing
SyncTab.tsx / SyncTabDialogs.tsx / useSyncTabState polling-loop / sync-tab.service
fetchSyncedCalls TS2589 errors; and 5 unrelated failing unit-test files
(rpc-type-smoke, MCP-settings x3, TranscriptsTab.batching). None reference the
sync-status / sync-tab / SyncTab modules changed here.

## Next Phase Readiness

- IMP-01 reader is the foundation the rest of Phase 24 builds on: IMP-02 (constraint regression test + NULL backfill), IMP-03 (additive `sync_jobs` migration), IMP-04 (orphan reconciliation + real-DB test).
- Plan 04's real-DB integration test still owes the cross-provider proof (Zoom UUID + Fathom BIGINT-string + paste all synced=true from one query) after `supabase db push`.

## Self-Check: PASSED

- FOUND: src/services/sync-status.service.ts
- FOUND: src/services/__tests__/sync-status.service.test.ts
- FOUND: .planning/phases/24-sync-status-foundation/24-01-SUMMARY.md
- FOUND commit: d1e93e0 (test)
- FOUND commit: cafa7f3 (feat)
- FOUND commit: 828ac94 (fix)

---
*Phase: 24-sync-status-foundation*
*Completed: 2026-06-20*
