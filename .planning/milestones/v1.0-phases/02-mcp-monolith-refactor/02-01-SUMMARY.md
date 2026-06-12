# Plan 02-01 Summary: MCP baseline gates

**Completed:** 2026-05-28
**Status:** Complete

## What Changed

- Added `golden-replay.test.ts` and `fixtures/golden-replay.json` to pin the restored monolith before extraction.
- Added `contract-surface.test.ts` to audit the current 41-tool surface, category coverage, `outputSchema` shape, `mcpOk` `content[].text` contract, and auth/protocol/gating/dispatch order.
- Added `cold-start-baseline.test.ts` and expanded `docs/operations/mcp-runbook.md` with exact invalid-bearer, valid-token, `tools/list`, representative read-tool, baseline timing, and candidate timing commands.

## Verification

```bash
npm test -- --run supabase/functions/mcp-server/__tests__/golden-replay.test.ts supabase/functions/mcp-server/__tests__/contract-surface.test.ts supabase/functions/mcp-server/__tests__/cold-start-baseline.test.ts supabase/functions/mcp-server/__tests__/category-gating.test.ts
```

Result: 4 files passed, 37 tests passed.

## Notes

- No production MCP behavior changed in this plan.
- Live token smoke and deployed cold-start improvement are documented but not yet executed; they remain final Phase 2 gates after the refactor candidate deploy.
