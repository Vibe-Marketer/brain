---
phase: 03-per-workspace-mcp-endpoints-+-connect-to-ai
plan: 01
subsystem: auth
tags: [mcp, oauth, supabase, tokens, rls]
requires:
  - phase: 02-mcp-monolith-refactor
    provides: modular mcp-server auth/dispatch baseline
provides:
  - OAuth client grants table with revoke and last-used tracking
  - Prefixed manual MCP token generation with legacy token compatibility
  - MCP auth flow using per-client grants instead of legacy org binding
affects: [MCP-02, MCP-03, phase-03-plans]
tech-stack:
  added: []
  patterns: [grant-backed oauth auth, prefixed-manual-token format]
key-files:
  created:
    - supabase/migrations/20260528163000_mcp_oauth_client_grants_and_prefixed_tokens.sql
    - supabase/functions/mcp-server/__tests__/oauth-client-grants.integration.test.ts
  modified:
    - supabase/functions/mcp-server/auth.ts
    - supabase/functions/mcp-server/protocol.ts
    - src/types/supabase.ts
key-decisions:
  - "OAuth JWT auth now resolves against mcp_oauth_client_grants keyed by user + client_id and fails closed on missing/revoked grants."
  - "Manual tokens support cv_org_/cv_ws_ prefixes while retaining 64-char legacy token fallback."
patterns-established:
  - "OAuth authorization failures return 403 while invalid bearer remains 401."
  - "Grant and token rows update last_used_at asynchronously on successful auth."
requirements-completed: [MCP-02, MCP-03]
duration: 36min
completed: 2026-05-28
---

# Phase 03 Plan 01: OAuth client grants and prefixed manual token auth Summary

**Phase 03 now uses first-class per-client OAuth grants with revoke-aware auth and prefixed manual token compatibility as the security substrate for workspace MCP setup.**

## Performance

- **Duration:** 36 min
- **Started:** 2026-05-28T11:39:00Z
- **Completed:** 2026-05-28T12:15:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Added Wave 0 regression coverage for OAuth grant resolution, revocation behavior, prefixed tokens, and 401/403 status semantics.
- Implemented `mcp_oauth_client_grants` migration + legacy binding backfill, plus prefixed token generation and revoke columns for manual tokens.
- Switched `authenticateMcpRequest` to grant-backed OAuth auth keyed by JWT `client_id`, with immediate 403 on revoked/missing grants.
- Applied migration to linked Supabase project with live `supabase db push` proof.

## Task Commits

1. **Task 1: Add Wave 0 grant/token auth regression coverage** - `3ab6e340` (test)
2. **Task 2: Replace legacy OAuth binding with per-client grants and prefixed tokens** - `17cadca0` (feat)
3. **Task 3: Push schema changes and record proof** - `88905d2f` (chore)

## Files Created/Modified
- `supabase/functions/mcp-server/__tests__/oauth-client-grants.integration.test.ts` - Wave 0 auth regression gate.
- `supabase/migrations/20260528163000_mcp_oauth_client_grants_and_prefixed_tokens.sql` - Grant table, token format, revoke fields, backfill.
- `supabase/functions/mcp-server/auth.ts` - Grant-backed OAuth auth + prefixed/legacy manual token parsing.
- `supabase/functions/mcp-server/protocol.ts` - Added explicit 403 forbidden response helper.
- `src/types/supabase.ts` - Added `mcp_oauth_client_grants` table typing and `revoked_at` token typing.

## Verification Evidence
- `VITEST_INTEGRATION_OK=true npm test -- --run supabase/functions/mcp-server/__tests__/oauth-client-grants.integration.test.ts` -> **PASS** (4/4 tests).
- `supabase db push` -> **PASS**; migration `20260528163000_mcp_oauth_client_grants_and_prefixed_tokens.sql` applied to remote project.

## Acceptance Criteria Checks
- **Task 1:** New regression file covers active grant path, revoked path, prefixed token parsing, and legacy token compatibility -> **PASS**.
- **Task 1:** Test asserts invalid bearer (401) vs authorization failure (403) distinction -> **PASS**.
- **Task 2:** Migration creates `mcp_oauth_client_grants` with scope columns, revocation/audit fields, and lookup indexes -> **PASS**.
- **Task 2:** `auth.ts` no longer depends on `mcp_oauth_org_bindings` as primary auth source -> **PASS**.
- **Task 2:** OAuth default category fallback excludes admin (`['read','write','ai']`) -> **PASS**.
- **Task 2:** Manual token parsing supports `cv_org_`/`cv_ws_` plus legacy token fallback -> **PASS**.
- **Task 3:** `supabase db push` succeeded and proof captured -> **PASS**.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added explicit 403 forbidden response helper for authz failures**
- **Found during:** Task 2
- **Issue:** Existing protocol helper only provided 401 unauthorized, preventing clear invalid-bearer vs authorization-failure semantics.
- **Fix:** Added `forbiddenResponse(...)` and used it for revoked/missing grant and revoked-token flows.
- **Files modified:** `supabase/functions/mcp-server/protocol.ts`, `supabase/functions/mcp-server/auth.ts`
- **Verification:** New regression test assertion for 401/403 distinction passes.
- **Committed in:** `17cadca0`

---

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** Improved correctness for auth semantics without expanding scope.

## Authentication Gates
None.

## Issues Encountered
- `npm test -- --run ...oauth-client-grants.integration.test.ts` initially discovered the repo integration-test guard (`*.integration.test.ts` excluded unless `VITEST_INTEGRATION_OK=true`). Verification was executed with the required flag.

## Known Stubs
None.

## Next Phase Readiness
- Grant-backed auth substrate and migration gate are complete for Phase 03 follow-up plans (`03-02` onward).
- Legacy `mcp_oauth_org_bindings` table remains for backward compatibility, but is no longer the primary authorization source in MCP auth.

## Self-Check: PASSED
- Verified summary file exists.
- Verified task commits exist in git log (`3ab6e340`, `17cadca0`, `88905d2f`).
