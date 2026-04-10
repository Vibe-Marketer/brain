---
phase: 19-provisioning-foundation
plan: 02
subsystem: api
tags: [mcp, billing, subscription, edge-function, plan-gating, deno]

# Dependency graph
requires:
  - phase: 19-01
    provides: mcp_tokens table with user_id for billing lookup
provides:
  - Server-side plan tier enforcement on all callvault/* MCP tool calls
  - isPaidTier helper function porting frontend deriveTier() logic to edge function
  - JSON-RPC -32001 error with upgrade URL for free-tier callers
affects:
  - 19-03
  - 19-04
  - Any future MCP tool additions (gating is method-prefix based, auto-covers new callvault/* tools)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Plan gating via method.startsWith('callvault/') — new callvault/* tools are gated automatically without code changes"
    - "Billing check uses live user_profiles query (not cached) — downgraded orgs rejected on next request"

key-files:
  created: []
  modified:
    - supabase/functions/mcp-server/index.ts

key-decisions:
  - "isPaidTier uses live user_profiles query per call — prevents downgraded orgs from retaining access (D-07)"
  - "initialize and tools/list remain ungated — MCP handshake must succeed for any client regardless of tier (D-06)"
  - "Gating on method prefix 'callvault/' not method name list — auto-gates future tools without code changes"

patterns-established:
  - "isPaidTier: server-side billing check pattern for edge functions"

requirements-completed: [PROV-02]

# Metrics
duration: 6min
completed: 2026-04-10
---

# Phase 19 Plan 02: MCP Server Plan Gating Summary

**Server-side subscription tier enforcement added to mcp-server edge function — free-tier orgs receive JSON-RPC -32001 error with upgrade URL on any callvault/* tool call; PRO+ orgs proceed normally; MCP handshake methods remain ungated**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-10T15:31:00Z
- **Completed:** 2026-04-10T15:37:43Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added `isPaidTier()` helper function to mcp-server edge function, porting `deriveTier()` logic from `useSubscription.ts` — handles pro-trial expiry, active/trialing status, pro/team product prefixes
- Added plan gating block between token validation and tool dispatch — queries `user_profiles` live for billing status, returns -32001 with upgrade URL for free-tier callers
- Deployed updated mcp-server edge function to production via `supabase functions deploy mcp-server --use-api`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add isPaidTier helper and plan gating to mcp-server edge function** - `95c4e391` (feat)
2. **Task 2: Deploy updated mcp-server edge function** - deploy-only (no code changes, captured in Task 1 commit)

## Files Created/Modified
- `supabase/functions/mcp-server/index.ts` - Added `isPaidTier()` helper + plan gating block before `switch(method)`

## Decisions Made
- `isPaidTier` queries `user_profiles` live on every tool call rather than caching — this ensures downgraded orgs are rejected on the very next callvault/* call (satisfies D-07 / T-19-06 threat mitigation)
- Gating uses `method.startsWith('callvault/')` not an explicit allowlist — future tools are automatically gated without code changes
- `initialize` and `tools/list` remain ungated — tool names are not sensitive (T-19-08 accepted) and blocking the handshake would break all MCP clients including Claude Desktop

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Deployment completed automatically.

## Next Phase Readiness
- Plan gating active in production; free-tier token callers now receive proper -32001 error
- 19-03 and 19-04 can proceed — billing enforcement foundation is in place

## Self-Check

Files exist:
- `supabase/functions/mcp-server/index.ts` — modified (read and edited in session)

Commits exist:
- `95c4e391` — feat(19-02): add isPaidTier helper and plan gating to mcp-server

## Self-Check: PASSED

---
*Phase: 19-provisioning-foundation*
*Completed: 2026-04-10*
