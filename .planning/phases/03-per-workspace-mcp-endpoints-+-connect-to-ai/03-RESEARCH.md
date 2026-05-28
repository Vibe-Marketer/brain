---
phase: 03
slug: per-workspace-mcp-endpoints-connect-to-ai
created: 2026-05-28
status: active
research_depth: standard
---

# Phase 03 Research - Per-Workspace MCP Endpoints + Connect to AI

## Summary

Phase 03 is possible, but the safest product shape is narrower than "live-edit provider permissions."

CallVault can reliably show and revoke OAuth-connected AI clients only if it stops treating OAuth JWTs as a synthetic full-access token and persists a first-class CallVault MCP grant per OAuth `client_id`, user, org, and optional workspace. Supabase provides OAuth identity, client registration, token issuance, and a `client_id` JWT claim; CallVault must own MCP authorization categories, workspace scoping, endpoint/resource binding, audit fields, and revocation state.

Provider-side behavior is uneven. Claude, ChatGPT, Cursor, Gemini Code Assist, Perplexity, and Manus all have some MCP or connector story, but not all expose a public one-click "install this exact remote MCP with this workspace URL" contract. Phase 03 should implement reliable CallVault-side OAuth setup, workspace-scoped URLs, manual snippets, and connection management first. Provider-specific "Add to X" buttons should be added only where an official, stable deep-link or publishing flow is verified.

The important correction to the user's concern is: yes, clients such as Claude and ChatGPT can have their own per-tool approval settings, but that is not the same security boundary as CallVault permissions. CallVault must filter `tools/list` and reject unauthorized `tools/call` server-side. If a grant changes after connection, clients may require a refresh, reload, or reconnect before their visible tool list changes.

## Primary Source Findings

### MCP protocol

- The MCP Tools spec says applications should expose which tools are available and keep a human in the loop. It also defines `tools/list` for tool discovery and a `listChanged` capability for servers that emit tool-list-change notifications. Source: https://modelcontextprotocol.io/specification/2025-06-18/server/tools
  - Short quote: "`tools/list` request"
  - Short quote: "`listChanged` indicates"
- The MCP Authorization spec requires bearer-token auth on each request, token validation by the resource server, and 401/403 distinction. Invalid tokens are 401; insufficient permission is 403. Source: https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
  - Short quote: "`Authorization: Bearer <access-token>`"
  - Short quote: "`403 Forbidden`"
- MCP authorization also relies on resource indicators/audience binding. The workspace URL should therefore be treated as the OAuth resource, not only as a UI convenience. Source: https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization

Planning implication: per-workspace endpoint auth should fail closed. A valid token/grant for workspace A presented to `/mcp/w/{workspace_b}` should return 403, not silently broaden access and not return 401 unless the bearer token itself is invalid.

### Supabase OAuth server

- Supabase OAuth Server supports OAuth 2.1 with PKCE, dynamic client registration, OIDC discovery, and JWT access tokens. Supabase states that access tokens include `user_id`, `role`, and `client_id` claims. Source: https://supabase.com/docs/guides/auth/oauth-server
  - Short quote: "`client_id` claims"
- Supabase's MCP auth guide describes discovery, optional dynamic registration, user authorization, token exchange, and authenticated access. It explicitly recommends user approval and later revocation. Source: https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication
  - Short quote: "Allow users to revoke access later"
- Supabase OAuth flow docs show `getAuthorizationDetails(authorization_id)`, `approveAuthorization`, and `denyAuthorization` as the custom consent-screen integration points. Source: https://supabase.com/docs/guides/auth/oauth-server/oauth-flows
  - Short quote: "`getAuthorizationDetails(authorization_id)`"
- Supabase OAuth flow docs list authorization-code + refresh-token grants and do not support client credentials/password grants. Source: https://supabase.com/docs/guides/auth/oauth-server/oauth-flows

Planning implication: Supabase can identify the OAuth client, but CallVault still needs its own durable grant table. The current `mcp_oauth_org_bindings` table is too coarse because it has one row per user and overwrites prior org binding.

### Provider/client support

