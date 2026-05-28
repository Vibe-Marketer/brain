---
phase: 03-per-workspace-mcp-endpoints-+-connect-to-ai
plan: 04
subsystem: ui
tags: [mcp, oauth, react, tanstack-query, settings]
requires:
  - phase: 03-01
    provides: workspace endpoint and OAuth setup baseline
  - phase: 03-02
    provides: manual token management and category controls
provides:
  - Grouped AI connectors settings surface with OAuth clients first and manual tokens second
  - OAuth grant list/revoke services and hooks for component-level management actions
  - Manual token connection metadata for scope-aware endpoint and category summaries
affects: [MCP-02, MCP-03, settings, connector-management]
tech-stack:
  added: []
  patterns: [service-hook-separation, oauth-first-settings-ia, token-fallback-controls]
key-files:
  created:
    - src/components/settings/__tests__/McpConnectionsTab.test.tsx
  modified:
    - src/components/settings/MCPTab.tsx
    - src/services/mcp-oauth-grants.service.ts
    - src/hooks/useMcpOAuthGrants.ts
    - src/services/mcp-tokens.service.ts
    - src/hooks/useMcpTokens.ts
key-decisions:
  - "Kept OAuth grant and manual token data access strictly in services, with React Query orchestration in hooks."
  - "Retained manual token fallback controls as first-class actions while promoting OAuth-connected clients as the primary section."
patterns-established:
  - "Settings management surfaces should use section ordering tests to pin IA copy and hierarchy."
  - "Connection rows expose endpoint URL, scope, category summary, and audit timestamps directly from service-layer view models."
requirements-completed: [MCP-02, MCP-03]
duration: 5min
completed: 2026-05-28
---

# Phase 03 Plan 04: AI Connector Management Surface Summary

**OAuth-first AI connector management now ships in Settings with revocable client grants and visible manual scoped-token fallback controls.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-28T16:00:00Z
- **Completed:** 2026-05-28T16:05:33Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Added RED-phase UI contract tests for grouped AI connector ordering, required copy, and action visibility.
- Implemented OAuth grant list/revoke service+hook and extended manual-token data shaping for endpoint/scope/category metadata.
- Refactored `MCPTab` into the approved `AI connectors` surface with `Connected AI clients` above `Manual token connectors` and immediate-enforcement messaging.

## Task Commits

1. **Task 1: Add grouped AI connectors UI and action coverage** - `ed70d307` (test)
2. **Task 2: Add OAuth-grant hooks/services and wire grouped management actions** - `e700e706` (feat)
3. **Task 3: Refactor the MCP tab into the approved AI connectors management surface** - `9c93c78c` (feat)

## Files Created/Modified
- `src/components/settings/__tests__/McpConnectionsTab.test.tsx` - Contract tests for grouped section ordering, CTA visibility, and refresh/reconnect copy.
- `src/services/mcp-oauth-grants.service.ts` - OAuth grant list/revoke service plus persisted grant model support.
- `src/hooks/useMcpOAuthGrants.ts` - React Query list/revoke/persist hooks for OAuth grant management.
- `src/services/mcp-tokens.service.ts` - Manual token view-model helpers for scoped endpoint/resource URL, token preview, and category summary.
- `src/hooks/useMcpTokens.ts` - Returns enriched manual token connections while preserving token CRUD ownership.
- `src/components/settings/MCPTab.tsx` - New grouped AI connectors UI and actions.

## Decisions Made
- Preserved 03-03 `persistMcpOAuthGrant` behavior and extended it with list/revoke operations rather than replacing prior service APIs.
- Used `https://api.callvaultai.com/mcp` base endpoint and workspace suffixes for displayed connector URLs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Backward compatibility with existing test mocks for `useMcpTokensList`**
- **Found during:** Task 3
- **Issue:** Existing/new tests mocked `useMcpTokensList` without `tokenConnections`, causing runtime access on `undefined`.
- **Fix:** Added fallback derivation from raw `tokens` when `tokenConnections` is absent.
- **Files modified:** `src/components/settings/MCPTab.tsx`
- **Verification:** `npm test -- --run src/components/settings/__tests__/McpConnectionsTab.test.tsx ...` passed.
- **Committed in:** `9c93c78c`

---

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** No scope change; fix was required for stability and test compatibility.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Verification Evidence
- `npm test -- --run src/components/settings/__tests__/McpConnectionsTab.test.tsx src/hooks/__tests__/useMcpTokenCapabilities.test.ts src/services/__tests__/mcp-token-capabilities.service.test.ts`
  - Result: 3 files passed, 17 tests passed.
- `npm run build`
  - Result: success (Vite build completed; non-blocking chunk-size warnings only).

## Next Phase Readiness
- Settings now exposes grouped OAuth and manual connector management consistent with Phase 03 UI contract.
- Ready for downstream provider-specific setup/deep-link wiring and broader end-to-end verification.

## Self-Check: PASSED
- Verified created/modified files exist on disk.
- Verified task commits exist in git history: `ed70d307`, `e700e706`, `9c93c78c`.
