---
phase: 07-differentiators
plan: 01
subsystem: ai
tags: [profits, extraction, sales-psychology, openrouter, vercel-ai-sdk, citations]

# Dependency graph
requires:
  - phase: 06-code-health
    provides: Stable infrastructure, rate limiting, clean codebase
provides:
  - PROFITS extraction Edge Function (extract-profits)
  - usePROFITS hook for React components
  - PROFITSReport and PROFITSSection UI components
  - Citation system linking to transcript moments
affects: [07-differentiators, analytics, content-generation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - PROFITS 7-category extraction (P/R/O/F/I/T/S)
    - Citation linking from AI findings to transcript segments
    - Collapsible section UI with color-coded letter badges

key-files:
  created:
    - supabase/functions/extract-profits/index.ts
    - src/hooks/usePROFITS.ts
    - src/components/profits/PROFITSReport.tsx
    - src/components/profits/PROFITSSection.tsx
  modified:
    - src/pages/CallDetailPage.tsx

key-decisions:
  - "Used fathom_transcripts table directly for citations (not transcript_chunks)"
  - "Store PROFITS in fathom_calls.profits_framework JSONB column (existing)"
  - "Claude 3 Haiku for extraction (cost-effective, good quality)"
  - "Segment-indexed citations for clickable quotes"

patterns-established:
  - "PROFITS extraction follows content-insight-miner pattern"
  - "Citation structure: { transcript_id, timestamp }"
  - "Section collapse/expand with finding count badges"

# Metrics
duration: 5min
completed: 2026-01-31
---

# Phase 7 Plan 01: PROFITS Framework Summary

**PROFITS extraction Edge Function with usePROFITS hook, section UI components, and CallDetailPage integration with clickable citation system**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-31T15:41:16Z
- **Completed:** 2026-01-31T15:46:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Created extract-profits Edge Function that extracts PROFITS insights with verbatim quotes
- Built usePROFITS hook with query/mutation pattern for data fetching and extraction triggering
- Implemented PROFITSReport and PROFITSSection components with collapsible sections
- Wired PROFITS tab in CallDetailPage with citation click handling
- Added color-coded letter badges and confidence indicators

## Task Commits

Each task was committed atomically:

1. **Task 1: Create extract-profits Edge Function** - `997586a` (feat)
2. **Task 2: Create usePROFITS hook and UI components** - `e921a97` (feat)
3. **Task 3: Wire PROFITS tab in CallDetailPage** - `fdf1a13` (feat)

## Files Created/Modified

- `supabase/functions/extract-profits/index.ts` - Edge Function for PROFITS extraction
- `src/hooks/usePROFITS.ts` - React hook for PROFITS data management
- `src/components/profits/PROFITSReport.tsx` - Full report component with extraction button
- `src/components/profits/PROFITSSection.tsx` - Collapsible section component with findings
- `src/pages/CallDetailPage.tsx` - Updated to use PROFITSReport in PROFITS tab

## Decisions Made

- **Citation structure**: Uses `{ transcript_id, timestamp }` linking directly to fathom_transcripts rows
- **Model selection**: Claude 3 Haiku via OpenRouter for cost-effective extraction
- **Storage location**: Uses existing `fathom_calls.profits_framework` JSONB column
- **Segment indexing**: AI receives segment markers `[SEG N]` to reference quotes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **TypeScript types stale**: The `profits_framework` column exists in the database but wasn't in generated Supabase types. Worked around with type casting through `unknown`. Regenerating types with `supabase gen types` would fix this permanently.

## Next Phase Readiness

- PROFITS extraction functional end-to-end
- Ready for 07-02 (Folder-Level Chat)
- Citation click currently switches to transcript tab (enhancement to scroll to exact segment possible)

---
*Phase: 07-differentiators*
*Completed: 2026-01-31*
