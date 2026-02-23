# CallVault MCP Implementation Analysis

**Analysis Date:** 2026-02-21
**Source:** `/Users/Naegele/Developer/mcp/callvault-mcp/`

---

## Executive Summary

The CallVault MCP implementation consists of **dual deployment modes**:
1. **Local stdio mode** (`src/index.ts`) - Runs as subprocess via Claude Desktop/Code
2. **Cloudflare Worker mode** (`src/worker.ts`) - Remote MCP server with HTTP transport

The codebase has been **fully refactored** to support both modes with shared business logic, and the Worker implementation is **production-ready** pending Supabase OAuth 2.1 configuration.

---

## Current Implementation State

### What's Working

#### 1. Dual-Mode Architecture ✅
| Mode | Entry Point | Status | Notes |
|------|-------------|--------|-------|
| **Local stdio** | `src/index.ts` | Working | Uses filesystem auth, StdioServerTransport |
| **Cloudflare Worker** | `src/worker.ts` | Working | Uses JWT validation, StreamableHTTP transport |

Both modes share:
- All handler logic (`src/handlers/*.ts`)
- Operations catalog (`src/operations.json`)
- Prompt templates (`src/prompts.ts`)
- Utility functions (`src/utils.ts`)

#### 2. Authentication Flows

**Local Mode (`src/auth.ts`):**
- Uses filesystem-based session storage (`~/.callvault-mcp/session.json`)
- Runs local HTTP server via `authorize.ts` for OAuth callback
- Session refresh handled automatically
- Requires manual `npm run authorize` before use

**Worker Mode (`src/auth-middleware.ts`):**
- Stateless JWT validation via Supabase JWKS endpoint
- Bearer token extracted from `Authorization` header
- Uses `jose` library with `createRemoteJWKSet` for validation
- Supports both `aud: 'authenticated'` and any audience (OAuth tokens)
- No session storage required

#### 3. MCP Protocol Support

**Tools (4 meta-tools):**
- `callvault_discover` - Browse available operations
- `callvault_get_schema` - Get parameter details
- `callvault_execute` - Run operations
- `callvault_continue` - Pagination (now cursor-based)

**Resources:**
- Operations index and per-category schemas exposed as resources
- URI pattern: `callvault://operations/{category}/{operation}`

**Prompts (5 templates):**
- `call_analysis` - Single call deep-dive
- `meeting_prep` - Pre-meeting research
- `weekly_digest` - Week summary
- `action_items` - Extract todos
- `sales_pipeline` - Deal tracking

#### 4. Data Access Patterns

**16 Operations Across 6 Categories:**

| Category | Operations | Tables Queried |
|----------|-----------|----------------|
| `navigation` | list_banks, list_vaults, list_folders, list_tags | `bank_memberships`, `banks`, `vault_memberships`, `vaults`, `folders`, `call_tags` |
| `recordings` | search, get, list | `vault_entries`, `recordings`, `fathom_calls`, `fathom_transcripts` |
| `transcripts` | raw, structured, timestamped | `recordings`, `fathom_calls`, `fathom_transcripts` |
| `search` | semantic | Calls Supabase Edge Function `semantic-search` |
| `contacts` | list, history, attendees | `contacts`, `contact_call_appearances`, `fathom_calls`, `fathom_transcripts` |
| `analysis` | compare, track_speaker | `recordings`, `fathom_calls`, `fathom_transcripts` |

**Key Query Patterns:**
```typescript
// RLS-protected queries via supabase-js
const { data, error } = await supabase
  .from("table_name")
  .select("...")
  .eq("user_id", userId)  // RLS enforced
  .order("created_at", { ascending: false })
  .range(offset, offset + limit - 1);
```

**Dual-Schema Fallback:**
All recording lookups try `recordings` table first, then fall back to `fathom_calls`:
```typescript
// Try new recordings table
const { data: recording } = await supabase
  .from("recordings")
  .select("...")
  .eq("id", id)
  .maybeSingle();

if (recording) return recording;

// Fall back to legacy fathom_calls
const { data: call } = await supabase
  .from("fathom_calls")
  .select("...")
  .eq("recording_id", parseInt(id))
  .maybeSingle();
```

#### 5. Request Context Threading

All handlers receive `RequestContext`:
```typescript
interface RequestContext {
  supabase: SupabaseClient;  // Per-request client with user's JWT
  userId: string;            // From validated JWT sub claim
}
```

Passed through:
`worker.ts` → `createMcpServer()` → `executeOperation()` → handlers

#### 6. Pagination Strategy

