---
slug: mcp-settings-connection-ux
status: fixing
created: 2026-07-04
updated: 2026-07-04
trigger: |
  DATA_START
  User reports the MCP connection process and Settings MCP area are confusing, inaccurate, and hard to use.
  First blocking issue: LGJ MCP appears authenticated in claude.ai, but Claude Code cannot connect:
    /mcp
      Failed to reconnect to callvault: Server rejected the configured Authorization header (HTTP 403).
      Check that the token is valid for this MCP endpoint — OAuth fallback is disabled when
      headers.Authorization is set.
  User also reports the Settings panel MCP area is incorrectly laid out, hides or obscures options, does not
  clearly show what is configured, has cached codes / messed-up org routing, lacks proper instructions, and
  likely needs a customer-centered rebuild for clarity and ease.
  DATA_END
---

# Debug: mcp-settings-connection-ux

## Symptoms

### Expected behavior
- A user should be able to connect an MCP client to a specific CallVault org/workspace without understanding
  OAuth internals, stale headers, token categories, or subdomain routing.
- Settings should clearly show each connection's actual endpoint, org/workspace scope, connection method
  (OAuth vs manual token), credential state, enabled tool categories, and next action.
- The default path should be simple and safe; advanced/manual configuration should be explicit, inspectable,
  and not mixed into the simple path.

### Actual behavior
- Claude Code fails against the LGJ endpoint with HTTP 403 because it has a configured Authorization header,
  so OAuth fallback is disabled even though claude.ai appears authenticated.
- Settings MCP UI is reported as badly laid out, inaccurate, hard to inspect, and missing clear instructions.
- User reports cached codes and incorrect org routing/connector display, making it unclear what is actually
  configured manually.

### Error messages
```text
/mcp
  Failed to reconnect to callvault: Server rejected the configured Authorization header (HTTP 403).
  Check that the token is valid for this MCP endpoint — OAuth fallback is disabled when headers.Authorization is set.
```

### Timeline
- Broader subdomain/OAuth MCP routing bugs were fixed in June 2026.
- On 2026-07-04, `leadgenjay.callvaultai.com/mcp` eventually connected in Claude after earlier registration
  errors, but Claude Code still fails with the Authorization-header 403.
- The Settings MCP confusion appears persistent and broad, not a single transient error.

### Reproduction
1. Configure Claude Code with the LGJ CallVault MCP endpoint.
2. Claude Code attempts reconnect to `/mcp`.
3. It sends a configured Authorization header.
4. Server rejects the header with 403; OAuth fallback does not run.
5. Open CallVault Settings MCP area and audit the displayed connection rows, setup instructions, visible
   endpoint/scope/method/credential/category state, and manual vs OAuth actions.

## Current Focus

- hypothesis: CONFIRMED for the immediate 403 — the server is healthy, but Claude Code is sending a configured
  Authorization header, so it never follows the OAuth challenge. The Settings UI contributes to this class of
  failure by treating manual-token setup and OAuth/subdomain setup as adjacent equal paths without a clear
  "do not use a bearer header for OAuth connectors" boundary.
- next_action: Ship the immediate Settings repair, then continue the planned rebuild into a unified connection
  inventory + guided setup wizard.
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- timestamp: 2026-07-04T02:37:03Z — Live endpoint without Authorization:
  `POST https://leadgenjay.callvaultai.com/mcp` returned `401 Authorization required` and a valid
  `WWW-Authenticate` challenge pointing at
  `https://leadgenjay.callvaultai.com/.well-known/oauth-protected-resource/mcp`. This is the correct OAuth
  discovery path for a client with no static bearer header.

- timestamp: 2026-07-04T02:37:04Z — Live endpoint with an intentionally invalid static bearer:
  `POST https://leadgenjay.callvaultai.com/mcp` with `Authorization: Bearer <invalid>` returned
  `401 Invalid token`. This reproduces the same class as Claude Code's message: any configured
  Authorization header bypasses OAuth fallback.

- timestamp: 2026-07-04T02:37:03Z — Live protected-resource metadata for LGJ:
  `GET https://leadgenjay.callvaultai.com/.well-known/oauth-protected-resource/mcp` returned `200` with
  `resource: "https://leadgenjay.callvaultai.com/mcp"` and
  `authorization_servers: ["https://leadgenjay.callvaultai.com"]`. Discovery is not currently broken.

- timestamp: 2026-07-04 — Claude Code CLI state:
  `claude mcp list` shows `claude.ai CV Freedom: https://freedomexperience-inbox.callvaultai.com/mcp -
  Needs authentication`. It does not show a visible LGJ local JSON config in the inspected global/project
  files. `claude mcp get "claude.ai CV Freedom"` reports scope `claude.ai config` and suggests removal via
  `claude mcp remove "claude.ai CV Freedom" -s claudeai`. Do not remove without operator approval.

