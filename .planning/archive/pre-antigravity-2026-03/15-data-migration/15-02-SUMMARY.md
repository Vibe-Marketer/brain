---
phase: 15-data-migration
plan: 02
subsystem: ui
tags: [react, tanstack-query, supabase, typescript, recordings, calls-list]

# Dependency graph
requires:
  - phase: 15-01
    provides: recordings table populated with migrated fathom_calls data, RLS verified clean
  - phase: 14-04
    provides: AppShell layout, TanStack Router routes for / and /calls/$callId, query-config.ts key factory

provides:
  - recordings service layer (getRecordings, getRecordingById) querying supabase recordings table
  - useRecordings and useRecording TanStack Query hooks
  - recordings domain added to queryKeys factory
  - / route renders live recordings list (title, date, duration, source_app badge)
  - /calls/:id route renders full recording detail with summary, tags, and transcript
  - Zero fathom_calls references in authored v2 source code

affects:
  - phase-16-workspace-redesign (calls list is the primary surface for workspace filtering)
  - phase-17-import-pipeline (import result should appear in calls list immediately via query invalidation)
  - phase-19-mcp-audit (MCP tools query recordings table; frontend now verifies data integrity visually)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Supabase service functions in src/services/ — data access layer separate from hooks"
    - "RecordingListItem narrower type using Pick<> for list views, full Row for detail views"
    - "useRecordings/useRecording hooks follow TanStack Query + useAuth enabled pattern"
    - "recordings domain added to queryKeys factory alongside existing calls, workspaces, folders domains"

key-files:
  created:
    - src/services/recordings.service.ts
    - src/hooks/useRecordings.ts
  modified:
    - src/lib/query-config.ts
    - src/routes/_authenticated/index.tsx
    - src/routes/_authenticated/calls/$callId.tsx

key-decisions:
  - "fathom_calls never referenced in authored v2 source — recordings table only (hard boundary)"
  - "RecordingListItem = Pick for list, full Row for detail — avoids transferring transcript in list query"
  - "service functions in src/services/ separate from hooks for testability and reuse"

patterns-established:
  - "Service layer pattern: src/services/*.service.ts exports plain async functions, hooks wrap with useQuery"
  - "Narrower list type via Pick<Row, ...> avoids fetching heavy columns (full_transcript) in list queries"

# Metrics
duration: 8min
completed: 2026-02-28
---

# Phase 15 Plan 02: Frontend Data Wiring Summary

**Recordings service layer and TanStack Query hooks wired to / and /calls/:id routes — real call history visible in v2 frontend with title, date, duration, source app badge, and full transcript on detail page**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-28T01:05:28Z
- **Completed:** 2026-02-28T01:13:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created `src/services/recordings.service.ts` with `getRecordings()` (list, ordered by date desc) and `getRecordingById()` (full detail with transcript)
- Created `src/hooks/useRecordings.ts` with `useRecordings()` and `useRecording(id)` hooks, both gated on session
- Added `recordings` domain to the `queryKeys` factory in `query-config.ts`
- Replaced "Coming soon" placeholder in `/` (index.tsx) with a live recordings list linking to /calls/:id
- Replaced "Coming soon" placeholder in `/calls/:id` ($callId.tsx) with full recording detail — title, date, duration, source_app, summary, tags, transcript
- `pnpm build` passes with zero TypeScript or bundler errors
- Zero `fathom_calls` references in authored v2 source code (only the auto-generated supabase.ts types file, expected)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create recordings service and TanStack Query hooks** - `91d3758` (feat)
2. **Task 2: Wire calls list and call detail pages to recordings data** - `530af0c` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/services/recordings.service.ts` - Supabase data access: getRecordings() and getRecordingById()
- `src/hooks/useRecordings.ts` - TanStack Query hooks: useRecordings() and useRecording(id)
- `src/lib/query-config.ts` - Added recordings domain to queryKeys factory
- `src/routes/_authenticated/index.tsx` - Replaced placeholder with live recordings list
- `src/routes/_authenticated/calls/$callId.tsx` - Replaced placeholder with full call detail

## Decisions Made
- `fathom_calls` is a hard boundary — zero references in authored v2 source code. The only match in src/ is the auto-generated supabase types file which lists all tables.
- `RecordingListItem` uses `Pick<Row, ...>` to exclude `full_transcript` from list queries — avoids fetching heavy transcript data for every row in the list view.
- Services pattern established: plain async functions in `src/services/`, TanStack Query hooks in `src/hooks/`. This separates data access from cache management and makes functions independently testable.

## Deviations from Plan
None — plan executed exactly as written.

## Issues Encountered
None — TypeScript compiled clean on first attempt, pnpm build passed with zero errors.

## User Setup Required
None — no external service configuration required. The recordings table was populated in Plan 01; the frontend reads it directly via Supabase RLS.

## Next Phase Readiness
- Phase 15 Plan 02 complete. Plans 03 (archive fathom_calls) and 04 (cleanup) remaining.
- The v2 frontend now shows real call data. An authenticated user can navigate to / and see their complete call history, click any call and read the full transcript.
- No blockers for Plans 03 and 04.

---
*Phase: 15-data-migration*
*Completed: 2026-02-28*

## Self-Check: PASSED

- [x] `src/services/recordings.service.ts` — FOUND
- [x] `src/hooks/useRecordings.ts` — FOUND
- [x] `src/lib/query-config.ts` — modified (recordings domain added)
- [x] `src/routes/_authenticated/index.tsx` — modified (real recordings list)
- [x] `src/routes/_authenticated/calls/$callId.tsx` — modified (real call detail)
- [x] `.planning/phases/15-data-migration/15-02-SUMMARY.md` — FOUND
- [x] Commit `91d3758` — FOUND (Task 1)
- [x] Commit `530af0c` — FOUND (Task 2)
- [x] `pnpm build` passes
- [x] Zero fathom_calls in authored v2 source