**Cursor-based pagination** (replaced in-memory sessionsCache):
```typescript
// Response format
{
  items: [...],
  total: N,
  offset: 0,
  limit: 50,
  has_more: true,
  next_offset: 50  // Client uses this for next request
}
```

`callvault_continue` preserved as compatibility wrapper returning migration message.

#### 7. CORS Configuration

Worker implements full CORS for browser clients:
```typescript
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Accept, Authorization, Mcp-Session-Id, Last-Event-ID, MCP-Protocol-Version
Access-Control-Expose-Headers: Content-Type, Authorization, Mcp-Session-Id
Access-Control-Max-Age: 86400
```

---

## Current Limitations & Gaps

### 1. Supabase OAuth 2.1 Not Fully Configured ⚠️

**Status:** Worker validates JWTs, but OAuth 2.1 flow requires Supabase dashboard configuration:

**Missing Configuration:**
- [ ] Enable "OAuth Server" in Supabase Dashboard (Authentication > OAuth Server)
- [ ] Enable Dynamic Client Registration
- [ ] Switch JWT signing from HS256 to RS256 (Authentication > Signing Keys)
- [ ] Build `/oauth/consent` page in CallVault frontend
- [ ] Allowlist OAuth callback URLs for Claude and ChatGPT

**Impact:** MCP clients can connect with manually-provisioned tokens, but cannot use automatic OAuth discovery flow.

### 2. No Multi-Bank Context Handling

**Current Behavior:**
- All queries are user-scoped via `user_id = current_user`
- RLS policies enforce data isolation
- No explicit bank-level filtering in most queries

**Gap:** If a user belongs to multiple banks, the MCP server returns data from all banks. There's no `bank_id` parameter on most operations.

### 3. Limited Workspace Scoping

**Vault-level filtering available:**
- `recordings.search`, `recordings.list` require `vault_id`

**Missing bank-level filtering:**
- `contacts.list` - returns all contacts for user (no bank filter)
- `search.semantic` - returns all results for user (no bank filter)

### 4. Session State Not Persisted

**Worker uses stateless mode** (`sessionIdGenerator: undefined`):
- Each request creates fresh McpServer instance
- No session continuity across requests
- Pagination via cursor, not session

**Trade-off:** Simpler deployment (no KV needed), but no MCP session resumption.

### 5. No MCP OAuth Auto-Discovery Endpoints

**Current implementation returns static resource metadata:**
```typescript
// GET /.well-known/oauth-protected-resource
{
  resource: origin,
  authorization_servers: [`${env.SUPABASE_URL}/auth/v1`],
  scopes_supported: ["openid", "email"]
}
```

**Gap:** Full OAuth discovery requires Supabase to serve `/.well-known/oauth-authorization-server` which it does, but this hasn't been tested end-to-end with Claude/ChatGPT.

---

## File-by-File Architecture

### Entry Points

| File | Mode | Purpose |
|------|------|---------|
| `src/index.ts` | stdio | Local MCP server with StdioServerTransport |
| `src/worker.ts` | Worker | Cloudflare Worker with StreamableHTTP transport |
| `authorize.ts` | CLI | Standalone OAuth flow for local mode |

### Shared Modules

| File | Purpose | Portable? |
|------|---------|-----------|
| `src/handlers/index.ts` | Operation router | Yes |
| `src/handlers/navigation.ts` | Bank/vault/folder queries | Yes |
| `src/handlers/recordings.ts` | Recording search/get/list | Yes |
| `src/handlers/transcripts.ts` | Transcript formatting | Yes |
| `src/handlers/search.ts` | Semantic search via Edge Function | Yes |
| `src/handlers/contacts.ts` | Contact management | Yes |
| `src/handlers/analysis.ts` | Cross-recording analysis | Yes |
| `src/prompts.ts` | Prompt templates | Yes |
| `src/operations.json` | Operation catalog | Yes |
| `src/utils.ts` | Logging, pagination, field projection | Yes (console-based logging) |
| `src/types.ts` | TypeScript types | Yes |

### Mode-Specific Modules

| File | Mode | Purpose |
|------|------|---------|
| `src/auth.ts` | stdio | Filesystem session storage |
| `src/auth-middleware.ts` | Worker | JWT validation via JWKS |
| `src/supabase.ts` | Both | Client factory for both modes |

---

## Deployment Configuration

### Wrangler Configuration (`wrangler.jsonc`)

