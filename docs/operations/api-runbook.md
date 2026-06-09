# CallVault REST API Runbook

**Last updated:** 2026-06-09
**Owner:** Andrew Naegele (naegele412@gmail.com)
**Status:** Production

---

## Overview

The CallVault REST API is a read-only HTTP API for programmatic access to calls, contacts, speakers, and workspace data. It is **separate from the MCP server** — see [MCP Runbook](./mcp-runbook.md) for the Model Context Protocol integration.

| Item | Value |
|------|-------|
| Base URL | `https://api.callvaultai.com/v1` |
| Auth scheme | `Authorization: Bearer <api_token>` |
| Token source | `token_source = 'api'` (created in Settings → Integrations) |
| Response envelope | `{ "data": [...], "pagination": { ... } }` |
| Error envelope | `{ "error": { "code": "...", "message": "..." } }` |

---

## Authentication

All requests require an `Authorization: Bearer <token>` header. Tokens are created through the CallVault UI at **Settings → Integrations → API Tokens**.

- Tokens with `token_source = 'api'` are accepted.
- MCP tokens (`token_source = 'mcp'`) return **HTTP 403**.
- Missing or malformed tokens return **HTTP 401**.
- Revoked tokens return **HTTP 401**.

### Generate a temporary smoke token

Create a token in the UI, use it for smoke testing, then revoke it immediately:

```bash
# Set as an env var — never paste into docs or scripts
export CALLVAULT_API_TOKEN="<token from Settings UI>"
```

### Revoke a token

Delete the token via the UI (Settings → Integrations → API Tokens → trash icon) or via the Supabase dashboard:

```sql
DELETE FROM api_tokens WHERE token_prefix = '<first 8 chars of token>';
```

---

## Endpoints

### GET /v1/workspaces

List workspaces visible to the authenticated token.

```bash
curl -fsS https://api.callvaultai.com/v1/workspaces \
  -H "Authorization: Bearer $CALLVAULT_API_TOKEN"
```

Expected HTTP 200 response shape:

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "My Workspace",
      "created_at": "2026-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "per_page": 50,
    "has_more": false
  }
}
```

---

### GET /v1/calls

List calls scoped to the token's workspace or organization.

```bash
curl -fsS "https://api.callvaultai.com/v1/calls?limit=10&page=1" \
  -H "Authorization: Bearer $CALLVAULT_API_TOKEN"
```

Query parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `workspace_id` | UUID | token scope | Filter to a specific workspace |
| `limit` | integer | 50 | Results per page (max 100) |
| `page` | integer | 1 | Page number |

Expected HTTP 200 response shape:

```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Call title",
      "source_date": "2026-01-01",
      "created_at": "2026-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "total": 42,
    "page": 1,
    "per_page": 10,
    "has_more": true
  }
}
```

---

### GET /v1/calls/{id}

Get a single call with transcript and participants.

```bash
curl -fsS "https://api.callvaultai.com/v1/calls/<recording-id>" \
  -H "Authorization: Bearer $CALLVAULT_API_TOKEN"
```

Expected HTTP 200 response shape:

```json
{
  "data": {
    "id": "uuid",
    "title": "Call title",
    "transcript": "Speaker 1: Hello...",
    "participants": ["Speaker 1", "Speaker 2"],
    "source_date": "2026-01-01",
    "created_at": "2026-01-01T00:00:00Z"
  }
}
```

---

### GET /v1/contacts

List contacts scoped to the authenticated user.

```bash
curl -fsS https://api.callvaultai.com/v1/contacts \
  -H "Authorization: Bearer $CALLVAULT_API_TOKEN"
```

Expected HTTP 200 response shape:

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Jane Smith",
      "email": "jane@example.com"
    }
  ],
  "pagination": {
    "total": 10,
    "page": 1,
    "per_page": 50,
    "has_more": false
  }
}
```

---

### GET /v1/speakers

List speakers scoped to the token's organization or workspace.

```bash
curl -fsS https://api.callvaultai.com/v1/speakers \
  -H "Authorization: Bearer $CALLVAULT_API_TOKEN"
```

