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

## Vault/Workspace Scoping Architecture

### Problem: Multi-Tenant Access Control

CallVault's Bank/Vault architecture requires:
1. **Bank-level isolation** - Users can belong to multiple banks (personal + business)
2. **Vault-level scoping** - Within a bank, access is controlled by VaultMembership
3. **Client-scoped access** - MCP clients may need access to only specific vaults (e.g., client access to their vault only)

### Solution: JWT Claims + Token Exchange (RFC 8693)

**Two-Layer Authorization:**
1. **Authentication Layer:** OAuth 2.1 PKCE → Supabase issues broad access token
2. **Authorization Layer:** Token Exchange → Obtain vault-scoped token with narrowed claims

**JWT Claims Structure:**

```json
{
  "iss": "https://<project>.supabase.co/auth/v1",
  "sub": "user-uuid",
  "aud": "https://callvault-mcp.workers.dev",
  "exp": 1735689600,
  "iat": 1735686000,
  "jti": "unique-token-id",
  "client_id": "mcp-client-id",
  "scope": "vault:read vault:write recordings:read",
  "bank_id": "bank-uuid-123",
  "vault_ids": ["vault-uuid-1", "vault-uuid-2"],
  "roles": ["bank_member", "vault_admin"],
  "entitlements": ["read:calls", "write:tags"]
}
```

### Pattern: Workspace Selection Tool

Following Cloudflare's `set_active_account` pattern:

```typescript
// navigation.set_active_workspace tool
HANDLERS["navigation.set_active_workspace"] = async (params, context) => {
  const { bank_id, vault_ids } = params;
  
  // Validate bank membership
  const hasAccess = await validateBankMembership(context.user_id, bank_id);
  if (!hasAccess) {
    throw new McpError(ErrorCode.InvalidRequest, "Access denied to bank");
  }
  
  // Store active context
  context.active_bank_id = bank_id;
  context.active_vault_ids = vault_ids || await getAccessibleVaults(context.user_id, bank_id);
  
  return {
    content: [{
      type: "text",
      text: `Active workspace: bank ${bank_id}, vaults: ${context.active_vault_ids.join(", ")}`
    }]
  };
};
```

### RLS Policy for Vault Scoping

```sql
-- Vault-scoped access policy
CREATE POLICY "vault_scoped_access" ON vault_entries
FOR SELECT
TO authenticated
USING (
  -- Must have vault membership
  EXISTS (
    SELECT 1 FROM vault_memberships vm
    WHERE vm.vault_id = vault_entries.vault_id
    AND vm.user_id = auth.uid()
  )
  AND
  -- If token has vault_ids claim, must include this vault
  (
    auth.jwt()->>'vault_ids' IS NULL
    OR
    vault_entries.vault_id::text = ANY(
      ARRAY(SELECT jsonb_array_elements_text(auth.jwt()->'vault_ids'))
    )
  )
);
```

### Token Exchange Flow

```typescript
// Exchange broad token for vault-scoped token
const exchangeRequest = {
  grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
  subject_token: originalAccessToken,
  subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
  scope: "vault:read recordings:search",
  resource: "https://callvault-mcp.workers.dev"
};

const response = await fetch(
  "https://<project>.supabase.co/auth/v1/token",
  {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(exchangeRequest)
  }
);
```

### Client-Scoped Access for External Users

For clients accessing specific vaults (e.g., agency clients):

1. **Generate vault-scoped token:**
   ```typescript
   // Edge Function: generate-vault-token
   const token = await supabase.auth.admin.createCustomToken(user_id, {
     vault_ids: [specific_vault_id],
     bank_id: bank_id,
     scope: "vault:read",
     exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
   });
   ```

2. **Client configures MCP with scoped token:**
   ```json
   {
     "mcpServers": {
       "callvault-client": {
         "transport": "streamable-http",
         "url": "https://callvault-mcp.workers.dev/mcp",
         "headers": {
           "Authorization": "Bearer <vault-scoped-token>"
         }
       }
     }
   }
   ```

