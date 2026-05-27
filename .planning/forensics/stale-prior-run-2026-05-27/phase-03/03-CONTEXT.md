# Phase 3: Per-Workspace MCP Endpoints + Connect-to-AI - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Each workspace exposes its own MCP URL that AI clients see as a distinct connection; users can wire any workspace into Claude Desktop / Cursor / a generic MCP client in one click; tokens are mintable, listable, and revocable per workspace.

</domain>

<decisions>
## Implementation Decisions

### Token Management UI & Placement
- Integrate it directly inside the existing "AI Integrations" tab.
- Rename the "AI Integrations" tab to "AI Connectors".

### Connect to AI URL Structure
- Use **UUIDs** (`/mcp/w/{workspace_uuid}`). While slugs are aesthetically cleaner, if a user renames a workspace and the slug changes, it would break any active MCP connections in Cursor/Claude Desktop (which may not properly follow HTTP 308 redirects for JSON-RPC POST requests). UUIDs guarantee that the connection remains robust permanently, regardless of workspace renaming.

### the agent's Discretion
- The exact layout of the token management table within the AI Connectors tab (following the GitHub PAT pattern).
- Token prefix generation logic (`cv_ws_<hex>`).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mcp_tokens` table already supports workspace scoping (`workspace_id`).
- Existing OAuth DCR endpoints and PKCE flow can be kept intact for auto-discovery clients.
- `api-proxy/worker.ts` already forwards `/mcp/*` transparently to the edge function.

### Established Patterns
- Path-based routing inside the Edge Function (extracting `{workspace_id}` from `/mcp/w/{workspace_id}`).
- JWT validation logic inside `mcp-server/auth.ts`.

### Integration Points
- "AI Connectors" tab in the Workspace Settings UI.
- `supabase/functions/mcp-server/routing.ts` (to parse workspace from URL).

</code_context>

<specifics>
## Specific Ideas

- The UI should have a one-click "Connect to AI" button that exposes the pre-filled JSON snippets for Claude Desktop and Cursor with a newly minted hex token.

</specifics>

<deferred>
## Deferred Ideas

- Slug-based URLs or customizable workspace vanity URLs. We will stick to UUIDs for v1 to ensure robust, unbreakable connections.

</deferred>
