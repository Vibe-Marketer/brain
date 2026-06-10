---
status: resolved
trigger: "token prefix chaos (cv_obs/cv_api/cv_org/cv_mcp) and MCP Connect an AI page showing raw JSON error instead of a setup guide"
created: 2026-06-10
updated: 2026-06-10
---

## Symptoms

expected: One clear token prefix per integration type; MCP "Connect an AI" button in settings opens a setup guide
actual: Multiple inconsistent prefixes in the wild — cv_obs_, cv_api_, cv_org_, cv_mcp_, cv_apoi — shown inconsistently across settings UI; clicking "Connect an AI" navigates to https://mcp.callvaultai.com/ which shows raw JSON: {"jsonrpc":"2.0","id":null,"error":{"code":-32001,"message":"Authorization required"}}
error_messages: |
  mcp.callvaultai.com raw response: {"jsonrpc":"2.0","id":null,"error":{"code":-32001,"message":"Authorization required"}}
  MCP configured setup copy shows cv_org_ token prefix
  Claude Code install command in settings shows cv_api_smoke_ prefix for MCP
  Settings shows cv_obs_, cv_api_, cv_mcp_, cv_org_ in various places
timeline: "Observed after Phase 06.2 (REST API). cv_obs_ tokens pre-date Phase 06.2. cv_api_ tokens introduced by Phase 06.2 migration. cv_org_ appears in MCP settings copy."
reproduction: |
  1. Open Settings → Integrations → AI Connectors / MCP tab
  2. Click "Connect an AI" button — lands on raw JSON page
  3. Observe token prefix inconsistency across ApiTokensSection, MCPTab, and install command copy

## Current Focus

hypothesis: "Multiple token generation RPCs with different prefixes exist side-by-side (generate_api_token=cv_api_, generate_mcp_token=cv_org_ or cv_mcp_, old generate_obsidian_token=cv_obs_) and the settings UI copy was not updated to use a unified prefix; the MCP button links directly to the protocol endpoint instead of a setup/docs page"
next_action: "RESOLVED"

## Evidence

- timestamp: 2026-06-10
  finding: "MCPTab.tsx line 694 — Connect AI client button calls window.open(getMcpUrl(), '_blank') which opens https://mcp.callvaultai.com — the raw JSON-RPC MCP protocol endpoint. GET request with no auth header hits unauthorizedResponse() which returns the exact JSON error seen."
  files: ["src/components/settings/MCPTab.tsx:694"]

- timestamp: 2026-06-10
  finding: "Token prefixes are intentional and correct — each source type has a distinct prefix for server-side discrimination: cv_org_/cv_ws_ for MCP tokens (migration 20260528163000), cv_obs_ for Obsidian sync tokens (migration 20260608120000), cv_api_ for REST API tokens (migration 20260609120000). auth.ts correctly only accepts cv_org_ and cv_ws_ for MCP server auth."
  files: ["supabase/migrations/20260528163000_mcp_oauth_client_grants_and_prefixed_tokens.sql", "supabase/migrations/20260608120000_obsidian_sync_token_label.sql", "supabase/migrations/20260609120000_api_token_generator.sql", "supabase/functions/mcp-server/auth.ts:37-40"]

- timestamp: 2026-06-10
  finding: "cv_mcp_ prefix does not exist in any current migration — was eliminated before shipping. cv_api_smoke_ in install command copy is a stale test fixture token name, not a prefix issue. No hardcoded stale prefix strings exist in current frontend source."
  files: ["src/components/settings/MCPTab.tsx", "src/services/mcp-tokens.service.ts"]

## Eliminated

- Token prefix logic in DB is broken: ELIMINATED — prefixes are correct and intentional per token_source discriminator
- auth.ts missing prefix checks: ELIMINATED — cv_org_/cv_ws_ are the only valid MCP token prefixes, correctly coded

## Resolution

root_cause: "MCPTab.tsx 'Connect AI client' button called window.open(getMcpUrl(), '_blank') opening the raw MCP JSON-RPC protocol endpoint (https://mcp.callvaultai.com) which returns {\"jsonrpc\":\"2.0\",\"id\":null,\"error\":{\"code\":-32001,\"message\":\"Authorization required\"}} for unauthenticated browser GET requests. Token prefix inconsistency was not a code bug — each token type (MCP, Obsidian, API) correctly has its own prefix (cv_org_/cv_ws_, cv_obs_, cv_api_) enforced server-side by token_source discriminator."

fix: "Changed button onClick in MCPTab.tsx to open 'https://docs.callvaultai.com/mcp' instead of getMcpUrl(). Removed now-unused getMcpUrl import from MCPTab.tsx."

verification: "All 8 MCP tab tests pass (McpConnectionsTab.test.tsx + McpSetupSnippets.test.tsx). getMcpUrl no longer imported in MCPTab — TypeScript would error if used elsewhere in that file."

files_changed:
  - src/components/settings/MCPTab.tsx
