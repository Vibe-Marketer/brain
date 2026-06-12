# Phase 02: MCP Monolith Refactor - Discussion Log

**Date:** 2026-05-27
**Mode:** Text mode
**Status:** Context captured

## Initial Gray Areas Presented

The user selected all four proposed areas:

1. Current-code reality check — whether to treat the existing modular tree as prior work to audit, rebuild, or validate.
2. Behavior parity gate — how strict replay/golden-master verification should be.
3. AI dependency and cold-start proof — what evidence is required for dynamic imports and cold-start improvement.
4. MCP contract safety — which contracts are non-negotiable.

## User Direction

The user asked for deeper investigation before making a Phase 2 decision:

- Determine what happened in the prior Phase 2 work.
- Determine whether the prior agent broke MCP.
- Revert the changes if unsafe.
- Verify whether MCP is still working.
- Note the findings before planning Phase 2.

## Investigation Summary

- Suspect commit: `83693443 feat(2): Phase 2 MCP monolith refactor reconciliation`.
- The prior refactor reduced `mcp-server/index.ts` from 3,921 LOC to 133 LOC and generated module files under `tools/{read,write,ai}/`.
- The prior Phase 2 verification was explicitly partial: no replay fixture diff, no cold-start measurement, no live MCP response-shape check.
- Targeted MCP tests failed against the local refactor: 125 passed, 5 failed.
- The extracted auth path passed an anon Supabase client into `mcp_tokens` lookup, which cannot see stored token rows under the `mcp_tokens` RLS policy.
- Production remained on `origin/main`, not the unsafe local refactor.

## Decision Outcome

- The prior generated modular refactor is not accepted as Phase 2 work.
- The unsafe refactor was reverted locally in `b465f351`.
- Phase 2 planning must restart from the restored production monolith.
- `deno check` failure on the restored monolith is a Phase 2 planning concern, not an immediate pre-plan emergency.

## Verification Evidence

- Production valid-token check: `initialize` returned HTTP 200; `tools/list` returned HTTP 200 with 41 tools.
- After revert, targeted tests passed: 3 files, 130 tests.
- After revert, `npm run build` passed.
- No net MCP source diff remains against `origin/main`.

## Deferred Questions

- Exact fixture replay harness design is left for Phase 2 research/planning.
- Exact cold-start measurement procedure is left for Phase 2 research/planning.
- Whether to make `deno check` pass directly or define a replacement Edge type gate is left for Phase 2 planning, but a type gate is required.
