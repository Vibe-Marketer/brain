# Plan 02-02 Summary: Protocol, auth, and gate extraction

**Completed:** 2026-05-28
**Status:** Complete

## What Changed

- Extracted MCP response helpers into `supabase/functions/mcp-server/protocol.ts`.
- Extracted custom MCP bearer auth into `supabase/functions/mcp-server/auth.ts`, preserving service-role `mcp_tokens` lookup, JWT validation through Supabase Auth, service-role OAuth org binding lookup, and async `last_used_at` update.
- Extracted paid-plan and category gates into `supabase/functions/mcp-server/gating.ts`.
- Added `supabase/functions/mcp-server/tools/_types.ts` for shared JSON-RPC/MCP token/tool contract types.
- Updated source-anchor tests so they follow the extracted helper locations instead of stale monolith-only anchors.

## Verification

```bash
npm test -- --run supabase/functions/mcp-server/__tests__/contract-surface.test.ts supabase/functions/mcp-server/__tests__/golden-replay.test.ts supabase/functions/mcp-server/__tests__/category-gating.test.ts supabase/functions/mcp-server/__tests__/ai-tools-invariants.test.ts supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts
```

Result: 5 files passed, 143 tests passed.

```bash
npm run build
```

Result: build passed against the committed tree after touching `mcp-server/index.ts`.

```bash
deno check supabase/functions/mcp-server/index.ts
```

Result: still fails on existing Supabase join typing and AI SDK/Zod/provider type drift, plus the existing `fetchOrgWorkspaceIds` client typing shape. New extracted auth/gating helper errors were removed after type adjustment; full Deno type-gate cleanup remains a later Phase 2 gate per D-07.

## Notes

- No tool case body moved in this plan.
- `index.ts` still owns the 41-tool `TOOLS` array and switch dispatch.
- Protocol order remains: valid token -> `initialize`/`tools/list` -> paid-plan gate -> category gate -> dispatch.
