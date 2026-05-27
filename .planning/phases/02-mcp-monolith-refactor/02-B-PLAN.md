---
must_haves:
  artifacts:
    - supabase/functions/mcp-server/index.ts
    - supabase/functions/mcp-server/tools/write/
    - supabase/functions/mcp-server/tools/ai/
  tests:
    - supabase/functions/mcp-server/__tests__/mcp-server.integration.test.ts
---

# Phase 02-B: MCP Monolith Refactor - Write & AI Tools

**Status:** Ready to execute

## Goal
Extract all remaining WRITE and AI tools from `index.ts`, completing the monolith refactor.

## Approach
1. **Refactor Write Tools:** Extract all `WRITE` tools (e.g., `create_note`, `rename_call`, `create_share_link`, etc.) into `tools/write/<tool-name>.ts`.
2. **Refactor AI Tools:** Extract tools requiring `@openrouter/ai-sdk-provider` or `ai` sdk (if any, like `get_action_items` or other semantic generations) into `tools/ai/<tool-name>.ts`. If they are already in read/write, ensure they only import AI SDKs within the file so cold starts for non-AI tools are not impacted.
3. **Update Registry:** Register all write and AI tools in `tools/registry.ts`.
4. **Cleanup `index.ts`:** Remove any lingering AI sdk imports (`@openrouter/ai-sdk-provider`, `ai`) from the top of `index.ts`. Ensure it's under 300 LOC.

## Step-by-Step Instructions

1. Extract `create_note`, `rename_call`, `move_calls_to_workspace`, `delete_call`, `copy_calls_to_organization`, `create_folder`, `rename_folder`, `delete_folder`, `add_call_to_folder`, `remove_call_from_folder`, `create_tag`, `rename_tag`, `delete_tag`, `tag_call`, `untag_call`, `create_share_link`, `revoke_share_link`, `import_youtube_video`, `create_organization`, `create_workspace` into `supabase/functions/mcp-server/tools/write/`.
2. Ensure any AI-related functions are in `tools/ai/` and update registry.
3. Remove `createOpenRouter`, `generateObject`, `generateText` imports from `index.ts`.
4. Run tests and deploy.

## Verification
- Run tests and ensure all requests map correctly.
- Verify `index.ts` size: `wc -l supabase/functions/mcp-server/index.ts` should be under 300.
- Verify cold starts: test locally or observe deployment logs for no AI dependency loads on basic `list_calls` request.
