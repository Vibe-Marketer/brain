# Phase 03: Per-Workspace MCP Endpoints + Connectors Setup - Research

**Researched:** 2026-05-28  
**Domain:** MCP OAuth authorization, workspace-scoped endpoint routing, and connection management UX  
**Confidence:** MEDIUM

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** OAuth MCP connections default to full non-admin access, scoped to the selected organization or workspace.
- **D-02:** OAuth is not the v1 mechanism for granular tool-category choices. Manual tokens are the v1 path for category-scoped access such as read-only, read+AI, or no-write.
- **D-03:** Permission changes after a connection is established must be enforced server-side immediately. Client-visible tool lists may require the user to reconnect/reload the AI client, so Phase 03 must not depend on live graying-out or instant tool refresh inside Claude, ChatGPT, or other MCP clients.
- **D-04:** Normal OAuth connections must not include admin tools by default. Admin-scoped MCP is a separate future connection type.
- **D-05:** Default OAuth consent remains organization-scoped.
- **D-06:** The OAuth consent page should add an optional checkbox to limit the MCP connection to a specific workspace.
- **D-07:** When the workspace-scope checkbox is checked, show a secondary workspace dropdown. If unchecked, the OAuth grant is full-org non-admin access.
- **D-08:** Starting from a workspace-specific CallVault surface should preselect workspace scope and the relevant workspace when possible.
- **D-09:** The ideal user flow is a top-client action such as "Add to Claude", "Add to ChatGPT", "Add to Perplexity", "Add to Gemini", or "Add to Manus" that opens the destination provider and starts the auth/add-MCP flow targeted to the chosen org or workspace.
- **D-10:** Provider-specific add/deep-link support is a Phase 03 research target, not an assumed implementation. Downstream research must validate each provider before planning exact one-click flows.
- **D-11:** The connection-management UI belongs inside the AI connectors tab in Settings.
- **D-12:** Use grouped sections, not one mixed list. OAuth-connected AI clients appear at the top as the easiest way to connect.
- **D-13:** Manual/token-based connectors appear below OAuth clients as the more controlled/scoped option and as the fallback for providers that do not support CallVault OAuth yet.
- **D-14:** Token setup should be secondary but visible. Do not hide it behind advanced settings in v1.

### the agent's Discretion
- Exact labels, badges, and card/row layout are flexible as long as OAuth clearly reads as the simplest path and manual tokens clearly read as the control/fallback path.
- Exact top-client list can be adjusted by research evidence and current provider support, but Claude, ChatGPT, Perplexity, Gemini, and Manus should be investigated.
- Exact server response text for stale/disallowed calls is flexible, but server-side enforcement must be immediate and clear.

### Deferred Ideas (OUT OF SCOPE)
- Admin-scoped MCP should be a future/admin-specific connection type, separate from the normal OAuth flow.
- Provider-specific auto-add/deep-link support must be validated during Phase 03 research before implementation commits to exact providers.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MCP-01 | Per-workspace MCP URLs `/mcp/w/{workspace_uuid}` with audience binding and multi-connection support | Routing/auth section + OAuth resource metadata section + grant table design |
| MCP-02 | OAuth-first setup UX and snippet-based fallback using public API URL | Provider setup evidence + UI architecture + snippet standardization |
| MCP-03 | Unified management for OAuth grants + manual tokens with scopes/categories/actions | Grant persistence model + server-side enforcement + settings IA |

## Summary

Phase 03 should be planned as an authorization-and-routing phase, not just a UI phase. The current code still resolves OAuth MCP access via `mcp_oauth_org_bindings` (one row per user) and synthesizes full-access permissions, which cannot satisfy per-client grant listing/revocation and category enforcement requirements. [VERIFIED: codebase grep]  

