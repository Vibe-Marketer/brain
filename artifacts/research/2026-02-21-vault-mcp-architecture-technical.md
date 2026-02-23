# Technical Research: MCP Vault/Bank Architecture for CallVault

**Date:** 2026-02-21  
**Status:** Complete  
**Topic:** Multi-tenant MCP implementation for business/personal banks with client vault access

---

## Strategic Summary

CallVault needs to solve two problems simultaneously: (1) the MCP data gap where new schema has only ~5% of calls, and (2) architecting proper vault/bank scoping for both internal users and external clients. The optimal approach is a **hybrid architecture** combining: (1) **Separate MCP connections per bank** for strong isolation and simple mental models, (2) **Token-scoped vault access** via JWT claims for client access control, and (3) **Workspace switching tools** within connections for vault navigation. This provides strong bank-level isolation while enabling flexible vault-scoped access for clients, all using existing Supabase OAuth 2.1 infrastructure.

**Key tradeoff:** Separate connections provide stronger isolation but require clients to manage multiple MCP configurations. This is acceptable for CallVault's use case where users typically have 2-3 banks (personal + 1-2 business), not dozens.

---

## Requirements

- **Must use existing Supabase OAuth 2.1** infrastructure (no custom auth servers)
- **Support both internal team and client MCP access** patterns equally
- **Business vs personal bank separation** via separate MCP connections
- **Vault-level scoping** for client access control
- **Fix MCP data gap** where only ~5% of calls are visible in new schema
- **Production-ready** within 2-4 weeks
- **Maintainable** long-term architecture

---

## Approach 1: Separate MCP Connection Per Bank (Recommended Primary)

**How it works:** Each bank (personal + each business bank) exposes its own MCP server endpoint. Users configure separate MCP connections for each bank in their client (e.g., `callvault-personal`, `callvault-business-acme`). Each connection is authenticated independently and only sees that bank's data.

**Libraries/tools:**
- `@modelcontextprotocol/sdk` v1.27+ (official TypeScript SDK)
- `@modelcontextprotocol/client` v1.27+ (connection management)
- `jose` v5.x (JWT validation in Cloudflare Worker)
- Cloudflare Workers (hosting separate endpoints)
- Supabase OAuth 2.1 (existing auth infrastructure)

**Pros:**
- **Strong isolation** - Each bank is completely separate; no risk of cross-bank data leakage
- **Simple mental model** - Users explicitly choose which bank they're operating in
- **Natural MCP pattern** - MCP SDK designed for multiple simultaneous connections
- **Easy client scoping** - Generate vault-scoped tokens for specific bank+vault combinations
- **Simpler server implementation** - No workspace switching logic needed in handlers
- **Horizontal scaling** - Each bank can scale independently

**Cons:**
- **Client configuration overhead** - Users must configure N MCP connections for N banks
- **Tool name collisions** - Need to prefix tools with bank ID or manage per-connection tool registries
- **Connection management** - Must properly handle connection lifecycle (cleanup, pooling)
- **Cross-bank operations difficult** - Requires client-side aggregation or separate gateway
- **Discovery complexity** - Clients need to know available banks before connecting

**Best when:** Users have few banks (2-4), strong isolation is critical, and client configuration overhead is acceptable. Perfect for CallVault where typical user has personal + 1-2 business banks.

**Complexity:** Medium

---

## Approach 2: Single Connection with Workspace Switching

**How it works:** One MCP server handles all banks. After authentication, users call a `navigation.set_active_workspace` tool to switch between banks/vaults. All subsequent operations use the active workspace context.

**Libraries/tools:**
- Same as Approach 1 (`@modelcontextprotocol/sdk`, `jose`, Cloudflare Workers)
- Additional: Session state management (Durable Objects or KV for Cloudflare)

**Pros:**
- **Simpler client configuration** - One MCP connection covers all banks
- **Unified tool namespace** - No tool name collisions across banks
- **Easy cross-bank operations** - Server can query across all user's banks
- **Familiar pattern** - Similar to Cloudflare MCP's `set_active_account`

**Cons:**
- **Weaker isolation** - Single server process has access to all banks; bug could leak data
- **Complex server implementation** - Every handler must check active workspace context
- **Session management overhead** - Must track active workspace per session
- **Harder client scoping** - Vault-scoped tokens require additional token exchange complexity
- **Single point of failure** - One server outage affects all banks
- **Scaling limitations** - Must scale monolithically

**Best when:** Users have many banks (5+), client configuration simplicity is paramount, and cross-bank queries are common. Less suitable for CallVault's typical 2-3 bank scenario.

**Complexity:** High

---

## Approach 3: Unified Query Layer + Workspace-Aware MCP

**How it works:** Two-phase approach addressing the immediate data gap while building toward proper architecture. Phase 1: Create unified RPC function that queries BOTH legacy `fathom_calls` and new `recordings`/`vault_entries` with deduplication. Phase 2: Add workspace selection tools and vault-scoped tokens on top of this unified layer.

