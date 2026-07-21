---
phase: 25-durable-selection
plan: 02
subsystem: ui
tags: [hook, zustand, reconciliation, selection, sync-status, tanstack-adjacent, client-state]

# Dependency graph
requires:
  - phase: 24-sync-status-foundation
    provides: canonical synced-signal reader (getSyncStatusForExternalIds) — reconciled against here
  - phase: 25-durable-selection
    plan: 01
    provides: useImportSelectionStore + getSelectionScopeKey/getSelectionEntryKey + dropSyncedIds/clearScope
provides:
  - useImportSelection — UI-shape-independent React hook wrapping the durable store
  - reconcile(externalIds) — synced auto-drop against Phase 24 canonical truth (SEL-01 second half)
  - scoped toggle / selectAllMatching / clearAllMatching / clearSelection / isSelected / count
  - no-clear-on-refetch guarantee (empty synced Map -> no-op) enforced by unit test
affects: [26 unified import surface, ImportSurface, SyncTab, Import tab]

# Tech tracking
tech-stack:
  added: []  # zero new packages — @testing-library/react + vitest + zustand already present
  patterns:
    - "Reconciliation hook: client INTENT (durable store) reconciled against server TRUTH (recordings reader); store is never the authority for 'synced'"
    - "Scope-slice selector subscription (useImportSelectionStore((s) => s.selectionsByScope[scopeKey])) — stable store-owned reference, no per-render object construction"
    - "reconcile reads CURRENT explicit selection via store.getState() at call time to avoid stale closures, then drops only the synced subset"

key-files:
  created:
    - src/hooks/useImportSelection.ts
    - src/hooks/__tests__/useImportSelection.test.ts
  modified: []

key-decisions:
  - "useSyncTabSelection refactor DEFERRED to Phase 26 — delegating its unsyncedSelected set to the new store is NOT a low-risk drop-in (it co-owns the legacy-number existingSelected set and is wired into the SyncTab render path); the plan's low-risk gate says default to NOT refactoring when uncertain"
  - "reconcile is a no-op on an empty synced Map (background refetch) — the clear-on-fetch bug (Anti-Pattern 1) cannot recur, unit-asserted"
  - "reconcile drops ONLY the intersection of (currently-selected) and (synced) ids — synced-but-unselected ids are ignored, all-matching descriptor never touched"
  - "externalIds forwarded to the Phase 24 reader as STRINGS — no parseInt/Number coercion (dual recording-ID rule); organizationId threaded so reconcile cannot read cross-org (T-25-04)"

patterns-established:
  - "Hook re-exposes store actions closed over a single scopeKey so consumers pass raw externalId strings, not entry keys — getSelectionEntryKey conversion is internal"
  - "clearSelection() docstring'd 'CALL ON JOB CREATION ONLY' — the single clear path, distinct from reconcile"

requirements-completed: [SEL-01, SEL-02]

# Metrics
duration: ~6min
completed: 2026-06-23
---

# Phase 25 Plan 02: useImportSelection Reconciliation Hook Summary

**The UI-shape-independent React hook that wraps the durable selection store and reconciles it against Phase 24's canonical `recordings` reader — selected calls that have become synced auto-drop (SEL-01), while a background refetch (empty synced Map) drops nothing, so the clear-on-fetch bug cannot recur.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-23T18:57Z
- **Completed:** 2026-06-23T19:03Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 2 created

## Accomplishments
- `useImportSelection({ sourceApp, dateStart, dateEnd, organizationId? })` computes a `scopeKey` and subscribes to only that scope's slice via a stable store-owned selector — no per-render object construction.
- Re-exposes ergonomic, scope-closed actions taking raw provider `externalId` strings: `toggle`, `selectAllMatching`, `clearAllMatching`, `clearSelection` (job-creation-only clear path), `isSelected`, and a `count` (number or `"all"`). `getSelectionEntryKey` conversion is internal so consumers never touch entry keys.
- `reconcile(externalIds)` is the SEL-01 auto-drop: it calls `getSyncStatusForExternalIds(sourceApp, externalIds, { organizationId })`, computes the subset of CURRENTLY-explicit-selected ids that are now synced, and calls `dropSyncedIds(scopeKey, syncedEntryKeys)`. It drops ONLY synced ids — never the whole selection, never the all-matching descriptor.
- No-clear-on-refetch guarantee: an empty synced Map short-circuits to a no-op (Anti-Pattern 1 cannot recur), unit-asserted.
- 5 unit tests (mocked Phase 24 reader, real jsdom store): synced auto-drop + remainder persists, empty-Map refetch drops nothing, all-matching descriptor survives, UUID + BIGINT-string reconcile with no coercion, and synced-but-unselected ids are ignored.
- `tsc -p tsconfig.app.json` reports zero errors in the new files.

## Task Commits

Each task committed atomically (TDD: test RED -> feat GREEN):

1. **Task 2 RED: failing tests** - `4d582be` (test)
2. **Task 1 GREEN: hook implementation** (+ Task 2 gate-fix) - `166b397` (feat)

