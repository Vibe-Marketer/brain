---
phase: 26-unified-import-surface
plan: 02
subsystem: ui
tags: [react, import-surface, transcript-table, sync-status, connectors, vitest, multi-provider]

# Dependency graph
requires:
  - phase: 24-sync-status-foundation
    provides: getSyncStatusForExternalIds canonical synced-status reader (org-scoped, TEXT ids)
  - phase: 25-durable-selection
    provides: useImportSelection durable selection hook (toggle/selectAllMatching/count/reconcile/clearSelection)
  - phase: 26-01
    provides: TBL-04 fast TranscriptTable + the three Wave 0 RED scaffolds this plan turns GREEN
provides:
  - "TBL-01: one shared <ImportSurface sourceApp=...> two-section dense surface on the reused TranscriptTable"
  - "TBL-02: provider-agnostic overlaySyncStatus helper — synced status grouped by REAL source_app, org-threaded, merge-not-clobber (replaces per-adapter wasAlreadySynced)"
  - "BROWSE-01: find-new (live provider search) stacked ABOVE browse-synced (cheap per-provider DB read), synced rows de-emphasized inline"
  - "Phase 24 carry-forward triple fixed (CR-02 real source_app / WR-01 merge-not-clobber / WR-02 org threading)"
affects: [26-03 rewire ImportPage + TranscriptsNew at <ImportSurface>, 26-04 delete wizard + useSyncTab* hooks]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lift-and-parameterize: the SyncTab two-stacked-section shape extracted into one reusable component keyed by sourceApp (not a from-scratch build)"
    - "Canonical-read overlay: synced status computed client-side per provider via getSyncStatusForExternalIds, never the per-adapter server flag"
    - "Distinct selection keyspaces: find-new keys by source_app::externalId; browse-synced keys by recording UUID — never mixed (Pitfall 5)"
    - "Provider grouping + Promise.all per-provider reader calls with merged hits (merge-not-clobber)"

key-files:
  created:
    - src/components/import/ImportSurface.tsx
    - src/components/import/importSurfaceSyncStatus.ts
  modified:
    - src/components/import/__tests__/ImportSurface.test.tsx
    - src/components/import/__tests__/ImportSurface.syncStatus.test.tsx

key-decisions:
  - "overlaySyncStatus returns a Set<externalId> of already-imported ids; callers merge it onto rows (rows not in the set keep prior state — WR-01)"
  - "Surface owns its own date-range state + DateRangePicker internally (RESEARCH Open Question 1 recommendation)"
  - "Browse-synced section scoped to the surface's sourceApp client-side (per-provider browse, locked decision)"
  - "Inlined findRowKey(sourceApp, externalId) instead of getUnsyncedMeetingSelectionKey to avoid a cross-Meeting-type cast (two Meeting types exist: @/hooks/useMeetingsSync vs @/types/meetings)"
  - "connectorSearch.ts REUSED (searchAllAvailableConnectorCalls auto-pages) — NOT deleted this plan (it still has the orchestration consumer; deletion is 26-04)"

requirements-completed: [TBL-01, TBL-02, BROWSE-01]

# Metrics
duration: 18min
completed: 2026-06-23
---

# Phase 26 Plan 02: Unified Import Surface — <ImportSurface> + Provider-Agnostic Overlay + Carry-Forward Triple Summary

**One shared two-section dense `<ImportSurface>` on the reused TranscriptTable, driven by the Phase 25 durable selection hook and a new provider-agnostic sync-status overlay that fixes the Phase 24 carry-forward triple (real source_app, merge-not-clobber, org threading).**

## Performance

- **Duration:** 18 min
- **Started:** 2026-06-23T19:51:22Z
- **Completed:** 2026-06-23T20:09:26Z
- **Tasks:** 2 auto (both TDD)
- **Files:** 2 created, 2 modified

## Accomplishments

