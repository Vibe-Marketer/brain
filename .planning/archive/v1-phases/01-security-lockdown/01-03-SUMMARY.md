---
phase: 01-security-lockdown
plan: 03
subsystem: security
tags: [cors, edge-functions, dynamic-origin, security]

# Dependency graph
requires:
  - phase: 01-security-lockdown
    provides: "getCorsHeaders() function in _shared/cors.ts (created in 01-01)"
provides:
  - "All 14 Group B edge functions use dynamic CORS via getCorsHeaders(origin)"
  - "Wildcard corsHeaders export removed from _shared/cors.ts"
affects: [01-04, 01-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level let corsHeaders set per-request for functions with external helpers"
    - "const corsHeaders = getCorsHeaders(origin) for functions with inline-only logic"

key-files:
  created: []
  modified:
    - "supabase/functions/_shared/cors.ts"
    - "supabase/functions/coach-notes/index.ts"
    - "supabase/functions/coach-relationships/index.ts"
    - "supabase/functions/coach-shares/index.ts"
    - "supabase/functions/content-builder/index.ts"
    - "supabase/functions/content-classifier/index.ts"
    - "supabase/functions/content-hook-generator/index.ts"
    - "supabase/functions/content-insight-miner/index.ts"
    - "supabase/functions/get-available-models/index.ts"
    - "supabase/functions/manager-notes/index.ts"
    - "supabase/functions/share-call/index.ts"
    - "supabase/functions/team-direct-reports/index.ts"
    - "supabase/functions/team-memberships/index.ts"
    - "supabase/functions/team-shares/index.ts"
    - "supabase/functions/teams/index.ts"

key-decisions:
  - "Two migration patterns: module-level let for functions with external helpers, const for inline-only"
  - "Kept variable name corsHeaders in Pattern B functions to minimize diff and avoid threading params through helpers"
  - "Removed backward-compatible corsHeaders export after confirming zero imports"

patterns-established:
  - "Module-level let corsHeaders = getCorsHeaders(origin) pattern for Deno edge functions with helpers"
  - "const corsHeaders = getCorsHeaders(origin) pattern for Deno edge functions with inline logic"

# Metrics
duration: 8min
completed: 2026-01-27
---

# Phase 1 Plan 3: CORS Migration Group B Functions Summary

**Migrated 14 Group B edge functions from wildcard corsHeaders to dynamic getCorsHeaders(origin) and removed backward-compatible export**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-27T23:23:40Z
- **Completed:** 2026-01-27T23:31:40Z
- **Tasks:** 2/2
- **Files modified:** 15

## Accomplishments
- Migrated all 14 Group B edge functions from importing `corsHeaders` (wildcard `*`) to using `getCorsHeaders(origin)` (dynamic origin checking)
- Used two patterns based on function structure:
  - **Pattern A** (5 functions with `Deno.serve` + inline logic): `const corsHeaders = getCorsHeaders(origin)` local variable
  - **Pattern B** (9 functions with `serve()` + external helpers): `let corsHeaders` module-level variable set per-request
- Removed the backward-compatible `export const corsHeaders` from `_shared/cors.ts` — only `getCorsHeaders()` remains
- All helper functions (handleCreateNote, handleGetTeam, etc.) continue working without parameter changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate 14 Group B functions to getCorsHeaders()** - `be022a8` (fix)
2. **Task 2: Remove backward-compatible corsHeaders export from _shared/cors.ts** - `3ff2911` (fix)

## Files Created/Modified
- `supabase/functions/_shared/cors.ts` - Removed `export const corsHeaders` (lines 23-27)
- `supabase/functions/coach-notes/index.ts` - getCorsHeaders import + module-level let + origin extraction
- `supabase/functions/coach-relationships/index.ts` - getCorsHeaders import + module-level let + origin extraction
- `supabase/functions/coach-shares/index.ts` - getCorsHeaders import + module-level let + origin extraction
- `supabase/functions/content-builder/index.ts` - getCorsHeaders import + const + origin extraction
- `supabase/functions/content-classifier/index.ts` - getCorsHeaders import + const + origin extraction
- `supabase/functions/content-hook-generator/index.ts` - getCorsHeaders import + const + origin extraction
- `supabase/functions/content-insight-miner/index.ts` - getCorsHeaders import + const + origin extraction
- `supabase/functions/get-available-models/index.ts` - getCorsHeaders import + const + origin extraction
- `supabase/functions/manager-notes/index.ts` - getCorsHeaders import + module-level let + origin extraction
- `supabase/functions/share-call/index.ts` - getCorsHeaders import + module-level let + origin extraction
- `supabase/functions/team-direct-reports/index.ts` - getCorsHeaders import + module-level let + origin extraction
- `supabase/functions/team-memberships/index.ts` - getCorsHeaders import + module-level let + origin extraction
- `supabase/functions/team-shares/index.ts` - getCorsHeaders import + module-level let + origin extraction
- `supabase/functions/teams/index.ts` - getCorsHeaders import + module-level let + origin extraction

## Decisions Made
- **Two migration patterns:** Functions with external helper functions (coach-notes, teams, etc.) that reference `corsHeaders` at module scope use `let corsHeaders` reassigned per-request. Functions with all logic inside the handler (content-builder, etc.) use `const corsHeaders` locally. This minimized code changes while achieving dynamic CORS.
- **Kept variable name `corsHeaders`:** For Pattern B, keeping the same variable name means all helper functions work without any parameter threading changes. Only the import and initialization change.
- **Safe removal:** Confirmed zero imports of `corsHeaders` before removing the export. Group C functions (plans 04/05) use INLINE cors headers, not imports from `_shared/cors.ts`.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None — all 14 functions followed the expected import/usage pattern.

## User Setup Required
None — CORS behavior depends on `ALLOWED_ORIGINS` environment variable already configured in Supabase.

## Next Phase Readiness
- SEC-06 part 1 complete (Group B functions migrated)
- Ready for 01-04-PLAN.md (CORS migration: Group C batch 1 — 24 functions with INLINE cors headers)
- No blockers or concerns

---
*Phase: 01-security-lockdown*
*Completed: 2026-01-27*
