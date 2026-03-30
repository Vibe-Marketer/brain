---
phase: 12-import-flows-source-details
plan: "02"
subsystem: ui
tags: [react, tanstack-query, call-detail, source-metadata, fathom, zoom, youtube, upload]

# Dependency graph
requires:
  - phase: 12-import-flows-source-details
    provides: raw-calls.service.ts dispatcher, RawCallData types, source_platform on Meeting
provides:
  - useRawCallData TanStack Query hook wrapping getRawCallData service
  - SourceInfoSection collapsible component with per-source metadata rendering
  - Source Info section wired into CallOverviewTab in CallDetailDialog

affects:
  - call-detail views
  - all four source import flows (Fathom, Zoom, YouTube, Upload)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useRawCallData follows service+hook separation pattern — service in raw-calls.service.ts, hook wraps it with TanStack Query"
    - "Type guards via 'fieldName' in data for union type dispatch in SourceInfoSection"

key-files:
  created:
    - src/hooks/useRawCallData.ts
    - src/components/call-detail/SourceInfoSection.tsx
  modified:
    - src/components/CallDetailDialog.tsx
    - src/components/call-detail/CallOverviewTab.tsx

key-decisions:
  - "SourceInfoSection uses simple useState toggle (not Radix Collapsible) — per plan discretion, simpler and sufficient"
  - "Type guards via in operator ('zoom_meeting_id' in data etc.) for discriminating union — matches plan specification"
  - "useRawCallData query key: ['raw-call-data', recordingId, sourceApp] — simple inline key rather than queryKeys factory since rawCalls factory uses per-source keys, not the unified dispatcher"

patterns-established:
  - "SourceInfoSection pattern: collapsible header with source icon + title, MetaRow helper for label/value pairs"

requirements-completed: [DETAIL-01]

# Metrics
duration: 8min
completed: 2026-03-30
---

# Phase 12 Plan 02: Source Info Section Summary

**Collapsible Source Info section added to call detail Overview tab — renders Zoom meeting ID/host/duration, Fathom recorded-by/invitees, YouTube view/like stats, and Upload filename/size via TanStack Query hook wrapping the existing raw-calls.service.ts dispatcher.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-30T21:33:00Z
- **Completed:** 2026-03-30T21:41:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created `useRawCallData` hook — TanStack Query wrapper around `getRawCallData` with 10-minute staleTime (raw source data doesn't change)
- Created `SourceInfoSection` component — collapsible accordion with source icon, per-source type-guarded rendering for all four sources, graceful "No source details available" empty state
- Integrated into `CallDetailDialog` and `CallOverviewTab` — raw call data fetched at dialog level, passed down to Overview tab where SourceInfoSection renders below the summary
- Fixed 6 stale `text-ink-muted` token occurrences in `CallOverviewTab` → `text-muted-foreground/60` (correct shadcn token per src/CLAUDE.md)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useRawCallData hook and SourceInfoSection component** - `5c0231cb` (feat)
2. **Task 2: Integrate SourceInfoSection into CallDetailDialog via CallOverviewTab** - `a93d63e0` (feat)

**Plan metadata:** (docs commit following)

## Files Created/Modified

- `src/hooks/useRawCallData.ts` - TanStack Query hook for raw call source metadata; wraps getRawCallData with 10min staleTime
- `src/components/call-detail/SourceInfoSection.tsx` - Collapsible section with per-source metadata rendering (Fathom/Zoom/YouTube/Upload), MetaRow helper, graceful empty state
- `src/components/CallDetailDialog.tsx` - Added useRawCallData hook call and passes rawCallData/rawCallLoading/sourceApp to CallOverviewTab
- `src/components/call-detail/CallOverviewTab.tsx` - Extended props interface, destructures new props, renders SourceInfoSection, fixed stale text-ink-muted tokens

## Decisions Made

- Used simple `useState` toggle for collapsible rather than Radix Collapsible — per plan discretion, simpler for this use case
- Query key `['raw-call-data', recordingId, sourceApp]` used inline rather than queryKeys factory — the existing `rawCalls` factory in query-config.ts has per-source keys; a unified key for the dispatcher-level hook is cleaner inline
- SourceInfoSection starts expanded (useState(true)) — source info is useful context, not secondary

## Deviations from Plan

None — plan executed exactly as written. The stale token fix was explicitly specified in Task 2 (not an auto-fix deviation).

## Issues Encountered

- Pre-existing build failure discovered: `OAuthCallback.tsx` imports missing `src/lib/zoom-api-client` (ENOENT). Confirmed pre-existing via `git stash` verification — build was already broken before this plan. Not caused by this plan's changes. Logged as out-of-scope.

## Known Stubs

None. The SourceInfoSection renders real data from the existing raw-calls.service.ts dispatcher. When no source data exists (null rawData), it shows "No source details available" — this is correct behavior, not a stub.

## Next Phase Readiness

- Source Info section is complete and wired — call detail modal now shows source-specific metadata for all four import types
- Ready to continue Phase 12 Plan 01 (import source detail wiring in Pane 2/3) if applicable

---
*Phase: 12-import-flows-source-details*
*Completed: 2026-03-30*

## Self-Check: PASSED

- src/hooks/useRawCallData.ts: FOUND
- src/components/call-detail/SourceInfoSection.tsx: FOUND
- .planning/phases/12-import-flows-source-details/12-02-SUMMARY.md: FOUND
- Commit 5c0231cb: FOUND
- Commit a93d63e0: FOUND