| Client/provider | Evidence | Phase 03 interpretation |
|---|---|---|
| Claude | Claude supports custom remote MCP connectors, public internet reachability, OAuth, org-owner setup on Team/Enterprise, user-level Connect, and remove/disconnect flows. Source: https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp | Strong candidate for primary OAuth flow and setup guidance. Official docs describe manual add/configure steps, not a guaranteed CallVault-controlled one-click deep link. |
| ChatGPT/OpenAI | ChatGPT Developer Mode supports creating apps from remote MCPs, SSE/streaming HTTP, OAuth/no auth/mixed auth, tool toggles, refresh, and confirmation prompts. New/changed actions are not automatically enabled after publish in some admin contexts. Sources: https://developers.openai.com/api/docs/guides/developer-mode and https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta | Strong candidate for setup guidance and future app publishing. The official docs explicitly support refresh to pull new tools, so CallVault should not assume tool-list changes propagate automatically. |
| Cursor | Cursor supports stdio, SSE, and Streamable HTTP MCP. Remote SSE/HTTP support OAuth. Cursor also supports one-click installation from its MCP collection and tool toggles in settings/chat. Source: https://docs.cursor.com/context/model-context-protocol | Strong candidate for manual snippets and possibly an Add to Cursor path. Need implementation-time validation of the exact button/deep-link schema before exposing it as one-click. |
| Gemini / Google | Gemini Code Assist docs show adding local or remote MCP servers through settings JSON. Gemini API docs show MCP SDK support for tool calling in application code. Sources: https://developers.google.com/gemini-code-assist/docs/use-agentic-chat-pair-programmer and https://ai.google.dev/gemini-api/docs/function-calling | Good candidate for generic/manual setup. I did not find a stable official consumer Gemini "one-click connect remote MCP with OAuth" contract in the researched docs. |
| Perplexity | Perplexity help center says local MCP is available on macOS and remote MCP is rolling out/coming soon to paid subscribers. Source: https://www.perplexity.ai/help-center/ja/articles/11502712-perplexity%E3%81%AE%E3%83%AD%E3%83%BC%E3%82%AB%E3%83%AB%E3%81%8A%E3%82%88%E3%81%B3%E3%83%AA%E3%83%A2%E3%83%BC%E3%83%88mcp | Do not promise one-click v1. Treat as researched-but-conditional and provide generic endpoint/token instructions until remote MCP support is confirmed in the target user account. |
| Manus | Manus API docs describe connectors authorized in the Manus web app through OAuth, connector UUIDs, and revocation from integrations. Source: https://open.manus.ai/docs/v2/connectors | Manus has an OAuth connector model, but the public API docs are about using existing Manus connectors, not registering arbitrary CallVault MCP from CallVault. Treat one-click as unverified. |

## Current CallVault Starting Point

Relevant current implementation:

- `cloudflare/api-proxy/worker.ts` already routes `/mcp` and `/mcp/*` to the `mcp-server` Edge Function, so `/mcp/w/{workspace_uuid}` can reach the server without a new public service.
- `supabase/functions/mcp-oauth-metadata/index.ts` advertises a canonical resource for `/mcp`, but not workspace-specific resources such as `/mcp/w/{workspace_uuid}`.
- `supabase/functions/mcp-oauth-register/index.ts` proxies dynamic client registration into Supabase Auth and normalizes MCP client registration fields.
- `src/pages/OAuthConsentPage.tsx` already calls Supabase OAuth consent APIs and displays client/org information, but it only stores a one-row-per-user org binding.
- `supabase/functions/mcp-server/auth.ts` validates manual hex tokens from `mcp_tokens`; for OAuth JWTs it looks up `mcp_oauth_org_bindings` by `user_id` and returns a synthetic full-access `McpToken` shape with `enabled_categories: null`.
- `supabase/migrations/20260415120000_mcp_oauth_org_bindings.sql` intentionally enforces `unique(user_id)`, which prevents listing multiple AI clients separately.
- `src/components/settings/MCPTab.tsx`, `src/services/mcp-token-capabilities.service.ts`, and `src/hooks/useMcpTokenCapabilities.ts` already provide a token-centric management UI and category-toggle persistence pattern.

## Recommended Architecture

### Data model

Add a first-class OAuth MCP grant table. Suggested shape:

