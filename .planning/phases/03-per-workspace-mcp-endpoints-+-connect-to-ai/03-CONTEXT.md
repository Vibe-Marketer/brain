# Phase 03: Per-Workspace MCP Endpoints + Connectors Setup - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 03 makes CallVault's own MCP connection setup workspace-aware and self-serve. Each workspace gets a stable UUID-based MCP endpoint, OAuth is the primary "connect this AI" path, and manual tokens remain the visible fallback for finer-grained control or providers that do not support CallVault OAuth yet.

This phase is about connecting AI clients to CallVault's MCP server. It is not the Phase 04 write-tool expansion, not a multi-vendor MCP gateway, and not an admin-control-plane MCP.

</domain>

<decisions>
## Implementation Decisions

### OAuth Consent and Default Permissions

- **D-01:** OAuth MCP connections default to full non-admin access, scoped to the selected organization or workspace.
- **D-02:** OAuth is not the v1 mechanism for granular tool-category choices. Manual tokens are the v1 path for category-scoped access such as read-only, read+AI, or no-write.
- **D-03:** Permission changes after a connection is established must be enforced server-side immediately. Client-visible tool lists may require the user to reconnect/reload the AI client, so Phase 03 must not depend on live graying-out or instant tool refresh inside Claude, ChatGPT, or other MCP clients.
- **D-04:** Normal OAuth connections must not include admin tools by default. Admin-scoped MCP is a separate future connection type.

### Workspace and Organization Scope

- **D-05:** Default OAuth consent remains organization-scoped.
- **D-06:** The OAuth consent page should add an optional checkbox to limit the MCP connection to a specific workspace.
- **D-07:** When the workspace-scope checkbox is checked, show a secondary workspace dropdown. If unchecked, the OAuth grant is full-org non-admin access.
- **D-08:** Starting from a workspace-specific CallVault surface should preselect workspace scope and the relevant workspace when possible.

### Provider-Specific Connect Actions

- **D-09:** The ideal user flow is a top-client action such as "Add to Claude", "Add to ChatGPT", "Add to Perplexity", "Add to Gemini", or "Add to Manus" that opens the destination provider and starts the auth/add-MCP flow targeted to the chosen org or workspace.
- **D-10:** Provider-specific add/deep-link support is a Phase 03 research target, not an assumed implementation. Downstream research must validate each provider before planning exact one-click flows.

### Settings / AI Connectors Layout

- **D-11:** The connection-management UI belongs inside the AI connectors tab in Settings.
- **D-12:** Use grouped sections, not one mixed list. OAuth-connected AI clients appear at the top as the easiest way to connect.
- **D-13:** Manual/token-based connectors appear below OAuth clients as the more controlled/scoped option and as the fallback for providers that do not support CallVault OAuth yet.
- **D-14:** Token setup should be secondary but visible. Do not hide it behind advanced settings in v1.

### the agent's Discretion

- Exact labels, badges, and card/row layout are flexible as long as OAuth clearly reads as the simplest path and manual tokens clearly read as the control/fallback path.
- Exact top-client list can be adjusted by research evidence and current provider support, but Claude, ChatGPT, Perplexity, Gemini, and Manus should be investigated.
- Exact server response text for stale/disallowed calls is flexible, but server-side enforcement must be immediate and clear.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning Scope

- `.planning/ROADMAP.md` — Phase 03 goal, success criteria, research notes, and sequencing constraints.
- `.planning/REQUIREMENTS.md` — MCP-01, MCP-02, and MCP-03 requirements.
- `.planning/PROJECT.md` — Workstream 4 scope and key decisions.
- `.planning/STATE.md` — current milestone state and Phase 03 roadmap evolution note.
- `.planning/phases/02-mcp-monolith-refactor/02-CONTEXT.md` — Phase 2 MCP auth and behavior-preservation boundaries that Phase 03 builds on.

### MCP Auth, Discovery, and Routing

