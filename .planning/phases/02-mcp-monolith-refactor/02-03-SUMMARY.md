# Plan 02-03 Summary: Registry dispatcher and read-tool pilot

**Completed:** 2026-05-28
**Status:** Complete

## What Changed

- Added `tools/registry.ts` with `getToolModule()` dispatch and `buildToolDefinitions()` aggregation.
- Wired `index.ts` to return registry-built `tools/list` definitions while preserving the 41 legacy schemas.
- Wired `index.ts` to dispatch extracted modules before the inline switch fallback.
- Extracted five read tools into one-tool-per-file modules:
  - `search_calls`
  - `list_calls`
  - `get_transcript`
  - `get_recording_context`
  - `list_workspaces`
- Removed the five extracted inline cases from `index.ts`; remaining tools still use the inline fallback.
- Updated golden replay anchors so extracted handlers can be validated from module files.

## Verification

```bash
npm test -- --run supabase/functions/mcp-server/__tests__/golden-replay.test.ts supabase/functions/mcp-server/__tests__/contract-surface.test.ts supabase/functions/mcp-server/__tests__/category-gating.test.ts
```

Result: 3 files passed, 32 tests passed.

```bash
npm run build
```

Result: build passed against the committed tree after touching `mcp-server/index.ts`.

```bash
deno check supabase/functions/mcp-server/index.ts
```

Result: still fails, but the error count dropped as extracted read tools reduced monolith surface. Remaining failures are the known Supabase join typing casts and esm.sh AI SDK/Zod/provider drift, plus mirrored join-cast issues inside the newly extracted read modules. This remains an explicitly documented D-07 limitation; targeted MCP tests plus `npm run build` remain the active gate until the type gate is repaired.

## Notes

- `tools/list` still exposes 41 tools.
- Extracted tools are read-only and preserve the existing workspace/org scoping logic.
- Not-yet-extracted tools still dispatch through the inline switch.
