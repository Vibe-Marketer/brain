# Phase 05: MCP Workspace Support - Research

**Researched:** 2026-02-21
**Domain:** Model Context Protocol (MCP), Multi-tenancy, Connection Management
**Confidence:** HIGH

## Summary

This research investigates the "separate MCP connection per bank/workspace" pattern as an alternative to "single MCP connection with workspace switching tools." The MCP architecture natively supports multiple simultaneous client connections, making the per-bank connection pattern a natural fit.

**Primary recommendation:** Use separate MCP connections per bank/workspace. Each bank runs as an independent MCP server instance; the client maintains parallel connections and routes tool calls to the appropriate connection based on context.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @modelcontextprotocol/sdk | v1.27+ (stable) or v2.x (pre-alpha) | Official TypeScript SDK | Reference implementation, protocol-compliant |
| @modelcontextprotocol/client | v1.27+ | Client connection management | Handles connection lifecycle, auth, reconnection |
| @modelcontextprotocol/server | v1.27+ | Server implementation | Tools, resources, prompts, SSE transport |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | v4.x | Schema validation | Required peer dependency for SDK |
| @modelcontextprotocol/express | v1.x | Express middleware | HTTP server with DNS rebinding protection |
| @modelcontextprotocol/node | v1.x | Node.js HTTP wrapper | Streamable HTTP transport for Node |

### Transport Selection
| Use Case | Transport | Notes |
|----------|-----------|-------|
| Local CLI/desktop apps | STDIO | One client per server process |
| Remote/multi-tenant servers | Streamable HTTP | Server handles many concurrent clients |
| Browser-based clients | Streamable HTTP + SSE | CORS-enabled, session resumption |

## Architecture Patterns

### Pattern 1: Separate Connection Per Bank (Recommended)

**What:** Each bank/workspace runs as an independent MCP server endpoint. The client maintains one connection per active bank.

**When to use:** 
- Strong tenant isolation required
- Different banks have different tool sets
- Banks need independent authentication/authorization
- Scaling concerns favor horizontal distribution

**Example:**
```typescript
// Client maintains multiple connections
class MultiBankMCPClient {
  private connections: Map<string, Client> = new Map();
  
  async connectToBank(bankId: string, endpoint: string) {
    const client = new Client({ 
      name: 'callvault-client', 
      version: '1.0.0' 
    });
    
    const transport = new StreamableHTTPClientTransport(
      new URL(endpoint)
    );
    
    await client.connect(transport);
    this.connections.set(bankId, client);
    
    // Discover bank-specific tools
    const tools = await client.listTools();
    this.registerToolsForBank(bankId, tools);
  }
  
  async callTool(bankId: string, toolName: string, args: any) {
    const client = this.connections.get(bankId);
    if (!client) throw new Error(`Not connected to bank: ${bankId}`);
    return client.callTool({ name: toolName, arguments: args });
  }
}
```

### Pattern 2: Single Connection with Workspace Switching

**What:** One MCP server handles all banks; tools accept a `workspaceId` parameter to switch context.

**When to use:**
- Simpler client implementation
- Shared tool set across banks
- Lower connection overhead
- Centralized state management

**Trade-offs:**
- Less isolation between banks
- Tool implementations must handle workspace context
- Single point of failure

### Pattern 3: Hybrid - Gateway with Per-Bank Routing

**What:** Single client-facing endpoint that routes to bank-specific backends.

**When to use:**
- Unified client experience
- Backend isolation still desired
- Load balancing requirements

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Connection lifecycle | Custom connection management | SDK Client class | Handles reconnection, timeouts, cleanup |
| Session tracking | Manual session IDs | SDK session management | Built-in MCP-Session-Id handling |
| Tool discovery | Caching tool lists | SDK listTools() with change notifications | Server can notify of updates |
| Auth flow | Custom OAuth | SDK OAuth providers | PKCE, token refresh, dynamic registration |
| Transport layer | Raw HTTP/SSE | SDK transports | Protocol compliance, resumption, error handling |
| Schema validation | Manual JSON validation | Zod schemas | Type safety, runtime validation |

**Key insight:** The MCP SDK handles complex protocol details (version negotiation, capability discovery, notification routing) that are easy to get wrong. The "separate connection" pattern is simpler because it uses SDK primitives as-designed.

## Common Pitfalls

### Pitfall 1: Orphaned Connections
**What goes wrong:** Client disconnects but server processes remain running, consuming resources.

**Why it happens:** STDIO-based servers may not detect client disconnection; HTTP servers may keep sessions alive.

**How to avoid:**
- Always call `client.close()` or `transport.terminateSession()`
- For STDIO: SDK handles SIGTERM/SIGKILL cascade
- For HTTP: Send explicit session termination (DELETE request)

**Warning signs:** Accumulating server processes in process list; increasing memory usage over time.

### Pitfall 2: Tool Name Collisions
**What goes wrong:** Different banks expose tools with the same name; client cannot distinguish.

**Why it happens:** MCP tool names are not globally unique; each connection has its own namespace.

