# MCP Connectors Architecture

**Last updated:** 2026-05-28
**Status:** Production (Phase 03)

## Public endpoints

Use only the public API domain:

- Organization endpoint: `https://api.callvaultai.com/mcp`
- Workspace endpoint: `https://api.callvaultai.com/mcp/w/{workspace_uuid}`
- Organization protected-resource metadata:
  `https://api.callvaultai.com/.well-known/oauth-protected-resource`
- Workspace protected-resource metadata:
  `https://api.callvaultai.com/.well-known/oauth-protected-resource/mcp/w/{workspace_uuid}`

Do not use raw Supabase function URLs in user-facing setup docs or snippets.

## Connection model

CallVault supports two MCP connection types:

1. OAuth-connected AI clients (primary path)
2. Manual scoped tokens (fallback path)

Both can coexist for the same organization/workspace. Revocation is per
connection.

## OAuth-first setup

OAuth is the default setup path in Settings > AI connectors.

- Default scope: organization, non-admin categories.
- Optional scope: single workspace (selected during consent/setup flow).
- Server enforces scope/categories on every request.
- Permission changes are enforced immediately server-side; some clients may need
  refresh or reconnect to update visible tool lists.

## Manual token fallback

Use manual tokens when:

- a provider does not support direct OAuth flow from CallVault
- category-scoped control is required for a specific connection

Manual token snippets use the same public endpoints:

- Organization token snippet -> `https://api.callvaultai.com/mcp`
- Workspace token snippet -> `https://api.callvaultai.com/mcp/w/{workspace_uuid}`

## Provider capability caveats

Provider setup actions must match proven capability:

- Show OAuth-connect actions only where CallVault can initiate and complete that
  provider setup path.
- Otherwise show setup guide/copy configuration actions.
- Never imply one-click installation in a provider that has no verified support
  path.

## Authorization behavior reference

- `401 Unauthorized`: invalid/expired bearer token or missing authentication
  (`WWW-Authenticate` header present).
- `403 Forbidden`: valid credential, but scope mismatch (for example using
  workspace A credential against workspace B endpoint) or revoked access.

## Security and contract notes

- MCP result payload contract remains `content[].text` markdown for tool output.
- Tool visibility/execution remains category-gated server-side.
- Protected-resource metadata must match endpoint scope (org vs workspace).