Expected HTTP 200 response shape:

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com"
    }
  ],
  "pagination": {
    "total": 5,
    "page": 1,
    "per_page": 50,
    "has_more": false
  }
}
```

---

## Error Responses

### 401 — Missing or invalid token

Returned when the `Authorization` header is absent, malformed, or the token does not exist / has been revoked.

```bash
curl -fsS https://api.callvaultai.com/v1/workspaces
# → HTTP 401
```

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid API token"
  }
}
```

### 403 — Wrong token source

Returned when a valid token exists but has `token_source != 'api'` (e.g., an MCP token is used against the REST API).

```bash
curl -fsS https://api.callvaultai.com/v1/workspaces \
  -H "Authorization: Bearer $CALLVAULT_MCP_TOKEN"
# → HTTP 403
```

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Token source not permitted for REST API"
  }
}
```

### 404 — Resource not found

Returned when a specific resource ID is valid but not accessible to the token scope.

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Recording not found"
  }
}
```

### 405 — Method not allowed

The REST API is read-only. Non-GET requests return 405.

```json
{
  "error": {
    "code": "METHOD_NOT_ALLOWED",
    "message": "Only GET requests are supported"
  }
}
```

---

## Smoke Test Commands

Run these after any deploy to verify the API is live. Use a temporary token (create, test, revoke).

```bash
export CALLVAULT_API_TOKEN="<temporary token — revoke after test>"

# 1. Valid token — should return HTTP 200 with JSON data array
curl -fsS -D /tmp/callvault-api.headers \
  https://api.callvaultai.com/v1/workspaces \
  -H "Authorization: Bearer $CALLVAULT_API_TOKEN" \
  | jq '.data | length'

# 2. Missing token — should return HTTP 401
curl -o /dev/null -w "%{http_code}\n" \
  https://api.callvaultai.com/v1/workspaces
# Expected: 401

# 3. Wrong-source token (MCP token) — should return HTTP 403
# (Only run if an MCP token is available; do not create one just for this check)
# curl -o /dev/null -w "%{http_code}\n" \
#   https://api.callvaultai.com/v1/workspaces \
#   -H "Authorization: Bearer $CALLVAULT_MCP_TOKEN"
# Expected: 403

# 4. After testing, revoke the temporary token via the UI
```

Check the response headers file to confirm proxy headers are present:

```bash
grep -i "content-type\|x-sb" /tmp/callvault-api.headers
```

---

## Deploy Commands

```bash
# Deploy the REST API Edge Function (Docker-free)
supabase functions deploy callvault-api --use-api

# Deploy the Cloudflare proxy (routes /v1/* to callvault-api)
cd cloudflare/api-proxy && npx wrangler deploy

# Verify worker routes after deploy
npx wrangler tail --format=pretty
```

---

## Architecture

```
https://api.callvaultai.com/v1/*
          │
          ▼
  Cloudflare Worker (cloudflare/api-proxy/worker.ts)
          │  resolveTarget: /v1/* → callvault-api
          ▼
  Supabase Edge Function (supabase/functions/callvault-api/)
          │  authenticateApiToken → token_source='api' check
          │  Route dispatch: /v1/workspaces, /v1/calls, /v1/contacts, /v1/speakers
          ▼
  Supabase PostgreSQL (api_tokens table, workspaces, recordings, contacts, speakers)
```

The MCP server (`mcp-server` Edge Function) is a completely separate path — see [MCP Runbook](./mcp-runbook.md).

---

## Env Var Reference

| Env var | Where set | Purpose |
|---------|-----------|---------|
| `SUPABASE_URL` | Supabase secrets (auto-injected) | Project URL for DB client |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secrets (auto-injected) | Service-role client for token lookup |

No additional secrets are required for the REST API Edge Function beyond the standard Supabase auto-injected vars.

---

## Related References

- API Edge Function: `supabase/functions/callvault-api/`
- Auth module: `supabase/functions/callvault-api/auth.ts`
- Cloudflare proxy: `cloudflare/api-proxy/worker.ts`
- MCP runbook: `docs/operations/mcp-runbook.md`
- API token UI: `src/components/settings/ApiTokensSection.tsx`
