# Research: Phase 12 — Deploy CallVault MCP as Remote Cloudflare Worker

**Synthesized:** 2026-02-19
**Sources:** 4 parallel research streams + existing technical research artifact
**Overall Confidence:** HIGH

---

## Executive Summary

Deploying CallVault MCP as a remote Cloudflare Worker with Supabase OAuth 2.1 is well-supported by the ecosystem. The MCP spec has converged on Streamable HTTP transport, and both Claude Desktop and ChatGPT support remote MCP servers with OAuth auto-discovery. The existing callvault-mcp codebase's handler logic is fully portable — the migration primarily involves replacing transport, auth, and filesystem dependencies.

**Key finding: OpenClaw native MCP is disabled** (feature request closed 2026-02-01). Downgrade MCP-REMOTE-06 to community plugin documentation.

---

## Architecture Decisions

### 1. Worker Pattern: `createMcpHandler` (stateless) over `McpAgent` (stateful)

**Decision:** Use `createMcpHandler` with manual Supabase JWT validation per-request.

**Rationale:**
- `McpAgent` requires `OAuthProvider` from `@cloudflare/workers-oauth-provider` for props injection. Adapting this to proxy Supabase's OAuth 2.1 flow is underdocumented and adds complexity.
- `createMcpHandler` supports `authContext` option — extract Bearer token from header, validate via `jose` + Supabase JWKS, pass user context to tools via `getMcpAuthContext()`.
- CallVault operations are stateless reads — no session state needed across tool calls.
- Avoids Durable Object billing and `new_sqlite_classes` migration complexity.

### 2. Auth: Supabase OAuth 2.1 Server + Worker as Protected Resource

**Decision:** Supabase handles the entire OAuth authorization server role. Worker serves `/.well-known/oauth-protected-resource` pointing to Supabase.

**Flow:**
```
MCP Client → POST /mcp (no token)
  → Worker returns 401 + WWW-Authenticate with resource_metadata URL
MCP Client → GET /.well-known/oauth-protected-resource (from Worker)
  → Returns { authorization_servers: ["https://<project>.supabase.co"] }
MCP Client → GET /.well-known/oauth-authorization-server/auth/v1 (from Supabase)
  → Discovers authorize, token, register endpoints
MCP Client → DCR or pre-registered client credentials
MCP Client → PKCE authorization code flow via Supabase Auth
  → User sees consent page at callvault.ai/oauth/consent
  → Approves → Supabase issues access_token (JWT)
MCP Client → POST /mcp with Bearer <access_token>
  → Worker validates JWT via JWKS → creates Supabase client → executes operation
```

**Prerequisites:**
1. Enable Supabase OAuth 2.1 Server (Authentication > OAuth Server)
2. Enable Dynamic Client Registration
3. Switch JWT signing to RS256 (Authentication > Signing Keys)
4. Build `/oauth/consent` page in CallVault frontend
5. Allowlist OAuth callback URLs for Claude and ChatGPT

### 3. Consent Page: Frontend route, not Worker

The consent page (`/oauth/consent`) must live in the CallVault frontend (Vite/React app) because it uses `supabase.auth.oauth.getAuthorizationDetails()`, `approveAuthorization()`, and `denyAuthorization()` — browser-side supabase-js methods.

### 4. Token Validation: `jose` + JWKS (no shared secret)

```typescript
import { jwtVerify, createRemoteJWKSet } from 'jose';
const JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
const { payload } = await jwtVerify(token, JWKS, {
  issuer: `${SUPABASE_URL}/auth/v1`,
  audience: 'authenticated',
});
```

### 5. Pagination: Remove chunking, use cursor-based pagination

Replace in-memory `sessionsCache` Map with cursor-based pagination via `offset` parameter in `callvault_execute`. Eliminates KV dependency for initial deployment.

---

## Codebase Migration Summary

### Fully Portable (zero changes)
- `src/prompts.ts` — pure TypeScript
- `src/operations.json` — data only (change load mechanism)
- All Supabase query logic in 6 handler files
- Pure utility functions (`extractFields`, `truncateList`, `estimateTokens`, `parseTranscript`)

### Needs Context Threading (mechanical, low effort per file)
Replace `getSupabaseClient()` / `getCurrentUserId()` with `context: { supabase, userId }` parameter in:
- `src/handlers/navigation.ts`
- `src/handlers/recordings.ts`
- `src/handlers/transcripts.ts`
- `src/handlers/search.ts`
- `src/handlers/contacts.ts`
- `src/handlers/analysis.ts`
- `src/handlers/index.ts` (router)

