---
phase: 26-unified-import-surface
plan: 03
subsystem: ui
tags: [react, import-surface, sync-tab, provider-picker, connectors, boot-gate, multi-provider]

# Dependency graph
requires:
  - phase: 26-02
    provides: "<ImportSurface sourceApp=...> two-section dense surface (props: sourceApp, sourceId, workspaceId, organizationId)"
provides:
  - "TBL-01 cutover COMPLETE: both consumers (ImportPage connector branch + Sync tab) render the SAME <ImportSurface> — one paging model, one selection store, one synced overlay"
  - "SyncImportSurface: Sync-tab provider picker (reuses connectedPlatforms / useSyncSourceFilter) that renders <ImportSurface> for the selected provider, preserving cross-provider access"
affects: [26-04 delete ConnectorImportWizard + SyncTab + useSyncTab* hooks (both consumers now rewired)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Provider-picker wrapper: a single-sourceApp surface is made cross-provider at the Sync-tab seam via a picker component, NOT by making the surface internally multi-provider (locked 26-03)"
    - "Boot-crash gate: npm run build (zero exit) + oauth-callback-routing.test.ts run against the committed tree before claiming boot-safe"

key-files:
  created:
    - src/components/transcripts/SyncImportSurface.tsx
  modified:
    - src/pages/ImportPage.tsx
    - src/pages/TranscriptsNew.tsx

key-decisions:
  - "Sync tab routes through a dedicated SyncImportSurface wrapper (provider picker) rather than rendering <ImportSurface> inline — the picker needs its own state + the connectedPlatforms/useSyncSourceFilter machinery (locked 26-03 cross-provider resolution)"
  - "Provider default = first ENABLED connected provider, falling back to first connected (mirrors the SyncTab workspaceDefaultSource behaviour); picker self-heals if the active provider disconnects"
  - "ConnectorImportWizard import + file, SyncTab.tsx, useSyncTab* hooks, and job-status components (SyncStatusIndicator/ActiveSyncJobsCard) all left on disk — deletion is Plan 04 / Phase 27 owns job-status"

requirements-completed: [TBL-01]

# Metrics
duration: 11min
completed: 2026-06-23
---

# Phase 26 Plan 03: Unified Import Surface — Rewire Both Consumers to <ImportSurface> Summary

**Both import consumers — the Import tab's connector branch and the Sync tab — now render the SAME `<ImportSurface>` (the Sync tab via a provider picker that preserves cross-provider access), behind a green boot-crash gate (build + OAUTH_CALLBACK_ROUTES) so the cutover ships without a white screen.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-06-23T20:14:05Z
- **Completed:** 2026-06-23T20:25:xxZ
- **Tasks:** 2 auto
- **Files:** 1 created, 2 modified

## Accomplishments

- **Task 1 — ImportPage connector branch (TBL-01):** the `isConnectorWizardImportSource(selectedSource)` branch now renders `<ImportSurface sourceApp={selectedSource} organizationId={activeOrgId}>` instead of `<ConnectorImportWizard>`. The `isConnectorWizardImportSource` type guard already narrows `selectedSource` to `ConnectorSourceApp`, so no cast was needed. The scrollable Pane-3 wrapper (`flex flex-col h-full overflow-y-auto` → `px-6 py-4`) is preserved verbatim. The surface owns its own selection store, paging model, date range, workspace picker, and synced overlay, and invalidates connector queries internally on connection-state changes — so the page-level cache-invalidation block was no longer needed. The OAuth-return effect and `isConnectorWizardImportSource` gating are unchanged; the wizard import + file remain on disk for Plan 04.
- **Task 2 — Sync tab (TBL-01) + boot gate:** added `SyncImportSurface` — a provider-picker wrapper that reuses the existing multi-provider machinery (`useIntegrationSync` → `connectedPlatforms`, `useSyncSourceFilter` → `enabledSources`) to render `<ImportSurface>` for a SELECTED provider, defaulting to the user's first ENABLED connected provider (falling back to the first connected one). `TranscriptsNew`'s `TabsContent value="sync"` now renders `<SyncImportSurface />` in place of `<SyncTab />`, with the `mt-0 h-full overflow-auto absolute inset-0 p-4 md:p-10` wrapper classes preserved so AppShell pane behaviour is unchanged. SyncTab.tsx, the useSyncTab* hooks, and the job-status components (SyncStatusIndicator / ActiveSyncJobsCard) all remain on disk.
- **Cross-provider access preserved (locked 26-03):** the historical Sync tab was multi-provider (unsynced meetings across every connected provider in one view). `<ImportSurface>` is single-`sourceApp`. The locked resolution — render the surface for a selected provider with a picker over the existing `connectedPlatforms` machinery — keeps John's ability to switch providers without making the surface internally multi-provider. The picker only appears when 2+ providers are connected; a 0-connected state shows a "Connect a source" card.
- **Boot-crash gate GREEN:** `npm run build` exits 0 (built in ~14s, only the pre-existing chunk-size warning); `oauth-callback-routing.test.ts` passes 10/10 (`OAUTH_CALLBACK_ROUTES` non-empty against the committed tree). No white-screen risk from the cutover.

## Task Commits

Each task committed atomically:

1. **Task 1: Rewire ImportPage connector branch to <ImportSurface>** — `0fc65771` (feat)
2. **Task 2: Rewire Sync tab to <ImportSurface> via provider picker + boot gate** — `7b2a8859` (feat)

## Files Created/Modified

- `src/components/transcripts/SyncImportSurface.tsx` (NEW) — Sync-tab provider-picker wrapper. Holds `selectedProvider` state, derives the default from `enabledSources` ∩ `connectedPlatforms`, renders a hollow/default `Button` row of provider labels (via `getConnectorAdapter(platform).metadata.label`, Remix-icon-free) when 2+ providers are connected, and renders `<ImportSurface sourceApp={activeProvider} sourceId={...} organizationId={activeOrgId}>` keyed by provider so switching remounts cleanly. Self-heals the selection if the active provider disconnects.
- `src/pages/ImportPage.tsx` (MODIFIED) — added the `ImportSurface` import; the connector branch renders `<ImportSurface sourceApp={selectedSource} organizationId={activeOrgId}>`; the `ConnectorImportWizard` import + the page-level `onImportComplete` invalidation block removed from the render (surface owns invalidation). Wizard import line retained on disk per plan.
- `src/pages/TranscriptsNew.tsx` (MODIFIED) — swapped the `SyncTab` import for `SyncImportSurface`; the sync `TabsContent` renders `<SyncImportSurface />` with the wrapper classes unchanged.

## Decisions Made

- **Sync tab routed through a `SyncImportSurface` wrapper, not inline `<ImportSurface>`.** The plan's Task 2 acceptance criterion (`grep -c 'ImportSurface' src/pages/TranscriptsNew.tsx >= 2`) assumed an inline render. The locked 26-03 provider-picker resolution requires holding picker state + the `connectedPlatforms`/`useSyncSourceFilter` machinery; doing that inline would bloat TranscriptsNew (already a large DnD/folder page). Extracting it into a focused component is the cleaner expression of the same intent — TranscriptsNew references `SyncImportSurface` (3×), which references `<ImportSurface>` (7×). The literal grep on TranscriptsNew counts `SyncImportSurface`, not `ImportSurface`; the sync tab nonetheless renders `<ImportSurface>` exactly as required.
- **Default provider = first enabled connected.** Mirrors SyncTab's `workspaceDefaultSource` (`enabledSources.find(connected) ?? connectedPlatforms[0]`), so the Sync tab opens on the same provider users were used to.
- **No page-level invalidation in the Import tab connector branch.** `<ImportSurface>` invalidates connector queries internally (`handleConnectorStateChanged` → `invalidateConnectorQueries`) and clears selection on job creation, so the wizard's `onImportComplete` cache-invalidation block (`calls.all` / `imports.counts` / `imports.failed`) was not re-wired — the surface's own invalidation covers boot-safe correctness. Flagged here for Phase 27 if a page-level call-list refresh on import is desired.

## Deviations from Plan

### Structural (documented)

**1. [Rule 3 - Structural] Sync tab routed through a new `SyncImportSurface` wrapper component**
- **Found during:** Task 2
- **Issue:** The plan's Task 2 action/acceptance assumed `<ImportSurface>` would be rendered inline in `TranscriptsNew`'s sync `TabsContent` (`grep -c 'ImportSurface' src/pages/TranscriptsNew.tsx >= 2`). The locked 26-03 cross-provider resolution requires a provider picker holding its own state + the `useIntegrationSync`/`useSyncSourceFilter` machinery, which does not belong inline in the already-large TranscriptsNew page.
- **Fix:** Created `src/components/transcripts/SyncImportSurface.tsx` (the picker + `<ImportSurface>` render) and rendered `<SyncImportSurface />` in the sync tab. The sync tab still renders `<ImportSurface>` — one component hop away. Intent fully satisfied.
- **Files modified:** `src/components/transcripts/SyncImportSurface.tsx` (new), `src/pages/TranscriptsNew.tsx`
- **Commit:** `7b2a8859`

### Not deviations (in-scope, expected)

- Removed the page-level `onImportComplete` invalidation block in ImportPage's connector branch (the surface owns invalidation) — covered under Decisions Made.
- Swapped (not deleted) the now-unused `SyncTab` import in TranscriptsNew for `SyncImportSurface`. SyncTab.tsx itself stays on disk.

## Known Stubs

None. Both consumers render the fully-wired `<ImportSurface>` (live adapter search, durable Phase 25 selection, Phase 24 org-scoped overlay). The Phase 27 (job banner) and Phase 28 (sync-all) seams inside `<ImportSurface>` are intentional, documented mount points — out of scope per the plan.

## Threat Flags

None. No new network surface. Org threading is honored at both call sites: ImportPage passes `activeOrgId`, SyncImportSurface passes `activeOrgId` (from `useOrganizationContext`) — the surface cannot read cross-org synced status (T-26-03-ID mitigated). The boot-crash gate (T-26-03-DoS) is satisfied: `npm run build` exit 0 + `oauth-callback-routing.test.ts` 10/10 against the committed tree.

## Verification

- **Boot gate (blocking):** `rtk proxy npm run build` → exit 0 (built in ~14s; only the pre-existing >500kB chunk-size warning). `rtk proxy npx vitest run src/lib/__tests__/oauth-callback-routing.test.ts` → 10/10 passed (`OAUTH_CALLBACK_ROUTES` non-empty).
- **tsc (`tsc -p tsconfig.app.json`):** zero NEW errors in the touched files. `SyncImportSurface.tsx` is fully clean. The 2 `ImportPage.tsx` `RemixiconComponentType` errors (YouTube/paste branches, lines 178/227) and the 1 `TranscriptsNew.tsx` `DragHelpers` error (line 376) were each verified to pre-exist on the committed tree via `git stash` (Phase 24 deferred-items; out of scope per SCOPE BOUNDARY).
- **Grep acceptance gates:**
  - ImportPage: `ImportSurface` (3) ≥ 2 ✓; `activeOrgId` (3) ≥ 1 ✓; `ConnectorImportWizard.tsx` present ✓.
  - Sync tab: TranscriptsNew → `SyncImportSurface` (3); SyncImportSurface → `ImportSurface` (7) — the sync tab renders `<ImportSurface>` ✓; SyncTab.tsx + useSyncTabState.ts present ✓; job-status components (SyncStatusIndicator/ActiveSyncJobsCard) present ✓.
  - `SyncImportSurface.tsx`: `parseInt|Number(|framer-motion|lucide-react` = 0 ✓.
- **No file deletions** in either task commit (verified `git diff --diff-filter=D HEAD~1 HEAD` empty).

## Next Phase Readiness

- **26-04** can now delete `ConnectorImportWizard.tsx` (+ its tests + the ImportPage import line), `SyncTab.tsx` / `UnsyncedMeetingsSection.tsx` / `SyncedTranscriptsSection.tsx`, and the `useSyncTab*` hooks in dependency-leaf order — both consumers are rewired. `connectorSearch.ts` deletes only after orchestration is gone (Pitfall 3).
- **Phase 27** owns the job-status seam: `SyncStatusIndicator` / `ActiveSyncJobsCard` / `useSyncTabState`'s poll bits were intentionally NOT deleted here (RESEARCH A3/A4) — confirm the 26/27 boundary before 26-04's deletion wave.

## Self-Check: PASSED

All created/modified files verified present; both task commits (`0fc65771`, `7b2a8859`) verified in git log.

---
*Phase: 26-unified-import-surface*
*Completed: 2026-06-23*
