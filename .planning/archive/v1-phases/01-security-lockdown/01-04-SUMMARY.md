---
phase: 01-security-lockdown
plan: 04
subsystem: security
tags: [cors, edge-functions, dynamic-origin, security, inline-migration]

# Dependency graph
requires:
  - phase: 01-security-lockdown
    provides: "getCorsHeaders() function in _shared/cors.ts (created in 01-01)"
  - phase: 01-security-lockdown
    provides: "Group B migration complete, corsHeaders export removed (01-03)"
provides:
  - "23 Group C batch 1 edge functions use dynamic CORS via getCorsHeaders(origin)"
  - "No inline wildcard CORS headers remain in functions A-G alphabetically"
affects: [01-05, 01-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "const corsHeaders = getCorsHeaders(origin) inside handler for all Group C functions"

key-files:
  created: []
  modified:
    - "supabase/functions/auto-tag-calls/index.ts"
    - "supabase/functions/automation-email/index.ts"
    - "supabase/functions/automation-engine/index.ts"
    - "supabase/functions/automation-scheduler/index.ts"
    - "supabase/functions/automation-sentiment/index.ts"
    - "supabase/functions/automation-webhook/index.ts"
    - "supabase/functions/chat-stream/index.ts"
    - "supabase/functions/create-fathom-webhook/index.ts"
    - "supabase/functions/delete-all-calls/index.ts"
    - "supabase/functions/embed-chunks/index.ts"
    - "supabase/functions/enrich-chunk-metadata/index.ts"
    - "supabase/functions/fathom-oauth-callback/index.ts"
    - "supabase/functions/fathom-oauth-refresh/index.ts"
    - "supabase/functions/fathom-oauth-url/index.ts"
    - "supabase/functions/fetch-meetings/index.ts"
    - "supabase/functions/fetch-single-meeting/index.ts"
    - "supabase/functions/generate-ai-titles/index.ts"
    - "supabase/functions/generate-meta-summary/index.ts"
    - "supabase/functions/get-config-status/index.ts"
    - "supabase/functions/google-meet-fetch-meetings/index.ts"
    - "supabase/functions/google-meet-sync-meetings/index.ts"
    - "supabase/functions/google-oauth-callback/index.ts"
    - "supabase/functions/google-oauth-refresh/index.ts"

key-decisions:
  - "Skipped backfill-chunk-metadata — no CORS handling (server-side utility function)"
  - "Used const corsHeaders inside handler for all Group C functions (no external helpers needing module-level access)"
  - "fetch-single-meeting uses serve() not Deno.serve() — same pattern applies"

patterns-established:
  - "const corsHeaders = getCorsHeaders(origin) inside handler body for inline CORS migration"

# Metrics
duration: 6min
completed: 2026-01-27
---

# Phase 1 Plan 4: CORS Migration Group C Batch 1 Summary

**Migrated 23 Group C edge functions from inline wildcard CORS constants to dynamic getCorsHeaders(origin) import**

## Performance

- **Duration:** 6 min
- **Started:** 2026-01-27T23:35:00Z
- **Completed:** 2026-01-27T23:41:00Z
- **Tasks:** 2/2
- **Files modified:** 23

## Accomplishments
- Migrated all 23 Group C batch 1 edge functions from inline `const corsHeaders = { 'Access-Control-Allow-Origin': '*', ... }` to dynamic `getCorsHeaders(origin)` from `_shared/cors.ts`
- All functions use a single migration pattern: delete inline constant, add import, extract origin at handler entry, use `const corsHeaders = getCorsHeaders(origin)`
- Kept variable name `corsHeaders` everywhere so all existing response references work unchanged with zero business logic modifications
- Correctly identified and skipped `backfill-chunk-metadata` which has no CORS handling at all (server-side utility)
- Handled special cases: `fetch-single-meeting` uses `serve()` instead of `Deno.serve()`, `fathom-oauth-refresh` and `google-oauth-refresh` export helper functions at module level (only handler code affected)

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate 16 functions (auto-tag-calls through fetch-single-meeting)** - `2473c1f` (fix)
2. **Task 2: Migrate 7 functions (generate-ai-titles through google-oauth-refresh)** - `0f3e569` (fix)

## Verification Results
- `grep -rl "getCorsHeaders" supabase/functions/ | grep -v _shared | wc -l` = **37** (14 from Plan 03 + 23 from Plan 04)
- Zero wildcard CORS strings found in any migrated file
- Each migrated file has exactly 2 getCorsHeaders references (import + usage)
- `backfill-chunk-metadata` confirmed: no CORS handling whatsoever

## Files Modified
- 23 edge function `index.ts` files (see key-files in frontmatter for complete list)

## Decisions Made
- **Skip backfill-chunk-metadata:** This function is a server-side batch utility with no CORS handling, OPTIONS handler, or browser-facing responses. It was listed in the plan's 24 functions but doesn't apply.
- **Single pattern for all:** Unlike Group B (which needed two patterns due to external helpers), all Group C functions use inline-only logic so they all use `const corsHeaders = getCorsHeaders(origin)` inside the handler.
- **fetch-single-meeting old-style serve():** Uses `serve()` from `std/http/server.ts` instead of `Deno.serve()` — same migration pattern works identically.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Skipped backfill-chunk-metadata (no CORS to migrate)**
- **Found during:** Task 1 file analysis
- **Issue:** backfill-chunk-metadata has no corsHeaders constant, no OPTIONS handler, no CORS handling at all — it's a server-side utility
- **Fix:** Skipped this file; migrated 23 functions instead of 24
- **Impact:** None — function was never browser-accessible

## Issues Encountered
None — all 23 functions followed the expected inline CORS pattern.

## User Setup Required
None — CORS behavior depends on `ALLOWED_ORIGINS` environment variable already configured in Supabase.

## Next Phase Readiness
- SEC-06 part 2 complete (Group C batch 1 migrated)
- Total functions migrated so far: 14 (Group B) + 23 (Group C batch 1) = **37 functions**
- Ready for 01-05-PLAN.md (CORS migration: Group C batch 2 — remaining functions)
- No blockers or concerns

---
*Phase: 01-security-lockdown*
*Completed: 2026-01-27*
