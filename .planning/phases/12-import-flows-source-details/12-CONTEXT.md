# Phase 12: Import Flows + Source Details - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire all four import source detail views (Fathom, Zoom, YouTube, Upload) into the Pane 2/3 layout established in Phase 11. Add connect/disconnect functionality, failed import retry, and source-specific metadata in call detail views. Most components already exist and are orphaned — this phase is primarily integration and wiring.

</domain>

<decisions>
## Implementation Decisions

### Source Detail Integration in Pane 3
- Conditional render based on `selectedSource` state — match Phase 11's ImportPage pattern already in place
- When a source isn't connected: show connect CTA at top of Pane 3, then disabled/empty detail below — one-click to connect
- Reset detail view state on source switch — fresh state each time, matches org-switch behavior from Phase 11
- YouTube shows URL import form directly — no connect/disconnect needed, always "available" (no OAuth)

### Connect/Disconnect & Failed Import Retry
- Connect/disconnect appears at top of each source's Pane 3 detail — status badge + action button (Connect/Disconnect) right-aligned in a header bar
- Disconnect requires simple confirmation dialog — "Disconnect [Source]? Your imported calls will remain." with Cancel/Disconnect buttons
- Failed imports shown in ImportOverviewDashboard via existing FailedImportsSection component + inline retry button per failed item
- Retry is per-item — retry icon button calls the same import edge function with the original params

### Call Detail Source Metadata (DETAIL-01)
- New "Source Info" section below the transcript in call detail modal — collapsible accordion with source icon + name as header
- Metadata per source: Zoom (meeting ID, duration, participants list), Fathom (call date, attendees, topics), YouTube (video title, channel, view count), Upload (filename, size, upload date)
- Fetch via existing `raw-calls.service.ts` per-source dispatcher — data already flows through this service
- Empty state: "No source details available" with muted text — graceful degradation, don't hide the section

### Claude's Discretion
- Exact component composition for source header bar (status badge + connect/disconnect button)
- Fathom/Zoom search UX refinements within existing detail components
- How retry edge function calls are structured (reuse existing import functions)
- Accordion implementation details for Source Info section

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets (ALL EXIST — orphaned, need wiring)
- `src/components/import/FathomImportDetail.tsx` (265+ lines) — complete Fathom search/select/import UI
- `src/components/import/ZoomImportDetail.tsx` (280+ lines) — complete Zoom search/select/import UI
- `src/components/import/YouTubeImportForm.tsx` — URL import form
- `src/components/import/FileUploadDropzone.tsx` — file upload dropzone
- `src/components/import/FailedImportsSection.tsx` — failed imports list with retry
- `src/components/import/ImportOverviewDashboard.tsx` — Phase 11 created, Pane 3 default view
- `src/components/panes/ImportSourcePane.tsx` — Phase 11 created, Pane 2 source nav
- `src/services/raw-calls.service.ts` — full per-source metadata dispatcher
- `src/services/import-sources.service.ts` — connect/disconnect/toggle/counts (org-scoped after Phase 11)

### Established Patterns
- ImportPage uses `selectedSource` state to drive conditional Pane 3 content
- AppShell `secondaryPane` prop for Pane 2 (wired in Phase 11)
- OAuth connect via `supabase.functions.invoke('fathom-oauth-url')` and `zoom-oauth-url`
- Disconnect via `useDisconnectSource` hook
- Service + Hook separation for all data access

### Integration Points
- `src/pages/ImportPage.tsx` — needs conditional rendering for each source in Pane 3
- `src/components/calls/CallDetailDialogue.tsx` (or similar) — needs Source Info accordion section
- `src/hooks/useImportSources.ts` — connect/disconnect hooks
- `src/hooks/useRawCalls.ts` or similar — hook for raw-calls.service.ts

</code_context>

<specifics>
## Specific Ideas

- Most components are complete and orphaned — wiring only, minimal new code
- FailedImportsSection already exists — just needs placement in ImportOverviewDashboard
- Connect CTA should be prominent and one-click (matches One-Click Promise)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-import-flows-source-details*
*Context gathered: 2026-03-30*