- `supabase/functions/mcp-server/auth.ts` — current hex-token and OAuth-JWT authentication boundary.
- `supabase/functions/mcp-server/gating.ts` — plan/category gate enforcement.
- `supabase/functions/mcp-oauth-metadata/index.ts` — OAuth/MCP discovery document generation.
- `supabase/functions/mcp-oauth-register/index.ts` — dynamic client registration proxy.
- `cloudflare/api-proxy/worker.ts` — public `api.callvaultai.com` routing for `/mcp`, `/mcp/*`, `/.well-known/*`, `/mcp-register`, and `/auth/v1/*`.
- `docs/operations/mcp-runbook.md` — MCP production runbook and response-shape contract.

### Data Model and UI

- `supabase/migrations/20260415120000_mcp_oauth_org_bindings.sql` — current one-binding-per-user OAuth bridge that must be replaced or migrated for per-client grants.
- `supabase/migrations/20260310160000_mcp_tokens.sql` — manual MCP token schema baseline.
- `src/pages/OAuthConsentPage.tsx` — current OAuth consent page and org selection behavior.
- `src/components/settings/MCPTab.tsx` — current token-centric MCP settings UI and permission toggles.
- `src/services/mcp-tokens.service.ts` — manual token CRUD service.
- `src/services/mcp-token-capabilities.service.ts` — manual token category persistence.
- `src/hooks/useMcpTokenCapabilities.ts` — optimistic permission-toggle mutation pattern.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `src/pages/OAuthConsentPage.tsx`: existing MCP OAuth consent route, client-name display, org picker, and `mcp_oauth_org_bindings` upsert path.
- `src/components/settings/MCPTab.tsx`: existing MCP token UI with token creation, token list, snippets, permission toggles, revoke, and rotate.
- `src/services/mcp-tokens.service.ts`: manual token list/create/delete/regenerate service.
- `src/services/mcp-token-capabilities.service.ts` and `src/hooks/useMcpTokenCapabilities.ts`: existing category-toggle persistence and optimistic update pattern for manual tokens.
- `supabase/functions/mcp-server/auth.ts`: current auth split between 64-char hex tokens and Supabase OAuth JWTs.
- `supabase/functions/mcp-oauth-register/index.ts`: dynamic client registration compatibility layer for MCP clients.

### Established Patterns

- Frontend data access follows service + TanStack Query hook separation. Components should not call services directly.
- MCP remains one Edge Function; Phase 03 changes path routing/auth behavior inside that server rather than splitting functions.
- MCP tool-call responses stay `content[].text` markdown. Structured JSON is only for protocol-level methods like `initialize` and `tools/list`.
- `tools/list` filtering and `tools/call` enforcement must both be server-side; UI/client affordances are not the security boundary.
- Manual-token category semantics already use `enabled_categories: null` as all categories enabled.

### Integration Points

- Add or migrate from `mcp_oauth_org_bindings` to a first-class per-client OAuth grant table keyed by authenticated user, Supabase OAuth `client_id`, and org/workspace scope.
- Extend OAuth consent to support org default plus optional workspace checkbox/dropdown.
- Add workspace path handling for `/mcp/w/{workspace_uuid}` through Cloudflare routing, OAuth metadata, and MCP auth/audience enforcement.
- Rework current token-centric `MCPTab` into a Settings AI connectors surface with OAuth clients first and manual token connectors second.
- Research provider-specific add/deep-link support for top MCP clients before promising one-click install buttons.

</code_context>

<specifics>
## Specific Ideas

- OAuth copy should position OAuth as "the simplest and easiest way to connect."
- Manual token copy should explain that tokens are for more control, scoped access, or providers that do not yet support CallVault OAuth.
- Top provider research should include Claude, ChatGPT, Perplexity, Gemini, and Manus.
- If a user starts from a workspace, the OAuth consent flow should preserve that intent instead of making them reselect from scratch.

</specifics>

<deferred>
## Deferred Ideas

- Admin-scoped MCP should be a future/admin-specific connection type, separate from the normal OAuth flow.
- Provider-specific auto-add/deep-link support must be validated during Phase 03 research before implementation commits to exact providers.

</deferred>

---

*Phase: 03-Per-Workspace MCP Endpoints + Connectors Setup*
*Context gathered: 2026-05-28*
