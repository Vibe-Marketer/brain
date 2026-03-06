# Phase 11: PROFITS Frontend Trigger - Context

**Gathered:** 2026-02-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the orphaned extract-profits Edge Function to the Content generators area. Users can run PROFITS analysis on single or multiple calls from a dedicated page, with batch aggregation and sequential trend analysis. Also clean up Content area navigation: remove indented "Social Posts" sub-item from the category pane so all generators are accessed through the generators grid. Replace the Call Detail PROFITS tab with a link to the Content page.

</domain>

<decisions>
## Implementation Decisions

### Entry point & navigation
- Available in **TWO places**: ContentGenerators page AND Call Detail view
- Add PROFITS as a **new generator card** in the Content generators grid (alongside Social Post Generator, Document, Video)
- Card links to a **dedicated page** at `/content/generators/profits`
- PROFITS does **NOT** get an entry in the Content category pane (2nd pane) — accessed only via the generator card
- **Remove the indented "Social Posts" sub-item** from ContentCategoryPane — all generators are reached through the generators grid, not via sidebar nav. Top-level items (Overview, Generators, Hooks, Posts, Emails) stay.
- **Call Detail:** Add button next to existing "Content" button that navigates to `/content/generators/profits?recording_id=X` with the call pre-selected (not inline dialog). Remove the inline PROFITSReport tab from Call Detail.
- Both entry points work: direct from generators grid (pick call on the page) or from Call Detail (pre-selected)

### Call selection flow
- **Scrollable call list** on the PROFITS page for selecting calls — shows recent calls with title, date, duration
- Call list **respects bank/vault context** (only shows calls from active workspace)
- **Multi-select enabled** — checkbox selection for batch analysis
- **No cancellation once started** — analysis must complete
- **Two analysis modes:**
  - **Batch** — aggregate PROFITS across N calls into one combined report (requires new backend logic)
  - **Sequential** — run per-call analysis to see trends over time
- Single-call analysis is the degenerate case of either mode
- **Batch backend included in Phase 11 scope** — new Edge Function or extension of extract-profits to handle aggregation across multiple calls with token-limit-aware batching
- When arriving via Call Detail link (`?recording_id=X`), that call is pre-selected in the list

### Results presentation
- **Tab-based letter navigation** (P | R | O | F | I | T | S) — 7 tabs, click each to see that letter's findings. Replaces the accordion pattern from the old PROFITSReport.
- Each finding shows **expandable citation** (click to reveal source quote + timestamp) — prevents information overload while preserving traceability
- **Confidence scores visible** for each finding (percentage or indicator)
- **Batch results:** Aggregated batch view shows combined/synthesized insights per letter tab. Click through to see individual call breakdowns.
- **Sequential/trend results:** OpenCode's discretion on visualization (timeline vs comparison table — pick what best shows how findings evolve across calls chronologically)
- **Export:** Copy to clipboard (no PDF needed). Also download as file (markdown or similar). Per-section and full report.

### Progress & loading experience
- **Per-call progress list** — shows all selected calls with status indicators: pending, analyzing, complete, error. Like a task queue.
- **Progress steps:** "Analyzing transcript..." -> "Extracting findings..." etc.
- **For batch:** Overall progress ("Analyzing 3 of 5 calls...")
- **Auto-retry on failure** — retry once automatically on failed extraction. If still fails, show error message with both **"Retry" AND "Skip to next"** options.
- **Incremental vs wait-for-all:** OpenCode's discretion — pick based on UX quality and whether batch aggregation requires all calls to complete first.
- **Cached results:** OpenCode's discretion — use cached results by default to skip re-extraction (existing Edge Function supports this via `force_refresh` param). Offer re-analyze option.

### OpenCode's Discretion
- Sequential trend visualization format (timeline vs comparison table)
- Incremental result display vs wait-for-all (depends on batch aggregation requirements)
- Cached result handling (default to cache, re-analyze button)
- Loading skeleton design for the PROFITS page
- Exact progress step labels and timing
- Tab styling and icon choices for PROFITS letters
- Confidence score visual treatment (percentage vs badge vs color vs circular [like on the main transcripts page — most on brand])
- Exact call list UI details (search/filter within the list)
- Clipboard format for export
- Export file format (markdown recommended, but OpenCode can choose)
- Generator card icon and description text
- Call picker component implementation details
- Token limit strategy for batch aggregation (how many calls per batch)

</decisions>

<specifics>
## Specific Ideas

- "You want to be able to extract PROFITS from across a number of calls more often than you'll want to extract from a single call" — multi-call is the primary use case, single-call is secondary
- Batch mode = aggregate combined view. Sequential mode = per-call for trend analysis. Both should be available.
- The Content category pane cleanup (removing "Social Posts" sub-item) is a general principle: no generator gets special nav treatment. All generators are cards in the grid.
- Generator card should match existing Social Post Generator pattern (icon, title, description, arrow)
- Tab-based letter navigation keeps the dense PROFITS data digestible
- Expandable citations prevent information overload while preserving traceability
- Force refresh option ensures users can get fresh analysis if transcript was updated

</specifics>

<deferred>
## Deferred Ideas

- PROFITS analysis results feeding into other generators (e.g., auto-generate social posts from PROFITS insights) — future phase
- PROFITS comparison across different clients/contacts — future phase (depends on Contacts Database)
- Saving/bookmarking PROFITS reports to a library (like Posts/Hooks libraries) — future phase

</deferred>

---

*Phase: 11-profits-frontend-trigger*
*Context gathered: 2026-02-11*
