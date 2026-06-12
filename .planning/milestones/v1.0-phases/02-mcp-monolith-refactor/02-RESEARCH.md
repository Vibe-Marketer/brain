---
phase: 02-mcp-monolith-refactor
created: 2026-05-27
source: gsd-phase-researcher sidecar during Phase 1 execution
status: active
---

# Phase 02 Research — MCP Monolith Refactor

## Summary

Safest Phase 2 strategy is an incremental internal extraction from `supabase/functions/mcp-server/index.ts`, keeping one Edge Function and preserving current top-level control flow:

1. auth
2. `initialize` / `tools/list`
3. paid-plan gate
4. category gate
5. tool dispatch

Do not start from old modular artifacts. Start from the restored monolith only.

The highest-risk boundary is auth: hex MCP token lookup must remain on the service-role client, while JWT validation can use the anon/auth client.

Phase 2 should be accepted only with passing targeted MCP invariants, successful `npm run build`, live token smoke against deployed candidate, and an explicit type gate decision because `deno check` currently fails on the monolith.

## Current Evidence With File Paths

- Monolith baseline: `supabase/functions/mcp-server/index.ts`
- Tool calls must preserve `content[].text` markdown responses via `mcpOk`.
- `initialize` and `tools/list` return structured JSON via `mcpJsonResult`.
- Wildcard/public CORS plus `WWW-Authenticate` 401 behavior is intentional.
- Service-role client is used for hex token lookup in `mcp_tokens`.
- JWT validation uses the auth client path.
- OAuth org binding lookup uses the service-role path.
- Current monolith has 41 tools.
- `mcp_tokens` RLS policy is `user_id = auth.uid()`, so anon client lookup can hide valid token rows.
- `supabase/functions/_shared/mcp-tool-categories.ts` is the category authority and maps 41 tools.

Fresh sidecar status:

- `category-gating`, `ai-tools-invariants`, `write-tools-boundary`: 130/130 pass.
- `npm run build`: pass.
- `deno check supabase/functions/mcp-server/index.ts`: fails on current monolith with type drift, mostly Supabase typing plus AI SDK/provider/Zod issues.

## Prior Failure And Risk Analysis

The prior refactor was risky because extracted auth logic used the wrong client boundary for MCP token lookup. Hex MCP tokens are not Supabase JWTs. Looking them up through an anon/RLS client can fail because `mcp_tokens` RLS depends on `auth.uid()`.

That failure mode can break valid MCP token auth even if unit tests pass with mocked or simplified data.

The prior refactor also lacked full behavior-parity proof. Phase 2 needs fixture replay and live contract checks before accepting the extraction as complete.

Additional current risk: `tools/list` currently returns full `TOOLS` directly while category gating is enforced on `tools/call`. If Phase 2 intends strict list-time non-disclosure, that needs an explicit plan decision and compatibility test.

## Recommended Refactor Order

1. Freeze top-level contract first with tests for auth order, response envelope, and existing protocol behavior.
2. Extract pure protocol helpers: `mcpOk`, `mcpJsonResult`, `mcpError`, `unauthorizedResponse`, host/resource-metadata helpers. No DB calls.
3. Extract auth module with highest scrutiny:
   - Hex `mcp_tokens` lookup stays on service-role client.
   - JWT validation stays on auth client.
   - OAuth org binding query stays on service-role path.
4. Extract paid-plan and category gating modules while preserving call order and error messages.
5. Extract dispatch registry without moving tool bodies yet.
6. Extract tool handlers family-by-family: read non-AI, write, then AI.
7. Introduce dynamic AI imports last, after parity is stable.
8. Final trim: reduce `index.ts` to orchestrator only once all gates are green.

## Verification Gates

Per extraction step:

```bash
npm test -- --run supabase/functions/mcp-server/__tests__/category-gating.test.ts supabase/functions/mcp-server/__tests__/ai-tools-invariants.test.ts supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts
npm run build
```

Auth-specific live/deployed candidate smoke:

- Valid hex token -> `initialize` 200.
- Valid hex token -> `tools/list` 200.
- Valid hex token -> representative read tool 200.
- Invalid bearer -> 401 with `WWW-Authenticate`.

Type gate:

- Either make `deno check supabase/functions/mcp-server/index.ts` pass, or define and document an equivalent Edge type gate.

Parity gate before acceptance:

- Fixture replay / golden diff across protocol plus representative read/write/admin/AI `tools/call` paths.
- No contract regressions on `content[].text` for tool calls.

Cold-start gate:

- Measure baseline vs candidate on deployed function with a reproducible cold-call method.
- Require measured improvement before closing Phase 2.

## Planning Implications

Phase 2 plans must touch or explicitly verify:

- `supabase/functions/mcp-server/index.ts`
- `supabase/functions/_shared/mcp-tool-categories.ts`
- `supabase/migrations/20260310160000_mcp_tokens.sql`
- `supabase/migrations/20260507130000_add_mcp_token_enabled_categories.sql`
- `supabase/migrations/20260415120000_mcp_oauth_org_bindings.sql`
- `docs/operations/mcp-runbook.md`
- `supabase/functions/mcp-server/__tests__/category-gating.test.ts`
- `supabase/functions/mcp-server/__tests__/ai-tools-invariants.test.ts`
- `supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts`

Most important planning guardrail: do not redesign behavior while refactoring structure. Every extraction step needs immediate proof before continuing.
