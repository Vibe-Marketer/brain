# Phase 16: Filters & Sort - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix all filter popovers and sort columns that broke during v1→v2 migration. Filters should stack with AND logic, pills remove cleanly, sort columns work bidirectionally, and inline search syntax operators return org-scoped results. All filter/sort infrastructure exists — this is repair work.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure bug-fix/repair phase. Key known issues from codebase audit:
- Filter/sort broken from v1.1 — absorbed into this phase
- URL-based filter state persistence is a working v1 feature that just needs org scoping
- Inline search syntax operators (participant:, tag:, folder:, source:, duration:, date:, status:) need verification/repair

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Filter popover components exist in `src/components/filters/` or `src/components/transcript-library/`
- `src/hooks/useFilters.ts` or similar — filter state management
- `src/hooks/useTableSort.ts` — sort state management
- URL-based filter persistence — existing v1 feature
- FilterBar.tsx — central filter bar component (org-scoped after Phase 11)

### Integration Points
- TranscriptTable filter popovers
- URL params for filter state persistence
- Sort column headers in transcript table

</code_context>

<specifics>
## Specific Ideas

No specific requirements — bug-fix phase

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>

---

*Phase: 16-filters-sort*
*Context gathered: 2026-03-30 via infrastructure skip*
