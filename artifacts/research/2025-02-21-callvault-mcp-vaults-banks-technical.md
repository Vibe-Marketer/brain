# Technical Research: CallVault MCP Implementation for Banks/Vaults

## Strategic Summary

This research evaluates approaches for exposing CallVault's bank/vault architecture via MCP (Model Context Protocol) for AI assistants. The recommended approach is **Approach 2: Single MCP Server with Multi-Tenant Context** - a single FastMCP server using HTTP transport with bank-scoped authentication via Supabase JWT. This provides the best balance of simplicity, security, and infrastructure efficiency while matching the user's preference for per-bank organization through URL routing.

**Key tradeoff**: Each bank gets its own URL path (e.g., `/mcp/{bank-id}`), maintaining the mental model of "per-bank MCP" without the infrastructure overhead of separate deployments.

---

## Requirements

- **MCP Protocol**: Model Context Protocol - standardized way for AI assistants to access external tools/data
- **Use Case**: AI assistants (Claude, GPT, etc.) programmatically accessing vault call data
- **Data Scope**: Calls only (transcripts, summaries, metadata)
- **Client Auth**: Separate CallVault accounts per client
- **Organization**: Per-bank MCP endpoints (via URL routing)
- **Security**: Must respect bank/vault boundaries - no cross-bank access

---

## Current Architecture Context

CallVault already has a sophisticated multi-tenant architecture:

```
Banks (personal/business) → Vaults (personal/team/coach/community/client) → Calls
```

- **banks**: Top-level tenant container with type (personal/business)
- **vaults**: Collaboration containers within banks
- **bank_memberships**: Links users to banks with roles (bank_owner, bank_admin, bank_member)
- **vault_memberships**: Links users to vaults with roles (vault_owner, vault_admin, manager, member, guest)

All data (calls, folders, tags, content) is filtered by `bank_id` with RLS enforcing access.

---

## Approach 1: Per-Bank Standalone MCP Servers

**How it works**: Each bank gets its own completely separate MCP server deployment. Authentication is implicit - the server only serves one bank's data.

**Libraries/Tools**:
- Python FastMCP (`mcp[cli]`)
- Deployment: One container/function per bank on Vercel/AWS Lambda
- Database: Same Supabase instance, but each MCP server uses service role (bypasses RLS)

**Pros**:
- Complete isolation - impossible to accidentally access wrong bank
- Simple mental model for users ("my bank's MCP")
- Easy to reason about security boundaries
- Can customize per-bank if needed later

**Cons**:
- Infrastructure overhead - N MCP servers for N banks
- Cold start latency issues on serverless
- Harder to manage/deploy at scale
- Service role required (bypasses RLS - security risk if server compromised)
- No shared caching across banks

**Best when**: Few banks (<10), high security requirements, willingness to manage infrastructure

**Complexity**: L

---

## Approach 2: Single MCP Server with Multi-Tenant Context (Recommended)

**How it works**: One MCP server handles all banks. Authentication is handled by extracting bank context from the Supabase JWT. URL routing provides per-bank endpoints (e.g., `/mcp/{bank-id}`) matching user mental model.

**Libraries/Tools**:
- Python FastMCP (`mcp[cli]`) with streamable-http transport
- Supabase JWT for authentication (bank_id in claims)
- FastAPI or raw MCP HTTP for routing layer

**Pros**:
- Single deployment to manage
- Leverages existing RLS policies - security in depth
- Natural URL structure matches "per-bank" mental model
- Shared connection pooling, caching
- Can use user-level auth (not service role)
- OAuth 2.1 ready for future

**Cons**:
- More complex initial implementation
- Need to handle bank context extraction carefully
- Must ensure bank_id cannot be spoofed in requests

**Best when**: Many banks, existing Supabase infrastructure, want to minimize ops overhead

**Complexity**: M

---

## Approach 3: Extend Existing Edge Functions with MCP Capability

