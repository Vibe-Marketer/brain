---
phase: 02-mcp-monolith-refactor
plan: 08
subsystem: api
tags: [mcp, edge-functions, registry, verification, cold-start]

requires:
  - phase: 02-mcp-monolith-refactor
    provides: Plans 02-01 through 02-07 extracted read, write, admin, and AI tools into modules
provides:
  - Lean MCP HTTP/protocol orchestrator under 300 lines
  - Registry-backed tools/list definitions for all 41 MCP tools
  - Final targeted MCP test and build verification
  - Deployed MCP smoke evidence and candidate timing sample
affects: [phase-03-per-workspace-mcp-endpoints, phase-04-mcp-ai-write-tools]

tech-stack:
  added: []
  patterns: [registry-dispatched MCP tools, separated MCP tool definitions]

key-files:
  created:
    - supabase/functions/mcp-server/tools/definitions.ts
  modified:
    - supabase/functions/mcp-server/index.ts
    - supabase/functions/mcp-server/tools/registry.ts
    - supabase/functions/mcp-server/__tests__/contract-surface.test.ts
    - supabase/functions/mcp-server/__tests__/golden-replay.test.ts
    - supabase/functions/mcp-server/__tests__/category-gating.test.ts
    - supabase/functions/mcp-server/__tests__/ai-tools-invariants.test.ts
    - docs/operations/mcp-runbook.md

key-decisions:
  - "Kept full MCP schema definitions in tools/definitions.ts so tools/list preserves the 41-tool outputSchema contract while index.ts stays orchestration-only."
  - "Recorded cold-start improvement as not fully verified because no pre-refactor deployed baseline was captured before the candidate deploy."

patterns-established:
  - "MCP index.ts dispatches only through getToolModule(toolName); no inline switch remains."
  - "Contract tests pin tool definitions through tools/definitions.ts rather than the HTTP entrypoint."

requirements-completed: [MCP-05]

duration: 38min
completed: 2026-05-28
---

# Plan 02-08 Summary: MCP Dispatcher Close-Out

**MCP server entrypoint trimmed to a 237-line registry dispatcher with deployed smoke evidence and explicit cold-start verification limits.**

## Performance

- **Duration:** 38 min
- **Started:** 2026-05-28T14:09:00Z
- **Completed:** 2026-05-28T14:47:38Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Removed the remaining inline MCP tool-definition scaffold from `index.ts`; it is now 237 lines and has no `case '<tool>':` blocks or `switch (toolName)`.
- Added `tools/definitions.ts` and updated `tools/registry.ts` so `tools/list` still returns all 41 tool schemas with `outputSchema.required = ['text']`.
- Updated MCP contract/golden/category/AI invariant tests to validate the registry-dispatched shape.
- Deployed `mcp-server` with `supabase functions deploy mcp-server --use-api`.
- Verified the public endpoint returns invalid-bearer 401 with `WWW-Authenticate`, valid `initialize`, 41 tools, and read-tool `content[0].text`.

## Task Commits

1. **Task 1-3: final dispatcher trim, local gates, deploy smoke, and runbook evidence** - `54fe44da` (`refactor(02-08): trim mcp server dispatcher`)

## Files Created/Modified

- `supabase/functions/mcp-server/index.ts` - Lean HTTP/CORS/auth/protocol/gate/registry dispatcher.
- `supabase/functions/mcp-server/tools/definitions.ts` - Full 41-tool definition and schema list used by `tools/list`.
- `supabase/functions/mcp-server/tools/registry.ts` - Registry now builds definitions without an inline legacy argument from `index.ts`.
- `supabase/functions/mcp-server/__tests__/contract-surface.test.ts` - Pins definitions and dispatch ordering after switch removal.
- `supabase/functions/mcp-server/__tests__/golden-replay.test.ts` - Reads tool-definition surface from `tools/definitions.ts`.
- `supabase/functions/mcp-server/__tests__/category-gating.test.ts` - Confirms category gate precedes registry dispatch and no switch exists.
- `supabase/functions/mcp-server/__tests__/ai-tools-invariants.test.ts` - Reads AI tool registration schemas from `tools/definitions.ts`.
- `docs/operations/mcp-runbook.md` - Records final module map, verification commands, deployed smoke, Deno check limitation, and candidate timing evidence.

