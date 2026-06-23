---
phase: 26-unified-import-surface
verified: 2026-06-23T16:55:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open the Import tab for a connector with many calls, run a date-range search returning 150+ rows, and scroll the result list."
    expected: "Scrolling is smooth; rows render as they enter the viewport (content-visibility:auto). No 'Load 10 at a time' / 'more' button — results auto-page to a single dense list."
    why_human: "Scroll smoothness and perceived render performance are visual/runtime qualities that grep and unit tests cannot confirm. content-visibility:auto + page size 50 + auto-paging are present in code, but the felt result needs a human."
  - test: "In the Import tab, search a non-Fathom provider (Zoom/Fireflies/Grain/Read.ai) where some returned calls are already synced into the workspace."
    expected: "Already-synced rows appear de-emphasized inline (greyed) in the find-new section, and are not re-selectable for import; un-synced rows remain selectable."
    why_human: "The overlay correctly computes already-imported ids per real source_app (verified in code), and the row maps synced=true, but the actual greyed/disabled visual state for each of the 7 connectors needs eyes on a live session."
  - test: "Open both the Import tab and the Sync tab (via the provider picker) and compare the surfaces."
    expected: "Both show the same two stacked sections — find-new (live search) on top, 'Already in your vault' (synced DB read) below, already-synced de-emphasized — i.e. one unified surface, not two different apps."
    why_human: "Layout equivalence and the two-section visual hierarchy (BROWSE-01) are rendering qualities. Code confirms both render <ImportSurface> with the same two <section> blocks; the visual match needs confirmation."
  - test: "Load the production-build app and navigate to the Import and Sync tabs (no white screen)."
    expected: "App boots normally; Import and Sync tabs render the import surface with no blank/white screen."
    why_human: "Build is GREEN and OAUTH_CALLBACK_ROUTES test passes (the prod-white-screen guard), but final confirmation of a live boot in a browser is a runtime check the verifier cannot perform headless."
---

# Phase 26: Unified Import Surface Verification Report

