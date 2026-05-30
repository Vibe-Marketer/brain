---
phase: 03-per-workspace-mcp-endpoints-+-connect-to-ai
plan: 06
subsystem: docs
tags: [mcp, oauth, workspace-endpoints, runbook, verification]
requires:
  - phase: 03-per-workspace-mcp-endpoints-+-connect-to-ai
    provides: workspace-scoped MCP endpoints and connectors UI
provides:
  - Final targeted test/build verification evidence for Phase 03
  - Updated MCP runbook for org/workspace URL shapes and troubleshooting
  - Live deploy/smoke evidence with explicit proof gaps
  - Follow-up credential-backed production smoke evidence for workspace-scoped MCP tokens
affects: [phase-04-mcp-ai-write-tools, mcp-operations, connectors-setup]
tech-stack:
  added: []
  patterns: [evidence-first verification, explicit live-proof gap reporting]
key-files:
  created:
    - .planning/phases/03-per-workspace-mcp-endpoints-+-connect-to-ai/03-06-TASK1-VERIFICATION.md
    - .planning/phases/03-per-workspace-mcp-endpoints-+-connect-to-ai/03-06-TASK3-LIVE-SMOKE.md
    - docs/architecture/mcp-connectors.md
  modified:
    - docs/operations/mcp-runbook.md
key-decisions:
  - "Included the verification-backed notifications/initialized MCP protocol fix and pinned it with contract coverage."
  - "Recorded missing credential-dependent live proofs as explicit gaps instead of claiming full production verification."
patterns-established:
  - "Phase close-out requires test/build evidence and production smoke artifacts committed with the plan."
  - "Credential-backed MCP smoke must record token revocation and separate function correctness from proxy deployment state."
requirements-completed: [MCP-01, MCP-02, MCP-03]
duration: 27min
completed: 2026-05-28
---

# Phase 03 Plan 06: Final verification, runbook/doc alignment, and production smoke Summary

**Phase 03 has green targeted tests/build, updated public MCP setup docs for workspace endpoints, and follow-up credential-backed production smoke for valid workspace access plus wrong-workspace rejection. One production metadata gap remains blocked on Cloudflare Worker deploy permissions.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-05-28T16:15:00Z
- **Completed:** 2026-05-28T16:42:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Fixed `notifications/initialized` handling so authenticated MCP clients can send the notification without receiving an invalid JSON-RPC `id:null` response.
- Ran the required targeted Phase 03 verification suite and `npm run build` with all checks passing.
- Updated runbook and architecture docs to reflect `/mcp/w/{workspace_uuid}`, protected-resource paths, OAuth/manual connection model, and 401 vs 403 guidance.
- Deployed `mcp-oauth-metadata` and `mcp-server`, then captured live smoke evidence against `https://api.callvaultai.com` including invalid bearer 401 behavior and current metadata response.
- Follow-up credential-backed smoke created a temporary workspace-scoped production token, proved valid workspace initialize/tools-list behavior, proved wrong-workspace 403 behavior, and revoked the temporary token.
- Isolated the remaining workspace protected-resource metadata gap to the Cloudflare Worker deployment: the Supabase metadata function returns the correct workspace resource when passed `resource_path`, while the live vanity route still returns org-wide `https://api.callvaultai.com/mcp`.

## Verification Output

### Automated command (Task 1)

```bash
VITEST_INTEGRATION_OK=true npm test -- --run supabase/functions/mcp-server/__tests__/workspace-scope.integration.test.ts supabase/functions/mcp-server/__tests__/oauth-client-grants.integration.test.ts supabase/functions/mcp-oauth-metadata/__tests__/workspace-resource.test.ts src/components/settings/__tests__/McpConnectionsTab.test.tsx src/components/settings/__tests__/McpSetupSnippets.test.tsx && npm run build
```

Result:
- PASS: 5 test files, 18 tests.
- PASS: `npm run build` exit 0.

### Production smoke (Task 3)

- PASS: Invalid bearer returns HTTP 401 with `WWW-Authenticate`.
- PARTIAL: Workspace metadata endpoint responds at `/.well-known/oauth-protected-resource/mcp/w/{workspace_uuid}`.
- GAP: Missing local `WORKSPACE_UUID`, `CALLVAULT_MCP_TOKEN`, and `MISMATCH_WORKSPACE_UUID` prevented required valid `initialize`, valid `tools/list`, and wrong-workspace 403 proof.
- GAP: Workspace metadata currently returned `resource: https://api.callvaultai.com/mcp` in smoke output, so workspace-specific resource advertisement was not proven complete by this run.

### Follow-up credential-backed production smoke