**Libraries/tools:**
- Supabase RPC functions (PostgreSQL)
- Same MCP stack as above
- Token exchange implementation (RFC 8693)

**Pros:**
- **Fixes data gap immediately** - MCP sees all calls within 1-2 days
- **Clear migration path** - Bridge pattern with explicit deprecation plan
- **Follows proven patterns** - Cloudflare's `set_active_account`, Notion's OAuth scoping
- **Enables client access** - Vault-scoped tokens for external users
- **Preserves all data** - UNION query ensures no field loss
- **Incremental implementation** - Can ship Phase 1 while designing Phase 2

**Cons:**
- **Temporary complexity** - Unified RPC function will be deprecated after migration
- **Dual-schema maintenance** - Must maintain both old and new query paths during transition
- **Performance overhead** - UNION queries slightly slower than single-table queries
- **No strong bank isolation** - Single server instance (though workspace-scoped)

**Best when:** You need to fix the MCP data gap immediately while architecting for future multi-tenant access. This is the pragmatic choice for CallVault's current state.

**Complexity:** Medium (Phase 1) to High (Phase 2)

---

## Approach 4: Token-Scoped Vault Access with Instance-Per-Tenant

**How it works:** Hybrid approach where each bank has separate MCP endpoint (like Approach 1), but external clients receive vault-scoped JWT tokens that limit access to specific vaults within a bank. Internal users use full bank-scoped tokens.

**Libraries/tools:**
- All tools from Approach 1
- Supabase `auth.admin.createCustomToken()` for vault-scoped tokens
- RFC 8693 Token Exchange (if Supabase supports it)
- Custom Edge Function for token generation

**Pros:**
- **Strongest isolation** - Bank-level (separate connections) + vault-level (token scoping)
- **Client-friendly** - External users get just the vaults they need
- **Flexible access control** - Can generate tokens with varying scopes (read-only, time-limited, etc.)
- **Audit-friendly** - Each token has unique JTI for tracking and revocation
- **Compatible with existing auth** - Works with Supabase OAuth 2.1

**Cons:**
- **Most complex implementation** - Requires token exchange logic and custom claims
- **Token lifecycle management** - Must handle refresh, revocation, expiration
- **RLS policy complexity** - Database policies must check vault_ids claims
- **Documentation overhead** - Clients need clear instructions for token usage

**Best when:** You need both strong bank isolation AND fine-grained vault access control for external clients. This is the most complete solution for CallVault's requirements.

**Complexity:** High

---

## Comparison

| Aspect | Approach 1: Separate Connections | Approach 2: Workspace Switching | Approach 3: Unified Query | Approach 4: Token-Scoped |
|--------|----------------------------------|----------------------------------|---------------------------|--------------------------|
| **Isolation** | Strong | Weak | Medium | Strongest |
| **Implementation** | Medium | High | Medium | High |
| **Client Config** | Multiple connections | Single connection | Single connection | Multiple connections |
| **Data Gap Fix Speed** | Moderate (need migration) | Moderate | Fast (1-2 days) | Moderate |
| **Client Access Support** | Good | Moderate | Excellent | Excellent |
| **Cross-Bank Queries** | Hard | Easy | Medium | Hard |
| **Scaling** | Horizontal | Vertical | Vertical | Horizontal |
| **MCP Spec Alignment** | Excellent | Good | Excellent | Excellent |
| **Long-term maintainability** | Good | Moderate | Good (post-migration) | Good |

---

## Recommendation

**Primary Recommendation: Hybrid of Approach 1 + Approach 3**

Deploy **separate MCP connections per bank** (Approach 1) for strong isolation and simple mental models, but implement the **unified query layer** (Approach 3 Phase 1) first to fix the immediate data gap. Then add **vault-scoped token support** (Approach 4 elements) for client access.

### Why This Hybrid:

1. **Fixes data gap in 1-2 days** - Unified RPC function unblocks MCP immediately
2. **Strong bank isolation** - Separate connections prevent cross-bank leakage
3. **Client-ready** - Vault-scoped tokens enable external client access
4. **Follows existing patterns** - Cloudflare MCP uses separate connections; Notion uses OAuth scoping
5. **Maintainable** - Clean separation of concerns; migration path is explicit

### Implementation Sequence:

**Week 1: Data Gap Fix (Unified Query)**
- Create `get_unified_recordings()` RPC function
- Update MCP handlers to use unified queries
- Deploy to production

**Week 2-3: Separate Bank Connections**
- Deploy MCP server with bank-specific endpoints (`/mcp/bank-{id}`)
- Update client configuration docs
- Add bank discovery endpoint

**Week 4: Client Vault Scoping**
- Implement vault-scoped token generation Edge Function
- Add RLS policies for vault_ids claims
- Create client onboarding documentation

---

## Implementation Context

