# MCP Connection + Settings Rebuild Plan

**Debug session:** `.planning/debug/mcp-settings-connection-ux.md`  
**Status:** immediate repair implemented; full rebuild still planned  
**Created:** 2026-07-04

## Goal

Make MCP setup understandable and hard to misconfigure:

- Users can connect Claude/Claude Code/Cursor/etc. to the right org or workspace without learning OAuth internals.
- Settings clearly shows what is connected, how it authenticates, what it can access, and how to fix it.
- OAuth/subdomain setup and manual bearer-token setup are distinct paths, not mixed controls.
- Stale Authorization-header failures are diagnosed and recoverable from the product surface.

## Confirmed Immediate Bug

Claude Code can fail with:

```text
Server rejected the configured Authorization header (HTTP 403).
OAuth fallback is disabled when headers.Authorization is set.
```

Live proof: `leadgenjay.callvaultai.com/mcp` correctly returns an OAuth challenge when no Authorization header is sent. A static bearer header bypasses that OAuth path and is rejected if the token is stale, wrong, revoked, or scoped to another org/workspace.

## Immediate Repair Applied

1. OAuth rows now include a Claude Code setup copy action that uses only the endpoint URL:
   `claude mcp add --transport http callvault <endpoint>`.
2. OAuth rows explicitly warn not to configure an Authorization header.
3. Manual token setup is labeled as advanced/manual bearer-token setup, and manual copy buttons say "manual".
4. The page includes a Claude Code recovery panel with list/get/remove commands for stale managed connectors.
5. Duplicate OAuth grant rows with the same visible client and endpoint are collapsed in the display service.
6. The simple endpoint copy now says "single-org fallback", not "works for everyone".

Verified 2026-07-04:

- Targeted MCP tests passed: 39 tests across MCPTab, setup snippets, OAuth grants, and URL builders.
- `npm run build` passed.
- GSD Browser local visual check passed on desktop/mobile; LGJ endpoint appears once and the no-header guidance is visible.

## Product Failures To Fix

1. `MCPTab.tsx` mixes OAuth grants, manual tokens, endpoint snippets, token reveal, category controls, and docs links in one dense page.
2. The Claude Code manual-token command includes `--header "Authorization: Bearer ..."` with no strong separation from OAuth connector setup.
3. OAuth rows do not expose enough diagnostic state: client ID, exact method, re-auth/test status, stale-client recovery.
4. Manual rows expose too many destructive/copy actions inline and are difficult to scan.
5. `McpSetupSnippets.tsx` says the simple endpoint "works for everyone" even though multi-org users can need org/workspace subdomains.
6. The snippets show at most one inferred workspace endpoint instead of explicit endpoints for the active org/workspaces.
7. The "Connect AI client" action opens docs, not a guided in-product connection flow.

## Target UX

### Top-Level Page

Replace the two-section layout with one connection inventory:

| Column | Meaning |
| --- | --- |
| Name | User-facing client/token name |
| Client | Claude, Claude Code, Cursor, Generic |
| Method | OAuth or Manual token |
| Scope | Organization or specific workspace |
| Endpoint | Exact URL this connection should use |
| Access | Read / Write / AI / Admin |
| Status | Last used, needs auth, token issue, scope issue |
| Actions | Test, copy endpoint, details, revoke/delete |

### Primary Flow

Primary CTA: **Connect AI client**

Wizard steps:

1. Choose client: Claude, Claude Code, Cursor, VS Code, Other.
2. Choose scope: active organization or one workspace.
3. Choose method:
   - OAuth, recommended: copy/open endpoint only. No Authorization header.
   - Manual token, advanced: create/select token and copy config with Authorization header.
4. Show client-specific instructions and "Test connection".

### Details Drawer

Each connection row gets details instead of inline clutter:

- endpoint URL
- resource URL
- org and workspace names
- slugs
- client ID for OAuth
- token preview for manual
- enabled categories
- last used
- troubleshooting state

### Troubleshooting

Add a Claude Code recovery panel:

```bash
claude mcp list
claude mcp get "<name>"
claude mcp remove "<name>" -s claudeai
```

Explain:

- OAuth connector URLs should not have an Authorization header.
- Manual tokens require an Authorization header.
- If Claude Code says OAuth fallback is disabled, remove the stale header/manual connector and reconnect cleanly.

## Implementation Plan

### Task 1 — View Model Service

Create a unified service model, probably in `src/services/mcp-connections.service.ts`.

Inputs:

- OAuth grants from `mcp_oauth_client_grants`
- Manual tokens from `mcp_tokens`
- organizations and workspaces for names/slugs

Output:

```ts
type McpConnectionView = {
  id: string
  displayName: string
  method: 'oauth' | 'manual'
  clientName: string
  clientId?: string
  scope: 'organization' | 'workspace'
  orgId: string | null
  orgName: string
  orgSlug: string | null
  workspaceId: string | null
  workspaceName: string | null
  workspaceSlug: string | null
  endpointUrl: string
  requiresAuthorizationHeader: boolean
  categories: ToolCategory[]
  lastUsedAt: string | null
  createdAt: string
  status: 'ready' | 'needs_auth' | 'not_used' | 'revoked' | 'unknown'
}
```

### Task 2 — Setup Command Builders

Split setup builders by method:

- OAuth Claude Code: endpoint only, no `--header`.
- Manual Claude Code: endpoint plus `--header "Authorization: Bearer ..."` and advanced/manual label.
- Cursor/VS Code/generic follow the same method separation.

Add tests proving OAuth never emits a bearer header.

### Task 3 — Replace `McpSetupSnippets`

Delete or demote passive snippets. Replace with:

- "All endpoints" drawer for active org/workspaces.
- Clear labels:
  - Organization endpoint
  - Workspace endpoint
  - Legacy/simple endpoint, only if needed, with warning for multi-org users

### Task 4 — Rebuild `MCPTab`

Break the oversized tab into focused components:

- `McpConnectionsInventory`
- `McpConnectionRow`
- `McpConnectionDetailsDrawer`
- `McpConnectWizard`
- `McpTroubleshootingPanel`
- `McpEndpointList`

Keep services pure and hooks as TanStack wrappers.

### Task 5 — Test + Verify

Targeted tests:

- OAuth Claude Code setup does not include `Authorization`.
- Manual Claude Code setup does include `Authorization`.
- Inventory renders OAuth and manual rows in one list.
- Row details expose endpoint, scope, method, categories, and client ID/token preview appropriately.
- Multi-org copy does not say "works for everyone".
- Workspace endpoints list all active org workspaces, not just first inferred grant/token.

Verification:

- `npm test -- src/components/settings/__tests__/McpConnectionsTab.test.tsx src/components/settings/__tests__/McpSetupSnippets.test.tsx src/components/settings/__tests__/MCPTab.permissions.test.tsx src/services/__tests__/mcp-oauth-grants.service.test.ts src/services/__tests__/mcp-tokens-url-builder.test.ts`
- `npx tsc -p tsconfig.app.json`
- `npm run build`
- Browser visual audit desktop + mobile. Interceptor failed to attach in the planning pass, so retry Interceptor or use Playwright.

## Immediate Operator-Safe Recovery

Do not remove any managed Claude connector automatically. To inspect:

```bash
claude mcp list
claude mcp get "claude.ai CV Freedom"
```

If the stale connector is confirmed and the operator approves removal:

```bash
claude mcp remove "claude.ai CV Freedom" -s claudeai
```

Then reconnect using the correct subdomain endpoint with no manual Authorization header for OAuth.