**How to avoid:**
- Prefix tool names with bank ID: `bank_123_search_transactions`
- Or maintain per-bank tool registries on client side
- Use structured tool registration with metadata

```typescript
// Client-side tool organization
interface BankTool {
  bankId: string;
  tool: Tool;
  client: Client;
}

// When calling, route to correct connection
async executeTool(toolName: string, args: any) {
  const bankTool = this.toolRegistry.get(toolName);
  return bankTool.client.callTool({
    name: toolTool.tool.name,
    arguments: args
  });
}
```

### Pitfall 3: Authentication Context Confusion
**What goes wrong:** Token from one bank used on another bank's connection.

**Why it happens:** Client caches tokens globally instead of per-connection.

**How to avoid:**
- Each connection has its own `authProvider`
- Store tokens per-session, not globally
- Validate token audience matches expected bank

### Pitfall 4: Resource Leak on Rapid Bank Switching
**What goes wrong:** User switches banks frequently; client accumulates connections without cleanup.

**Why it happens:** No connection pooling or TTL on inactive connections.

**How to avoid:**
- Implement connection pool with max size
- LRU eviction for inactive connections
- Or lazy-connect on first use

```typescript
class ConnectionPool {
  private pool: Map<string, PooledConnection> = new Map();
  private maxConnections = 10;
  
  async getConnection(bankId: string) {
    // Return existing if active
    if (this.pool.has(bankId)) {
      return this.pool.get(bankId)!.client;
    }
    
    // Evict oldest if at capacity
    if (this.pool.size >= this.maxConnections) {
      const oldest = this.findOldest();
      await oldest.client.close();
      this.pool.delete(oldest.bankId);
    }
    
    // Create new connection
    const client = await this.connect(bankId);
    this.pool.set(bankId, { bankId, client, lastUsed: Date.now() });
    return client;
  }
}
```

## Code Examples

### Server-Side: Multi-Tenant Bank Server

```typescript
// Each bank has its own server instance
// Could be same process (different routes) or different processes

import { McpServer } from '@modelcontextprotocol/server';

function createBankServer(bankId: string, db: Database) {
  const server = new McpServer({
    name: `callvault-bank-${bankId}`,
    version: '1.0.0'
  });
  
  // All tools automatically scoped to this bank's DB
  server.registerTool(
    'search_transactions',
    {
      description: `Search transactions in bank ${bankId}`,
      inputSchema: z.object({ query: z.string() })
    },
    async ({ query }) => {
      // DB already bound to this bank
      const results = await db.transactions.search(query);
      return { content: [{ type: 'text', text: JSON.stringify(results) }] };
    }
  );
  
  return server;
}

// Deploy one endpoint per bank
// /mcp/bank-123
// /mcp/bank-456
```

### Client-Side: Managing Multiple Connections

```typescript
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

class CallVaultMCPManager {
  private connections = new Map<string, BankConnection>();
  
  async connectToBank(bankId: string, endpoint: string) {
    // Disconnect existing if any
    await this.disconnectFromBank(bankId);
    
    const client = new Client({
      name: 'callvault-client',
      version: '1.0.0'
    }, {
      capabilities: {
        sampling: {},  // If we want servers to request LLM completions
        elicitation: { form: {} }  // If servers need user input
      }
    });
    
    const transport = new StreamableHTTPClientTransport(
      new URL(endpoint)
    );
    
    await client.connect(transport);
    
    // Discover and prefix tools
    const { tools } = await client.listTools();
    const prefixedTools = tools.map(t => ({
      ...t,
      // Prefix to avoid collisions
      name: `bank_${bankId}_${t.name}`
    }));
    
    this.connections.set(bankId, {
      client,
      transport,
      tools: prefixedTools,
      originalToolNames: new Map(prefixedTools.map((t, i) => [t.name, tools[i].name]))
    });
    
    return prefixedTools;
  }
  
  async callTool(prefixedToolName: string, args: any) {
    // Extract bank ID from tool name
    const match = prefixedToolName.match(/^bank_(\w+)_(.+)$/);
    if (!match) throw new Error(`Invalid tool name: ${prefixedToolName}`);
    
    const [, bankId, originalToolName] = match;
    const conn = this.connections.get(bankId);
    if (!conn) throw new Error(`Not connected to bank: ${bankId}`);
    
    return conn.client.callTool({
      name: originalToolName,
      arguments: args
    });
  }
  
  async disconnectFromBank(bankId: string) {
    const conn = this.connections.get(bankId);
    if (conn) {
      await conn.client.close();
      this.connections.delete(bankId);
    }
  }
  
  getAllTools(): Tool[] {
    return Array.from(this.connections.values()).flatMap(c => c.tools);
  }
}
```

### Connection with Authentication

