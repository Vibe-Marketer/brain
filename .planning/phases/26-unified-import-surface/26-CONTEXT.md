# Phase 26: Unified Import Surface - Context

**Gathered:** 2026-06-23
**Status:** Ready for planning
**Mode:** Operator UX brief captured directly from Andrew's request + v2.1 research

<domain>
## Phase Boundary

One dense, fast import surface used everywhere, with browsing already-synced calls cleanly separated from finding/importing new ones. Collapse the `ConnectorImportWizard` / `SyncTab` fork onto a single `<ImportSurface>` built on the dense `TranscriptTable`. Consumes the Phase 24 canonical sync-status reader and the Phase 25 durable selection store/hook.

Requirements: TBL-01 (shared ImportSurface on dense TranscriptTable, both surfaces), TBL-02 (provider-agnostic already-imported status overlay for all 7 connectors), TBL-03 (delete ConnectorImportWizard + duplicate useSyncTab* hooks), TBL-04 (virtualized dense table, larger pages, background prefetch — kill "Load 10 at a time"), BROWSE-01 (browse-synced vs find-new as two stacked sections, already-synced de-emphasized inline).
</domain>

<decisions>
## Implementation Decisions (operator UX brief — Andrew's own words, treat as locked)

### Density & table
- Use the SAME dense table component the main Transcripts pages use (`TranscriptTable`) — Andrew: "at one point the import tab used to use the same type of table as the main transcripts pages and that was a lot better — you could list a lot more calls in a tighter space." Reuse it; do NOT rebuild a thin custom checkbox list (the wizard's regression).
- Fast loading is a hard requirement. Andrew: "should not take forever to load… I should not have had to watch John click 'more' a million times 10 calls at a time." Virtualize rows, larger page sizes, background prefetch/auto-paging. Kill the 10-at-a-time manual "more" loop.

### Browse vs find/import (BROWSE-01)
- Two clearly distinct experiences, but NOT necessarily two separate areas. Andrew: "There's a difference between searching back through and seeing calls that already synced, vs going in and finding calls and importing them for the first time… I don't know that it needs separate areas." Implement as two stacked sections in ONE surface: already-synced (cheap DB read, de-emphasized inline) and find-new (live provider API). One surface, a browse/find split — NOT two separate apps (the named anti-feature).

### Selection & import flow (easy + trustworthy)
- Selecting and importing must be fast and seamless; selections must persist (Phase 25 store) — John lost his selections, that must be impossible now.
- Sensible, natural button/control placement: connect, search/filter (date range), select (incl. select-all-matching), import — laid out so it feels natural to connect → search → scroll → select → import. Apply the One-Click Promise and KISS-UX.
- Provider-agnostic across ALL connectors (Fathom, Zoom, Fireflies, Grain, Read.ai, PLAUD, YouTube).

### CARRY-FORWARD from Phase 24 (must fix here)
- The SyncTab currently hardcodes `sourceApp: "fathom"` in `useSyncTabState.ts` and does not thread `organizationId`. Now that the surface becomes multi-provider, thread the REAL per-row `source_app` (and the caller's org) into the Phase 24 `getSyncStatusForExternalIds` reader, or non-Fathom providers will show as unsynced. See `.planning/phases/24-sync-status-foundation/deferred-items.md` (CR-02/WR-01/WR-02).

### Claude's Discretion
Virtualization library choice (existing TranscriptTable may already virtualize — reuse its mechanism; if not, pick a library already in the dep tree before adding one), exact section layout/visual treatment within the dense-table + stacked-sections constraints, prefetch page size. All grounded in matching the existing Transcripts UX.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/transcripts/TranscriptTable.tsx` — THE dense table to reuse (already used by `UnsyncedMeetingsSection.tsx`).
- `UnsyncedMeetingsSection.tsx` / `SyncTab.tsx` — the better existing flow; the reuse template.
- Phase 24: `getSyncStatusForExternalIds` (src/services/sync-status.service.ts) — the provider-agnostic already-synced overlay source.
- Phase 25: `importSelectionStore.ts` + `useImportSelection` hook — durable selection to wire in.
- Provider adapter registry: `src/components/connectors/registry/connectorRegistry.ts`, `adapter-helpers.ts`, `registry/types.ts` (searchAvailable/importSelected contract).

### To DELETE (TBL-03)
- `src/components/connectors/ConnectorImportWizard.tsx` (custom checkbox list + manual cursor paging).
- Duplicate hooks: `useSyncTabSelection.ts`, and the now-superseded selection bits of `useSyncTabState.ts` / `useSyncTabOrchestration.ts` (migrate their consumers to the new ImportSurface + Phase 25 store).

### Fragile surfaces (respect)
- `source-registry.ts` `oauthCallbackFunctionName` entries are boot-time critical — a zeroed/broken registry white-screens prod. Build against the COMMITTED tree; keep the CI assertion on `OAUTH_CALLBACK_ROUTES.length`.
- Dual recording-ID system — never parseInt/Number on IDs; `source_call_id` is TEXT; use `toRecordingUuid`/`toRecordingUuidBatch`.
- `resolveShareUrl()` for share URLs; Remix Icons only; no framer-motion/Lucide.
</code_context>

<specifics>
## Specific Ideas

The whole point (Andrew): "across the board, for all providers, a better way to sync all calls, a status indicator, and a better/faster way to selectively import — seamless, doesn't take forever, makes the customer feel like all their content is being synced without worry." This phase delivers the unified SURFACE + selection + browse/find; the status indicator + observable jobs are Phase 27; server-side sync-all is Phase 28. Keep those seams clean so 27/28 plug into this surface.
</specifics>

<deferred>
## Deferred Ideas

- Observable job progress UI / per-provider status chip → Phase 27 (JOB). Leave mount points/seams in the surface.
- Server-side "Sync all from provider" button behavior → Phase 28 (SYNC). The select-all-matching descriptor (Phase 25) is the client twin; the surface should expose the affordance, wired to the real backend job in Phase 28.
- Partial-success/retry surfacing → Phase 29 (FAIL).
</deferred>
