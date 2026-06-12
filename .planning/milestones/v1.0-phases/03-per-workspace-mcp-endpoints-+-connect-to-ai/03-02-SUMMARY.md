---
phase: 03-per-workspace-mcp-endpoints-+-connect-to-ai
plan: 02
subsystem: api
tags: [mcp, oauth, workspace-routing, cloudflare-worker, supabase-edge]
requires:
  - phase: 02-mcp-monolith-refactor
    provides: Modular mcp-server auth/protocol/gating split used for workspace routing changes
provides:
  - Workspace-scoped MCP path parsing at /mcp/w/{workspace_uuid}
  - Server-side workspace audience enforcement with 403 mismatch responses
  - Workspace-aware OAuth protected-resource metadata and worker fanout
  - Server-side category-filtered tools/list preservation after routing changes
affects: [phase-03-plan-03-04, phase-04-mcp-ai-write-tools]
tech-stack:
  added: []
  patterns: [path-derived workspace audience binding, metadata resource fanout via worker query passthrough]
key-files:
  created: []
  modified:
    - supabase/functions/mcp-server/index.ts
    - supabase/functions/mcp-server/auth.ts
    - supabase/functions/mcp-server/protocol.ts
    - supabase/functions/mcp-oauth-metadata/index.ts
    - cloudflare/api-proxy/worker.ts
    - supabase/functions/mcp-server/__tests__/workspace-scope.integration.test.ts
    - supabase/functions/mcp-oauth-metadata/__tests__/workspace-resource.test.ts
    - supabase/functions/mcp-server/__tests__/category-gating.test.ts
key-decisions:
  - "Workspace target is derived from MCP request path and enforced in auth before dispatch."
  - "401 remains only for unauthenticated probes; valid-but-wrong workspace audience returns 403."
patterns-established:
  - "Pass workspace path context into WWW-Authenticate resource_metadata hints."
  - "Keep tools/list server-filtered by token enabled_categories after introducing path scoping."
requirements-completed: [MCP-01, MCP-02, MCP-03]
duration: 50min
completed: 2026-05-28
---

# Phase 03 Plan 02: Workspace MCP Audience and Metadata Summary

**Workspace-scoped MCP endpoint routing now enforces server-side audience checks and advertises exact workspace resources via protected-resource metadata.**

## Performance

- **Duration:** 50 min
- **Started:** 2026-05-28T11:42:00Z
- **Completed:** 2026-05-28T12:32:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added Wave 0 regression tests for workspace path parsing, workspace protected-resource metadata, and category gate preservation.
- Implemented `/mcp/w/{workspace_uuid}` path parsing and threaded workspace context through auth/401 metadata responses.
- Enforced workspace audience checks in auth: workspace token mismatch and org token workspace-ownership mismatch now return HTTP 403.
- Updated metadata/worker fanout so `/.well-known/oauth-protected-resource/mcp/w/{workspace_uuid}` advertises workspace-specific `resource`.
- Preserved server-side category filtering behavior with explicit `tools/list` filtering by `enabled_categories`.

## Task Commits

1. **Task 1: Add Wave 0 routing and metadata tests** - `61b10bea` (test)
2. **Task 2: Implement workspace routing, auth audience, metadata fanout, and filtering** - `d5c3e053` (feat)

## Files Created/Modified

- `supabase/functions/mcp-server/__tests__/workspace-scope.integration.test.ts` - Wave 0 workspace routing/auth contract tests.
- `supabase/functions/mcp-oauth-metadata/__tests__/workspace-resource.test.ts` - Wave 0 workspace protected-resource metadata + worker route coverage.
- `supabase/functions/mcp-server/index.ts` - Parses workspace path context and filters `tools/list` by token categories.
- `supabase/functions/mcp-server/auth.ts` - Enforces workspace audience constraints for manual tokens and OAuth grants.
- `supabase/functions/mcp-server/protocol.ts` - Builds workspace-aware `resource_metadata` URLs and path parser helper.
- `supabase/functions/mcp-oauth-metadata/index.ts` - Emits workspace resource values when workspace protected-resource paths are requested.
- `cloudflare/api-proxy/worker.ts` - Routes workspace protected-resource requests with `resource_path` passthrough.
- `supabase/functions/mcp-server/__tests__/category-gating.test.ts` - Updated assertion for OAuth category fallback literal pattern.

## Decisions Made

- Audience binding is path-first: the request path defines the target workspace audience and auth enforces against token/grant scope before tool handling.
- Kept OAuth `enabled_categories` fallback semantics compatible with existing behavior (`null` full-access fallback when grant categories are unset).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adjusted source-pattern assertions in existing tests after auth/protocol refactor**
- **Found during:** Task 2 verification
- **Issue:** Static regex tests expected pre-refactor literals (`enabled_categories: null`, hardcoded workspace path strings) and failed despite intended behavior.
- **Fix:** Updated test assertions to validate equivalent semantics in current source structure.
- **Files modified:** `supabase/functions/mcp-server/__tests__/category-gating.test.ts`, `supabase/functions/mcp-server/__tests__/workspace-scope.integration.test.ts`, `supabase/functions/mcp-oauth-metadata/__tests__/workspace-resource.test.ts`
- **Verification:** Required plan verification command passed.
- **Committed in:** `d5c3e053`

---

**Total deviations:** 1 auto-fixed (Rule 3)
**Impact on plan:** No scope expansion; deviations were test-harness alignment required to validate implemented behavior.

## Issues Encountered

- None after inline fixes.

## User Setup Required

- None.

## Verification

Passed command:

```bash
VITEST_INTEGRATION_OK=true npm test -- --run supabase/functions/mcp-server/__tests__/workspace-scope.integration.test.ts supabase/functions/mcp-oauth-metadata/__tests__/workspace-resource.test.ts supabase/functions/mcp-server/__tests__/category-gating.test.ts && npm run build
```

Results:

- `workspace-scope.integration.test.ts`: pass
- `workspace-resource.test.ts`: pass
- `category-gating.test.ts`: pass
- `npm run build`: exit 0

## Next Phase Readiness

Phase 03 follow-on plans can now rely on stable workspace-scoped public resources and fail-closed audience checks at auth boundaries.

## Self-Check: PASSED

- `supabase/functions/mcp-server/__tests__/workspace-scope.integration.test.ts` exists.
- `supabase/functions/mcp-oauth-metadata/__tests__/workspace-resource.test.ts` exists.
- Commit `61b10bea` exists in git log.
- Commit `d5c3e053` exists in git log.

---
*Phase: 03-per-workspace-mcp-endpoints-+-connect-to-ai*
*Completed: 2026-05-28*
