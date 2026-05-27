---
phase: 2
timestamp: 2026-05-27T17:40:00Z
status: partial
score: 3/5 local, live/cold-start pending
---

# Phase 2: MCP Monolith Refactor - Verification

## Goal Achievement

- **Truth 1: Every existing MCP tool returns byte-identical responses post-refactor.** NOT YET VERIFIED. No captured replay fixture diff exists in this session.
- **Truth 2: `mcp-server/index.ts` is <=300 LOC and contains only HTTP/CORS, auth dispatch, plan-gating, and handler-map lookup.** VERIFIED (`wc -l` reports 264 LOC).
- **Truth 3: Cold-start latency drops by >=30%; AI SDK deps no longer load on non-AI tool calls.** PARTIAL. AI tools are dynamically imported through `tools/registry.ts`; deployed cold-start measurement is still pending.
- **Truth 4: `tools/list` continues to filter by `token.enabled_categories`.** VERIFIED by targeted tests.
- **Truth 5: The MCP runbook contract holds: all tool responses still emit `content[].text` markdown.** LOCALLY VERIFIED by source-level invariant tests; live `api.callvaultai.com/mcp` verification is still pending.

## Behavioral Verification

| Check | Result | Detail |
|-------|--------|--------|
| `deno check supabase/functions/mcp-server/index.ts` | passed | Caught and repaired malformed generated utilities/import paths. |
| Targeted Vitest | passed | `category-gating`, `ai-tools-invariants`, and `write-tools-boundary`: 130 tests passed. |
| Build | pending rerun after reconciliation | Must be run against final tree before ship. |

## Human Verification

Required before closing Phase 2: replay fixture diff or equivalent behavior-parity proof, deployed cold-start measurement, and live MCP response-shape check.

## Conclusion
Local refactor is repaired, but Phase 2 is not fully closed until behavior parity and live/cold-start verification are captured.