## Verification

Passed:

```bash
test "$(wc -l < supabase/functions/mcp-server/index.ts)" -le 300
! rg -n "case '.*':|switch\\s*\\(\\s*toolName|const TOOLS" supabase/functions/mcp-server/index.ts
npm test -- --run supabase/functions/mcp-server/__tests__/category-gating.test.ts supabase/functions/mcp-server/__tests__/ai-tools-invariants.test.ts supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts supabase/functions/mcp-server/__tests__/track-ai-usage-registry.test.ts supabase/functions/mcp-server/__tests__/golden-replay.test.ts supabase/functions/mcp-server/__tests__/contract-surface.test.ts supabase/functions/mcp-server/__tests__/cold-start-baseline.test.ts
npm run build
supabase functions deploy mcp-server --use-api
```

Targeted MCP test result: 7 files passed, 167 tests passed.

Build result: `npm run build` exited 0.

Live smoke against `https://api.callvaultai.com/mcp`:

- Invalid bearer: HTTP 401 with `WWW-Authenticate`
- Valid `initialize`: HTTP 200, `serverInfo.name = callvault`
- Valid `tools/list`: HTTP 200, 41 tools
- Valid `list_calls`: HTTP 200, `content[0].type = text`

Candidate read-path timing:

- 10 `list_calls` invocations, 20-second spacing
- HTTP statuses: 200 for all calls
- Median total: 0.459s
- P95 total: 0.747s

Did not pass:

```bash
deno check supabase/functions/mcp-server/index.ts
```

`deno check` still fails on external type drift between `ai@5.0.102` and the OpenRouter provider plus Supabase nested-select cast drift in extracted modules. This is recorded in the runbook; the replacement gate for this plan was targeted MCP tests, `npm run build`, and deployed smoke.

## Decisions Made

Kept the full MCP client-facing schema definitions in `tools/definitions.ts` instead of duplicating schema bodies into every handler module. This preserves the current `tools/list` contract and still removes the HTTP entrypoint monolith remnant.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated tests for registry-dispatched definitions**
- **Found during:** Task 1 verification
- **Issue:** Contract and golden tests still expected `const TOOLS` and a dispatcher switch inside `index.ts`.
- **Fix:** Repointed tests to `tools/definitions.ts` and asserted category gating runs before registry lookup with no switch present.
- **Files modified:** MCP contract, golden replay, category gating, and AI invariant tests.
- **Verification:** Targeted MCP suite passed.
- **Committed in:** `54fe44da`

---

**Total deviations:** 1 auto-fixed (Rule 3).
**Impact on plan:** The fix was necessary to keep tests aligned with the intended final architecture; no new product scope was added.

## Issues Encountered

- No pre-refactor deployed cold-start baseline was captured before deployment. Candidate timing is recorded, but the required 30% improvement cannot be verified from this evidence.
- `deno check` remains blocked by external dependency type drift and Supabase generated nested-select type drift, not by the final dispatcher trim itself.

## User Setup Required

None.

## Next Phase Readiness

Phase 3 can build per-workspace MCP endpoints on the modular dispatcher. The remaining caveat is verification language: Phase 2 behavior is locally tested and live-smoked, but cold-start improvement is not proven against a baseline.

## Self-Check: PASSED

All local targeted MCP tests and build gates passed, the function was deployed, and live behavior was smoke-tested. The cold-start improvement limitation is explicitly recorded instead of claimed.

---
*Phase: 02-mcp-monolith-refactor*
*Completed: 2026-05-28*