```jsonc
{
  "name": "callvault-mcp",
  "main": "src/worker.ts",
  "compatibility_date": "2025-03-10",
  "compatibility_flags": ["nodejs_compat"],
  "workers_dev": true,
  "routes": [
    { "pattern": "mcp.callvaultai.com", "custom_domain": true }
  ],
  "vars": {
    "ENVIRONMENT": "production",
    "MCP_SERVER_NAME": "callvault-mcp",
    "MCP_SERVER_VERSION": "1.0.0"
  }
  // Secrets set via: wrangler secret put SUPABASE_URL
  //                  wrangler secret put SUPABASE_ANON_KEY
}
```

**Notable:** No Durable Objects, no KV - using stateless pattern.

### Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@modelcontextprotocol/sdk` | ^1.12.1 | MCP protocol implementation |
| `@supabase/supabase-js` | ^2.49.4 | Supabase client |
| `agents` | ^0.1 | Cloudflare Agents SDK (McpAgent, createMcpHandler) |
| `jose` | ^6 | JWT validation |
| `zod` | ^3.24.0 | Schema validation |

---

## Security Analysis

### Authentication

**Local Mode:**
- Session tokens stored in `~/.callvault-mcp/session.json` with `chmod 600`
- Tokens auto-refresh via Supabase
- Never exposed to Claude

**Worker Mode:**
- JWTs validated via Supabase JWKS (RS256)
- No token storage in Worker
- Each request validates token independently
- RLS enforces data isolation

### Authorization

**RLS Policies Required:**
All queries use `.eq("user_id", userId)` which relies on Supabase RLS:
```sql
-- Example RLS policy
CREATE POLICY "users_own_data" ON recordings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);
```

### Data Flow

```
User → MCP Client (Claude/ChatGPT)
  → POST /mcp with Bearer token
  → Worker validates JWT via JWKS
  → Worker creates Supabase client with user's token
  → Supabase applies RLS
  → Returns user-scoped data
```

---

## Testing Status

| Component | Test Status | Notes |
|-----------|-------------|-------|
| stdio mode | Working | Tested with Claude Desktop |
| Worker local dev | Working | `wrangler dev` functional |
| JWT validation | Working | Validates against Supabase JWKS |
| CORS | Configured | Needs browser testing |
| OAuth flow | Not tested | Requires Supabase OAuth 2.1 enablement |
| MCP Inspector | Not tested | Should work with bearer token |

---

## Recommendations

### Immediate (Pre-Launch)

1. **Enable Supabase OAuth 2.1 Server**
   - Authentication > OAuth Server → Enable
   - Enable Dynamic Client Registration
   - Set Authorization Path to `/oauth/consent`

2. **Switch to RS256 Signing**
   - Authentication > Signing Keys → Generate asymmetric key
   - Activate new key

3. **Build `/oauth/consent` Page**
   - React route in CallVault frontend
   - Use `supabase.auth.oauth.getAuthorizationDetails()`
   - Use `supabase.auth.oauth.approveAuthorization()`

4. **Allowlist OAuth Callbacks**
   - `https://claude.ai/api/mcp/auth_callback`
   - `https://claude.com/api/mcp/auth_callback`
   - `https://chatgpt.com/connector_platform_oauth_redirect`

### Post-Launch

1. **Add Bank-Level Filtering**
   - Add optional `bank_id` parameter to relevant operations
   - Filter queries by bank membership

2. **Implement KV-Backed Sessions (Optional)**
   - For session continuity across Worker invocations
   - Requires KV namespace and `sessionIdGenerator`

3. **Add Rate Limiting**
   - Cloudflare Rate Limiting rules
   - Per-user limits via Supabase

4. **Enhanced Logging**
   - Structured logging to external service
   - Request/response tracing

---

## Architecture Comparison: Current vs Target

| Aspect | Current (stdio) | Current (Worker) | Target (Remote MCP) |
|--------|-----------------|------------------|---------------------|
| **Transport** | StdioServerTransport | StreamableHTTP | StreamableHTTP ✅ |
| **Auth** | Filesystem session | JWT validation | Supabase OAuth 2.1 |
| **Session** | Long-lived process | Stateless per-request | Stateless ✅ |
| **Discovery** | N/A | Manual | OAuth auto-discovery |
| **Deployment** | npm package | Cloudflare Worker | Cloudflare Worker ✅ |
| **Pagination** | In-memory cache | Cursor-based | Cursor-based ✅ |

---

## Summary

The CallVault MCP implementation is **architecturally complete** for both local and remote deployment modes. The Worker implementation follows Cloudflare best practices with stateless JWT validation and cursor-based pagination.

**Primary blocker:** Supabase OAuth 2.1 configuration and `/oauth/consent` page implementation.

**Code quality:** High - clean separation of concerns, shared business logic, proper TypeScript typing, comprehensive CORS handling.

---

*Analysis completed: 2026-02-21*