The stable implementation pattern is: keep one `mcp-server` function, parse workspace path in-function, resolve a first-class CallVault OAuth grant keyed by `user_id + client_id + org/workspace`, and enforce categories/workspace on both `tools/list` and `tools/call`. [VERIFIED: codebase grep] [CITED: https://supabase.com/docs/guides/auth/oauth-server/token-security] [CITED: https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization]  

Provider “Add to X” flows are uneven; plan one-click buttons only where official, stable docs prove deep-link/install support. Otherwise ship guided setup + copyable snippets first. [CITED: https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp] [CITED: https://platform.openai.com/docs/mcp/] [CITED: https://docs.perplexity.ai/docs/getting-started/integrations/mcp-server] [CITED: https://manus.im/docs/integrations/mcp-connectors] [CITED: https://ai.google.dev/gemini-api/docs/function-calling]

**Primary recommendation:** Implement per-workspace OAuth resource binding + per-client CallVault grant persistence first; treat provider one-click actions as capability-gated enhancements, not baseline delivery.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Workspace endpoint parsing (`/mcp/w/{uuid}`) | API / Backend | CDN / Static | URL path arrives at Worker/function; auth context is backend-owned |
| OAuth metadata + DCR exposure | API / Backend | CDN / Static | RFC docs and registration proxy are backend endpoints |
| OAuth consent scope capture (org vs workspace) | Frontend Server (SSR) | API / Backend | User decision in UI; persisted grant + enforcement on backend |
| Grant/category authorization | API / Backend | Database / Storage | Security boundary must be server-side, persisted in DB |
| Token/grant management UI | Browser / Client | API / Backend | Presentation and actions in Settings; backend performs mutations |
| Token/grant audit fields (`last_used_at`, revoke state) | Database / Storage | API / Backend | Durable operational state for audit and management |

## Project Constraints (from AGENTS.md)

- Direct-to-`main` workflow. [CITED: /Users/admin/dev/brain/AGENTS.md]  
- Keep one Edge Function for `mcp-server`; internal routing only. [CITED: /Users/admin/dev/brain/AGENTS.md]  
- MCP tool responses remain `content[].text` markdown. [CITED: /Users/admin/dev/brain/AGENTS.md]  
- `tools/list` filtered by `enabled_categories`. [CITED: /Users/admin/dev/brain/AGENTS.md]  
- MCP discovery and MCP endpoint CORS remain public/wildcard. [CITED: /Users/admin/dev/brain/AGENTS.md]  
- OAuth scopes are not CallVault tool permissions; CallVault must enforce categories. [CITED: /Users/admin/dev/brain/AGENTS.md] [CITED: https://supabase.com/docs/guides/auth/oauth-server/token-security]  
- OAuth default full non-admin access; manual tokens are v1 granular control. [CITED: /Users/admin/dev/brain/.planning/phases/03-per-workspace-mcp-endpoints-+-connect-to-ai/03-CONTEXT.md]  
- No positive UI copy using “AI-powered”. [CITED: /Users/admin/dev/brain/AGENTS.md]

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | `2.84.0` | OAuth consent APIs + DB access from frontend/services | Already integrated; required for current consent flow and token/grant CRUD. [VERIFIED: codebase grep] |
| Supabase OAuth 2.1 Server | Managed service | Auth server, DCR, OIDC discovery, JWT issuance with `client_id` claim | Official supported path for MCP OAuth with existing Supabase auth base. [CITED: https://supabase.com/docs/guides/auth/oauth-server] |
| MCP spec auth + discovery | 2025-03-26 spec snapshot | Defines OAuth flow, discovery behavior, status handling | Keeps interoperability with Claude/ChatGPT/Cursor-style MCP clients. [CITED: https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Cloudflare Worker proxy | Existing project infra | Stable public endpoint and path fanout to Supabase functions | Use for `/mcp/w/*`, `/.well-known/*`, `/mcp-register` routing continuity. [VERIFIED: codebase grep] |
| TanStack Query hooks + service layer | Existing project pattern | UI data fetching/mutations for connection manager | Use for OAuth-grant list/revoke and token management UI actions. [VERIFIED: codebase grep] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Path-based workspace URL | Subdomain-per-workspace MCP URLs | More DNS/cert ops; roadmap and requirements already lock path strategy. [VERIFIED: codebase grep] |
| CallVault grant categories | OAuth scopes for tool categories | Supabase custom scopes unavailable; scopes are OIDC-data-centric. [CITED: https://supabase.com/docs/guides/auth/oauth-server/oauth-flows] [CITED: https://supabase.com/docs/guides/auth/oauth-server/token-security] |

**Installation:** No new package is required for baseline Phase 03. [VERIFIED: codebase grep]

## Package Legitimacy Audit

No external package install recommended for Phase 03 baseline. Package legitimacy gate not applicable unless planner introduces new dependencies. [VERIFIED: codebase grep]

## Architecture Patterns

### System Architecture Diagram

`AI Client` -> `https://api.callvaultai.com/mcp/w/{workspace_uuid}` -> `Cloudflare Worker` -> `supabase/functions/mcp-server`  
`mcp-server` -> `authenticate bearer` -> `resolve manual token OR OAuth JWT(client_id)` -> `load CallVault grant` -> `enforce workspace + categories` -> `initialize/tools/list/tools/call`  
`OAuth discovery` path: `AI Client` -> `/.well-known/oauth-protected-resource/mcp/w/{workspace_uuid}` + auth server metadata -> OAuth authorize/token flow -> JWT -> MCP calls.  

### Recommended Project Structure

```text
supabase/functions/
├── mcp-server/                  # path parsing + auth + dispatch + category/workspace enforcement
├── mcp-oauth-metadata/          # workspace-aware protected-resource metadata
└── mcp-oauth-register/          # DCR proxy

src/
├── pages/OAuthConsentPage.tsx   # org/workspace selection during consent
├── components/settings/         # OAuth grants + manual token manager sections
└── services/                    # grant/token CRUD service layer + hook wrappers
```

### Pattern 1: Grant-Backed OAuth Authorization
**What:** Resolve OAuth JWT `client_id` to a persisted CallVault grant row; do not synthesize full-access authorization.  
**When to use:** Every authenticated MCP request with non-hex bearer token.  
**Example:** Current code shows JWT validation + legacy org-binding lookup to replace. [VERIFIED: codebase grep]

### Pattern 2: Dual Gate Enforcement
**What:** Filter visible tools in `tools/list` and block unauthorized execution in `tools/call`.  
**When to use:** Any category-scoped permission system.  
**Example:** Existing category gate already blocks `tools/call`; extend same policy to OAuth grant resolution and workspace path context. [VERIFIED: codebase grep]

### Anti-Patterns to Avoid
- **UI-only permission assumptions:** Client tool visibility is not an auth boundary. Enforce server-side every request. [CITED: https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization]
- **One-row-per-user OAuth binding:** Cannot represent multiple AI clients or per-client revoke/list. [VERIFIED: codebase grep]
- **Treating OAuth scopes as CallVault tool permissions:** Not supported by Supabase model. [CITED: https://supabase.com/docs/guides/auth/oauth-server/token-security]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth server + DCR stack | Custom OAuth server in Edge Function | Supabase OAuth Server + existing metadata/register proxies | Avoid protocol bugs and maintenance burden. [CITED: https://supabase.com/docs/guides/auth/oauth-server] |
| MCP auth spec interpretation | Ad-hoc auth contract | MCP auth/discovery standards | Interop with client ecosystems depends on spec compliance. [CITED: https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization] |

**Key insight:** Phase 03 complexity is mostly in authorization state modeling and enforcement consistency, not transport mechanics. [VERIFIED: codebase grep]

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `mcp_oauth_org_bindings` enforces `UNIQUE(user_id)` and loses per-client granularity. [VERIFIED: codebase grep] | Data migration to new grant table + backfill or reconnect path |
| Live service config | Supabase OAuth server + DCR toggles are dashboard-level prerequisites. [CITED: https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication] | Verify enabled in target project before rollout |
| OS-registered state | None found in repo-scoped phase research. [VERIFIED: codebase grep] | None |
| Secrets/env vars | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` required by auth/registration paths. [VERIFIED: codebase grep] | Ensure env continuity across deploy targets |
| Build artifacts | None specific to rename/migration in this phase. [VERIFIED: codebase grep] | None |

## Common Pitfalls

### Pitfall 1: 401/403 confusion on workspace mismatch
**What goes wrong:** Valid token used against wrong workspace endpoint returns 401.  
**Why it happens:** Conflating authentication failure with authorization failure.  
**How to avoid:** 401 only for invalid/expired token; use 403 for valid token with insufficient workspace/grant scope.  
**Warning signs:** Client re-auth loop despite valid login.

### Pitfall 2: Grant updates not reflected instantly in client UI
**What goes wrong:** Server permission changed but client still shows prior tool list.  
**Why it happens:** Client-side tool cache and refresh semantics vary by provider.  
**How to avoid:** Enforce on server immediately; show reconnect/refresh guidance in UI copy.  
**Warning signs:** “Tool still appears but call fails.”

### Pitfall 3: Provider one-click assumptions
**What goes wrong:** UI promises “Add to X” for providers without stable public deep-link contract.  
**Why it happens:** Mixing marketing claims with unverified install APIs.  
**How to avoid:** Capability-flag provider buttons from verified docs only.  
**Warning signs:** Broken outbound setup links or dead end flows.

## Code Examples

### Existing MCP auth split (manual token vs OAuth JWT)
```typescript
// Source: /Users/admin/dev/brain/supabase/functions/mcp-server/auth.ts
const isHexToken = /^[0-9a-f]{64}$/.test(rawToken);
if (isHexToken) { /* mcp_tokens lookup */ }
// else: Supabase Auth getUser(rawToken), then oauth binding lookup
```

### Existing worker route compatibility for workspace paths
```typescript
// Source: /Users/admin/dev/brain/cloudflare/api-proxy/worker.ts
if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
  const tail = url.pathname.slice(4);
  return `${SUPABASE_BASE}/functions/v1/mcp-server${tail}${url.search}`;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-user org binding (`mcp_oauth_org_bindings`) | Per-client grant model keyed by `client_id` (recommended) | Pending in Phase 03 | Enables list/revoke per AI client and scope-aware enforcement |
| Single resource metadata for `/mcp` | Workspace resource metadata at `/mcp/w/{uuid}` (required) | Pending in Phase 03 | Correct audience/resource binding for workspace URLs |

**Deprecated/outdated:**
- Treating OAuth as implicit full-access MCP token is insufficient for MCP-03. [VERIFIED: codebase grep]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Cursor one-click “Add to Cursor” link schema can be integrated directly from CallVault UI | Provider setup | Resolved as not baseline: do not ship one-click unless implementation-time docs prove a stable schema |
| A2 | Gemini end-user product supports remote custom MCP connector flow similar to Claude/ChatGPT | Provider setup | Resolved as not baseline: ship generic/manual guidance only |
| A3 | Manus supports stable custom remote MCP onboarding flow for arbitrary third-party MCP servers in all target plans | Provider setup | Resolved as not baseline: ship generic/manual guidance only |

## Open Questions (RESOLVED)

1. **What exact provider deep-link/install URLs are stable for production?**
   - What we know: Claude/ChatGPT/Cursor/Perplexity/Manus each document MCP in some form.
   - Resolution: Treat provider-specific one-click install/deep-link URLs as **not available for the Phase 03 baseline** unless the implementation task verifies an official, stable provider-specific contract in the current docs and adds a test for it. The baseline UX is OAuth-first setup initiated from CallVault plus guided setup/copyable snippets for Claude Desktop, Cursor, generic MCP clients, and conditional guidance for ChatGPT, Perplexity, Gemini, and Manus.
   - Planning consequence: `03-05-PLAN.md` must use a provider capability registry with `Copy setup` / `Open setup guide` defaults. It may expose `Connect with OAuth` where CallVault can start its own OAuth flow, but must not promise `Add to {Provider}` one-click install for providers without verified evidence.

2. **Can Supabase consent detail payload reliably expose all client metadata needed for CallVault grant row creation at approval time?**
   - What we know: Supabase supports `getAuthorizationDetails` and approve/deny APIs.
   - Resolution: Do **not** assume the consent detail payload always contains every desired client metadata field. Phase 03 should persist whatever client fields are present at consent time, create/reconcile the CallVault grant before `approveAuthorization`, and include a backend first-request reconciliation path that completes or refreshes `client_id`-keyed grant metadata from the verified OAuth JWT when needed.
   - Planning consequence: `03-01-PLAN.md` owns the backend fallback and grant schema; `03-03-PLAN.md` owns consent-side grant persistence through a frontend service/hook layer. Execution must test both approval-time grant creation and first-request JWT reconciliation.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `node` | Build/test scripts | ✓ | project runtime present [ASSUMED] | — |
| `npm` | Package scripts (`build`, `test`) | ✓ | project runtime present [ASSUMED] | — |
| Supabase project OAuth server enabled | OAuth setup path | ? | — | Manual token fallback |
| Cloudflare Worker routing | Public MCP vanity URL | ✓ | repo contains worker source [VERIFIED: codebase grep] | Direct Supabase function URL (not preferred UX) |

**Missing dependencies with no fallback:**
- None identified from repository evidence.

**Missing dependencies with fallback:**
- If OAuth server config is not enabled in Supabase project, manual tokens can still satisfy partial setup flows.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + Playwright [VERIFIED: codebase grep] |
| Config file | `vitest.config.ts`, `playwright.config.ts` [VERIFIED: codebase grep] |
| Quick run command | `npm run test -- supabase/functions/mcp-server/__tests__/category-gating.test.ts` |
| Full suite command | `npm run test:integration && npm run test:e2e` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MCP-01 | Workspace URL routing and 403 mismatch behavior | integration | `npm run test -- supabase/functions/mcp-server/__tests__/workspace-scope.integration.test.ts` | ❌ Wave 0 |
| MCP-02 | OAuth-first setup + snippet generation with workspace URL | unit/e2e | `npm run test -- src/pages/__tests__/OAuthConsentPage.workspace-scope.test.ts` | ❌ Wave 0 |
| MCP-03 | OAuth grant + manual token management list/revoke/rotate/category enforcement | integration/e2e | `npm run test -- src/components/settings/__tests__/McpConnectionsTab.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** targeted Vitest file(s) + `npm run build` when touching `mcp-server` or source registry.
- **Per wave merge:** `npm run test:integration`.
- **Phase gate:** full required MCP integration + UI e2e scenarios green before `$gsd-verify-work`.

### Wave 0 Gaps
- [ ] `supabase/functions/mcp-server/__tests__/workspace-scope.integration.test.ts`
- [ ] `supabase/functions/mcp-server/__tests__/oauth-client-grants.integration.test.ts`
- [ ] `src/pages/__tests__/OAuthConsentPage.workspace-scope.test.ts`
- [ ] `src/components/settings/__tests__/McpConnectionsTab.test.tsx`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Bearer validation + Supabase OAuth JWT verification |
| V3 Session Management | yes | OAuth grant revoke + token rotation handling |
| V4 Access Control | yes | Server-side category/workspace enforcement on list+call |
| V5 Input Validation | yes | Workspace UUID path validation + strict token format checks |
| V6 Cryptography | yes | OAuth/JWT + TLS endpoints; no custom crypto |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token replay across workspace URLs | Elevation of Privilege | Enforce path workspace audience binding and return 403 on mismatch |
| Overbroad OAuth grant usage | Information Disclosure | Persist per-client grant scope and categories; server-side gate every call |
| Tool enumeration leakage | Information Disclosure | Filter `tools/list` by categories/grant scope |
| Cross-origin discovery blocking breakage | Denial of Service | Keep public/wildcard CORS for MCP discovery endpoints |

## Sources

### Primary (HIGH confidence)
- https://supabase.com/docs/guides/auth/oauth-server  
- https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication  
- https://supabase.com/docs/guides/auth/oauth-server/oauth-flows  
- https://supabase.com/docs/guides/auth/oauth-server/token-security  
- https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization  
- https://www.ietf.org/rfc/rfc9728.html  
- https://www.rfc-editor.org/rfc/rfc8707  
- /Users/admin/dev/brain/supabase/functions/mcp-server/auth.ts  
- /Users/admin/dev/brain/supabase/functions/mcp-server/gating.ts  
- /Users/admin/dev/brain/supabase/functions/mcp-server/index.ts  
- /Users/admin/dev/brain/supabase/functions/mcp-oauth-metadata/index.ts  
- /Users/admin/dev/brain/supabase/functions/mcp-oauth-register/index.ts  
- /Users/admin/dev/brain/cloudflare/api-proxy/worker.ts  
- /Users/admin/dev/brain/src/pages/OAuthConsentPage.tsx  
- /Users/admin/dev/brain/src/components/settings/MCPTab.tsx  
- /Users/admin/dev/brain/src/services/mcp-tokens.service.ts  

### Secondary (MEDIUM confidence)
- https://platform.openai.com/docs/mcp/  
- https://platform.openai.com/docs/developer-mode  
- https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta  
- https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp  
- https://docs.perplexity.ai/docs/getting-started/integrations/mcp-server  
- https://manus.im/docs/integrations/mcp-connectors  
- https://ai.google.dev/gemini-api/docs/function-calling

### Tertiary (LOW confidence)
- Cursor docs pages were partially JS-rendered in this environment; setup details from indexed snippets may require direct manual verification at implementation time.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - existing project stack and Supabase/MCP standards are explicit.
- Architecture: MEDIUM - provider-specific one-click mechanics are still partly variable.
- Pitfalls: HIGH - derived from current code constraints + MCP OAuth standards.

**Research date:** 2026-05-28  
**Valid until:** 2026-06-04 (fast-moving provider UX/docs)