---

## Detailed Research Files

| File | Focus | Lines |
|------|-------|-------|
| `RESEARCH-cloudflare-workers.md` | Agents SDK, createMcpHandler, wrangler config, pitfalls | 744 |
| `RESEARCH-supabase-oauth.md` | OAuth 2.1 setup, DCR, consent page, JWT validation | 586 |
| `RESEARCH-codebase-analysis.md` | File-by-file migration guide, patterns to preserve | 635 |
| `RESEARCH-mcp-client-compat.md` | Claude/ChatGPT/OpenClaw connection flows, CORS, testing | 724 |
| `RESEARCH-vault-scoping.md` | This research - JWT claims, token exchange, multi-tenant patterns | Added below |

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

---

## Appendix: Vault Scoping Deep Dive

### OAuth 2.1 Token Scoping Strategies

Based on RFC 9728 (Protected Resource Metadata) and MCP Authorization Spec:

**1. Scope Definition in Protected Resource Metadata**

```typescript
// /.well-known/oauth-protected-resource
{
  "resource": "https://callvault-mcp.workers.dev",
  "authorization_servers": ["https://<project>.supabase.co/auth/v1"],
  "scopes_supported": [
    "vault:read",      // List vaults, read vault metadata
    "vault:write",     // Create/modify vaults
    "recordings:read", // Read recording metadata
    "recordings:search", // Search across recordings
    "transcripts:read",  // Access transcript content
    "contacts:read",     // Access contact information
    "analysis:read"      // Access AI analysis results
  ],
  "resource_name": "CallVault MCP Server"
}
```

**2. WWW-Authenticate Challenge with Scope**

```typescript
// Server response when insufficient scope
return new Response(null, {
  status: 403,
  headers: {
    'WWW-Authenticate': `Bearer error="insufficient_scope", ` +
                       `scope="vault:read recordings:read", ` +
                       `resource_metadata="https://callvault-mcp.workers.dev/.well-known/oauth-protected-resource"`
  }
});
```

### JWT Claims Patterns for Multi-Tenant Access

**RFC 9068 (JWT Profile for OAuth Access Tokens) + SCIM (RFC 7643) Extensions:**

```json
{
  "iss": "https://<project>.supabase.co/auth/v1",
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "aud": "https://callvault-mcp.workers.dev",
  "exp": 1735689600,
  "iat": 1735686000,
  "jti": "dbe39bf3a3ba4238a513f51d6e1691c4",
  "client_id": "claude-desktop-client",
  "scope": "vault:read recordings:read transcripts:read",
  
  "CallVault-specific claims": {
    "bank_id": "bank-uuid-123",
    "vault_ids": ["vault-uuid-1", "vault-uuid-2"],
    "active_vault_id": "vault-uuid-1"
  },
  
  "SCIM authorization claims (RFC 7643)": {
    "roles": ["bank_member", "vault_admin"],
    "groups": ["sales-team", "managers"],
    "entitlements": ["read:calls", "write:tags", "export:transcripts"]
  }
}
```

**Claim Purposes:**
- `bank_id`: Current active bank context (prevents cross-bank access)
- `vault_ids[]`: List of vaults user has access to (enables cross-vault queries)
- `active_vault_id`: Specific vault for single-vault mode
- `roles[]`: SCIM-standard roles for RBAC
- `entitlements[]`: Fine-grained permissions beyond scopes

### Token Exchange Implementation (RFC 8693)

**Supabase Token Exchange Endpoint:**

```typescript
// POST /auth/v1/token with grant_type=urn:ietf:params:oauth:grant-type:token-exchange
interface TokenExchangeRequest {
  grant_type: "urn:ietf:params:oauth:grant-type:token-exchange";
  subject_token: string;              // Original access token
  subject_token_type: "urn:ietf:params:oauth:token-type:access_token";
  requested_token_type?: "urn:ietf:params:oauth:token-type:access_token";
  scope?: string;                     // Narrowed scope
  resource?: string;                  // Target resource URI
  audience?: string;                  // Logical audience name
}

interface TokenExchangeResponse {
  access_token: string;               // New scoped token
  issued_token_type: "urn:ietf:params:oauth:token-type:access_token";
  token_type: "Bearer";
  expires_in: number;
  scope: string;                      // Granted scope (may differ from requested)
  refresh_token?: string;             // New refresh token for this scope
}
```