<claude_context>
<chosen_approach>
- name: Hybrid - Separate Bank Connections + Unified Query + Vault Scoping
- libraries: 
  - @modelcontextprotocol/sdk@1.27.0
  - @modelcontextprotocol/client@1.27.0
  - jose@5.2.0
  - @supabase/supabase-js@2.39.0
- install: npm install @modelcontextprotocol/sdk@1.27.0 @modelcontextprotocol/client@1.27.0 jose@5.2.0
</chosen_approach>
<architecture>
- pattern: Multi-endpoint MCP with JWT-scoped access
- components:
  1. Unified RPC function (Phase 1)
  2. Bank-specific MCP endpoints (e.g., /mcp/bank-{id})
  3. Vault-scoped token generator Edge Function
  4. RLS policies with vault_ids claims
  5. Client connection manager with tool prefixing
- data_flow:
  1. Client authenticates via Supabase OAuth 2.1
  2. Client connects to specific bank endpoint
  3. Server validates JWT + checks bank membership
  4. Tools query unified RPC or specific vault based on token claims
  5. For client access: exchange for vault-scoped token first
</architecture>
<files>
- create:
  - supabase/migrations/20260221_unified_recordings_rpc.sql
  - supabase/functions/generate-vault-token/index.ts
  - mcp-server/src/handlers/bank-scoped.ts
  - mcp-server/src/middleware/vault-auth.ts
  - docs/mcp-client-setup.md
- structure:
  - mcp-server/src/endpoints/bank-{id}.ts (per-bank endpoints)
  - mcp-server/src/shared/handlers.ts (common tool implementations)
  - mcp-server/src/auth/token-exchange.ts (vault scoping)
- reference:
  - Cloudflare MCP pattern: https://github.com/cloudflare/mcp-server-cloudflare
  - Existing CallVault MCP: .planning/codebase/MCP_ANALYSIS.md
  - Vault scoping research: .planning/phases/12-deploy-callvault-mcp-as-remote-cloudflare-worker-with-supabase-oauth-2-1/12-RESEARCH.md
</files>
<implementation>
- start_with: Create unified RPC function to fix data gap
- order:
  1. Create get_unified_recordings() SQL function
  2. Update MCP handlers to use RPC
  3. Deploy separate bank endpoints
  4. Implement vault token generation
  5. Add RLS policies
  6. Create client documentation
- gotchas:
  - UNION query must deduplicate migrated records (use NOT EXISTS)
  - Tool names must be prefixed with bank ID to avoid collisions
  - Token audience validation required for security
  - Connection cleanup critical to avoid orphaned sessions
  - Vault-scoped tokens need shorter expiration (24-48 hours)
- testing:
  - Compare RPC output vs dashboard for same user
  - Test cross-bank isolation (shouldn't see other bank's data)
  - Test vault-scoped tokens (should only see specified vaults)
  - Test token expiration and refresh
  - Load test with 1000+ calls per user
</implementation>
</claude_context>

**Next Action:** Begin Phase 1 by creating the unified RPC function to fix the immediate MCP data gap.

---

## Sources

### MCP Specification & SDK
- MCP Specification 2025-11-25: https://modelcontextprotocol.io/specification/2025-11-25/
- MCP TypeScript SDK v1.27: https://github.com/modelcontextprotocol/typescript-sdk
- MCP Architecture Overview: https://modelcontextprotocol.io/docs/learn/architecture
- MCP Authorization Spec (draft): https://modelcontextprotocol.io/specification/draft/basic/authorization

### Multi-Tenant Patterns
- Cloudflare MCP (set_active_account pattern): https://github.com/cloudflare/mcp-server-cloudflare
- Notion Hosted MCP: https://www.notion.com/blog/notions-hosted-mcp-server-an-inside-look
- SageMCP multi-tenant platform: https://github.com/sagemcp/sagemcp
- AWS Multi-Tenant MCP Sample: https://github.com/aws-samples/sample-multi-tenant-saas-mcp-server

### Authentication Standards
- RFC 8693 (Token Exchange): https://tools.ietf.org/html/rfc8693
- RFC 9068 (JWT Profile for OAuth): https://tools.ietf.org/html/rfc9068
- RFC 9728 (Protected Resource Metadata): https://tools.ietf.org/html/rfc9728
- RFC 7643 (SCIM Core Schema): https://tools.ietf.org/html/rfc7643

### CallVault Internal Research
- MCP Workspaces Research: .planning/phases/05-mcp-workspaces/05-mcp-workspaces-RESEARCH.md
- Vault MCP Architecture Options: artifacts/research/2026-02-21-vault-mcp-architecture-options.md
- Cloudflare Worker Deployment Research: .planning/phases/12-deploy-callvault-mcp-as-remote-cloudflare-worker-with-supabase-oauth-2-1/12-RESEARCH.md
- MCP Analysis: .planning/codebase/MCP_ANALYSIS.md

### Date Accessed
All sources accessed 2026-02-21

---

**Research Complete.** Ready to proceed with Phase 1 implementation (unified RPC function) or dive deeper into any specific approach.
