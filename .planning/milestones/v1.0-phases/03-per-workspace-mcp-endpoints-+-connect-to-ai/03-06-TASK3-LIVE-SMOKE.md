# 03-06 Task 3 Deploy and Production Smoke
Date: 2026-05-28T16:18:51Z

## Deploy
- mcp-oauth-metadata: deployed
- mcp-server: deployed

## Smoke checks against https://api.callvaultai.com

### Invalid bearer (expected 401 + WWW-Authenticate)
1:HTTP/2 401 
12:www-authenticate: Bearer realm="callvault", resource_metadata="https://api.callvaultai.com/.well-known/oauth-protected-resource/mcp"
15:access-control-expose-headers: WWW-Authenticate

### Workspace protected-resource metadata path check
1:HTTP/2 200 
29:  "resource": "https://api.callvaultai.com/mcp",

## Missing inputs for remaining required live proofs
- WORKSPACE_UUID: missing in local env
- CALLVAULT_MCP_TOKEN: missing in local env
- MISMATCH_WORKSPACE_UUID: missing in local env

## Result
- PARTIAL: invalid-bearer 401 proof captured.
- GAP: cannot run valid initialize/tools/list and wrong-workspace 403 without workspace/test token vars.
- GAP: workspace protected-resource metadata currently responds with resource=https://api.callvaultai.com/mcp for /mcp/w/{workspace_uuid}; this does not prove workspace-specific resource advertisement.

## Follow-up Credential-Backed Smoke
Date: 2026-05-29

### Temporary credential setup
- Created a temporary production workspace-scoped manual MCP token for workspace `4cf3bf4f-215c-4db8-ad35-ad3e9a978f19`.
- Token was not recorded in this artifact.
- Revoked the temporary token immediately after smoke testing; database update returned `revoked=true`.

### Valid workspace-scoped initialize
- URL: `https://api.callvaultai.com/mcp/w/4cf3bf4f-215c-4db8-ad35-ad3e9a978f19`
- Method: JSON-RPC `initialize`
- Result: HTTP 200
- `protocolVersion`: `2025-03-26`
- `serverInfo.name`: `callvault`

### Valid workspace-scoped tools/list
- URL: `https://api.callvaultai.com/mcp/w/4cf3bf4f-215c-4db8-ad35-ad3e9a978f19`
- Method: JSON-RPC `tools/list`
- Result: HTTP 200
- Tool count: 17
- Tools with `inputSchema` present and `outputSchema` absent: 17/17

### Wrong-workspace audience binding
- URL: `https://api.callvaultai.com/mcp/w/6184a8bd-396f-4fa4-8332-4e12b2f5870e`
- Method: JSON-RPC `tools/list`
- Credential: valid token scoped to workspace `4cf3bf4f-215c-4db8-ad35-ad3e9a978f19`
- Result: HTTP 403
- JSON-RPC error code: `-32001`
- Error message confirmed workspace-audience mismatch.

### Workspace protected-resource metadata isolation
- Direct Supabase function probe with `resource_path=/mcp/w/4cf3bf4f-215c-4db8-ad35-ad3e9a978f19` returns the correct resource:
  `https://api.callvaultai.com/mcp/w/4cf3bf4f-215c-4db8-ad35-ad3e9a978f19`
- Vanity route probe still returns org-wide resource:
  `https://api.callvaultai.com/mcp`
- Root cause isolated to stale Cloudflare Worker deployment/routing, not the Supabase metadata function.
- Attempted `npx wrangler deploy` after sourcing local `.env`; deployment failed with Cloudflare API authentication error `10000` because the stored token lacks worker-service deploy permission.

### Cloudflare Worker deploy and final vanity metadata proof
Date: 2026-05-29

- Authenticated Wrangler through OAuth with `npx wrangler login`.
- Deployed `cloudflare/api-proxy` with `npx wrangler deploy`.
- Deployment succeeded for Worker `callvault-api-proxy`.
- Cloudflare Worker version: `d13eaafb-9b8e-4cd2-bebb-9baf6aa1d412`.
- Custom domains deployed:
  - `api.callvaultai.com`
  - `mcp.callvaultai.com`
- Final `api.callvaultai.com` workspace metadata probe:
  - URL: `https://api.callvaultai.com/.well-known/oauth-protected-resource/mcp/w/4cf3bf4f-215c-4db8-ad35-ad3e9a978f19`
  - `resource`: `https://api.callvaultai.com/mcp/w/4cf3bf4f-215c-4db8-ad35-ad3e9a978f19`
  - `authorization_servers`: `["https://api.callvaultai.com"]`
- Final `mcp.callvaultai.com` workspace metadata probe:
  - URL: `https://mcp.callvaultai.com/.well-known/oauth-protected-resource/mcp/w/4cf3bf4f-215c-4db8-ad35-ad3e9a978f19`
  - `resource`: `https://mcp.callvaultai.com/mcp/w/4cf3bf4f-215c-4db8-ad35-ad3e9a978f19`
  - `authorization_servers`: `["https://mcp.callvaultai.com"]`
- Invalid bearer probe against `https://api.callvaultai.com/mcp/w/4cf3bf4f-215c-4db8-ad35-ad3e9a978f19` returned HTTP 401 with:
  `WWW-Authenticate: Bearer realm="callvault", resource_metadata="https://api.callvaultai.com/.well-known/oauth-protected-resource/mcp/w/4cf3bf4f-215c-4db8-ad35-ad3e9a978f19"`

### Follow-up verification command

```bash
npm test -- --run supabase/functions/mcp-oauth-metadata/__tests__/workspace-resource.test.ts supabase/functions/mcp-server/__tests__/workspace-scope.integration.test.ts
```

Result:
- PASS: `supabase/functions/mcp-oauth-metadata/__tests__/workspace-resource.test.ts` (3 tests).
- NOTE: the integration test file did not execute in this command under the current Vitest selection/environment; the credential-backed production curl above is the live workspace-scope proof for this follow-up.

## Follow-up Result
- PASS: valid workspace-scoped token works against its `/mcp/w/{workspace_uuid}` URL.
- PASS: valid workspace-scoped token returns 403 against a different workspace URL.
- PASS: temporary production token was revoked after testing.
- PASS: Cloudflare Worker deployed and vanity workspace protected-resource metadata now advertises the exact workspace resource on both `api.callvaultai.com` and `mcp.callvaultai.com`.