- timestamp: 2026-07-04 — Local config inspection:
  `.mcp.json` only contains `gsd-browser`. `~/.claude/settings.json` only lists qmd/screenpipe/loopnet/reonomy
  local MCP servers. `~/.claude/mcp.json` has a static Authorization header for an unrelated server, but no
  visible CallVault server. Therefore the active CallVault managed connector state is not represented in the
  plain project `.mcp.json` surface.

- timestamp: 2026-07-04 — Interceptor attempt:
  `interceptor open https://app.callvaultai.com/settings/mcp --full` timed out twice with
  "no response for tab_create"; Chrome/Brave did not respond to the Interceptor extension. Real-browser visual
  audit is still required before shipping UI changes.

- timestamp: 2026-07-04 — Source audit, immediate footgun:
  `src/components/settings/MCPTab.tsx` builds Claude Code manual-token setup as
  `claude mcp add --transport http callvault {url} --header "Authorization: Bearer {token}"` (lines 112-116).
  This is correct only for manual-token connectors, but it creates the exact failure mode when reused against
  an OAuth/subdomain connector: the Authorization header disables OAuth fallback.

- timestamp: 2026-07-04 — Source audit, mixed mental model:
  `MCPTab.tsx` renders "AI connectors" and "Manual tokens" as two large sections with separate rows, separate
  actions, and setup snippets. OAuth rows show URL/category state but no client ID, no re-auth/test action, and
  no "remove stale client-side config" recovery. Manual rows show token preview, copy token, copy URL, setup
  JSON, permissions, regenerate, and delete inline, causing dense controls and multiple copy targets.

- timestamp: 2026-07-04 — Source audit, misleading endpoint copy:
  `McpSetupSnippets.tsx` labels `https://mcp.callvaultai.com` as "Simple endpoint — works for everyone", while
  prior production bugs and current multi-org behavior show simple endpoint can require disambiguation and is
  not the right default for users managing multiple org/workspace connectors.

- timestamp: 2026-07-04 — Source audit, incomplete workspace endpoint discovery:
  `MCPTab.tsx` infers exactly one `snippetWorkspaceId` from the first workspace OAuth grant or manual token,
  then renders at most one workspace endpoint snippet. Users cannot see all available workspace endpoints for
  the active org, which makes manual configuration and org/workspace routing opaque.

- timestamp: 2026-07-04 — Source audit, backend behavior:
  `supabase/functions/mcp-server/auth.ts` first branches on `Authorization`. Missing header returns the OAuth
  challenge; manual-looking tokens are checked against `mcp_tokens`; JWT-looking tokens go through Supabase
  OAuth grant selection. A stale manual token against the wrong subdomain can fail with audience mismatch or
  token errors before any OAuth recovery path.

- timestamp: 2026-07-04 — Immediate repair applied:
  `MCPTab.tsx` now shows a Claude Code auth-header warning with recovery commands, labels manual bearer-token
  setup as advanced/manual, and adds an OAuth-only "Copy Claude Code setup" action that copies the endpoint
  command without `--header` or `Authorization`.

- timestamp: 2026-07-04 — Duplicate connector display repair:
  `mcp-oauth-grants.service.ts` now collapses duplicate visible OAuth grant rows by client name + endpoint URL,
  preserving the newest row from the existing `created_at desc` query order. This hides duplicate LGJ rows
  even when stale grants have different raw OAuth `client_id` values.

- timestamp: 2026-07-04 — Browser visual verification with GSD Browser:
  Local authenticated page `http://127.0.0.1:3001/settings/mcp` showed exactly one
  `https://leadgenjay.callvaultai.com/mcp` row, displayed the Claude Code auth-header warning, and exposed
  "Copy Claude Code setup" on OAuth rows. Screenshots:
  `.planning/debug/artifacts/mcp-settings-local-deduped-2026-07-04.png` and
  `.planning/debug/artifacts/mcp-settings-local-mobile-2026-07-04.png`.

- timestamp: 2026-07-04 — Test/build verification:
  `npm test -- --run src/components/settings/__tests__/McpConnectionsTab.test.tsx src/components/settings/__tests__/McpSetupSnippets.test.tsx src/components/settings/__tests__/MCPTab.permissions.test.tsx src/services/__tests__/mcp-oauth-grants.service.test.ts src/services/__tests__/mcp-tokens-url-builder.test.ts`
  passed 39 tests. `npm run build` completed successfully.

## Eliminated

- "LGJ discovery is currently down" — ELIMINATED. Live `/mcp` challenge and protected-resource metadata both
  respond correctly.
- "The visible repo `.mcp.json` is the source of the CallVault Authorization header" — ELIMINATED for this
  checkout. The visible `.mcp.json` only contains `gsd-browser`.
