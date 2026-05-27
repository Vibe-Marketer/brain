---
must_haves:
  artifacts:
    - supabase/functions/mcp-server/index.ts
    - supabase/functions/mcp-server/tools/types.ts
    - supabase/functions/mcp-server/tools/registry.ts
  tests:
    - supabase/functions/mcp-server/__tests__/mcp-server.integration.test.ts
---

# Phase 02-A: MCP Monolith Refactor - Core Infrastructure & Read Tools

**Status:** Ready to execute

## Goal
Establish the modular dispatcher architecture and refactor all read-only tools out of `index.ts`, satisfying the first half of MCP-05.

## Approach
1. **Define Types:** Create `tools/types.ts` defining `ToolModule`, `McpRequest`, `McpResult`, etc.
2. **Create Registry:** Create `tools/registry.ts` mapping tool names to lazy-loaded or dynamic imports.
3. **Refactor Read Tools:** Extract all `READ` tools (e.g., `list_calls`, `search_calls`, `get_transcript`, etc.) into `tools/read/<tool-name>.ts`.
4. **Update Dispatcher:** Refactor `mcp-server/index.ts` to use the registry. The new `index.ts` handles CORS, Auth, and routes the request to the correct handler. AI dependencies must NOT be imported in `index.ts`.

## Step-by-Step Instructions

1. `mkdir -p supabase/functions/mcp-server/tools/{read,write,ai}`
2. Create `supabase/functions/mcp-server/tools/types.ts` and migrate all types (e.g. `McpToken`, `McpContent`, `McpResult`) from `index.ts` into it.
3. Extract `list_calls`, `search_calls`, `get_transcript`, `get_recording_context`, `list_workspaces`, `list_contacts`, `get_contact`, `get_contact_calls`, `list_folders`, `get_folder_calls`, `list_tags`, `get_tagged_calls`, `list_speakers`, `get_speaker_calls`, `get_action_items`, `get_call_notes`, `list_shared_calls` into `supabase/functions/mcp-server/tools/read/`.
4. Create `supabase/functions/mcp-server/tools/registry.ts` to export an object mapping tool names to their imports, e.g. `const tools = { list_calls: () => import('./read/list_calls.ts') }`.
5. Also extract the `list` tool (returns the available tools filtered by `token.enabled_categories`) into `tools/read/list.ts`.
6. Update `mcp-server/index.ts` to remove the extracted code, import the registry, and route requests to the imported module's `handler()`.
7. Ensure `index.ts` retains only HTTP/CORS, auth, plan-gating, and the routing logic.

## Verification
- `npm run test:integration` passes (specifically any MCP tests).
- Run a manual request against a local edge function using a valid token to verify a read tool.