- PASS: Temporary workspace-scoped token against `https://api.callvaultai.com/mcp/w/4cf3bf4f-215c-4db8-ad35-ad3e9a978f19` returned HTTP 200 for `initialize` with `protocolVersion: 2025-03-26` and `serverInfo.name: callvault`.
- PASS: Same token returned HTTP 200 for `tools/list` with 17 tools and no `outputSchema` fields.
- PASS: Same token against `https://api.callvaultai.com/mcp/w/6184a8bd-396f-4fa4-8332-4e12b2f5870e` returned HTTP 403 with JSON-RPC code `-32001`.
- PASS: Temporary token was revoked immediately after smoke testing.
- PASS: Direct Supabase metadata function with `resource_path=/mcp/w/4cf3bf4f-215c-4db8-ad35-ad3e9a978f19` returns `resource: https://api.callvaultai.com/mcp/w/4cf3bf4f-215c-4db8-ad35-ad3e9a978f19`.
- BLOCKED: Live vanity route `https://api.callvaultai.com/.well-known/oauth-protected-resource/mcp/w/4cf3bf4f-215c-4db8-ad35-ad3e9a978f19` still returns `resource: https://api.callvaultai.com/mcp`; `npx wrangler deploy` failed with Cloudflare authentication error `10000` because the local API token lacks worker deploy permission.

## Task Commits

1. **Task 1: MCP initialized notification fix** - `cac21d87` (fix)
2. **Task 1: Targeted verification gate evidence** - `64a1f6d0` (docs)
3. **Task 2: Runbook + architecture doc updates** - `0e3f3c34` (docs)
4. **Task 3: Deploy and production smoke evidence** - `5d22ff5e` (docs)

## Files Created/Modified

- `.planning/phases/03-per-workspace-mcp-endpoints-+-connect-to-ai/03-06-TASK1-VERIFICATION.md` - Task 1 command/result evidence
- `.planning/phases/03-per-workspace-mcp-endpoints-+-connect-to-ai/03-06-TASK3-LIVE-SMOKE.md` - Deploy/smoke command output and explicit live-proof gaps
- `docs/operations/mcp-runbook.md` - Workspace endpoint/path documentation, 401/403, revoke behavior, smoke commands
- `docs/architecture/mcp-connectors.md` - OAuth-first + manual fallback architecture reference
- `supabase/functions/mcp-server/index.ts` - Accepted authenticated `notifications/initialized` notifications without JSON-RPC response body
- `supabase/functions/mcp-server/protocol.ts` - Added `mcpAccepted` helper for 202 notification acknowledgements
- `supabase/functions/mcp-server/__tests__/contract-surface.test.ts` - Pinned initialized notification ordering and 202 behavior
- `supabase/functions/mcp-server/__tests__/golden-replay.test.ts` - Relaxed tools/list source-window assertion after protocol handling moved

## Decisions Made

- Kept the `notifications/initialized` MCP protocol fix because it was committed before the final targeted verification gate and is covered by contract tests.
- Treated missing credential-dependent live proofs as explicit verification gaps, per plan requirement to avoid claiming full live verification without evidence.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Accepted initialized notifications without invalid JSON-RPC response bodies**
- **Found during:** Task 1 verification/deploy preparation
- **Issue:** Authenticated clients can send `notifications/initialized` without an `id`; returning a JSON-RPC response with `id:null` is invalid for notifications.
- **Fix:** Added `mcpAccepted(...)` and handled `notifications/initialized` before normal protocol method dispatch.
- **Files modified:** `supabase/functions/mcp-server/index.ts`, `supabase/functions/mcp-server/protocol.ts`, `supabase/functions/mcp-server/__tests__/contract-surface.test.ts`, `supabase/functions/mcp-server/__tests__/golden-replay.test.ts`
- **Verification:** Final targeted Phase 03 command and `npm run build` passed.
- **Committed in:** `cac21d87`

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** Narrow protocol correctness fix discovered during final verification; no new tools or endpoint split.

## Authentication Gates

None.

## Issues Encountered

- Initial local environment did not include `WORKSPACE_UUID`, `CALLVAULT_MCP_TOKEN`, or `MISMATCH_WORKSPACE_UUID`, which blocked the first full production smoke for valid workspace calls and wrong-workspace 403 assertion.
- Follow-up smoke solved the credential gap with a temporary revoked production token.
- Cloudflare Worker deployment is currently blocked by API token permissions; until the worker is deployed, the vanity workspace protected-resource route remains org-wide despite the Supabase function returning the correct workspace resource directly.

## Known Stubs

None.

## Next Phase Readiness

- Documentation, automation evidence, and credential-backed live proof for valid workspace initialize/tools-list and wrong-workspace 403 are in place.
- Phase 03 still needs one infrastructure action before archive-clean close-out: deploy the Cloudflare Worker with the already-committed workspace protected-resource routing, then re-probe the vanity metadata URL.

## Self-Check: PASSED