### Needs Replacement (delete and rewrite)
- `src/auth.ts` — filesystem session → Bearer token from header
- `src/supabase.ts` — singleton → per-request factory
- `src/index.ts` — stdio transport → Worker fetch handler + createMcpHandler
- `src/utils.ts` — filesystem logging → console.log, sessionsCache → cursor pagination
- `authorize.ts` — local HTTP server → eliminated (Supabase OAuth handles this)

### New Files Needed
- `wrangler.jsonc` — Worker config (no DO needed for stateless pattern)
- Worker entry point with CORS, auth validation, well-known endpoints
- `jose`-based JWT validation middleware

---

## Client Compatibility Matrix

| Platform | Support | OAuth Callback URL | Plan Required |
|----------|---------|-------------------|---------------|
| Claude Desktop/Web | Native via Connectors UI | `https://claude.ai/api/mcp/auth_callback` + `https://claude.com/api/mcp/auth_callback` | Pro/Max/Team/Enterprise |
| ChatGPT | Developer Mode connectors | `https://chatgpt.com/connector_platform_oauth_redirect` | Business/Enterprise/Education |
| OpenClaw | Community plugin only | N/A | N/A |
| MCP Inspector | Full support | `http://localhost:5173/` | None |

---

## OAuth Callback URLs to Allowlist

```
https://claude.ai/api/mcp/auth_callback
https://claude.com/api/mcp/auth_callback
https://chatgpt.com/connector_platform_oauth_redirect
https://platform.openai.com/apps-manage/oauth
http://localhost:5173/
http://127.0.0.1:5173/
```

---

## CORS Requirements

All endpoints (`/mcp`, `/.well-known/*`, `/register`) need:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Accept, Authorization, Mcp-Session-Id, Last-Event-ID, MCP-Protocol-Version
Access-Control-Expose-Headers: Content-Type, Authorization, Mcp-Session-Id
Access-Control-Max-Age: 86400
```

---

## Critical Prerequisites (Before Any Code)

1. **Supabase Dashboard:** Enable OAuth 2.1 Server + Dynamic Client Registration
2. **Supabase Dashboard:** Switch JWT signing from HS256 to RS256
3. **Supabase Dashboard:** Configure Authorization Path as `/oauth/consent`
4. **Verify:** `/.well-known/oauth-authorization-server/auth/v1` returns valid discovery doc
5. **Verify:** `/.well-known/openid-configuration` includes `code_challenge_methods_supported: ["S256"]`

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Supabase OAuth 2.1 beta instability | MEDIUM | HIGH | Test early, use raw *.supabase.co URL (not custom domain) |
| DCR rejects custom URI schemes | LOW | LOW | Pre-register Claude/ChatGPT clients manually |
| Workers 30s CPU limit on large transcripts | LOW | MEDIUM | Existing chunking already bounds response sizes |
| `code_challenge_methods_supported` missing from Supabase | MEDIUM | HIGH | Verify against live project before implementation |
| OAuth audience claim mismatch | LOW | HIGH | Test with actual OAuth token in jwt.io early |

---

## Detailed Research Files

| File | Focus | Lines |
|------|-------|-------|
| `RESEARCH-cloudflare-workers.md` | Agents SDK, createMcpHandler, wrangler config, pitfalls | 744 |
| `RESEARCH-supabase-oauth.md` | OAuth 2.1 setup, DCR, consent page, JWT validation | 586 |
| `RESEARCH-codebase-analysis.md` | File-by-file migration guide, patterns to preserve | 635 |
| `RESEARCH-mcp-client-compat.md` | Claude/ChatGPT/OpenClaw connection flows, CORS, testing | 724 |

---

## Requirement Status Update

Based on research findings:

| Requirement | Status | Notes |
|-------------|--------|-------|
| MCP-REMOTE-01 | Feasible | Streamable HTTP via createMcpHandler |
| MCP-REMOTE-02 | Feasible | Supabase OAuth 2.1 Server in public beta |
| MCP-REMOTE-03 | Feasible | All handler logic portable; context threading needed |
| MCP-REMOTE-04 | Feasible | Claude Connectors UI supports remote MCP |
| MCP-REMOTE-05 | Feasible | ChatGPT Developer Mode supports MCP |
| MCP-REMOTE-06 | **Downgraded** | OpenClaw has disabled native MCP; community plugin only |
| MCP-REMOTE-07 | Feasible | Supabase OAuth coexists with existing Google OAuth |
| MCP-REMOTE-08 | Feasible | Semantic search calls Supabase Edge Function (OpenAI key stays server-side) |
