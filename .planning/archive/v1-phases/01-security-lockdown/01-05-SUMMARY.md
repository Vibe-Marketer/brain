---
phase: 01-security-lockdown
plan: 05
subsystem: security
tags: [cors, edge-functions, dynamic-origin, security, inline-migration]

# Dependency graph
requires:
  - phase: 01-security-lockdown
    provides: "getCorsHeaders() function in _shared/cors.ts (created in 01-01)"
  - phase: 01-security-lockdown
    provides: "Group B migration complete, corsHeaders export removed (01-03)"
  - phase: 01-security-lockdown
    provides: "Group C batch 1 migration complete (01-04)"
provides:
  - "23 Group C batch 2 edge functions use dynamic CORS via getCorsHeaders(origin)"
  - "SEC-06 COMPLETE: All 60 production edge functions use dynamic CORS"
  - "Zero inline wildcard CORS constants remain in entire codebase"
affects: [01-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "const corsHeaders = getCorsHeaders(origin) inside handler for all Group C functions"

key-files:
  created: []
  modified:
    - "supabase/functions/google-oauth-url/index.ts"
    - "supabase/functions/google-poll-sync/index.ts"
    - "supabase/functions/process-embeddings/index.ts"
    - "supabase/functions/rerank-results/index.ts"
    - "supabase/functions/resync-all-calls/index.ts"
    - "supabase/functions/retry-failed-embeddings/index.ts"
    - "supabase/functions/save-fathom-key/index.ts"
    - "supabase/functions/save-host-email/index.ts"
    - "supabase/functions/save-webhook-secret/index.ts"
    - "supabase/functions/semantic-search/index.ts"
    - "supabase/functions/send-coach-invite/index.ts"
    - "supabase/functions/sync-meetings/index.ts"
    - "supabase/functions/sync-openrouter-models/index.ts"
    - "supabase/functions/test-fathom-connection/index.ts"
    - "supabase/functions/test-secrets/index.ts"
    - "supabase/functions/webhook/index.ts"
    - "supabase/functions/youtube-api/index.ts"
    - "supabase/functions/zoom-fetch-meetings/index.ts"
    - "supabase/functions/zoom-oauth-callback/index.ts"
    - "supabase/functions/zoom-oauth-refresh/index.ts"
    - "supabase/functions/zoom-oauth-url/index.ts"
    - "supabase/functions/zoom-sync-meetings/index.ts"
    - "supabase/functions/zoom-webhook/index.ts"

key-decisions:
  - "Applied same Pattern A (const inside handler) to all 23 functions"
  - "webhook/index.ts custom Allow-Headers (webhook-id, webhook-signature, etc.) handled by getCorsHeaders()"
  - "zoom-webhook/index.ts custom Allow-Headers (x-zm-signature, x-zm-request-timestamp) handled by getCorsHeaders()"
  - "sync-openrouter-models had extra Access-Control-Allow-Methods — getCorsHeaders() covers this"

patterns-established:
  - "const corsHeaders = getCorsHeaders(origin) inside handler body — universal pattern across all 60 functions"

# Metrics
duration: 10min
completed: 2026-01-28
---

# Phase 1 Plan 5: CORS Migration Group C Batch 2 Summary

**Migrated final 23 Group C edge functions from inline wildcard CORS to dynamic getCorsHeaders(origin) — SEC-06 COMPLETE**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-01-28T00:23:24Z
- **Completed:** 2026-01-28T00:33:47Z
- **Tasks:** 2/2
- **Files modified:** 23

## Accomplishments
- Migrated all 23 remaining Group C batch 2 edge functions from inline `const corsHeaders = { 'Access-Control-Allow-Origin': '*', ... }` to dynamic `getCorsHeaders(origin)` from `_shared/cors.ts`
- **SEC-06 COMPLETE:** All 60 production edge functions now use dynamic CORS via `getCorsHeaders()`
- Zero inline wildcard CORS constants remain anywhere in `supabase/functions/`
- Handled special cases: `webhook/index.ts` and `zoom-webhook/index.ts` had non-standard Allow-Headers (webhook-specific headers) — the shared `getCorsHeaders()` function covers all needed headers
- `sync-openrouter-models/index.ts` had extra `Access-Control-Allow-Methods` header — covered by `getCorsHeaders()`

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate 11 functions (google-oauth-url through send-coach-invite)** - `69f244c` (fix)
2. **Task 2: Migrate 12 functions (sync-meetings through zoom-webhook)** - `ed33148` (fix)

## Verification Results
- `grep -rl "getCorsHeaders" supabase/functions/ | grep -v _shared | wc -l` = **60** (14 Group B + 23 batch 1 + 23 batch 2)
- `grep -rl "'Access-Control-Allow-Origin': '\\*'" supabase/functions/` = **ZERO matches**
- `grep -rl "const corsHeaders" supabase/functions/ | grep -v _shared` = all are dynamic `getCorsHeaders(origin)` calls inside handlers (verified)
- Every function has: import getCorsHeaders, origin extraction, corsHeaders variable used in all responses

## Files Modified
- 23 edge function `index.ts` files (see key-files in frontmatter for complete list)

## Decisions Made
- **Same pattern for all 23:** All use `const corsHeaders = getCorsHeaders(origin)` inside the handler — consistent with Group C batch 1 pattern
- **Webhook functions migrated as-is:** `webhook/index.ts` and `zoom-webhook/index.ts` had custom Allow-Headers for webhook-specific headers (webhook-id, webhook-signature, x-zm-signature, etc.) — the shared `getCorsHeaders()` function includes all standard headers; the webhook-specific headers are handled by the webhook signature verification logic, not CORS
- **sync-openrouter-models Access-Control-Allow-Methods:** This function had an extra `Allow-Methods: POST, OPTIONS` in its CORS constant — `getCorsHeaders()` handles this implicitly

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None — all 23 functions followed the expected inline CORS pattern.

## User Setup Required
None — CORS behavior depends on `ALLOWED_ORIGINS` environment variable already configured in Supabase.

## Next Phase Readiness
- SEC-06 COMPLETE: All production edge functions migrated
- Total functions migrated across all plans: 14 (Group B, Plan 03) + 23 (Group C batch 1, Plan 04) + 23 (Group C batch 2, Plan 05) = **60 functions**
- Ready for 01-06-PLAN.md (Security audit — final phase 1 plan)
- No blockers or concerns

---
*Phase: 01-security-lockdown*
*Completed: 2026-01-28*
