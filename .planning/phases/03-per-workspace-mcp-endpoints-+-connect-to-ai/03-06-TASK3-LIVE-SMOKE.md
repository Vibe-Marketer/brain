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
