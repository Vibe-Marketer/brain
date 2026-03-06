# MCP Client Compatibility Research
## Phase 12: Deploy CallVault MCP as Remote Cloudflare Worker with Supabase OAuth 2.1

**Researched:** 2026-02-19
**Domain:** MCP remote server cross-platform client compatibility
**Confidence:** HIGH (official docs + MCP spec)

---

## Summary

This document answers "what must a remote MCP server implement to work across Claude Desktop/Claude.ai, ChatGPT Apps, OpenClaw, and MCP Inspector?" The findings show that the MCP ecosystem has converged around Streamable HTTP as the transport standard (spec version 2025-03-26), with OAuth 2.1 + Protected Resource Metadata as the authentication layer. The core protocol is well-standardized; the per-client variability is in how users *add* the server and what OAuth callback URLs to allowlist.

**Primary recommendation:** Implement a single `/mcp` endpoint supporting both POST (JSON-RPC) and GET (SSE stream), expose `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server`, CORS-configure for all origins, and allowlist the two OAuth callback URLs: `https://claude.ai/api/mcp/auth_callback` and `https://chatgpt.com/connector_platform_oauth_redirect`.

---

## 1. Claude Desktop / Claude.ai Connector

### Connection Method

Remote MCP servers connect via the Claude web UI — **not** via `claude_desktop_config.json`. Claude Desktop will refuse to connect to remote servers added through the config file.

**UI Path:**
- Pro/Max: Settings → Connectors → "Add custom connector" → paste MCP server URL
- Team/Enterprise: Organization settings → Connectors → "Add custom connector" (then members click "Connect" per-conversation)

**Plan requirement:** Pro, Max, Team, or Enterprise. Free plans excluded.

### Transport

Claude supports both:
- **Streamable HTTP** (preferred, MCP spec 2025-03-26)
- **HTTP+SSE** (legacy, spec 2024-11-05) — may be deprecated in coming months

Use Streamable HTTP. The endpoint should be reachable at a path like `https://your-worker.workers.dev/mcp`.

### OAuth Discovery Flow

Claude implements the full MCP OAuth 2.1 discovery chain:

1. Client POSTs unauthenticated `InitializeRequest` to `/mcp`
2. Server returns `401 Unauthorized` with `WWW-Authenticate: Bearer resource_metadata="https://your-server/.well-known/oauth-protected-resource"`
3. Client GETs `/.well-known/oauth-protected-resource` — server returns JSON with `authorization_servers` field
4. Client discovers authorization server metadata at `/.well-known/oauth-authorization-server`
5. Client uses Dynamic Client Registration (RFC 7591) **or** Client ID Metadata Documents to register
6. Standard OAuth 2.1 authorization code + PKCE flow begins
7. Client redirected to `https://claude.ai/api/mcp/auth_callback`

**Claude's OAuth callback URLs (both must be allowlisted):**
- `https://claude.ai/api/mcp/auth_callback` (current)
- `https://claude.com/api/mcp/auth_callback` (future migration)

**Claude's OAuth client name:** `Claude`

Claude supports Dynamic Client Registration (RFC 7591). As of July 2025, Claude also allows users to manually specify a Client ID + Secret in "Advanced settings" for servers that don't support DCR.

### claude_desktop_config.json (for local proxy only)

If Claude Desktop users need to use a remote server before Anthropic adds native remote support to the desktop app (unlikely now that it supports connectors via UI), they use `mcp-remote` as a stdio bridge:

```json
{
  "mcpServers": {
    "callvault": {
      "command": "npx",
      "args": [
        "mcp-remote@latest",
        "https://callvault-mcp.workers.dev/mcp"
      ]
    }
  }
}
```

With a static bearer token:
```json
{
  "mcpServers": {
    "callvault": {
      "command": "npx",
      "args": [
        "mcp-remote@latest",
        "https://callvault-mcp.workers.dev/mcp",
        "--header",
        "Authorization: Bearer YOUR_API_KEY"
      ]
    }
  }
}
```

The `mcp-remote` package handles OAuth browser flows automatically and stores credentials in `~/.mcp-auth/`.

