# Phase 25: Durable Selection - Context

**Gathered:** 2026-06-23
**Status:** Ready for planning
**Mode:** Auto-generated (decisions grounded in v2.1 research — reversible UI-state choices, no high-stakes gray areas)

<domain>
## Phase Boundary

A user's selection of calls survives everything that wipes it today — navigation, unmount, date-range change, and the OAuth round-trip. Plus select-all-matching-filter (select all calls matching the current filter, not just the rows loaded on screen). Delivers the durable client-side selection store that the Phase 26 unified surface will consume. No new table; this is client state (Zustand `persist`).

Requirements: SEL-01 (durable selection across nav/unmount/date-change/OAuth), SEL-02 (select-all-matching-filter).
</domain>

<decisions>
## Implementation Decisions

### Selection store (SEL-01)
- Use a dedicated Zustand store with the `persist` middleware (Zustand v5 already in stack) — NOT component `useState`. This is the root-cause fix for "selections were GONE."
- Storage backend: `sessionStorage` (survives navigation, unmount, and the OAuth same-tab redirect round-trip within a session; clears when the tab closes so stale selections don't linger across days). If research/codebase convention favors `localStorage` for the OAuth flow (different tab/popup), follow that — the OAuth return must land in the same storage the selection was written to. Claude's discretion grounded in how the existing OAuth return flow works (verify during plan/exec).
- Key scheme: selection keyed by `provider (source_app)` + `date range` so switching providers/ranges shows the correct per-context set rather than a global blob. Changing the date range preserves the prior range's selection instead of clearing it.
- Selection clears ONLY when a job is created (import fired), never on background refetch/poll. Any selected call that becomes synced drops out of the selection automatically (reconcile against canonical sync-status from Phase 24).

### Select-all-matching (SEL-02)
- "Select all matching the current filter" selects the full matching set (all N), not just loaded/scrolled rows — the client-side twin of Phase 28's server-side sync-all. Represent as a filter-descriptor selection (not an enumerated id list) so it scales to thousands without materializing every id, OR materialize ids if the matching count is bounded/cheap — Claude's discretion based on how search results paginate.
- Provide clear affordances: "N selected", select-all-matching, clear-selection.

### Claude's Discretion
Storage backend specifics (session vs local) pending OAuth-flow verification; the select-all representation (descriptor vs enumerated). Both grounded in research + codebase reality, decided at plan/exec.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 24 canonical reader `getSyncStatusForExternalIds` (src/services/sync-status.service.ts) — reconcile selected→synced drop-out against it.
- The volatile stores being replaced: inline `useState` in `ConnectorImportWizard.tsx` and `useSyncTabSelection.ts` (the bug sources).
- Zustand v5 `persist` is already used elsewhere in the app — follow the existing store pattern (src/stores or src/state).

### Established Patterns
- Service+Hook separation; Zustand for client state, TanStack Query for server state.

### Integration Points
- The new store is consumed by the Phase 26 `<ImportSurface>`. Keep it UI-shape-independent so both the Import tab and Sync tab can use it.
- OAuth return path (ImportPage.tsx OAuth-return effect) must not wipe selection — verify the store rehydrates after redirect.
</code_context>

<specifics>
## Specific Ideas

The vanishing-selection bug John hit (ConnectorImportWizard.tsx selection in `useState` wiped on unmount/date-change/OAuth) is the acceptance benchmark: select → navigate away → return → still selected; select → OAuth redirect → return → still selected; select in range A → change to range B → range A selection preserved.
</specifics>

<deferred>
## Deferred Ideas

- Range-select (shift-click) — SEL-03, deferred to a later milestone (Future Requirements).
- Wiring the store into the actual dense table UI is Phase 26 (TBL). This phase delivers the store + its hook + reconciliation, not the table.
</deferred>
