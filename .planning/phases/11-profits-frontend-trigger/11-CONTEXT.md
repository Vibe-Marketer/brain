# Phase 11: PROFITS Frontend Trigger - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the orphaned extract-profits Edge Function to a user-facing trigger in the Content area. Users can select call(s) and run PROFITS Framework analysis, with results displayed in a structured report format. The backend extraction logic already exists — this phase adds the frontend trigger and display.

</domain>

<decisions>
## Implementation Decisions

### Entry point location
- Available in TWO places: ContentGenerators page AND Call Detail view
- ContentGenerators: Add as new generator card (same style as Social Post Generator)
- Call Detail: Add button next to existing "Content" button
- Call Detail button navigates to PROFITS page with call pre-selected (not inline dialog)

### Trigger flow
- Multi-select call picker on PROFITS page (checkbox selection for batch analysis)
- Run sequentially, show separate reports (each call gets its own PROFITS report)
- Always show "Refresh" button to re-analyze even if cached results exist
- No cancellation once started — must complete

### Results display
- 7 tabs for PROFITS letters (P, R, O, F, I, T, S) — click to switch between sections
- Each finding shows expandable citation (click to reveal source quote + timestamp)
- Confidence scores visible for each finding (percentage or indicator)
- Copy to clipboard export (no PDF needed)

### Progress indication
- Progress bar with steps: "Analyzing transcript..." → "Extracting findings..." etc.
- For batch: Overall progress bar ("Analyzing 3 of 5 calls...")
- On error: Show error message with both "Retry" AND "Skip to next" options

### Claude's Discretion
- Exact progress step labels and timing
- Tab styling and icon choices for PROFITS letters
- Confidence score visual treatment (percentage vs badge vs color)
- Clipboard format for export
- Call picker component implementation details

</decisions>

<specifics>
## Specific Ideas

- Generator card should match existing Social Post Generator pattern (icon, title, description, arrow)
- Tab-based letter navigation keeps the dense PROFITS data digestible
- Expandable citations prevent information overload while preserving traceability
- Force refresh option ensures users can get fresh analysis if transcript was updated

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-profits-frontend-trigger*
*Context gathered: 2026-02-02*