- `id uuid primary key`
- `user_id uuid not null`
- `client_id text not null`
- `client_name text`
- `client_uri text`
- `redirect_uri text`
- `org_id uuid not null`
- `workspace_id uuid null`
- `scope text not null check (scope in ('organization', 'workspace'))`
- `enabled_categories text[] null`
- `last_used_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `revoked_at timestamptz null`
- `revoked_reason text null`
- unique active grant on `(user_id, client_id, org_id, workspace_id)` with partial index where `revoked_at is null`

Keep `mcp_tokens` for manual tokens. Add prefixed token generation (`cv_ws_...`, `cv_org_...`) while preserving legacy 64-char hex validation.

Migration posture:

- Do not delete `mcp_oauth_org_bindings` in the same step that introduces the new table.
- Add read fallback only long enough to migrate existing OAuth users.
- Backfill possible rows from existing bindings as "legacy OAuth" grants if a `client_id` can be recovered. If not, require reconnect and make the UI clear.

### OAuth consent flow

Consent page behavior:

1. Load Supabase authorization details with `authorization_id`.
2. Show client name/redirect URI/scopes.
3. Show organization select.
4. Default to org-scoped access.
5. Add checkbox: "Limit this AI connection to one workspace".
6. When checked, show workspace dropdown.
7. If flow starts from a workspace-specific surface, preselect workspace scope and that workspace.
8. On approve, upsert a CallVault OAuth MCP grant before calling Supabase `approveAuthorization`.
9. If Supabase returns a `redirect_url` fast path for an already-consented client, ensure CallVault still has an active grant before redirecting.

OAuth category policy:

- v1 OAuth grants should default to full non-admin access for the selected org/workspace.
- Manual tokens remain the v1 path for granular read/write/AI/admin category control.
- The schema can include `enabled_categories` for future OAuth category control, but the UI should not make OAuth category scoping a primary v1 control.

### MCP auth and workspace routing

Auth behavior:

- Manual prefixed/legacy token path remains supported.
- OAuth JWT path validates the Supabase access token, decodes/reads `client_id`, and resolves an active CallVault grant by `user_id + client_id`.
- The resolved grant is converted into the same internal token/permission context as manual tokens.
- `last_used_at` updates on successful authenticated requests.
- Missing/revoked grant returns 403 if the JWT is otherwise valid.
- Invalid/expired JWT returns 401 with the existing `WWW-Authenticate` behavior.

Workspace URL behavior:

- Parse `/w/{workspace_uuid}` inside `mcp-server`.
- If the path contains a workspace UUID, bind the request context to that workspace.
- Workspace-scoped grants/tokens must match the path workspace exactly.
- Org-scoped grants/tokens may use a workspace endpoint only when the org owns that workspace; the endpoint still constrains tool behavior to that workspace.
- `/mcp` remains org-scoped/generic for clients that do not use a workspace path.

Discovery behavior:

- Add protected resource metadata for `/.well-known/oauth-protected-resource/mcp/w/{workspace_uuid}`.
- The metadata `resource` value must exactly match `https://api.callvaultai.com/mcp/w/{workspace_uuid}`.
- Keep wildcard/public CORS on discovery endpoints.

### Settings AI connectors surface

Replace the token-only mental model with two grouped sections:

1. OAuth-connected AI clients
   - Position as the simplest setup path.
   - Show client name, provider/client type when known, org/workspace scope, workspace, endpoint/resource URL, categories, last used, created by, created date, and revoke.
   - Use "Reconnect" or "Open setup" actions where the provider cannot be deep-linked.

2. Manual/token-based connectors
   - Position as the more controlled option and provider fallback.
   - Preserve create/list/revoke/rotate.
   - Preserve category toggles and snippets.
   - Snippets must use `https://api.callvaultai.com/mcp/w/{workspace_uuid}` when workspace scoped.

Provider buttons:

- Claude: show guided setup; add one-click only after validating a stable Claude URL/deep-link.
- ChatGPT: show Developer Mode/App setup guidance; do not imply published app availability until submission/admin flow exists.
- Cursor: candidate for "Add to Cursor" after validating exact link schema.
- Perplexity, Gemini, Manus: generic/manual until official remote-MCP add flow is verified for arbitrary CallVault MCP servers.

### Tool refresh and permissions

CallVault should not rely on client UI state as a security mechanism.

