---
phase: 06-code-health-infrastructure
plan: 07
subsystem: backend
tags: [automation, supabase, edge-functions, graceful-degradation]

# Dependency graph
requires:
  - phase: 05-demo-polish
    provides: Automation rules routed and type-safe
provides:
  - Graceful handling when clients/tasks tables don't exist
  - Clear user feedback for unavailable features
  - Stable automation engine that won't crash on missing tables
affects: [phase-7-differentiators]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Table existence check before querying"
    - "Graceful skip with 'skipped' flag in response"
    - "Early return with informative note for missing features"

key-files:
  created: []
  modified:
    - supabase/functions/automation-engine/actions.ts

key-decisions:
  - "Option B chosen: Graceful skip (not creating tables yet)"
  - "Client Health tables will be created in Phase 7 (DIFF-03)"
  - "Tasks table has no clear requirement - deferred"

patterns-established:
  - "Pattern: Check table existence before queries with .limit(0)"
  - "Pattern: Return success with skipped=true for unavailable features"

# Metrics
duration: 1min
completed: 2026-01-31
---

# Phase 6 Plan 07: Handle Missing Table References Summary

**Graceful handling for non-existent clients, client_health_history, and tasks tables with clear feedback when features are unavailable**

## Performance

- **Duration:** 1 min
- **Started:** 2026-01-31T13:38:14Z
- **Completed:** 2026-01-31T13:39:57Z
- **Tasks:** 2 (combined into single implementation)
- **Files modified:** 1

## Accomplishments

- Researched table references: clients, client_health_history, tasks tables do not exist
- Confirmed Client Health is planned for Phase 7 (DIFF-03: Client Health Alerts)
- Implemented graceful handling in executeUpdateClientHealth with early table check
- Improved error messaging in executeCreateTask for missing tasks table
- No migration needed - tables will be created when features are implemented

## Task Commits

Each task was committed atomically:

1. **Tasks 1+2: Research and implement graceful handling** - `604930e` (fix)

**Plan metadata:** `[pending]` (docs: complete plan)

## Files Created/Modified

- `supabase/functions/automation-engine/actions.ts` - Added graceful handling for missing tables

## Decisions Made

1. **Option B: Graceful skip chosen over creating tables**
   - Client Health (clients, client_health_history) is Phase 7 feature
   - Tasks table has no clear requirement in roadmap
   - Creating empty tables would add maintenance burden without benefit

2. **Pattern: Early table existence check**
   - Query with `.limit(0)` to check if table exists
   - Return success with `skipped: true` flag
   - Clear note explaining feature is not yet available

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Automation engine stable - won't crash on missing tables
- Ready for Phase 7 to implement Client Health feature with actual tables
- Other automation actions (add_tag, add_to_folder, etc.) continue working normally

---
*Phase: 06-code-health-infrastructure*
*Completed: 2026-01-31*
