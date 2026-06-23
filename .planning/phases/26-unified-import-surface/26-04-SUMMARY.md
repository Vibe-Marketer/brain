---
phase: 26-unified-import-surface
plan: 04
subsystem: ui
tags: [react, import-surface, connectors, dead-code-deletion, fork-collapse, boot-gate, tbl-03]

# Dependency graph
requires:
  - phase: 26-03
    provides: "Both consumers (ImportPage connector branch + Sync tab via SyncImportSurface) rewired to the shared <ImportSurface>; the fork left on disk for this delete wave"
provides:
  - "TBL-03 COMPLETE: the forked ConnectorImportWizard + the duplicate useSyncTab* selection/orchestration/bridge hooks + the folded sections are deleted; nothing imports them"
  - "connectorSearch.ts KEPT as a live <ImportSurface> dependency (find-new paging) — documented, never a dangling import"
  - "Boot-crash gate GREEN against the committed tree (npm run build exit 0 + OAUTH_CALLBACK_ROUTES non-empty)"
affects: [27-job-status (owns the PRESERVED SyncStatusIndicator / ActiveSyncJobsCard / useSyncTabState; MUST fix the useSyncTabState.ts hardcoded "fathom" carry-forward)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Leaf-first dead-code deletion: delete consumers before their dependencies; keep a shared helper (connectorSearch) when a surviving consumer (ImportSurface) still imports it — never delete to a dangling import"
    - "Coverage migration before deletion: migrate the deleted module's still-relevant assertions onto the replacement (<ImportSurface>) before removing the old test"
    - "Source-read regression guard: assert the deleted symbol's ABSENCE (.not.toMatch) in the consumer's source so a future reintroduction fails the test"

key-files:
  created:
    - src/components/import/__tests__/ImportSurface.capabilities.test.ts
    - .planning/phases/26-unified-import-surface/deferred-items.md
  modified:
    - src/pages/ImportPage.tsx
    - src/pages/TranscriptsNew.tsx
    - src/pages/__tests__/ImportPage.connector-routing.test.ts
    - src/stores/importSelectionStore.ts
    - src/hooks/useSyncTabState.ts
    - src/components/import/ImportSurface.tsx

key-decisions:
  - "connectorSearch.ts KEPT (not deleted): ImportSurface.tsx:53 imports searchAllAvailableConnectorCalls for find-new paging — a live dependency (Pitfall 3 / plan Task 2 conditional). Its test kept too."
  - "Deleted the now-orphaned SyncTabDialogs.tsx (not enumerated in the plan): its sole consumer was the deleted SyncTab.tsx, so it is dead code directly caused by this wave (Rule 3)."
  - "Migrated wizard capability-gating coverage to a new ImportSurface.capabilities.test.ts before deleting ConnectorImportWizard.capabilities.test.ts — no loss of capability coverage."
  - "Annotated useSyncTabState.ts:202 hardcoded sourceApp \"fathom\" carry-forward for Phase 27 (file PRESERVED) with an in-code comment AND in this summary."

patterns-established:
  - "Pattern: delete a shared helper ONLY after ALL consumers are gone; keep it if any survivor imports it (verify by import-statement grep, not substring)"
  - "Pattern: prove no-new-failures by running the full suite against HEAD~1 in a detached worktree and diffing the failure counts"

requirements-completed: [TBL-03]

# Metrics
duration: 15min
completed: 2026-06-23
---

# Phase 26 Plan 04: Unified Import Surface — Delete the Superseded Fork Summary

**The forked `ConnectorImportWizard`, the duplicate `useSyncTab*` selection/orchestration/bridge hooks, the folded sections, and the now-orphaned `SyncTabDialogs` are deleted (≈2,975 lines removed) behind a GREEN boot-crash gate; `connectorSearch.ts` is kept as a live `<ImportSurface>` dependency, and the job-status UI + `useSyncTabState` are preserved for Phase 27.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-06-23T20:29:29Z
- **Completed:** 2026-06-23T20:44:xxZ
- **Tasks:** 2 (Task 1 delete + coverage migration; Task 2 connectorSearch decision + [BLOCKING] gates)
- **Files:** 12 deleted, 6 modified, 2 created

## Accomplishments

- **TBL-03 — fork deleted (Task 1):** removed `ConnectorImportWizard.tsx` (+ its 2 tests), `SyncTab.tsx` (+ `SyncTab.registry.test.ts`), the folded sections `UnsyncedMeetingsSection.tsx` (+ registry test) and `SyncedTranscriptsSection.tsx`, the now-orphaned `SyncTabDialogs.tsx`, and the fork hooks `useSyncTabSelection.ts` / `useSyncTabOrchestration.ts` / `useSyncTabStateBridge.ts`. 12 files, ≈2,975 deletions. Removed the dead `ConnectorImportWizard` import from `ImportPage.tsx`. Verified zero remaining **import statements** for any deleted module.
- **Coverage migrated, not lost:** created `src/components/import/__tests__/ImportSurface.capabilities.test.ts` (4 tests, green) carrying the wizard's capability-gating coverage (`getConnectorCapabilities`, `canSearchAvailable`/`canImportSelected`, the "imports automatically" card, `ConnectorSetupCluster`) onto `<ImportSurface>` before deleting the wizard's capabilities test. Updated `ImportPage.connector-routing.test.ts` to assert `<ImportSurface>` AND guard the wizard's absence (`.not.toMatch(/ConnectorImportWizard/)`).
- **connectorSearch.ts KEPT (Task 2):** `ImportSurface.tsx:53` imports `searchAllAvailableConnectorCalls` for its find-new paging (the "self-contained paging after fork removal" key-link) and `ImportSurface.syncStatus.test.tsx` mocks it — a live dependency, so it and its test are kept (Pitfall 3 / plan Task 2 conditional). No dangling import.
- **PRESERVED for Phase 27:** `SyncStatusIndicator.tsx`, `ActiveSyncJobsCard.tsx`, `useSyncTabState.ts` all on disk. No preserved file imported a deleted hook, so no import severing was needed.
- **[BLOCKING] boot gate GREEN:** `npm run build` exit 0 (built in 13.73s; only the pre-existing >500kB chunk-size warning), `oauth-callback-routing.test.ts` 10/10 (`OAUTH_CALLBACK_ROUTES` non-empty against the committed tree), `npm run lint:docs` clean. No white-screen risk from the deletions.

## Task Commits

1. **Task 1: Delete forked wizard + useSyncTab* fork plumbing + migrate coverage** — `e9d5cba2` (refactor)
2. **Task 2: connectorSearch kept (live dep) + [BLOCKING] build/OAuth/lint/suite gates** — verification-only; no source change (connectorSearch is kept as-is). Recorded via the docs/metadata commit below.

**Plan metadata:** see the final `docs(26-04)` commit (SUMMARY + STATE + ROADMAP + REQUIREMENTS + deferred-items + 26-RESEARCH).

## Files Created/Modified

- `src/components/import/__tests__/ImportSurface.capabilities.test.ts` (NEW) — migrated capability-gating coverage (4 tests).
- `.planning/phases/26-unified-import-surface/deferred-items.md` (NEW) — pre-existing baseline failures + pre-existing tsc errors (out of scope).
- `src/pages/ImportPage.tsx` (MOD) — removed dead `ConnectorImportWizard` import; refreshed the connector-branch comment.
- `src/pages/TranscriptsNew.tsx` (MOD) — refreshed the sync-tab comment (fork deleted, not "remains on disk").
- `src/pages/__tests__/ImportPage.connector-routing.test.ts` (MOD) — asserts `<ImportSurface>` + guards wizard absence.
- `src/stores/importSelectionStore.ts` (MOD) — comments no longer name the deleted wizard/hook files.
- `src/hooks/useSyncTabState.ts` (MOD, PRESERVED) — added the Phase 27 carry-forward annotation comment at the `"fathom"` literal (line ~202).
- `src/components/import/ImportSurface.tsx` (MOD) — comment de-references the deleted `UnsyncedMeetingsSection`.
- **Deleted (12):** `ConnectorImportWizard.tsx`, `ConnectorImportWizard.test.tsx`, `ConnectorImportWizard.capabilities.test.ts`, `SyncTab.tsx`, `SyncTab.registry.test.ts`, `UnsyncedMeetingsSection.tsx`, `UnsyncedMeetingsSection.registry.test.ts`, `SyncedTranscriptsSection.tsx`, `SyncTabDialogs.tsx`, `useSyncTabSelection.ts`, `useSyncTabOrchestration.ts`, `useSyncTabStateBridge.ts`.

## Decisions Made

- **connectorSearch.ts KEPT as a live dependency.** Plan Task 2 made deletion conditional on ImportSurface NOT importing it. `ImportSurface.tsx:53` does import `searchAllAvailableConnectorCalls`, so it stays (along with `connectorSearch.test.ts`, 3/3 green). This is the documented "kept-as-live-dependency" outcome, never a dangling import.
- **Deleted the orphaned SyncTabDialogs.tsx** (not in the plan's deletion list). Its only consumer (verified at HEAD: 2 references) was the deleted `SyncTab.tsx`; nothing else imports it. It is dead code directly caused by the SyncTab deletion — a Rule 3 cleanup, NOT in the preserve list.
- **Migrated capability coverage before deleting the wizard's test.** The wizard's `capabilities.test.ts` asserted `getConnectorCapabilities` usage; `<ImportSurface>` owns that behavior but had no equivalent test. Added `ImportSurface.capabilities.test.ts` first (plan Task 1 action: "do not lose capability-gating coverage").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated ImportPage.connector-routing.test.ts assertion**
- **Found during:** Task 1
- **Issue:** The test asserted `source` matches `/ConnectorImportWizard/`, which would FAIL once the wizard import was removed from `ImportPage.tsx`.
- **Fix:** Rewrote the assertion to require `<ImportSurface>` and guard wizard absence (`.not.toMatch(/ConnectorImportWizard/)`), preserving the test's intent ("routes native connectors through the unified surface").
- **Files modified:** `src/pages/__tests__/ImportPage.connector-routing.test.ts`
- **Verification:** 6/6 tests pass.
- **Committed in:** `e9d5cba2`

**2. [Rule 3 - Blocking] Deleted now-orphaned SyncTabDialogs.tsx**
- **Found during:** Task 1 (post-deletion tsc surfaced it as orphaned dead code)
- **Issue:** `SyncTabDialogs.tsx`'s sole consumer was the deleted `SyncTab.tsx`; it became unreferenced dead code with pre-existing type errors.
- **Fix:** `git rm src/components/transcripts/SyncTabDialogs.tsx`. It imports no preserved module and nothing imports it.
- **Files modified:** deleted `src/components/transcripts/SyncTabDialogs.tsx`
- **Verification:** `grep -rln SyncTabDialogs src/` returns nothing.
- **Committed in:** `e9d5cba2`

**3. [Rule 3 - Cleanup] De-referenced deleted files from surviving comments**
- **Found during:** Task 1
- **Issue:** `importSelectionStore.ts`, `ImportSurface.tsx`, and `TranscriptsNew.tsx` carried comments naming the deleted wizard/hook/section files, leaving stale references that the TBL-03 acceptance grep would match.
- **Fix:** Rewrote the comments to describe the behavior without naming deleted files.
- **Files modified:** `src/stores/importSelectionStore.ts`, `src/components/import/ImportSurface.tsx`, `src/pages/TranscriptsNew.tsx`
- **Verification:** the `ConnectorImportWizard|useSyncTab*` grep now only matches two intentional test references (the migration comment + the `.not.toMatch` regression guard).
- **Committed in:** `e9d5cba2`

---

**Total deviations:** 3 auto-fixed (all Rule 3 blocking/cleanup, all consequences of the planned deletions).
**Impact on plan:** No scope creep. Every change was a direct consequence of deleting the fork (a broken test, orphaned dead code, stale comments). connectorSearch kept exactly per the plan's conditional.

## Phase 27 Carry-Forward (REQUIRED ANNOTATION)

`src/hooks/useSyncTabState.ts` is **PRESERVED** for Phase 27 but still contains an **unfixed hardcoded `sourceApp: "fathom"`** at line ~202:

```ts
await checkSyncStatusRef.current("fathom", currentMeetings.map(m => m.recording_id));
```

The LIVE import path was fixed via the new `<ImportSurface>` overlay (real per-row `source_app` + `organizationId`), but THIS preserved file was NOT rewired. **Phase 27 MUST thread a real `source_app` (and `organizationId`) when it re-integrates `useSyncTabState` into the new surface** — otherwise non-Fathom rows read as unsynced forever (Pitfall 2 / CR-02 / WR-02). An in-code comment now flags this at the literal; do not let it stay silent.

## Known Stubs

None introduced. The hardcoded `"fathom"` in `useSyncTabState.ts:202` is a pre-existing carry-forward in a PRESERVED (currently-unmounted-by-the-new-surface) file, explicitly annotated for Phase 27 above — not a new stub.

## Threat Flags

None. No new network surface; this is pure deletion + comment/test hygiene. The boot-crash gate (T-26-04-DoS) is satisfied (`npm run build` exit 0 + `OAUTH_CALLBACK_ROUTES` non-empty against the committed tree). The premature-delete tampering risk (T-26-04-T) is mitigated: `connectorSearch.ts` was kept because a live consumer (`ImportSurface`) still imports it — no dangling import.

## Issues Encountered

- **Full-suite delta vs baseline.** The full `vitest run` showed 7 files / 21 tests failing vs the HEAD~1 baseline's 6 files / 20 tests. The single extra (`TranscriptsTab.batching.test.ts`) PASSES in isolation on both HEAD and HEAD~1 — a pre-existing test-isolation/ordering flake, not a regression. Proven by running the full suite against HEAD~1 in a detached worktree and diffing counts. Logged in `deferred-items.md`. None of the failing files import any deleted module.

## Verification

- **[BLOCKING] boot gate:** `rtk proxy npm run build` → exit 0 (13.73s; only the pre-existing chunk-size warning). `oauth-callback-routing.test.ts` → 10/10. `npm run lint:docs` → clean.
- **TBL-03 grep:** zero **import statements** for `ConnectorImportWizard|useSyncTabSelection|useSyncTabOrchestration|useSyncTabStateBridge|UnsyncedMeetingsSection|SyncedTranscriptsSection|SyncTabDialogs`. Remaining symbol matches are 2 intentional test references (capabilities migration comment + the `.not.toMatch` regression guard).
- **Deleted files gone / preserved files present:** verified via filesystem checks (all 12 deleted absent; `SyncStatusIndicator` / `ActiveSyncJobsCard` / `useSyncTabState` present).
- **tsc (`tsc -p tsconfig.app.json`):** zero NEW errors from the deletions (no "Cannot find module" for any deleted file). Pre-existing errors (ImportPage Remixicon, TranscriptsNew DragHelpers, useSyncTabState SyncJob, and unrelated files) logged in `deferred-items.md`.
- **Touched/migrated tests:** `ImportSurface.capabilities.test.ts` 4/4, `ImportSurface.test.tsx` 3/3, `ImportPage.connector-routing.test.ts` 6/6, `connectorSearch.test.ts` 3/3.
- **No accidental deletions:** the only deletions are the 12 intentional fork files (verified `git diff --diff-filter=D HEAD~1 HEAD` = 12).

## Next Phase Readiness

- **Phase 26 COMPLETE (4/4).** The two import surfaces share one `<ImportSurface>`; the fork is gone; the boot gate is green.
- **Phase 27 (job status)** owns the PRESERVED `SyncStatusIndicator` / `ActiveSyncJobsCard` / `useSyncTabState`. **Action required:** fix the `useSyncTabState.ts:202` hardcoded `"fathom"` carry-forward (real `source_app` + `organizationId`) when re-integrating it into the new surface.
- **Not pushed to origin** (batched to phase end per orchestrator instruction).

## Self-Check: PASSED

All created files verified present (`26-04-SUMMARY.md`, `ImportSurface.capabilities.test.ts`, `deferred-items.md`); Task 1 commit `e9d5cba2` verified in git log.

---
*Phase: 26-unified-import-surface*
*Completed: 2026-06-23*