**CallVault Token Exchange Flow:**

```typescript
// Step 1: User authenticates with broad scope
const broadToken = await authenticateWithOAuth({
  scope: "vault:read recordings:read"
});

// Step 2: User selects specific vault via set_active_workspace
const { bank_id, vault_ids } = await selectWorkspace();

// Step 3: Exchange for vault-scoped token
const scopedToken = await exchangeToken({
  subject_token: broadToken,
  scope: "vault:read recordings:read",
  // Custom claim injection via Supabase Edge Function
  custom_claims: {
    bank_id,
    vault_ids
  }
});

// Step 4: Use scoped token for all subsequent requests
// RLS policies automatically enforce vault_ids restriction
```

### Security Best Practices for Scoped MCP Access

**1. Token Audience Validation (RFC 8707)**

```typescript
// Worker must validate token is intended for this server
async function validateToken(token: JWT, expectedAudience: string): Promise<void> {
  // Check aud claim matches MCP server canonical URI
  if (token.aud !== expectedAudience) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      "Token audience mismatch - possible token misuse"
    );
  }
  
  // Validate iss claim against trusted issuers
  const trustedIssuers = [
    "https://<project>.supabase.co/auth/v1"
  ];
  if (!trustedIssuers.includes(token.iss)) {
    throw new McpError(ErrorCode.InvalidRequest, "Unknown token issuer");
  }
}
```

**2. Short-Lived Scoped Tokens**

```typescript
// Scoped tokens should have shorter lifetime than original
const TOKEN_LIFETIME = {
  broad: 3600,        // 1 hour for initial auth
  scoped: 900,        // 15 minutes for vault-scoped tokens
  client_access: 86400 // 24 hours for client-specific vault tokens
};
```

**3. Token Binding to MCP Session**

```typescript
// Bind token to MCP session ID to prevent token theft/replay
interface AuthContext {
  sessionId: string;          // From Mcp-Session-Id header
  tokenJti: string;           // Token unique ID
  userId: string;
  bankId: string;
  vaultIds: string[];
}

// Validate session consistency
if (authContext.sessionId !== request.headers.get('Mcp-Session-Id')) {
  throw new McpError(ErrorCode.InvalidRequest, "Session mismatch");
}
```

**4. Refresh Token Rotation**

```typescript
// When refreshing, maintain or narrow scope, never expand
async function refreshToken(refreshToken: string, currentScope: string): Promise<Tokens> {
  const response = await supabase.auth.refreshSession(refreshToken);
  
  // Verify refreshed token has same or narrower scope
  const newScope = parseScope(response.data.scope);
  const oldScope = parseScope(currentScope);
  
  if (!isScopeSubset(newScope, oldScope)) {
    throw new SecurityError("Scope expansion detected - possible attack");
  }
  
  return response.data;
}
```

**5. Client-Specific Vault Token Generation**