- "This is just a wording problem" — ELIMINATED. The page exposes conflicting setup models and generates a
  static-header command that can directly cause the reported Claude Code failure when mixed with OAuth.

## Resolution

status: partial_fix_applied

root_cause: |
  There are two layers:

  1. Immediate connection failure: Claude Code is using a configured Authorization header for a CallVault MCP
     endpoint that should be allowed to OAuth-challenge. Once that header exists, OAuth fallback is disabled
     client-side. The server then treats the request as a bearer-token/JWT request and rejects it when the
     token is invalid, stale, revoked, or scoped to a different org/workspace.

  2. Product/UX root cause: Settings does not present MCP as one coherent connection system. It splits OAuth
     grants, manual tokens, setup snippets, endpoints, token permissions, token reveal, docs, and destructive
     actions across a dense page. It does not clearly answer: "What is connected?", "What exact org/workspace
     does it access?", "Is this OAuth or manual bearer-token auth?", "Which URL should I use?", "Should this
     client have an Authorization header?", "How do I fix a stale Claude Code connector?", or "What tools can
     this connector use?"

repair_plan: |
  PLAN 1 — Immediate Claude Code recovery path
  - Add a visible "Claude Code is sending a bearer header" troubleshooting panel in Settings MCP.
  - For OAuth/subdomain connectors, show a no-header install/reconnect path and explicitly warn: do not add an
    Authorization header when connecting with OAuth.
  - Provide safe recovery commands for managed Claude Code entries:
      `claude mcp list`
      `claude mcp get "<name>"`
      `claude mcp remove "<name>" -s claudeai`
    The UI should explain when to remove/re-add versus when to paste a manual token.
  - Add a live "Test endpoint" action per row that checks discovery and token/audience status and reports:
    no auth challenge OK, invalid token, revoked token, org mismatch, workspace mismatch, missing grant, or
    multi-org ambiguity.

  PLAN 2 — Replace page structure with a single connection inventory
  - Replace separate "AI connectors" and "Manual tokens" sections with one table/list:
      Name | Client | Method (OAuth/Manual) | Scope (Org/Workspace) | Endpoint | Tool access | Last used | Status | Actions
  - Show org name + workspace name + slug-derived URL in the same row.
  - Make "Copy endpoint" different from "Copy manual-token config"; never colocate token copying with OAuth
    connection rows.
  - Expose client_id for OAuth rows in an advanced details drawer, not as the primary label.
  - Move token/category controls into a row details drawer so the top-level page stays scannable.

  PLAN 3 — Guided setup wizard, not scattered snippets
  - Primary CTA: "Connect an AI client".
  - Step 1: choose client (Claude web, Claude Code, Cursor, VS Code, Other).
  - Step 2: choose scope (active org or one workspace) from explicit org/workspace names.
  - Step 3: choose method:
      OAuth recommended where supported: copy/open only the endpoint URL; no Authorization header.
      Manual token advanced: create/select token; copy config with Authorization header.
  - Step 4: show client-specific instructions and a test checklist.
  - Remove the passive `McpSetupSnippets` card or replace it with an "All endpoints" drawer listing every
    org/workspace endpoint for the active org.

  PLAN 4 — Data/model cleanup
  - Create a view-model service that returns unified `McpConnectionView[]` from OAuth grants + manual tokens,
    with explicit fields for `method`, `requiresAuthorizationHeader`, `endpointUrl`, `scopeLabel`,
    `orgName`, `workspaceName`, `clientId`, `categories`, `lastUsedAt`, and `status`.
  - Stop inferring one workspace snippet from the first grant/token; fetch all active org workspaces for
    endpoint selection.
  - Update copy/build helpers so Claude Code OAuth setup never includes `--header`, and Claude Code manual
    setup always labels itself as advanced/manual bearer-token setup.

  PLAN 5 — Tests and verification
  - Add unit tests for setup command generation:
      OAuth Claude Code path contains no `--header`.
      Manual Claude Code path contains `--header "Authorization: Bearer ..."` and labels it manual.
      Simple endpoint is not labeled "works for everyone" for multi-org users.
  - Replace current MCPTab layout assertions with the new inventory/wizard contract.
  - Add service tests for unified connection view models.
  - Run existing MCP settings tests, targeted service tests, `tsc -p tsconfig.app.json`, and `npm run build`.
  - Before shipping, complete browser visual audit with Interceptor/Playwright across desktop and mobile,
    including the exact stale-header troubleshooting copy.

verification_gap:
  - Interceptor was unavailable in this session; GSD Browser was used for authenticated local desktop and
    mobile visual verification instead.
  - The immediate UI/service repair is verified locally but has not been committed, pushed, or production
    smoke-tested in this session.
  - The broader product rebuild in the repair plan remains open: unified inventory, guided setup wizard,
    row-level test connection, and durable DB cleanup for old duplicate OAuth grants.