**Sources:**
- [Building custom connectors via remote MCP servers | Claude Help Center](https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers)
- [Getting started with custom connectors using remote MCP](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp)
- [mcp-remote on npm](https://www.npmjs.com/package/mcp-remote)

---

## 2. ChatGPT Apps SDK (OpenAI)

### Connection Method

ChatGPT renamed "Connectors" to "Apps" in December 2025. The connection flow uses developer mode:

1. Enable Developer Mode: Settings → Apps & Connectors → Advanced Settings → toggle Developer Mode (requires org admin permission)
2. Create connector: Settings → Connectors → Create
3. Provide: connector name, description, public HTTPS endpoint (`https://your-server.example.com/mcp`)

**Plan requirement:** Business, Enterprise, or Education plans. Full MCP (write/modify) actions rolled out November 2025.

### Transport

Streamable HTTP over HTTPS. ChatGPT connects to the `/mcp` endpoint. No SSE-only mode documented.

### OAuth Flow

ChatGPT implements OAuth 2.1 + PKCE, discoverable via the MCP spec's well-known endpoint chain:

1. ChatGPT queries `GET /.well-known/oauth-protected-resource` for resource metadata
2. ChatGPT registers via Dynamic Client Registration (DCR)
3. User authenticates; ChatGPT exchanges authorization code for access token
4. Token attached to all subsequent MCP requests

**ChatGPT OAuth callback URL:**
- `https://chatgpt.com/connector_platform_oauth_redirect`
- Also allowlist for app submission review: `https://platform.openai.com/apps-manage/oauth`

**ChatGPT's OAuth discovery:** ChatGPT is moving toward Client Metadata Documents (CMID) where it will publish a stable document declaring its OAuth metadata and identity. For now, DCR must be supported.

### Auth Error Signaling

When a tool call requires authentication, return a 401 with `_meta["mcp/www_authenticate"]` containing the `WWW-Authenticate` header value. This triggers ChatGPT's "link account" UI.

### Per-tool Security Declarations

```typescript
securitySchemes: [
  { type: "noauth" },
  { type: "oauth2", scopes: ["vault:read", "vault:write"] }
]
```

**Sources:**
- [Developer mode, and MCP apps in ChatGPT [beta]](https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta)
- [MCP — Apps SDK](https://developers.openai.com/apps-sdk/concepts/mcp-server/)
- [Authentication — Apps SDK](https://developers.openai.com/apps-sdk/build/auth/)
- [Connect from ChatGPT](https://developers.openai.com/apps-sdk/deploy/connect-chatgpt/)

---

## 3. OpenClaw

### Status: Limited Native MCP Support

**Critical finding:** OpenClaw's Agent Client Protocol (ACP) layer explicitly disables MCP. The source code contains:

```
mcpCapabilities: { http: false, sse: false }
```

And MCP servers passed during session creation are silently ignored with log message: `"ignoring ${params.mcpServers.length} MCP servers"`

The official feature request (GitHub issue #4834) was **closed as "not planned" on February 1, 2026**.

### Workarounds

**Option A: openclaw-mcp-plugin (community)**

Adds MCP support to OpenClaw via a plugin. Config in `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "mcp-integration": {
        "enabled": true,
        "config": {
          "enabled": true,
          "servers": {
            "callvault": {
              "enabled": true,
              "transport": "http",
              "url": "https://callvault-mcp.workers.dev/mcp"
            }
          }
        }
      }
    }
  }
}
```

**Option B: Direct mcpServers config (alternative format)**

Some community tooling uses a Claude Desktop-compatible format with `"transport": "streamable-http"`:

```json
{
  "mcpServers": {
    "callvault": {
      "transport": "streamable-http",
      "url": "https://callvault-mcp.workers.dev/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

**Option C: mcporter (built-in, but slow)**

OpenClaw ships `mcporter` as a built-in skill — it subprocess-calls MCP tools, cold-starting the server per call (~2.4 seconds/call). Impractical for real-time use.

### Practical Recommendation

Do not prioritize OpenClaw as a launch target. The native support is explicitly disabled. Focus on Claude and ChatGPT, then document OpenClaw as "use mcp-remote or openclaw-mcp-plugin."

**Sources:**
- [openclaw-mcp-plugin on GitHub](https://github.com/lunarpulse/openclaw-mcp-plugin)
- [Feature: Native MCP support — closed](https://github.com/openclaw/openclaw/issues/4834)
- [OpenClaw Can't Use MCP Servers Natively — Gist](https://gist.github.com/Rapha-btc/527d08acc523d6dcdb2c224fe54f3f39)
- [rodgco/openclaw-mcp-server](https://github.com/rodgco/openclaw-mcp-server)

---

## 4. MCP Inspector

### Purpose

`@modelcontextprotocol/inspector` is the official developer testing tool. Provides a browser-based UI at `localhost:5173` with a proxy at `localhost:6277`. Use it to validate your server before attempting real client connections.

### Basic Usage (no auth)

```bash
# Start inspector, connect to remote Streamable HTTP server
npx @modelcontextprotocol/inspector
```

Then in the browser UI that opens:
1. Select transport type: "Streamable HTTP"
2. Enter URL: `https://callvault-mcp.workers.dev/mcp`
3. Click Connect
4. Click "List tools" to verify tool advertisement

### OAuth Testing

When the server returns 401:
1. In Inspector UI, click "Open Auth settings"
2. Click "Quick OAuth Flow"
3. Complete OAuth provider authentication in the browser popup
4. After redirect back to Inspector, click Connect again

**Known issue:** CORS errors have been reported in Inspector's Quick OAuth Flow (GitHub issue #817). This is a known bug in the Inspector itself, not necessarily your server.

### CLI Mode (for automation)

```bash
# Connect with bearer token
npx @modelcontextprotocol/inspector \
  --connect https://callvault-mcp.workers.dev/mcp \
  --bearer-token your-token-here

# Test specific methods
npx @modelcontextprotocol/inspector \
  --connect https://callvault-mcp.workers.dev/mcp \
  --method tools/list
```

### What Inspector Validates

- Server connectivity and InitializeRequest/InitializeResult handshake
- Capability negotiation (`tools`, `resources`, `prompts`)
- Tool schema advertisement (`tools/list`)
- Tool execution (`tools/call` with custom inputs)
- Resource listing and content
- Prompt templates
- Session management (Mcp-Session-Id header handling)
- SSE streaming for long-running operations

**Sources:**
- [MCP Inspector — Model Context Protocol](https://modelcontextprotocol.io/docs/tools/inspector)
- [Test a Remote MCP Server — Cloudflare Agents docs](https://developers.cloudflare.com/agents/guides/test-remote-mcp-server/)
- [CORS errors in Quick OAuth Flow — GitHub #817](https://github.com/modelcontextprotocol/inspector/issues/817)

---

## 5. Streamable HTTP Transport Specifics

**Spec version:** 2025-03-26 (replaces HTTP+SSE from 2024-11-05)

### Endpoint

A single URL path supports both POST and GET: `https://your-server.example.com/mcp`

### HTTP Methods

| Method | Purpose | Required? |
|--------|---------|-----------|
| POST `/mcp` | All client→server JSON-RPC messages | YES |
| GET `/mcp` | Open SSE stream for server→client push | OPTIONAL |
| DELETE `/mcp` | Client terminates session | OPTIONAL |
| OPTIONS `/mcp` | CORS preflight | YES (browser clients) |

### POST Request Requirements

Client MUST:
- Set `Content-Type: application/json`
- Set `Accept: application/json, text/event-stream`
- Include `Mcp-Session-Id` header after initialization (if server issued one)
- Send body as a single JSON-RPC request, notification, or response — or a batch array

Server MUST respond with either:
- `Content-Type: application/json` (single response)
- `Content-Type: text/event-stream` (SSE stream for streaming responses)

For notifications/responses only (no requests in body): server MUST return `202 Accepted` with no body.

### GET Request Behavior

- Client sets `Accept: text/event-stream`
- Server MUST return `Content-Type: text/event-stream` OR `HTTP 405 Method Not Allowed`
- GET stream is for server-initiated messages (notifications, requests to client)
- Server MUST NOT send JSON-RPC responses on GET stream (only on corresponding POST's stream)

### Session Management

```
# Initialization
POST /mcp
Body: {"jsonrpc":"2.0","method":"initialize",...}

# Server response includes:
HTTP 200 OK
Content-Type: application/json
Mcp-Session-Id: 1868a90c-uuid-here

# All subsequent requests must include:
Mcp-Session-Id: 1868a90c-uuid-here
```

- Session ID MUST be globally unique + cryptographically secure (UUID, JWT, or hash)
- Session ID MUST contain only visible ASCII (0x21–0x7E)
- If server issued a session ID, all subsequent requests without it SHOULD get `400 Bad Request`
- Session terminated: server responds with `404 Not Found` → client MUST start new session with fresh `InitializeRequest`

### Stream Resumability

Servers MAY attach `id` fields to SSE events. If connection drops, client sends:
```
GET /mcp
Mcp-Session-Id: 1868a90c-uuid-here
Last-Event-ID: <last-received-event-id>
```

### Origin Header Validation (Security)

Servers MUST validate the `Origin` header on all incoming connections to prevent DNS rebinding attacks. Cloudflare Workers handle this at the network level.

**Source:** [Transports — Model Context Protocol Specification 2025-03-26](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports)

---

## 6. OAuth 2.1 Requirements per MCP Spec

**Authorization is OPTIONAL** for MCP implementations. When implemented for HTTP-based transport, the spec requires:

### Server-Side (Resource Server) Requirements

**MUST implement:**
- OAuth 2.0 Protected Resource Metadata (RFC 9728)
- One of: WWW-Authenticate header on 401, OR well-known URI for resource metadata

**Discovery endpoint chain:**
```
1. Client → POST /mcp (no token)
2. Server → 401 + WWW-Authenticate: Bearer resource_metadata="https://your-server/.well-known/oauth-protected-resource"

3. Client → GET /.well-known/oauth-protected-resource
4. Server → JSON with authorization_servers field:
{
  "resource": "https://callvault-mcp.workers.dev",
  "authorization_servers": ["https://your-supabase.supabase.co"],
  "scopes_supported": ["vault:read", "vault:write"]
}

5. Client → GET https://your-supabase.supabase.co/.well-known/oauth-authorization-server
   OR GET https://your-supabase.supabase.co/.well-known/openid-configuration
6. Auth server → Standard OAuth metadata JSON

7. Client → POST /register (Dynamic Client Registration, RFC 7591)
   OR uses Client ID Metadata Documents (CMID)
8. Auth server → client_id, client_secret

9. Client → Opens browser for OAuth authorization code + PKCE
10. User authenticates
11. Redirect to client callback with authorization code
12. Client → POST /token with code + code_verifier
13. Auth server → access_token (+ refresh_token)

14. Client → POST /mcp with Authorization: Bearer <access_token>
15. Server → validates token audience, processes request
```

### PKCE Requirements

- OAuth 2.1 mandates PKCE for ALL clients (including confidential clients)
- Clients MUST use `S256` code challenge method
- If `code_challenge_methods_supported` is absent from auth server metadata, MCP clients MUST refuse to proceed
- Authorization server MUST include `code_challenge_methods_supported` in metadata

### Token Requirements

- Tokens passed in `Authorization: Bearer <token>` header ONLY
- Tokens MUST NOT be in URI query strings
- Every HTTP request (even same session) MUST include Authorization header
- Tokens MUST be bound to specific audience (the MCP server's canonical URI)
- Server MUST validate `aud` claim matches its canonical URI

### Resource Parameter (RFC 8707)

Clients MUST include `resource` parameter in both authorization AND token requests:
```
GET /authorize?...&resource=https%3A%2F%2Fcallvault-mcp.workers.dev
POST /token with body: ...&resource=https%3A%2F%2Fcallvault-mcp.workers.dev
```

### Client Registration Options (in priority order)

1. **Pre-registration**: Static client ID/secret configured at install time
2. **Client ID Metadata Documents (CMID)**: Client hosts metadata JSON at `https://client.example.com/metadata.json`, uses URL as `client_id`
3. **Dynamic Client Registration (RFC 7591)**: Client POSTs to `/register` to get credentials

For a Supabase-backed OAuth server: Supabase Auth supports OAuth 2.1 with PKCE natively. CMID and DCR would need custom Supabase Edge Functions or middleware to handle.

### Well-Known Endpoints Summary

| Endpoint | Spec | Purpose | Required? |
|----------|------|---------|-----------|
| `/.well-known/oauth-protected-resource` | RFC 9728 | Resource metadata → points to auth server | YES |
| `/.well-known/oauth-authorization-server` | RFC 8414 | Auth server capabilities, endpoints | YES (on auth server) |
| `/.well-known/openid-configuration` | OIDC Discovery | Alternative to RFC 8414 | Fallback |
| `/register` | RFC 7591 | Dynamic Client Registration | RECOMMENDED |

**Source:** [Authorization — Model Context Protocol (draft spec)](https://modelcontextprotocol.io/specification/draft/basic/authorization)

---

## 7. CORS Requirements

### Why CORS Matters for MCP

Browser-based MCP clients (Claude.ai web, ChatGPT web) make cross-origin requests to your Cloudflare Worker. The browser enforces CORS. Native desktop clients (Claude Desktop app) do NOT go through the browser's CORS enforcement, but the OAuth redirect flow DOES use a browser, so OAuth endpoints need CORS too.

### Required CORS Headers

**Access-Control-Allow-Origin:**
```
Access-Control-Allow-Origin: *
```
Or for authenticated endpoints (credentials mode), specify exact origins rather than `*`:
```
Access-Control-Allow-Origin: https://claude.ai
Access-Control-Allow-Origin: https://chatgpt.com
```

**Note:** Setting `Access-Control-Allow-Credentials: true` with `Access-Control-Allow-Origin: *` is invalid per the spec. If you need credentials, enumerate origins explicitly.

**Access-Control-Allow-Methods:**
```
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
```

**Access-Control-Allow-Headers (must include all MCP-specific headers):**
```
Access-Control-Allow-Headers: Content-Type, Accept, Authorization, Mcp-Session-Id, Last-Event-ID, MCP-Protocol-Version
```

**Access-Control-Expose-Headers (browser must be able to read response headers):**
```
Access-Control-Expose-Headers: Content-Type, Authorization, Mcp-Session-Id
```

**Access-Control-Max-Age (cache preflight for 24h):**
```
Access-Control-Max-Age: 86400
```

### OPTIONS Preflight Handler

Every MCP endpoint MUST handle `OPTIONS` requests and return `200 OK` with the above headers. Browsers send a preflight before any `POST /mcp` or custom-header request.

```typescript
// Cloudflare Worker example
if (request.method === 'OPTIONS') {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Mcp-Session-Id, Last-Event-ID, MCP-Protocol-Version',
      'Access-Control-Expose-Headers': 'Content-Type, Authorization, Mcp-Session-Id',
      'Access-Control-Max-Age': '86400',
    },
  });
}
```

### OAuth Endpoint CORS

The `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server` endpoints must also allow cross-origin GET:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
```

The `/register` (DCR) endpoint needs POST from browser origins:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

**Sources:**
- [HTTP Stream Transport — MCP Framework](https://mcp-framework.com/docs/Transports/http-stream-transport/)
- [CORS errors in MCP Inspector Quick OAuth Flow — GitHub #817](https://github.com/modelcontextprotocol/inspector/issues/817)
- [Does not work with browser based MCP clients due to lack of CORS — fastmcp #840](https://github.com/jlowin/fastmcp/issues/840)

---

## 8. Platform Compatibility Matrix

| Feature | Claude Desktop | Claude.ai Web | ChatGPT Web | OpenClaw | MCP Inspector |
|---------|---------------|---------------|-------------|----------|---------------|
| **Native remote MCP** | Via UI Connectors | Via UI Connectors | Via Connectors (Dev Mode) | NO | YES |
| **Streamable HTTP** | YES | YES | YES | Plugin only | YES |
| **Legacy SSE (2024-11-05)** | YES (deprecating) | YES (deprecating) | Unknown | N/A | YES |
| **OAuth 2.1 auto-discovery** | YES (DCR) | YES (DCR) | YES (DCR) | N/A | YES (Quick OAuth) |
| **Static bearer token** | Via mcp-remote | Advanced settings | Not documented | Header config | YES (--bearer-token) |
| **Plan restriction** | Pro/Max/Team/Ent | Pro/Max/Team/Ent | Business/Ent/Edu | N/A | None |
| **OAuth callback URL** | claude.ai/api/mcp/auth_callback | Same | chatgpt.com/connector_platform_oauth_redirect | N/A | localhost |

### OAuth Callback URLs to Allowlist

```
# Claude (both, in case of migration)
https://claude.ai/api/mcp/auth_callback
https://claude.com/api/mcp/auth_callback

# ChatGPT production
https://chatgpt.com/connector_platform_oauth_redirect

# ChatGPT app submission review
https://platform.openai.com/apps-manage/oauth

# MCP Inspector local testing
http://localhost:5173/
http://127.0.0.1:5173/
```

---

## 9. Cloudflare Workers Implementation Notes

Cloudflare provides official tooling:

**Package:** `workers-oauth-provider` — TypeScript library that wraps Worker code, adding authorization to API endpoints including MCP endpoints.

**Template:**
```bash
npm create cloudflare@latest -- remote-mcp-server-authless \
  --template=cloudflare/ai/demos/remote-mcp-authless
```

**Required Wrangler secrets:**
```bash
wrangler secret put GITHUB_CLIENT_ID      # or your OAuth provider credentials
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put COOKIE_ENCRYPTION_KEY
```

**KV Namespace for OAuth session storage:**
```toml
# wrangler.jsonc
[[kv_namespaces]]
binding = "OAUTH_KV"
id = "your-kv-namespace-id"
```

**Endpoint pattern:** `https://[worker-name].[account].workers.dev/mcp`

For Supabase OAuth integration specifically: Supabase Auth provides PKCE-ready OAuth 2.1 endpoints. The well-known auth server metadata would point at your Supabase project URL. The resource metadata (on the Worker) points at Supabase as the authorization_servers entry.

**Sources:**
- [Build a Remote MCP server — Cloudflare Agents docs](https://developers.cloudflare.com/agents/guides/remote-mcp-server/)
- [Build and deploy Remote MCP servers to Cloudflare — Cloudflare Blog](https://blog.cloudflare.com/remote-model-context-protocol-servers-mcp/)
- [Secure and Deploy Remote MCP Servers with Auth0 and Cloudflare — Auth0](https://auth0.com/blog/secure-and-deploy-remote-mcp-servers-with-auth0-and-cloudflare/)

---

## 10. Common Pitfalls

### Pitfall 1: Claude Desktop config file for remote servers
**What goes wrong:** Developer adds remote URL to `claude_desktop_config.json` and it silently does nothing.
**Root cause:** Anthropic explicitly disallows remote servers via config file (security measure).
**Prevention:** Use the Settings → Connectors UI. No config file workaround exists for native remote support.

### Pitfall 2: Missing `Mcp-Session-Id` in response headers
**What goes wrong:** Client cannot find session ID after init, re-initializes every request.
**Root cause:** Server doesn't set `Mcp-Session-Id` header on `InitializeResult` response.
**Prevention:** Set session ID on EVERY InitializeResult response, or don't use sessions at all (stateless is valid).

### Pitfall 3: OAuth callback URL not allowlisted
**What goes wrong:** OAuth works in Inspector but not in Claude or ChatGPT; redirect fails.
**Root cause:** Supabase OAuth app only has localhost callback registered.
**Prevention:** Allowlist all four production callback URLs at Supabase project configuration time.

### Pitfall 4: CORS blocks the Inspector Quick OAuth Flow
**What goes wrong:** Inspector shows CORS error when attempting OAuth in browser.
**Root cause:** Known Inspector bug (#817) AND/OR missing CORS on `/.well-known/` and `/register` endpoints.
**Prevention:** Add CORS to ALL endpoints including well-known and register. Test with curl before Inspector.

### Pitfall 5: Missing `resource` parameter in OAuth requests
**What goes wrong:** Token validation fails; server rejects token with 401.
**Root cause:** MCP spec requires clients to include `resource=<server-uri>` in auth and token requests, and servers must validate audience. If server validates strictly but client doesn't send `resource`, token won't have correct `aud` claim.
**Prevention:** Ensure auth server validates `resource` parameter; ensure server checks `aud` in JWT.

### Pitfall 6: `code_challenge_methods_supported` missing from auth server metadata
**What goes wrong:** MCP Inspector and some clients refuse to proceed with OAuth.
**Root cause:** Supabase OIDC metadata may not include `code_challenge_methods_supported`. MCP spec requires clients to abort if this field is missing.
**Prevention:** Verify Supabase's `/.well-known/openid-configuration` includes `code_challenge_methods_supported: ["S256"]`. If not, may need a metadata proxy or custom endpoint.

### Pitfall 7: `Access-Control-Allow-Origin: *` with credentials
**What goes wrong:** Browser rejects response with CORS error despite having `Access-Control-Allow-Origin: *`.
**Root cause:** Browser spec forbids `*` when `credentials: include` mode is used.
**Prevention:** For endpoints where clients send credentials (cookies, auth headers), use explicit origin allowlist instead of `*`. For OAuth well-known endpoints, `*` is fine.

### Pitfall 8: OpenClaw native MCP expectation
**What goes wrong:** Team spends time supporting OpenClaw native, no one can use it.
**Root cause:** OpenClaw has explicitly disabled MCP and closed the feature request as "not planned."
**Prevention:** Document OpenClaw as requiring the `openclaw-mcp-plugin` community plugin.

---

## 11. Testing Sequence

Use this order to validate your server:

```bash
# Step 1: Verify endpoint exists
curl -X OPTIONS https://callvault-mcp.workers.dev/mcp \
  -H "Origin: https://claude.ai" \
  -v 2>&1 | grep -E "Access-Control|HTTP/"

# Step 2: Verify well-known endpoints
curl https://callvault-mcp.workers.dev/.well-known/oauth-protected-resource | jq .
curl https://your-supabase.supabase.co/.well-known/openid-configuration | jq .

# Step 3: Test MCP init (no auth)
curl -X POST https://callvault-mcp.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' \
  -v

# Step 4: MCP Inspector visual test
npx @modelcontextprotocol/inspector

# Step 5: Full OAuth test in Inspector
# - Select Streamable HTTP transport
# - Enter https://callvault-mcp.workers.dev/mcp
# - Use "Quick OAuth Flow" when 401 appears
```

---

## Sources

### Primary (HIGH confidence — official spec and docs)
- [MCP Transport Specification 2025-03-26](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports)
- [MCP Authorization Specification (draft)](https://modelcontextprotocol.io/specification/draft/basic/authorization)
- [MCP Inspector Documentation](https://modelcontextprotocol.io/docs/tools/inspector)
- [Connect to remote MCP Servers — MCP Official Docs](https://modelcontextprotocol.io/docs/develop/connect-remote-servers)
- [Claude: Building custom connectors via remote MCP servers](https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers)
- [Claude: Getting started with custom connectors](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp)
- [ChatGPT Apps SDK: MCP Concepts](https://developers.openai.com/apps-sdk/concepts/mcp-server/)
- [ChatGPT Apps SDK: Authentication](https://developers.openai.com/apps-sdk/build/auth/)
- [Cloudflare: Build a Remote MCP server](https://developers.cloudflare.com/agents/guides/remote-mcp-server/)

### Secondary (MEDIUM confidence — verified community/vendor docs)
- [mcp-remote npm package](https://www.npmjs.com/package/mcp-remote)
- [HTTP Stream Transport — MCP Framework](https://mcp-framework.com/docs/Transports/http-stream-transport/)
- [Test a Remote MCP Server — Cloudflare](https://developers.cloudflare.com/agents/guides/test-remote-mcp-server/)
- [Secure and Deploy Remote MCP Servers with Auth0 and Cloudflare](https://auth0.com/blog/secure-and-deploy-remote-mcp-servers-with-auth0-and-cloudflare/)

### Tertiary (LOW confidence — community/GitHub, verify before implementing)
- [openclaw-mcp-plugin on GitHub](https://github.com/lunarpulse/openclaw-mcp-plugin) — community plugin, unverified maintenance status
- [OpenClaw MCP feature request — closed](https://github.com/openclaw/openclaw/issues/4834)
- [OpenClaw Can't Use MCP Natively — Gist](https://gist.github.com/Rapha-btc/527d08acc523d6dcdb2c224fe54f3f39)

---

## Metadata

**Confidence breakdown:**
- Streamable HTTP transport spec: HIGH — official MCP spec 2025-03-26
- OAuth 2.1 / discovery chain: HIGH — official MCP spec draft + confirmed by Claude/ChatGPT docs
- Claude Desktop connection flow: HIGH — official Anthropic support docs
- ChatGPT connection flow: HIGH — official OpenAI Apps SDK docs
- OpenClaw support status: HIGH — GitHub source code + closed issue confirm disabled
- CORS requirements: MEDIUM — derived from spec + community implementations, no single authoritative source
- OpenClaw plugin config: MEDIUM — GitHub README, community-maintained

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (30 days — MCP spec stabilizing but OAuth discovery details evolving)

**Flag for re-verification before shipping:**
- Supabase's `/.well-known/openid-configuration` includes `code_challenge_methods_supported: ["S256"]` — verify against actual Supabase project
- Claude's OAuth callback URL migration from `claude.ai` to `claude.com` — allowlist both
- ChatGPT CMID (Client Metadata Documents) rollout — DCR still required as of research date
