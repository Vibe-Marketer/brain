---
phase: 03-per-workspace-mcp-endpoints-+-connect-to-ai
plan: 05
subsystem: ui
tags: [react, settings, mcp, oauth, snippets]
requires:
  - phase: 03-03
    provides: oauth grants list and scoped endpoint plumbing
  - phase: 03-04
    provides: oauth-first management UI with manual-token fallback
provides:
  - Provider capability registry for honest setup actions
  - Workspace-aware MCP setup snippets on vanity API URLs
  - Regression tests for public endpoint contract and fallback visibility
affects: [mcp setup UX, provider action labels, settings integrations]
tech-stack:
  added: []
  patterns: [data-driven provider capability gating, vanity endpoint-only setup snippets]
key-files:
  created:
    - src/components/settings/mcp-provider-capabilities.ts
    - src/components/settings/McpSetupSnippets.tsx
    - src/components/settings/__tests__/McpSetupSnippets.test.tsx
  modified:
    - src/components/settings/MCPTab.tsx
    - src/components/settings/__tests__/McpConnectionsTab.test.tsx
key-decisions:
  - "Provider setup buttons are capability-gated (Connect with OAuth, Copy setup, Open setup guide) instead of implied one-click installs."
  - "Setup snippets always use https://api.callvaultai.com/mcp and /mcp/w/{workspace_uuid}; raw Supabase function URLs remain blocked from UI snippets."
patterns-established:
  - "Use mcp-provider-capabilities.ts as the single source for provider action behavior."
  - "Render org/workspace endpoint snippets directly in MCPTab with copy affordances and explicit fallback messaging."
requirements-completed: [MCP-02]
duration: 7min
completed: 2026-05-28
---

# Phase 03 Plan 05: Per-provider setup gating and workspace MCP snippet summary

**Capability-driven provider actions plus workspace-aware public MCP snippets in Settings without exposing raw Supabase URLs.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-28T16:05:30Z
- **Completed:** 2026-05-28T16:12:36Z
- **Tasks:** 2
- **Files modified:** 5
- **Files created:** 3

## Accomplishments
- Added `mcp-provider-capabilities.ts` as the data source for provider setup action labels.
- Added `McpSetupSnippets.tsx` and integrated it into `MCPTab` with org/workspace vanity endpoint snippets.
- Locked behavior with `McpSetupSnippets.test.tsx` and updated `McpConnectionsTab.test.tsx` for intentional duplicate snippet/provider text.

## Task Commits

1. **Task 1: Add provider setup coverage for public endpoints and honest capability gating** - `c7ae0166` (`test`)
2. **Task 2: Implement provider capability registry and workspace-aware snippet surface** - `e8ee9b8d` (`feat`)

## Files Created/Modified
- `src/components/settings/mcp-provider-capabilities.ts` - provider capability registry and action-label helper.
- `src/components/settings/McpSetupSnippets.tsx` - setup snippet UI with org/workspace endpoint blocks and provider action buttons.
- `src/components/settings/MCPTab.tsx` - integrated setup snippets into OAuth-first settings surface.
- `src/components/settings/__tests__/McpSetupSnippets.test.tsx` - public endpoint + capability gating + fallback visibility coverage.
- `src/components/settings/__tests__/McpConnectionsTab.test.tsx` - adapted assertions to intentional duplicate endpoint/provider text.

## Decisions Made
- Kept one-click `Add to X` out of baseline provider actions; used capability-driven labels from a registry to stay aligned with D-10 evidence.
- Derived workspace snippet URL from active workspace-scoped grants/tokens when available; fall back to org endpoint otherwise.

## Verification

Executed:

```bash
npm test -- --run src/components/settings/__tests__/McpSetupSnippets.test.tsx src/components/settings/__tests__/McpConnectionsTab.test.tsx && npm run build
```

Result:
- `McpSetupSnippets.test.tsx`: passed (3 tests)
- `McpConnectionsTab.test.tsx`: passed (4 tests)
- `npm run build`: passed (Vite production build succeeded)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test assumptions that required unique text matches after snippet integration**
- **Found during:** Task 2 verification
- **Issue:** Existing tests used `getByText/getByRole` where the new snippet surface intentionally renders additional matching endpoint/provider labels.
- **Fix:** Updated assertions to `getAllByText/getAllByRole` and asserted presence counts.
- **Files modified:** `src/components/settings/__tests__/McpConnectionsTab.test.tsx`, `src/components/settings/__tests__/McpSetupSnippets.test.tsx`
- **Verification:** Targeted tests and build passed.
- **Committed in:** `e8ee9b8d`

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** No scope creep; fixes were required for stable regression coverage.

## Known Stubs
None.

## Threat Flags
None.

## Issues Encountered
- Initial Task 2 verification failed due duplicate selector matches introduced by the new snippet UI; resolved by adapting assertions to intentional UI duplication.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Provider setup actions and snippet URLs are now contract-tested and integrated; ready for any follow-up provider-specific deep-link validation work.

## Self-Check: PASSED
- Verified summary file exists.
- Verified task commit hashes exist in git history.
