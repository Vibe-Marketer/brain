---
phase: 23-management-ui
plan: 01
type: execute-summary
status: shipped
shipped_at: 2026-05-07
requirements_satisfied:
  - MGMT-02 (backend infra)
  - MGMT-03 (backend enforcement)
---

# Phase 23 — Plan 01 SUMMARY (Backend)

## Outcome

Backend half of per-token capability gating shipped end-to-end: schema column, canonical tool→category map (server + frontend mirror), and the enforcement block that gates MCP tool dispatch when a token has explicit `enabled_categories`. MCP error -32001 returned with category-aware message when a UI-disabled tool is invoked. Tokens with `enabled_categories = null` continue full-access (D-13/D-14, no breaking change).

## Files Shipped

| File | Purpose |
|------|---------|
| `supabase/migrations/20260507130000_add_mcp_token_enabled_categories.sql` | Adds nullable JSONB column to `mcp_tokens` (D-02..D-04, D-13) |
| `supabase/functions/_shared/mcp-tool-categories.ts` | CANONICAL map: 41 tool entries + 4 category descriptions + `ToolCategory` type |
| `src/lib/mcp-tool-categories.ts` | Frontend mirror — byte-matches the canonical sibling on values |
| `supabase/functions/mcp-server/index.ts` | 5 deltas (import, interface field, hex-token select, OAuth synthetic token field, gating block above dispatcher) |

## TOOL_CATEGORIES Counts (D-06 lock honored)

- read: 17
- write: 12 (includes `import_youtube_video` per 2026-05-07 audit patch)
- admin: 8
- ai: 4
- **total: 41**

`grep -cE "^[[:space:]]+[a-z_]+: '(read|write|admin|ai)',"` returns 41 on both files. Frontend mirror matches the canonical sibling.

## Five Deltas to mcp-server/index.ts

1. **Import** (top, near line 7): `import { TOOL_CATEGORIES, type ToolCategory } from '../_shared/mcp-tool-categories.ts';`
2. **Interface** (line ~85): Added `enabled_categories: ToolCategory[] | null;` to `McpToken`.
3. **Select** (line ~711): Hex-token branch select string now ends with `, scope, name, enabled_categories`.
4. **OAuth synthetic** (line ~755): Added `enabled_categories: null,` to the OAuth-JWT branch synthetic token literal.
5. **Gating block** (line ~800, BEFORE `switch (toolName)` at line 833): Reads `mcpToken.enabled_categories`; if non-null AND `method === 'tools/call'`, looks up `TOOL_CATEGORIES[toolName]` and rejects with `-32001` either as "is not recognized" (D-08 unknown tool) or "is disabled for this token. Enable the '<category>' category in Settings > Integrations." (D-07 category disabled).

Order verified: enforcement block (line ~800) appears strictly before the dispatcher switch (line 833). Plan-gating block (lines ~765-783) runs before category gating (D-07 enforcement order).

## Deploy Log

- `supabase db push`: Applied `20260507130000_add_mcp_token_enabled_categories.sql` against remote project `vltmrnjsubfzrgrtdqey` — finished with `Finished supabase db push.`
- `supabase functions deploy mcp-server --use-api`: Bundled and uploaded `mcp-server/index.ts` plus `_shared/mcp-tool-categories.ts`, `_shared/track-ai-usage-inline.ts`, `_shared/cors.ts` — confirmed `Deployed Functions on project vltmrnjsubfzrgrtdqey: mcp-server`.

## Backwards Compatibility

- Column default is NULL → existing tokens unchanged (D-13).
- OAuth synthetic tokens get `enabled_categories: null` → OAuth flow continues full-access (D-14).
- Legacy null-categories smoke test: deferred to Plan 23-02 dev-browser checkpoint, which exercises both legacy null and explicit-array paths end-to-end via curl.

## import_youtube_video Fail-Closed Note

`import_youtube_video` is shipped in the dispatcher and **is** in `TOOL_CATEGORIES['write']` per the post-audit D-06 patch (commit `cd6e1383`). Tokens with non-null `enabled_categories` that include `'write'` will continue to call it. Tokens that toggle off the write category will reject `import_youtube_video` with -32001 — desired behavior. No customer-side escalation needed; if a user reports breakage on this tool, the resolution is to confirm the user's `enabled_categories` includes `'write'` (or set it to `null` to restore legacy full-access).

## Concurrent Phase 22 Wave 2 Coordination

The Phase 22 Wave 2 agent shipped `extract_action_items` MCP tool at the same time on the same branch. Phase 22 added a new case-block INSIDE the dispatcher switch; Phase 23 added an enforcement block ABOVE the dispatcher switch. Both edits applied cleanly with no merge conflict — the file currently contains both Phase 22's openrouter/zod imports + `enforceMcpAiUsage` import, and Phase 23's `TOOL_CATEGORIES` import.

## Requirements Status

- **MGMT-02 (backend infra)**: ✅ — column + map + service surface in place. UI delivery completes in Plan 23-02.
- **MGMT-03 (server-side enforcement)**: ✅ — `-32001` rejection with category-aware message live in production.