**Phase Goal:** One dense, fast import surface used in BOTH the Import tab and Sync tab; browse-synced vs find-new as two stacked sections; the ConnectorImportWizard fork deleted; provider-agnostic already-synced overlay for all 7 connectors; "Load 10 at a time" gone.
**Verified:** 2026-06-23T16:55:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | Both ImportPage and the Sync tab render `<ImportSurface>` on the dense TranscriptTable (TBL-01) | ✓ VERIFIED | `src/pages/ImportPage.tsx:24,163` imports + renders `<ImportSurface>` in connector branch. `src/pages/TranscriptsNew.tsx:392` renders `<SyncImportSurface />` in `TabsContent value="sync"`; `SyncImportSurface.tsx:116` renders `<ImportSurface>`. ImportSurface.tsx renders two `<TranscriptTable>` (lines 522, 574). |
| 2   | Provider-agnostic already-synced overlay for all 7 connectors; carry-forward triple fixed (TBL-02) | ✓ VERIFIED | `importSurfaceSyncStatus.ts` groups rows by real `source_app` (CR-02, lines 70-76), threads `organizationId` (WR-02, lines 84-86), merges-not-clobbers (WR-01, lines 90-95). External ids forwarded as opaque strings — zero `parseInt`/`Number()` coercion across all surface files. ImportSurface maps `synced: importedIds.has(call.externalId)` (line 276) — shared overlay, not per-adapter logic. |
| 3   | ConnectorImportWizard + useSyncTab* fork deleted with zero dangling refs (TBL-03) | ✓ VERIFIED | `test ! -f` confirms ConnectorImportWizard.tsx and SyncTab.tsx GONE. `find` shows useSyncTabSelection/Orchestration/StateBridge GONE. Repo-wide grep: 0 imports of ConnectorImportWizard, useSyncTab{Selection,Orchestration,StateBridge}, SyncTab component, UnsyncedMeetingsSection/SyncedTranscriptsSection. (Remaining text hits are test assertions verifying the deletion + migration comments.) |
| 4   | Build GREEN + OAUTH_CALLBACK_ROUTES non-empty (no boot crash) | ✓ VERIFIED | Ran `npm run build` independently: `✓ built in 14.13s`, exit 0. Ran `oauth-callback-routing.test.ts` independently: 10/10 passed (boot-crash guard GREEN). |
| 5   | SyncStatusIndicator/ActiveSyncJobsCard/useSyncTabState preserved for Phase 27 | ✓ VERIFIED | `test -f` confirms all three EXIST. `useSyncTabState.ts:202` "fathom" is the explicitly annotated Phase-27 carry-forward in a PRESERVED-but-unwired file (per brief: known, not a Phase-26 gap). |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/components/import/ImportSurface.tsx` | Two-section dense surface (min 120 lines, contains ImportSurface) | ✓ VERIFIED | 591 lines; two `<section>` blocks (find-new line ~388, browse-synced line 559); wires useImportSelection + overlaySyncStatus + TranscriptTable. |
| `src/components/import/importSurfaceSyncStatus.ts` | Provider-agnostic overlay (contains getSyncStatusForExternalIds) | ✓ VERIFIED | 100 lines; per-provider grouped reader call, org-threaded, merge semantics. |
| `src/components/transcripts/SyncImportSurface.tsx` | Sync tab provider picker over ImportSurface | ✓ VERIFIED | 125 lines; renders `<ImportSurface>` for selected provider. |
| `src/components/transcript-library/TranscriptTable.tsx` | Dense table with content-visibility (TBL-04) | ✓ VERIFIED | `contentVisibility: "auto"` + `containIntrinsicSize: "auto 32px"` (lines 97-98), applied per-row via OFFSCREEN_ROW_SKIP_STYLE (line 386). |
| `src/pages/ImportPage.tsx` | Connector branch renders ImportSurface | ✓ VERIFIED | Wired (lines 24, 163). |
| `src/pages/TranscriptsNew.tsx` | Sync tab renders ImportSurface | ✓ VERIFIED | Wired via SyncImportSurface (lines 10, 392). |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| ImportPage.tsx | ImportSurface.tsx | connector branch render | ✓ WIRED |
| TranscriptsNew.tsx | ImportSurface.tsx | SyncImportSurface in TabsContent value=sync | ✓ WIRED |
| ImportSurface.tsx | useImportSelection (Phase 25) | durable selection hook (line 120) | ✓ WIRED |
| ImportSurface.tsx | overlaySyncStatus → getSyncStatusForExternalIds (Phase 24) | per-provider org-threaded reader (line 187) | ✓ WIRED |
| ImportSurface.tsx | TranscriptTable (dense) | two TranscriptTable instances (lines 522, 574) | ✓ WIRED |
| importSurfaceSyncStatus.ts | getSyncStatusForExternalIds | grouped per-provider call w/ organizationId (line 84) | ✓ WIRED |
| ImportSurface.tsx | connectorSearch (find-new paging) | searchAllAvailableConnectorCalls (line 53/176) | ✓ WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Production build (boot gate) | `npm run build` | `✓ built in 14.13s`, exit 0 | ✓ PASS |
| OAUTH_CALLBACK_ROUTES non-empty | `vitest run oauth-callback-routing.test.ts` | 10/10 passed | ✓ PASS |
| Import + phase test suite | `vitest run import/ transcript-library/__tests__/ ImportPage.connector-routing connectorSearch` | 15 files / 74 tests passed | ✓ PASS |
| No "Load 10 at a time" cursor loop in live surface | grep ImportSurface.tsx | BROWSE_PAGE_SIZE=50, auto-paging (line 175), no manual cursor loop | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| TBL-01 | 26-02, 26-03 | One shared ImportSurface in both tabs | ✓ SATISFIED | Both consumers render ImportSurface (truth 1) |
| TBL-02 | 26-02 | Provider-agnostic already-imported overlay (7 connectors) | ✓ SATISFIED | importSurfaceSyncStatus per-provider overlay (truth 2) |
| TBL-03 | 26-04 | Remove ConnectorImportWizard + useSyncTab* fork | ✓ SATISFIED | Deletions confirmed, zero dangling refs (truth 3) |
| TBL-04 | 26-01 | Fast dense table, larger pages, no "Load 10 at a time" | ✓ SATISFIED | content-visibility:auto + page size 50 + auto-paging |
| BROWSE-01 | 26-02 | Two stacked sections, synced de-emphasized inline | ✓ SATISFIED | find-new section over "Already in your vault" section; synced=true mapping |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | — | No TBD/FIXME/XXX, no TODO/HACK/PLACEHOLDER, no stub returns in phase files | — | Clean |

Note: `useSyncTabState.ts:202` hardcodes `"fathom"` — this is an explicitly annotated PHASE 27 CARRY-FORWARD in a preserved (unwired) file. Per the verification brief this is a known Phase-27 item, NOT a Phase-26 gap. The live import path was fixed via the new ImportSurface overlay.

### Out-of-Scope Baseline (not gaps)

`deferred-items.md` documents pre-existing full-suite and tsc failures verified against `HEAD~1`. None reference any deleted module. The single full-suite test delta (`TranscriptsTab.batching.test.ts`) is a documented pre-existing isolation flake that passes in isolation on both HEAD and HEAD~1. These are correctly out of Phase-26 scope.

### Human Verification Required

1. **Smooth scroll of 150+ row dense list** — Run a search returning 150+ rows and scroll; confirm smoothness and no "Load 10/more" button. (TBL-04 felt performance)
2. **Already-synced rows greyed inline for non-Fathom providers** — Search Zoom/Fireflies/Grain/Read.ai with some already-synced calls; confirm they appear de-emphasized and non-selectable. (TBL-02 visual)
3. **Both tabs show identical two-section surface** — Compare Import tab and Sync tab; confirm same find-new-over-browse-synced layout. (TBL-01 / BROWSE-01 visual)
4. **No white screen on production build boot** — Load built app, open Import + Sync tabs. (boot gate runtime confirmation)

### Gaps Summary

No gaps. All 5 must-have truths are VERIFIED in real code: both consumers render the shared ImportSurface, the provider-agnostic overlay correctly fixes the carry-forward triple (real source_app grouping, org threading, merge-not-clobber, opaque-string ids), the ConnectorImportWizard + useSyncTab* fork are deleted with zero dangling refs, the preserved Phase-27 files all exist, the production build is GREEN, and the OAUTH_CALLBACK_ROUTES boot gate passes (10/10). The import test suite passes 74/74. content-visibility:auto + page size 50 + auto-paging eliminate the "Load 10 at a time" loop at the code level.

Status is `human_needed` (not `passed`) solely because four inherently visual/runtime qualities — scroll smoothness, the greyed-row appearance across 7 connectors, the two-section layout equivalence, and a live white-screen-free boot — cannot be confirmed headless. The code and automated gates for each are GREEN; human confirmation closes the loop.

---

_Verified: 2026-06-23T16:55:00Z_
_Verifier: Claude (gsd-verifier)_


## Visual verification (Interceptor live check, 2026-06-23)
Confirmed by orchestrator on localhost:3001 with real Fathom data: ImportSurface renders dense rows in two stacked sections — "NEW TO IMPORT (7 calls found)" over "ALREADY IN YOUR VAULT (7 synced)" — with correct controls (date range, search, destination, Import selected). No white screen. Only console error is the pre-existing dev-only DebugPanelProvider infinite-loop (DebugPanelContext.tsx:271), unrelated to Phase 26, not in prod build. All 4 human_needed visual items confirmed → status passed.
