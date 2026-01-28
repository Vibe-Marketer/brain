---
phase: 01-security-lockdown
plan: 01
subsystem: security
tags: [api-keys, edge-functions, auth, admin-check, dead-code-removal]

# Dependency graph
requires: []
provides:
  - "SEC-01: No client-side API key exposure (VITE_OPENAI_API_KEY eliminated)"
  - "SEC-02: Legacy unauthenticated edge functions deleted (extract-knowledge, generate-content)"
  - "SEC-03: Credential-exposing test-env-vars deleted, test-secrets requires admin role"
affects: [01-security-lockdown, 07-code-health]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Admin role check pattern via user_roles table query with service role client"

key-files:
  created: []
  modified:
    - "src/components/loop/ContentGenerator.tsx"
    - "supabase/functions/test-secrets/index.ts"
  deleted:
    - "src/lib/ai-agent.ts"
    - "src/hooks/useAIProcessing.ts"
    - "supabase/functions/extract-knowledge/index.ts"
    - "supabase/functions/generate-content/index.ts"
    - "supabase/functions/test-env-vars/index.ts"

key-decisions:
  - "Deleted test-env-vars entirely rather than securing — it exposed full credentials and self-documented as DELETE AFTER USE"
  - "Kept ContentGenerator.tsx (not dead code — used in CallDetailPage) but stubbed handleGenerate with migration TODO"
  - "Defined ExtractedInsight type inline in ContentGenerator.tsx rather than creating shared types file"

patterns-established:
  - "Admin role check: query user_roles with service role client, check role === 'ADMIN', return 403 if not"

# Metrics
duration: 3min
completed: 2026-01-27
---

# Phase 1 Plan 1: Delete Dangerous Code & Secure Test Endpoints Summary

**Eliminated client-side API key exposure (VITE_OPENAI_API_KEY), deleted 4 dangerous unauthenticated/credential-exposing edge functions, and added admin role gate to test-secrets**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-27T23:08:05Z
- **Completed:** 2026-01-27T23:10:42Z
- **Tasks:** 2
- **Files modified:** 7 (2 modified, 5 deleted)

## Accomplishments
- Removed client-side API key exposure — `VITE_OPENAI_API_KEY` no longer anywhere in browser-shipped code
- Deleted 2 legacy unauthenticated edge functions (`extract-knowledge`, `generate-content`) that allowed anonymous invocation
- Deleted `test-env-vars` which exposed the full `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, and had a database export mode — all with zero authentication
- Added admin role check to `test-secrets` so only ADMIN users can access secret diagnostics
- Fixed `ContentGenerator.tsx` to compile without deleted dependencies (inline type, stubbed handler)

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete client-side API key code and legacy unauthenticated functions** - `768d5a4` (feat)
2. **Task 2: Delete test-env-vars and add admin check to test-secrets** - `05da670` (feat)

## Files Created/Modified
- `src/lib/ai-agent.ts` - **DELETED** — contained `VITE_OPENAI_API_KEY` client-side exposure
- `src/hooks/useAIProcessing.ts` - **DELETED** — dead wrapper hook for ai-agent
- `src/components/loop/ContentGenerator.tsx` - Removed broken imports, defined `ExtractedInsight` type inline, stubbed `handleGenerate` with migration TODO
- `supabase/functions/extract-knowledge/index.ts` - **DELETED** — zero-auth legacy edge function
- `supabase/functions/generate-content/index.ts` - **DELETED** — zero-auth legacy edge function
- `supabase/functions/test-env-vars/index.ts` - **DELETED** — zero-auth credential exposure + DB export tool
- `supabase/functions/test-secrets/index.ts` - Added admin role check via `user_roles` table before secret retrieval

## Decisions Made
- **Deleted test-env-vars entirely** rather than securing it — the function exposed full credential values (not truncated), had a database export mode, and self-documented as "DELETE AFTER USE". Securing it would still leave an unnecessary attack surface.
- **Kept ContentGenerator.tsx** — grep confirmed it's imported in `CallDetailPage.tsx` (active route), so not dead code. Stubbed the AI handler with a toast message and TODO for future edge function wiring.
- **Defined ExtractedInsight inline** in ContentGenerator.tsx rather than creating a shared types file — keeps the change minimal and avoids creating infrastructure for a type that may change when content generation is properly rewired in Phase 7.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SEC-01, SEC-02, SEC-03 requirements fully satisfied
- Ready for 01-02-PLAN.md (Replace PII logging & fix type safety bypasses)
- ContentGenerator.tsx AI functionality is stubbed — will need rewiring when content generation pipeline is connected (tracked as future work, not blocking)

---
*Phase: 01-security-lockdown*
*Completed: 2026-01-27*
