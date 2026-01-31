---
phase: 05-demo-polish
plan: 01
subsystem: routing, database
tags: [react-router, supabase, fathom_calls, automation-rules]

# Dependency graph
requires:
  - phase: 04-team-collaboration
    provides: Team infrastructure complete, ready for demo polish
provides:
  - Automation Rules page accessible at /automation-rules
  - CallDetailPage queries correct fathom_calls table
  - Sub-routes for rule creation, editing, and history
affects: [demo-polish, analytics-tabs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Parse URL params to number for numeric primary keys"
    - "Use sentiment_cache JSON field for sentiment data"

key-files:
  created: []
  modified:
    - src/App.tsx
    - src/pages/CallDetailPage.tsx

key-decisions:
  - "Parse callId URL param to number for recording_id queries"
  - "Map sentiment from sentiment_cache JSON (not top-level columns)"
  - "Simplified PROFITS/action_items tabs (features not in fathom_calls schema)"

patterns-established:
  - "Route params for numeric IDs need parseInt before Supabase queries"

# Metrics
duration: 3min
completed: 2026-01-31
---

# Phase 5 Plan 01: Route Automation Rules and Fix CallDetailPage Summary

**Added 4 Automation Rules routes and fixed CallDetailPage to query fathom_calls table with correct recording_id column**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-31T10:48:33Z
- **Completed:** 2026-01-31T10:51:50Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Automation Rules page now accessible at /automation-rules with 4 routes (list, new, edit, history)
- CallDetailPage queries correct `fathom_calls` table instead of non-existent `calls` table
- Insights query updated to use `recording_id` column
- Sentiment data extracted from `sentiment_cache` JSON field

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Automation Rules routes to App.tsx** - `490d6a1` (feat)
2. **Task 2: Fix CallDetailPage to query fathom_calls table** - `40fc81e` (fix)

## Files Created/Modified

- `src/App.tsx` - Added AutomationRules import and 4 protected routes
- `src/pages/CallDetailPage.tsx` - Fixed database query from `calls` to `fathom_calls`, updated column mappings

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Parse callId to number | `recording_id` is numeric, URL params are strings |
| Use sentiment_cache JSON | `fathom_calls` doesn't have `sentiment`/`sentiment_score` columns - data stored in JSON |
| Simplified PROFITS tab | `fathom_calls` doesn't have `profits_framework` column - show placeholder |
| Simplified action_items tab | `fathom_calls` doesn't have `action_items` column - show placeholder |
| Remove quotes query | `quotes` table doesn't exist in schema |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed CallDetailPage type errors from schema mismatch**
- **Found during:** Task 2 (Fix CallDetailPage database query)
- **Issue:** `fathom_calls` table has different schema than legacy `calls` table - many columns referenced don't exist
- **Fix:** 
  - Map `transcript` → `full_transcript`
  - Map `id` → `recording_id`
  - Extract sentiment from `sentiment_cache` JSON
  - Simplify PROFITS/action_items tabs (show placeholders - features not in current schema)
  - Remove quotes query (table doesn't exist)
- **Files modified:** src/pages/CallDetailPage.tsx
- **Verification:** Build passes, TypeScript compiles cleanly
- **Committed in:** 40fc81e (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (blocking - schema mismatch required additional column mapping)
**Impact on plan:** Required additional work to handle schema differences, but core fix achieved correctly.

## Issues Encountered

None - plan executed with one blocking issue automatically resolved.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- WIRE-01 addressed: Automation Rules page now accessible
- IMPL-03 addressed: CallDetailPage queries correct table
- Ready for 05-02-PLAN.md (Fix AutomationRules.tsx type mismatches)
- CallDetailPage may need future enhancement when PROFITS/action_items features are added to schema

---
*Phase: 05-demo-polish*
*Completed: 2026-01-31*