- `tools/list` must filter by the resolved grant/token categories and workspace.
- `tools/call` must re-check the same authorization and return 403 for disallowed tools or mismatched workspace.
- After a grant changes, users may need to refresh/reconnect in the client before visible tools update.
- Do not promise grayed-out tools inside Claude/ChatGPT/etc. Some clients hide disabled/unavailable tools, some use per-tool approvals, and some require explicit refresh.

## Open Questions / Risks

1. Supabase JWT `client_id` shape should be verified in a real OAuth token or fixture. The docs say it exists, but implementation should test exact claim path and type.
2. `getAuthorizationDetails` may or may not expose every field CallVault wants to persist (`client_id`, client URI, redirect URI). If not exposed, the implementation needs a safe lookup or delayed grant completion from token/JWT evidence.
3. Supabase grant revocation from CallVault Settings may require the user's session API (`supabase.auth.oauth.revokeGrant(clientId)`) rather than service-role/admin revocation. Plan for local `revoked_at` as the immediate enforcement boundary.
4. Existing Supabase consent fast-path behavior can bypass CallVault's current binding write. This must be handled before shipping.
5. Dynamic client registration means untrusted clients can present names/metadata. UI should show but not over-trust provider labels.
6. Published ChatGPT apps and enterprise action controls are materially different from Developer Mode test apps. Do not conflate them in copy.
7. Perplexity remote MCP support appears not universally available yet, based on its help docs. Treat as conditional.
8. Phase 03 depends on Phase 02's modular MCP server. Planning should not land workspace routing on the old monolith.

## Validation Architecture

Automated tests should cover:

- SQL migration tests or Supabase integration checks for the new OAuth grant table, active unique indexes, revoked rows, and RLS/user ownership.
- `mcp-server` auth tests:
  - valid manual org token on `/mcp`
  - valid manual workspace token on matching `/mcp/w/{workspace_uuid}`
  - workspace A token on workspace B endpoint returns 403
  - valid OAuth JWT with active grant resolves categories and scope
  - valid OAuth JWT with missing/revoked grant returns 403
  - invalid/expired JWT returns 401
  - `last_used_at` updates
- `mcp-server` protocol tests:
  - `initialize` still returns valid capabilities
  - `tools/list` filters by categories and workspace
  - `tools/call` rejects tools not visible to the grant/token
  - tool-call responses remain `content[].text` markdown
- Metadata/DCR tests:
  - root `/mcp` protected-resource metadata remains valid
  - workspace protected-resource metadata advertises exact workspace resource
  - `/mcp-register` continues to normalize dynamic client registrations
- UI tests:
  - OAuth consent defaults to org scope
  - workspace checkbox reveals dropdown
  - workspace-originated setup preselects the workspace
  - approval writes a CallVault grant before Supabase approval
  - Settings AI connectors shows OAuth connections above manual tokens
  - revoke marks OAuth grant revoked and manual token revoked/deleted
- Browser/manual smoke:
  - connect Claude custom connector to a workspace URL using OAuth
  - connect Cursor/manual MCP config to workspace URL
  - verify ChatGPT app/developer-mode setup if account capability is available
  - verify provider refresh/reconnect copy after permission changes
- Production smoke after deploy:
  - `https://api.callvaultai.com/.well-known/oauth-protected-resource/mcp/w/{workspace_uuid}` returns the workspace resource
  - `https://api.callvaultai.com/mcp/w/{workspace_uuid}` initializes with a valid token/grant
  - mismatched workspace returns 403

Recommended feedback loop:

- Early Wave 0: create DB/auth fixtures before UI work.
- Per backend task: run targeted MCP auth/protocol tests.
- Per UI task: run component tests plus `npm run build`.
- Before verification: run full MCP test slice, build, and at least one live workspace endpoint smoke.

## Planning Recommendation

Split Phase 03 into implementation plans in this order:

1. DB grant model, prefixed manual-token compatibility, and migration/fallback strategy.
2. Workspace path parsing, protected-resource metadata, and audience/workspace enforcement in `mcp-server`.
3. OAuth consent page org-default/workspace-checkbox grant creation.
4. Settings AI connectors management UI with OAuth clients first and manual tokens second.
5. Provider setup snippets/actions, limited to verified provider capabilities.
6. End-to-end tests, production smoke, runbook updates, and provider-specific manual verification.

Do not implement OAuth category toggles as the main v1 UX. Keep OAuth full non-admin within org/workspace, and keep manual tokens as the controlled/scoped path.