_TDD note: the test file (Task 2) was authored first as the RED contract (module-not-found failure), then the hook (Task 1) made all 5 GREEN. A small test-formatting fix (vi.spyOn on one line) landed in the same GREEN commit to satisfy a literal grep acceptance gate._

## Files Created/Modified
- `src/hooks/useImportSelection.ts` (183 lines) — the reconciliation hook: scope-slice subscription, scoped actions, `reconcile()` synced-drop, optional `useReconcileOnIds` effect wrapper.
- `src/hooks/__tests__/useImportSelection.test.ts` (206 lines) — 5 tests via `renderHook`, mocking `getSyncStatusForExternalIds` with `vi.spyOn`; covers every `<behavior>` bullet.

## Decisions Made

### Required by `<output>`: useSyncTabSelection refactor decision

**DEFERRED to Phase 26.** The plan's REFACTOR DECISION is gated on the change being a SMALL, mechanical, non-behavior-changing drop-in. It is not:
- `useSyncTabSelection.ts` co-owns a second selection set, `existingSelected: (number | string)[]`, keyed by canonical recording UUID with legacy numbers tolerated — exactly the "legacy-number set" the plan names as a do-not-touch trigger.
- It is wired directly into the SyncTab render path (`toggleUnsynced`, `selectAllUnsynced`, `clearUnsynced`, plus the `existing*` verbs), so delegating its `unsyncedSelected` set to the new store would touch that render path.
- Its `selectAllUnsynced(visible)` / `selectAllExisting(visible)` semantics enumerate the visible `Meeting[]` — a different shape from the new store's filter-descriptor all-matching (SEL-02), so the swap is not mechanical.

The plan instruction is explicit: "Default to NOT refactoring if uncertain; this phase's contract is the store+hook+reconciliation+tests, not the wiring." Phase 26's `<ImportSurface>` owns the wiring swap. No behavior changed in `useSyncTabSelection` this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reformatted `vi.spyOn` onto one line to satisfy a literal grep acceptance gate**
- **Found during:** Task 2 acceptance verification
- **Issue:** Acceptance gate `grep -c 'vi.mock\|vi.spyOn' >= 1`. My `mockReaderReturning` helper called `vi` on one line and `.spyOn(...)` on the next (prettier-style wrap), so the literal single-line grep read 0 — a false negative; the reader WAS mocked.
- **Fix:** Rewrote the helper to `const spy = vi.spyOn(...); spy.mockResolvedValue(synced); return spy;` — same behavior, `vi.spyOn` now on one line.
- **Files modified:** src/hooks/__tests__/useImportSelection.test.ts
- **Verification:** gate now reads 1; 5/5 tests still green; tsc still clean.
- **Committed in:** 166b397

---

**Total deviations:** 1 auto-fixed (Rule 1 — grep-gate formatting false negative, same class as Plan 01).
**Impact on plan:** None on behavior. Hook public API and reconciliation semantics match the plan exactly.

## Issues Encountered
- RTK blanks vitest/tsc output and (when project filters are untrusted) injects warning lines into `grep -c` output — ran all verification via `rtk proxy` and confirmed grep counts with `/usr/bin/grep` directly, as the plan warned.
- Project-wide `tsc -p tsconfig.app.json` reports 319 PRE-EXISTING errors across unrelated files (baseline). Zero are in the new files (Scope Boundary — not in scope to fix).

## Known Stubs
None. The hook is fully wired; the consuming `<ImportSurface>` (Phase 26) is out of scope.

## Threat Flags
None. The hook introduces no new network surface — it reads through the existing Phase 24 owner/org-scoped reader and threads `organizationId` (T-25-04 mitigation present). "Synced" is read only from `recordings`, never from the persisted store (T-25-05). No new packages (T-25-SC).

## User Setup Required
None — pure client logic, no external service config, no new packages, no DB/prod/migration contact.

## Next Phase Readiness
- Phase 26's `<ImportSurface>` can consume `useImportSelection` directly for BOTH the Import tab and the Sync tab: pass `sourceApp` + date bounds, render rows from `searchAvailable`, call `toggle(externalId)` / `selectAllMatching(filter)`, read `isSelected` / `count`, call `reconcile(visibleExternalIds)` after each search returns, and call `clearSelection()` ONLY on job creation.
- The `useSyncTabSelection` -> store delegation is the wiring swap Phase 26 performs (deferred, rationale above).
- SEL-01 (durable + synced-auto-drop) and SEL-02 (all-matching descriptor) are now both complete across Plans 01+02.

## Self-Check: PASSED

- FOUND: src/hooks/useImportSelection.ts
- FOUND: src/hooks/__tests__/useImportSelection.test.ts
- FOUND: .planning/phases/25-durable-selection/25-02-SUMMARY.md
- FOUND commits: 4d582be (test RED), 166b397 (feat GREEN)

---
*Phase: 25-durable-selection*
*Completed: 2026-06-23*