```typescript
import { ClientCredentialsProvider } from '@modelcontextprotocol/client';

// Each bank connection has its own credentials
async function connectToBankWithAuth(bankId: string, endpoint: string, credentials: Credentials) {
  // Bank-specific auth provider
  const authProvider = new ClientCredentialsProvider({
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    // Token endpoint could be bank-specific
    tokenEndpoint: `${endpoint}/oauth/token`
  });
  
  const transport = new StreamableHTTPClientTransport(
    new URL(`${endpoint}/mcp`),
    { authProvider }
  );
  
  const client = new Client({ name: 'callvault', version: '1.0.0' });
  await client.connect(transport);
  
  return client;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HTTP+SSE transport (legacy) | Streamable HTTP (2025-11-25) | Nov 2025 | Simpler, more flexible, supports resumption |
| Sessionless connections | Stateful sessions with MCP-Session-Id | Nov 2025 | Better for multi-tenant servers |
| Single server for all users | Per-user/per-tenant server instances | Emerging | Better isolation, scaling |
| Manual auth handling | SDK OAuth providers | 2024 | Built-in PKCE, token refresh |

**Current best practices:**
- Use Streamable HTTP for remote servers
- Enable session management for multi-tenant scenarios
- Implement proper connection cleanup
- Use SDK auth providers instead of manual token management

## Comparison: Separate vs Single Connection

| Aspect | Separate Connections | Single Connection + Switching |
|--------|---------------------|------------------------------|
| **Isolation** | Strong - each bank is isolated | Weak - shared server process |
| **Auth** | Per-connection tokens | Single token, internal auth check |
| **Client complexity** | Medium - manage multiple clients | Low - single client |
| **Server complexity** | Low - one server per bank | High - must handle workspace switching |
| **Tool discovery** | Per-bank tool lists | All tools visible, params determine scope |
| **Scaling** | Horizontal - add bank servers | Vertical - scale one server |
| **Failure domain** | Isolated per bank | All banks affected |
| **Memory overhead** | Multiple connections | Single connection |

**Recommendation for CallVault:** Use separate connections per bank because:
1. Strong isolation aligns with bank data separation requirements
2. Simpler server implementation (no workspace switching logic)
3. Natural fit for MCP's multi-client architecture
4. Easier to scale individual banks independently

## Open Questions

1. **Connection Limits**
   - What is the practical limit on concurrent MCP connections per client?
   - Should implement connection pooling for users with many banks?

2. **Tool Visibility in LLM Context**
   - When user has 10 banks connected, should all 500+ tools be visible to LLM?
   - Or should we implement tool filtering based on active bank context?

3. **Shared Tools Across Banks**
   - Some tools (like "search_calls") exist for every bank
   - Should client deduplicate or present as separate tools?

4. **Cross-Bank Operations**
   - How to handle operations that span multiple banks?
   - Aggregate on client side or implement gateway server?

## Sources

### Primary (HIGH confidence)
- MCP Specification (2025-11-25) - https://modelcontextprotocol.io/specification/2025-11-25/
- MCP TypeScript SDK v1.27 - https://github.com/modelcontextprotocol/typescript-sdk
- MCP Architecture Overview - https://modelcontextprotocol.io/docs/learn/architecture

### Official Documentation
- Streamable HTTP Transport spec - https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
- Authorization spec - https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
- Client concepts - https://modelcontextprotocol.io/docs/learn/client-concepts
- Server concepts - https://modelcontextprotocol.io/docs/learn/server-concepts

### Examples
- TypeScript SDK Client Examples - https://github.com/modelcontextprotocol/typescript-sdk/tree/main/examples/client
- TypeScript SDK Server Examples - https://github.com/modelcontextprotocol/typescript-sdk/tree/main/examples/server
- Official MCP Servers - https://github.com/modelcontextprotocol/servers

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official SDK documentation
- Architecture patterns: HIGH - Based on protocol specification
- Pitfalls: MEDIUM - Some from GitHub issues/real-world reports
- Code examples: HIGH - Derived from official SDK examples

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (re-evaluate when SDK v2 releases)

## RESEARCH COMPLETE

**Phase:** 05 - MCP Workspace Support
**Confidence:** HIGH

### Key Findings

1. **MCP natively supports multiple simultaneous connections** - This is the intended architecture, not a workaround
2. **Separate connections per bank provides strongest isolation** - Each bank's data and tools are completely separate
3. **Client complexity is manageable** - SDK handles most connection management; client just needs to route calls correctly
4. **Tool name collisions are the main concern** - Use prefixing or namespacing to avoid conflicts
5. **Connection lifecycle must be managed** - Implement proper cleanup to avoid orphaned processes

### Implementation Guidance

1. Create one MCP server endpoint per bank (e.g., `/mcp/bank-{id}`)
2. Client maintains a `Map<bankId, Client>` of active connections
3. Prefix tool names with bank ID to avoid collisions
4. Implement connection pooling with LRU eviction for users with many banks
5. Use SDK auth providers for per-bank authentication

### File Created

`.planning/phases/05-mcp-workspaces/05-mcp-workspaces-RESEARCH.md`

### Ready for Planning

Research complete. Planner can now create PLAN.md files for implementing the separate MCP connection per bank/workspace pattern.