- **TBL-02 + carry-forward triple (Task 1):** `overlaySyncStatus(rows, { organizationId })` groups rows by their REAL `source_app` and calls `getSyncStatusForExternalIds` once per provider group (CR-02 — never the literal `"fathom"` SyncTab hardcoded), threading `organizationId` into every call (WR-02 — synced status cannot leak cross-org), and MERGES results by returning a `Set` of already-imported externalIds — a row flips to imported only on its OWN provider's hit with `hasWorkspaceEntries`, so one provider's batch never resets another's rows (WR-01). External ids stay opaque strings, never coerced.
- **TBL-01 + BROWSE-01 (Task 2):** `<ImportSurface sourceApp=...>` lifts the proven SyncTab two-stacked-section shape into one reusable component — find-new (live `adapter.searchAvailable`, auto-paged, selectable) stacked ABOVE browse-synced (cheap `useExistingTranscripts` DB read, per-provider scoped) — both on the dense `TranscriptTable` (reused, not a hand-rolled checkbox list).
- **Durable selection wired:** selection comes from the Phase 25 `useImportSelection` hook (`toggle`/`selectAllMatching`/`count`/`reconcile`); `reconcile(ids)` runs after each search; `clearSelection()` is called ONLY on successful import (job creation). No volatile `useState` selection sets.
- **Capability gating for all 7 providers** via `getConnectorCapabilities`: providers without `searchAvailable` (file-upload, youtube) show the "imports automatically" card and hide the find section; providers without `importSelected` hide the workspace picker + import button.
- **Clean Phase 27/28 seams:** a clearly-commented mount point for Phase 27's job banner under the toolbar, and a horizontal slot next to Import selected for Phase 28's "Sync all from provider". No job-poll/progress machinery built (Phase 27's domain); `connectorSearch.ts` reused, not deleted (26-04).
- **Both Wave 0 RED scaffolds turned GREEN:** `ImportSurface.test.tsx` (3/3) and `ImportSurface.syncStatus.test.tsx` (8/8 — 5 helper-level + 3 component-level).

## Task Commits

Each task committed atomically:

1. **Task 1: Provider-agnostic sync-status overlay (TBL-02 + carry-forward triple)** — `363c255c` (feat)
2. **Task 2: Build <ImportSurface> two-section dense surface (TBL-01, BROWSE-01)** — `dae68c8c` (feat)

_TDD note: Plan 01 shipped the RED scaffolds (`ImportSurface.test.tsx`, `ImportSurface.syncStatus.test.tsx`) that fail at module resolution until `<ImportSurface>` exists. Task 1's helper unit tests (added to the syncStatus file) assert the carry-forward triple directly; Task 2's component build turns the full structure + overlay contract GREEN._

## Files Created/Modified

- `src/components/import/importSurfaceSyncStatus.ts` — `overlaySyncStatus` overlay helper: groups rows by real `source_app`, one `getSyncStatusForExternalIds` call per provider with `organizationId`, merge-not-clobber, returns a `Set<externalId>` of imported ids. Ids never coerced.
- `src/components/import/ImportSurface.tsx` — the shared two-section dense surface (toolbar: connect/status → DateRangePicker → Search → Import selected (N) → destination workspace; find-new section over browse-synced section). Selection via `useImportSelection`; overlay via `overlaySyncStatus`; capability gating; Phase 27/28 seams.
- `src/components/import/__tests__/ImportSurface.test.tsx` — added leaf mocks for the provider-coupled hooks (`useConnector`, `useOrganizationWorkspaces`, `useExistingTranscripts`), a `matchMedia` polyfill, a minimal `TranscriptTableRow` stub (Plan 01 precedent — the real row pulls a deep org/auth/router chain), and a seeded synced row so the dense table renders real `<table>` markup. 3/3 GREEN.
- `src/components/import/__tests__/ImportSurface.syncStatus.test.tsx` — added the same leaf mocks + a `DateRangePicker` mock + a mocked `searchAllAvailableConnectorCalls`, plus 5 helper-level unit tests asserting the carry-forward triple directly. The 3 component-level tests now drive a real search → overlay flow and assert the reader is called with the real `"zoom"` source_app + `organizationId` and that a synced row never clobbers an unsynced sibling. 8/8 GREEN.

## Decisions Made

- **Overlay returns a `Set`, callers merge.** `overlaySyncStatus` returns only the already-imported externalIds; the surface marks `synced = importedIds.has(externalId)` per row. Rows absent from the set keep their prior state — the structural guarantee of WR-01 (merge, not clobber).
- **Inlined `findRowKey`.** Two `Meeting` types exist (`@/hooks/useMeetingsSync` with `recording_id: string` vs `@/types/meetings` with `recording_id: string | number`). `getUnsyncedMeetingSelectionKey` is typed to the former; rather than force a cross-type cast, the surface inlines the identical `encodeURIComponent(sourceApp)::encodeURIComponent(externalId)` convention.
- **Per-provider browse scoping.** The browse-synced section filters `useExistingTranscripts` rows to the surface's `sourceApp` client-side (locked decision) so the per-source Import-tab pane never shows other providers' rows.
- **Search-driven overlay, no auto-search on mount.** The overlay runs after `adapter.searchAvailable` returns (real UX). The component tests therefore drive a search (mocked search + DateRangePicker) rather than asserting an on-mount reader call.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test render crashed on the deep org/auth/router provider chain**
- **Found during:** Task 2 (and the syncStatus component tests)
- **Issue:** The structure scaffold mocked only `useImportSelection` + `getSyncStatusForExternalIds`. Rendering `<ImportSurface>` then hit `useOrganizationWorkspaces → useAuth` ("useAuth must be used within AuthProvider"), `window.matchMedia is not a function` (jsdom), and `TranscriptTableRow → useOrgContext → useNavigate` ("may be used only in the context of a <Router>").
- **Fix:** Added focused leaf mocks for the provider-coupled hooks, a `matchMedia` polyfill, and a minimal `TranscriptTableRow` stub — exactly the precedent set by Plan 01's virtualization test (stub the row, keep the table contract). The assertions remain meaningful: the two-section dense-table structure + the overlay wiring are what's under test, not the auth chain.
- **Files modified:** `ImportSurface.test.tsx`, `ImportSurface.syncStatus.test.tsx`
- **Commit:** `dae68c8c`

**2. [Rule 3 - Blocking] tsc: `Meeting & { recording_id: string }` cast not assignable to `getUnsyncedMeetingSelectionKey`'s `Meeting`**
- **Found during:** Task 2 type-check
- **Issue:** `getUnsyncedMeetingSelectionKey` expects the `@/hooks/useMeetingsSync` `Meeting`; the surface builds `@/types/meetings` rows — the cast failed `tsc`.
- **Fix:** Inlined `findRowKey(sourceApp, externalId)` using the identical `::` + `encodeURIComponent` convention, removing the cross-type dependency.
- **Files modified:** `ImportSurface.tsx`
- **Commit:** `dae68c8c`

### Component-test framing of WR-01

The Plan-01 syncStatus scaffold framed WR-01 at the component level as a two-provider (zoom + grain) test. A single `<ImportSurface>` is scoped to one provider, so the component-level WR-01 case was reframed as "a synced row does not flip an unsynced sibling in the same find list" (still asserting merge-not-clobber, exactly one row greyed). The TWO-PROVIDER merge-not-clobber assertion is proven directly and precisely by the helper-level unit tests (`overlaySyncStatus` with zoom + grain). Assertions were strengthened, not weakened.

## Known Stubs

None. The surface is fully wired to live data sources (adapter search, `useExistingTranscripts`, the Phase 24 reader, the Phase 25 store). The Phase 27 (job banner) and Phase 28 (sync-all) seams are intentional, documented mount points — not data stubs — and are out of scope per the plan.

## Issues Encountered

- jsdom lacks `window.matchMedia` (read by `use-mobile` inside the dense table / date picker). Polyfilled in both test files' `beforeAll`. The global `src/test/setup.ts` was not modified (out of scope).

## Verification

- `rtk proxy npx vitest run src/components/import/__tests__/` — 11 files / 58 tests GREEN, including `ImportSurface.test.tsx` (3/3) and `ImportSurface.syncStatus.test.tsx` (8/8).
- `rtk proxy npx tsc -p tsconfig.app.json` — zero errors in `ImportSurface.tsx` and `importSurfaceSyncStatus.ts` (the pre-existing unrelated errors logged in Phase 24 deferred-items remain; not in scope).
- Grep acceptance gates (all satisfied):
  - `importSurfaceSyncStatus.ts`: `getSyncStatusForExternalIds` (3) ≥ 1, `organizationId` (4) ≥ 1, `parseInt|Number(` = 0.
  - `ImportSurface.tsx`: `useImportSelection` (3) ≥ 1, overlay ref (3) ≥ 1, `useState<Set` = 0, `wasAlreadySynced` = 0, `parseInt|Number(` = 0, `framer-motion|lucide-react` = 0, Phase 27/28 seams (7) ≥ 1, `<TranscriptTable` (2 = find + browse).
- `connectorSearch.ts` confirmed PRESENT (deleted in 26-04, not here).

## Next Phase Readiness

- 26-03 can rewire `ImportPage` (connector branch) and `TranscriptsNew` (sync tab) to render `<ImportSurface sourceApp=... organizationId=...>`, gated by `npm run build` (the OAuth-callback boot-crash guard).
- 26-04 can then delete `ConnectorImportWizard` + the `useSyncTab*` hooks + `connectorSearch.ts` (after both its consumers are gone) in dependency-leaf order.
- The carry-forward triple is fixed at the overlay layer; once consumers are rewired, non-Fathom providers (Zoom/Fireflies/Grain/Read.ai) will grey synced rows correctly.

## Self-Check: PASSED

All created/modified files verified present; both task commits (`363c255c`, `dae68c8c`) verified in git log.

---
*Phase: 26-unified-import-surface*
*Completed: 2026-06-23*