**How it works**: Rather than a separate MCP server, add MCP protocol support to existing Supabase Edge Functions. The Edge Functions already handle auth and RLS.

**Libraries/Tools**:
- Use MCP HTTP transport but implement in Deno/Edge Functions
- Potentially use `@modelcontextprotocol/sdk` for TypeScript

**Pros**:
- Leverages existing infrastructure completely
- Single codebase to maintain
- Edge Functions already handle auth/RLS
- No new deployment targets

**Cons**:
- MCP TypeScript SDK less mature than Python
- Edge Functions have execution time limits
- Harder to do long-running operations
- Less flexible for advanced MCP features

**Best when**: Want to minimize new infrastructure, OK with Edge Functions constraints

**Complexity**: M

---

## Approach 4: STDIO-Based Local MCP (Claude Desktop)

**How it works**: Each user runs a local MCP server that connects to CallVault API. No server-side MCP component - just a local process that authenticates via API key.

**Libraries/Tools**:
- Python FastMCP with stdio transport
- User generates API key from CallVault UI
- Local execution only

**Pros**:
- Simplest server-side implementation
- No cloud infrastructure needed
- Works with existing web app
- User controls their own MCP

**Cons**:
- Not usable for server-side AI agents
- Each user/client needs to run locally
- API key management burden
- No centralized audit log

**Best when**: Only need desktop AI assistant access, no server-side agents

**Complexity**: S

---

## Comparison

| Aspect | Approach 1 (Per-Bank) | Approach 2 (Single MT) | Approach 3 (Edge Fn) | Approach 4 (STDIO) |
|--------|----------------------|----------------------|---------------------|-------------------|
| Complexity | L | M | M | S |
| Infrastructure | N servers | 1 server | 0 new | 0 new |
| Security | RLS bypassed | RLS enforced | RLS enforced | API key |
| Scalability | Poor | Good | Limited | N/A |
| URL routing | Native | Native | Custom | N/A |
| Maintainability | Hard | Medium | Medium | Easy |
| Cloud deploy | Yes | Yes | No | No |

---

## Recommendation

**Approach 2: Single MCP Server with Multi-Tenant Context**

This approach provides:
1. The "per-bank" URL structure users want (`/mcp/{bank-id}`)
2. Leverages existing RLS for security
3. Single deployment to manage
4. Production-ready with FastMCP's HTTP transport

### Implementation Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        AI Assistant                         │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP/MCP
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   CallVault MCP Server                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  FastMCP (Python) - streamable-http transport       │   │
│  │                                                     │   │
│  │  /mcp/{bank-id}/tools - Bank-scoped endpoints      │   │
│  │                                                     │   │
│  │  Auth: JWT in Authorization header                 │   │
│  │  Bank context: from JWT claims → RLS filter        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     Supabase                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                │
│  │  Banks   │  │  Vaults   │  │  Calls    │                │
│  │  RLS:    │  │  RLS:     │  │  RLS:     │                │
│  │  is_bank │  │  is_vault │  │  bank_id  │                │
│  │  _member │  │  _member  │  │  filter   │                │
│  └──────────┘  └──────────┘  └──────────┘                │
└─────────────────────────────────────────────────────────────┘
```

### MCP Tools to Expose

```python
# Calls tools - matching user requirement for "calls only"
@mcp.tool()
async def list_calls(
    vault_id: str | None = None,
    limit: int = 20,
    offset: int = 0
) -> list[Call]:
    """List calls in user's bank/vault. Optionally filter by vault."""

@mcp.tool()
async def get_call(call_id: str) -> Call:
    """Get a specific call by ID."""

@mcp.tool()
async def search_calls(
    query: str,
    limit: int = 20
) -> list[Call]:
    """Search calls by transcript content or title."""

@mcp.tool()
async def get_call_summary(call_id: str) -> str:
    """Get AI-generated summary of a call."""
