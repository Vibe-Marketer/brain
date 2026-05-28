---
phase: 03-per-workspace-mcp-endpoints-+-connect-to-ai
plan: 03
subsystem: auth
tags: [oauth, mcp, react, tanstack-query]
requires:
  - phase: 03-01
    provides: OAuth client grant schema and auth-path consumption
  - phase: 03-02
    provides: workspace endpoint audience routing
provides:
  - Workspace-aware OAuth consent scope selection and preselection
  - Approval-time grant persistence to mcp_oauth_client_grants
  - Consent regression coverage for org default and workspace flow
affects: [MCP-02, MCP-03, oauth-consent, mcp-grants]
tech-stack:
  added: []
  patterns: [service-plus-hook grant persistence boundary]
key-files:
  created:
    - src/pages/__tests__/OAuthConsentPage.workspace-scope.test.tsx
    - src/services/mcp-oauth-grants.service.ts
    - src/hooks/useMcpOAuthGrants.ts
  modified:
    - src/pages/OAuthConsentPage.tsx
key-decisions:
  - "Consent defaults to organization scope and only applies workspace scope when explicitly selected or workspace-preselected."
  - "Grant persistence moved out of page inline Supabase writes into service + hook boundary before approveAuthorization."
patterns-established:
  - "OAuth consent persists authorization scope in CallVault grant table before redirect approval."
requirements-completed: [MCP-02, MCP-03]
duration: 24min
completed: 2026-05-28
---

# Phase 3 Plan 03: OAuth consent scope-aware grant persistence Summary

**OAuth consent now defaults to org scope, supports optional workspace scoping, and persists reconciled non-admin grants before approval redirect.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-05-28T15:53:00Z
- **Completed:** 2026-05-28T16:17:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added targeted consent-page tests for org default, workspace gating, and workspace preselection behavior.
- Implemented dedicated OAuth grant persistence service and TanStack mutation hook.
- Refactored OAuth consent approval to persist `mcp_oauth_client_grants` scope before calling `approveAuthorization`.

## Task Commits

1. **Task 1: Add consent-page coverage for org default and workspace scoping** - `0c69609b` (test)
2. **Task 2: Implement workspace-aware OAuth consent and grant-write reconciliation** - `981ad729` (feat)

## Files Created/Modified
- `src/pages/__tests__/OAuthConsentPage.workspace-scope.test.tsx` - consent scope contract coverage.
- `src/services/mcp-oauth-grants.service.ts` - scoped OAuth grant upsert/reconcile logic.
- `src/hooks/useMcpOAuthGrants.ts` - approval-time persistence mutation wrapper.
- `src/pages/OAuthConsentPage.tsx` - workspace-scope UX, preselection, and approve-path grant persistence.

## Decisions Made
- Used `user_id,client_id,org_id,workspace_id` upsert conflict target to reconcile existing grant rows by scope.
- Preserved non-admin default categories (`read`, `write`, `ai`) for OAuth grants.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Test harness initially lacked `QueryClientProvider` after introducing mutation hook; resolved by wrapping test router with local QueryClient.

## Verification Output

- `npm test -- --run src/pages/__tests__/OAuthConsentPage.workspace-scope.test.tsx`
  - Result: PASS (3 tests passed)
- `npm run build`
  - Result: PASS (Vite build completed successfully)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Consent flow now captures org/workspace scope intent before OAuth redirect and is covered by dedicated tests.
- Ready for follow-on Phase 03 plans that consume the persisted grant state in settings and connection management surfaces.

## Self-Check: PASSED
- Verified created files exist.
- Verified task commits exist in git history (`0c69609b`, `981ad729`).

---
*Phase: 03-per-workspace-mcp-endpoints-+-connect-to-ai*
*Completed: 2026-05-28*
