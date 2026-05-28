---
status: resolved
trigger: "deno check supabase/functions/mcp-server/index.ts still fails due external AI SDK/OpenRouter provider type drift plus Supabase nested-select type drift"
created: "2026-05-28T00:00:00Z"
updated: "2026-05-28T15:00:00Z"
---

# Debug Session: deno-check-mcp-server-index

## Symptoms

- expected_behavior: `deno check supabase/functions/mcp-server/index.ts` exits 0 after the Phase 02 MCP refactor.
- actual_behavior: `deno check` fails on AI SDK/OpenRouter provider type incompatibilities and Supabase nested-select type casts in extracted MCP modules.
- error_messages: Reproduce with the command before changing code.
- timeline: Started during Phase 02 final verification after extracting MCP tools into modules.
- reproduction: Run `deno check supabase/functions/mcp-server/index.ts` from repo root.

## Current Focus

- hypothesis: Dynamic AI imports resolve incompatible `ai` and OpenRouter provider versions, and Supabase nested-select result inference needs explicit local shape normalization.
- test: Reproduce `deno check`, group errors by source file and category, then fix the smallest local type boundaries.
- expecting: Deno reports the same external provider/schema and nested-select errors described in the phase summary.
- next_action: resolved; commit, deploy, and smoke public endpoint

## Evidence

- timestamp: 2026-05-28T15:00:00Z
  observation: Reproduced `deno check supabase/functions/mcp-server/index.ts` with 16 errors.
  detail: Four AI modules failed on `ai@5.0.102` vs OpenRouter provider type incompatibility and Zod schema type drift. Five read modules failed on Supabase nested-select inference treating joined rows as arrays.
- timestamp: 2026-05-28T15:00:00Z
  observation: `deno check supabase/functions/mcp-server/index.ts` exits 0 after fixes.
  detail: Dynamic AI imports now use compatible esm.sh versions and narrow local function signatures at the import boundary. Nested-select rows cast through `unknown` before local object-shaped row types.
- timestamp: 2026-05-28T15:00:00Z
  observation: Full targeted MCP gate passes.
  detail: 7 Vitest files passed, 167 tests passed.

## Eliminated

- hypothesis: Runtime MCP handler behavior was broken by the Phase 02 extraction.
  reason: Targeted MCP contract/golden/category/AI/write tests remained green, and the failure was purely Deno static type resolution.

## Resolution

- root_cause: Deno resolved incompatible external AI SDK/OpenRouter/Zod type graphs in dynamic AI handlers, and Supabase nested-select generated types did not match the object-shaped joins used by the handlers.
- fix: Updated AI dynamic imports to compatible `@openrouter/ai-sdk-provider@2.9.0`, `ai@6.0.66`, and `zod@3.25.76`; added narrow local function signatures returning `unknown`/typed results at the dynamic import boundary; normalized nested-select rows through `unknown` before applying local row types.
- verification: `deno check supabase/functions/mcp-server/index.ts`; targeted MCP suite with 167 passing tests; `npm run build`.
- files_changed: `supabase/functions/mcp-server/tools/ai/*.ts`, selected `tools/read/*.ts`, `deno.lock`.