```

### Bank Context Extraction

```python
from fastmcp import FastMCP, Context
from mcp.types import TextContent
import jwt

mcp = FastMCP("CallVault", json_response=True)

def get_bank_id_from_token(auth_header: str) -> str:
    """Extract bank_id from JWT claims."""
    token = auth_header.replace("Bearer ", "")
    # Decode without verification (transport layer verified)
    payload = jwt.decode(token, options={"verify_signature": False})
    return payload.get("bank_id")

@mcp.tool()
async def list_calls(
    vault_id: str | None = None,
    limit: int = 20,
    ctx: Context
) -> list[Call]:
    """List calls - automatically scoped to requester's bank."""
    # Get bank_id from the authenticated request
    auth_header = ctx.request_context.request.headers.get("authorization")
    bank_id = get_bank_id_from_token(auth_header)
    
    # Query with bank_id filter - RLS will also enforce
    calls = await db.calls.filter(
        bank_id=bank_id,
        vault_id=vault_id
    ).limit(limit)
    return calls
```

---

## Implementation Plan

### Phase 1: Core Infrastructure
1. Create new Python project for MCP server
2. Set up FastMCP with streamable-http transport
3. Implement JWT validation for bank context
4. Create bank-scoped routing (`/mcp/{bank_id}/...`)

### Phase 2: Tool Implementation
1. Implement `list_calls` tool with bank filtering
2. Implement `get_call` tool
3. Implement `search_calls` tool
4. Add transcript access

### Phase 3: Deployment & Client Config
1. Deploy to Vercel or cloud provider
2. Create MCP connection UI in CallVault (show bank-specific URL)
3. Document client configuration

### Phase 4: Advanced Features (Future)
1. Add vault-level filtering
2. Implement OAuth 2.1 flow
3. Add rate limiting per bank

---

## Installation & Setup

```bash
# Create project
uv init callvault-mcp
cd callvault-mcp

# Install dependencies
uv add "mcp[cli]" supabase pyjwt fastapi

# Or use requirements.txt
echo "mcp[cli]
supabase
pyjwt
fastapi" > requirements.txt
```

### Minimal Server Example

```python
# server.py
from fastmcp import FastMCP
import jwt
from supabase import create_client

mcp = FastMCP("CallVault")

SUPABASE_URL = "https://xxx.supabase.co"
SUPABASE_KEY = "service-role-key"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_bank_id(token: str) -> str:
    payload = jwt.decode(token, options={"verify_signature": False})
    return payload.get("bank_id")

@mcp.tool()
def list_calls(bank_id: str, vault_id: str = None, limit: int = 20):
    query = supabase.table("calls").select("*").eq("bank_id", bank_id)
    if vault_id:
        query = query.eq("vault_id", vault_id)
    return query.limit(limit).execute().data

@mcp.tool()
def get_call(call_id: str, bank_id: str):
    return supabase.table("calls").select("*").eq("id", call_id).eq("bank_id", bank_id).execute().data

if __name__ == "__main__":
    mcp.run(transport="streamable-http", host="0.0.0.0", port=8000)
```

---

## Security Considerations

1. **JWT Validation**: Validate JWT signature in middleware, not just decode
2. **Bank ID Trust**: Bank ID must come from JWT claims, not request params
3. **RLS Layer**: Keep RLS as defense in depth - don't bypass it
4. **Rate Limiting**: Implement per-bank rate limits to prevent abuse
5. **Audit Logging**: Log all MCP tool calls for compliance
6. **Input Validation**: Validate all tool inputs (call_id format, etc.)

---

## Sources

- Model Context Protocol Official: https://modelcontextprotocol.io
- Python SDK (FastMCP): https://github.com/modelcontextprotocol/python-sdk
- MCP Specification: https://modelcontextprotocol.io/specification/latest
- FastMCP Documentation: https://modelcontextprotocol.github.io/python-sdk/