For external clients (e.g., agency's client accessing their vault):

```typescript
// Edge Function: generate-client-vault-token
export async function generateClientVaultToken(
  req: Request,
  res: Response
): Promise<void> {
  // 1. Authenticate the requester (must be vault admin)
  const { user } = await supabase.auth.getUser(req.headers.authorization);
  
  // 2. Verify user has admin rights on this vault
  const { data: membership } = await supabase
    .from('vault_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('vault_id', req.body.vault_id)
    .single();
    
  if (membership?.role !== 'admin') {
    return res.status(403).json({ error: "Admin rights required" });
  }
  
  // 3. Create custom token with vault-only access
  const token = await supabase.auth.admin.createCustomToken(
    req.body.client_user_id,
    {
      vault_ids: [req.body.vault_id],
      bank_id: req.body.bank_id,
      scope: "vault:read recordings:read",
      role: "client",
      exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
    }
  );
  
  // 4. Store token metadata for revocation
  await supabase.from('client_access_tokens').insert({
    token_jti: token.jti,
    vault_id: req.body.vault_id,
    client_user_id: req.body.client_user_id,
    created_by: user.id,
    expires_at: new Date(token.exp * 1000)
  });
  
  return res.json({ access_token: token.token, expires_at: token.exp });
}
```

**6. Revocation Checking**

```typescript
// Check token against revocation list (for client tokens)
async function isTokenRevoked(jti: string): Promise<boolean> {
  const { data } = await supabase
    .from('token_revocations')
    .select('revoked_at')
    .eq('token_jti', jti)
    .single();
    
  return data?.revoked_at != null;
}

// Use in validation pipeline
if (await isTokenRevoked(token.jti)) {
  throw new McpError(ErrorCode.InvalidRequest, "Token has been revoked");
}
```

### Multi-Tenant MCP Implementation Examples

**Cloudflare MCP Pattern (Reference):**

```typescript
// Cloudflare's set_active_account implementation
// Source: https://github.com/cloudflare/mcp-server-cloudflare

class CloudflareMCP {
  private activeAccountId?: string;
  
  async setActiveAccount(accountId: string): Promise<void> {
    // Validate account access via Cloudflare API
    const accounts = await this.api.listAccounts();
    if (!accounts.find(a => a.id === accountId)) {
      throw new Error("Account access denied");
    }
    
    this.activeAccountId = accountId;
    
    // All subsequent API calls include account_id
    this.api.setDefaultAccountId(accountId);
  }
  
  // Tool handlers automatically use active account
  async listZones(): Promise<Zone[]> {
    if (!this.activeAccountId) {
      throw new Error("No active account set");
    }
    return this.api.zones.list({ account_id: this.activeAccountId });
  }
}
```

**Notion MCP Pattern (Reference):**

From Notion's hosted MCP server (July 2025):
- Single OAuth integration per user
- Workspace context determined by user's Notion workspace membership
- No explicit workspace switching tool (workspace determined at OAuth time)
- All tools implicitly scoped to authorized workspace

**CallVault Adaptation:**

```typescript
// Hybrid approach: OAuth for auth + tool for workspace selection

// Option A: Like Cloudflare - explicit workspace selection
HANDLERS["navigation.set_active_workspace"] = setActiveWorkspace;

// Option B: Like Notion - workspace determined at OAuth time
// User re-authenticates to switch banks (simpler, but more friction)

// Recommended: Option A with Option B fallback
// - Primary: set_active_workspace for same-bank vault switching
// - Fallback: Re-authenticate for cross-bank switching
```

### Token Scope Minimization (RFC 9728)

```typescript
// Follow principle of least privilege

// BAD: Request all scopes upfront
const badScopes = "vault:read vault:write recordings:read recordings:write transcripts:read contacts:read analysis:read";

// GOOD: Start with minimal scope
const minimalScopes = "vault:read";

// GOOD: Request additional scopes via step-up authorization
// When user tries to write:
// Server returns: WWW-Authenticate: Bearer error="insufficient_scope", scope="vault:write"
// Client exchanges token with broader scope
```

### Sources

- RFC 9728: OAuth 2.0 Protected Resource Metadata (April 2025)
- RFC 8693: OAuth 2.0 Token Exchange (January 2020)
- RFC 9068: JWT Profile for OAuth 2.0 Access Tokens (October 2021)
- RFC 8707: Resource Indicators for OAuth 2.0
- RFC 7643: System for Cross-domain Identity Management (SCIM) Core Schema
- MCP Authorization Specification (draft): https://modelcontextprotocol.io/specification/draft/basic/authorization
- Cloudflare MCP Server: https://github.com/cloudflare/mcp-server-cloudflare
- Notion MCP Blog Post: https://www.notion.com/blog/notions-hosted-mcp-server-an-inside-look
- Supabase MCP Auth: https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication
