# Research: Deploying a Remote MCP Server on Cloudflare Workers

**Researched:** 2026-02-19
**Domain:** Cloudflare Workers + Agents SDK + MCP (Model Context Protocol)
**Confidence:** HIGH (verified against official Cloudflare docs and first-party examples)

---

## Summary

Cloudflare provides two distinct patterns for hosting remote MCP servers on Workers: the **stateful `McpAgent` class** (backed by Durable Objects) and the **stateless `createMcpHandler` function**. Both live in the `agents/mcp` package (part of the `agents` npm package). The `McpAgent` approach is the primary pattern in all Cloudflare docs and examples — it handles Streamable HTTP transport automatically, manages Durable Object lifecycle, and exposes user identity through `this.props` when OAuth is wired up.

The **Streamable HTTP transport** replaced SSE as of March 2025. It uses a single HTTP endpoint (`/mcp` by convention) for bidirectional messaging. SSE is deprecated but still works for legacy clients. Workers memory and CPU limits apply per-request; the Durable Object model means each MCP session gets its own isolated SQLite-backed instance, so you do not share state across clients.

**Primary recommendation:** Use `McpAgent` with `MyMCP.serve("/mcp")` as the Worker entry point. Wire `OAuthProvider` from `@cloudflare/workers-oauth-provider` around it when you need auth. For a custom Bearer-token-only flow (no interactive OAuth), use `createMcpHandler` with a manual auth check in the `fetch` handler before delegating to the handler.

---

## 1. Cloudflare Agents SDK — Import Paths and Core Classes

### Packages

| Package | Install | Purpose |
|---------|---------|---------|
| `agents` | `npm i agents` | Cloudflare Agents SDK — exports `McpAgent`, `Agent`, `context`, `routeAgentRequest` |
| `agents/mcp` | (sub-path of `agents`) | Exports `McpAgent`, `createMcpHandler`, `getMcpAuthContext` |
| `@modelcontextprotocol/sdk` | `npm i @modelcontextprotocol/sdk` | MCP specification SDK — exports `McpServer`, types |
| `@cloudflare/workers-oauth-provider` | `npm i @cloudflare/workers-oauth-provider` | OAuth 2.1 Provider library for Workers |
| `zod` | `npm i zod` | Schema validation for tool parameters |

**Confidence: HIGH** — Verified from official Cloudflare blog post code examples and changelog.

### Import Paths (as of 2025-04-07 changelog and later)

```typescript
// From the agents sub-path (confirmed correct)
import { McpAgent } from "agents/mcp";
import { createMcpHandler, getMcpAuthContext } from "agents/mcp";

// MCP SDK
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Zod for tool schemas
import { z } from "zod";

// OAuth (when using OAuth flow)
import OAuthProvider from "@cloudflare/workers-oauth-provider";
```

Note: An older changelog entry showed `import { MCPAgent } from "agents"` (from the root `agents` package), but the canonical import seen in all Cloudflare's own MCP server repositories is `from "agents/mcp"`. Use `agents/mcp`.

---

## 2. McpAgent Class — Stateful Pattern

### Class Structure

`McpAgent` extends `Agent` (which is backed by a Durable Object). Each MCP client session gets its own DO instance with persistent SQLite storage.

**Type signature:**
```typescript
class McpAgent<Env = unknown, State = unknown, Props = unknown> extends Agent
```

### Minimal Working Example

```typescript
// src/index.ts
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export class MyMCP extends McpAgent {
  server = new McpServer({
    name: "Demo",
    version: "1.0.0",
  });

  async init() {
    this.server.tool(
      "add",
      { a: z.number(), b: z.number() },
      async ({ a, b }) => ({
        content: [{ type: "text", text: String(a + b) }],
      })
    );
  }
}

// Worker entry point — creates Streamable HTTP handler automatically
export default MyMCP.serve("/mcp");
```

Source: [Cloudflare Blog — Build and deploy Remote MCP servers](https://blog.cloudflare.com/remote-model-context-protocol-servers-mcp/)

### Key Properties and Methods

| Member | Type | Description |
|--------|------|-------------|
| `server` | `McpServer` | The MCP server instance — register tools/resources here |
| `state` | `State` | Current persisted state (Durable Object storage) |
| `initialState` | `State` | Default state on first instantiation |
| `props` | `Props` | User identity and tokens injected at session start (from OAuth) |
| `init()` | `async (): Promise<void>` | Called once per session — register all tools here |
| `setState(s)` | `(state: State): void` | Update and persist state |
| `onStateChanged(s)` | `(state: State): void` | Hook — called after every state change |
| `elicitInput(opts, ctx)` | `async` | Request structured input from the user mid-tool |
| `sql` | SQL accessor | Run queries on embedded SQLite DB |

### Static Methods (Worker Entry Points)

```typescript
// Simple: serve Streamable HTTP at a path
export default MyMCP.serve("/mcp");

// With options (e.g. data residency jurisdiction)
export default MyMCP.serve("/mcp", { jurisdiction: "eu" });

// Mount — alternative alias for serve
export default MyMCP.mount("/mcp");

// Router property — for use inside OAuthProvider
MyMCP.Router  // used as apiHandler in OAuthProvider
```

The `serve()` / `mount()` methods return a standard Workers `ExportedHandler` object with `fetch`, `webSocketMessage`, `webSocketClose`, etc.

### Stateful Example with OAuth Props

```typescript
type AuthProps = {
  claims: { sub: string; name: string };
  permissions: string[];
};

export class MyMCP extends McpAgent<Env, {}, AuthProps> {
  server = new McpServer({ name: "CallVault MCP", version: "1.0.0" });

  async init() {
    this.server.tool("whoami", {}, async () => ({
      content: [{
        type: "text",
        text: `Hello, ${this.props.claims.name} (${this.props.claims.sub})`,
      }],
    }));
  }
}
```

---

## 3. createMcpHandler — Stateless Pattern

Use this when you do not need Durable Object-backed sessions. Creates a new `McpServer` per request.

### Function Signature

```typescript
function createMcpHandler(
  server: McpServer,
  options?: CreateMcpHandlerOptions,
): (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>;
```

### Stateless Worker Entry Point

```typescript
import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

function createServer() {
  const server = new McpServer({ name: "Demo", version: "1.0.0" });
  server.tool("add", { a: z.number(), b: z.number() }, async ({ a, b }) => ({
    content: [{ type: "text", text: String(a + b) }],
  }));
  return server;
}

export default {
  fetch: async (request: Request, env: Env, ctx: ExecutionContext) => {
    const server = createServer();
    return createMcpHandler(server)(request, env, ctx);
  },
};
```

**Important:** MCP SDK 1.26.0+ requires a new server instance per request to prevent cross-client response data leaks. Do not share a single `McpServer` instance across requests.

Source: [createMcpHandler API Reference](https://developers.cloudflare.com/agents/model-context-protocol/mcp-handler-api/)

### Options

```typescript
interface CreateMcpHandlerOptions {
  route?: string;                // Default: "/mcp"
  authContext?: object;          // Inject auth info for getMcpAuthContext()
  transport?: WorkerTransport;   // Custom transport instance
  sessionIdGenerator?: () => string;
  enableJsonResponse?: boolean;  // Disable SSE streaming, return JSON
  corsOptions?: CORSOptions;
  storage?: MCPStorageApi;       // Persistent storage for stateful variant
}
```

### Accessing Auth Context in Stateless Tools

```typescript
import { getMcpAuthContext } from "agents/mcp";

server.tool("whoami", {}, async () => {
  const auth = getMcpAuthContext();
  return {
    content: [{ type: "text", text: `User: ${auth?.props?.username}` }],
  };
});
```

---

## 4. Streamable HTTP Transport

**Confidence: HIGH** — Verified from [Transport docs](https://developers.cloudflare.com/agents/model-context-protocol/transport/)

### Overview

| Transport | Status | Use Case |
|-----------|--------|---------|
| Streamable HTTP | Current standard (March 2025) | All new remote MCP servers |
| SSE (Server-Sent Events) | Deprecated | Legacy client compatibility only |
| stdio | Active | Local-only (Claude Desktop native) |

### How Streamable HTTP Works

- Uses a **single HTTP endpoint** (e.g., `POST /mcp`) for bidirectional messaging
- Server can stream multiple responses back (SSE-compatible within the response)
- Replaces the two-endpoint SSE model (separate `/sse` + `/messages` endpoints)
- Session state can be maintained via `sessionIdGenerator` and `storage` in `WorkerTransportOptions`
- The `McpAgent.serve()` method configures this automatically — no manual transport setup needed

### Legacy SSE Support

If you need to support MCP clients that only understand SSE (e.g., older Claude Desktop), `McpAgent` still supports it via `serveSSE()`:

```typescript
// Only if legacy SSE support is needed
export default {
  fetch: async (req, env, ctx) => {
    const url = new URL(req.url);
    if (url.pathname === "/sse") {
      return MyMCP.serveSSE("/sse").fetch(req, env, ctx);
    }
    return MyMCP.serve("/mcp").fetch(req, env, ctx);
  }
};
```

The August 2025 update added **auto transport selection** — the SDK falls back from Streamable HTTP to SSE automatically when clients require it.

---

## 5. Worker Entry Point Patterns

### Pattern A: Simplest — McpAgent.serve() (no auth)

```typescript
export class MyMCP extends McpAgent { /* ... */ }
export default MyMCP.serve("/mcp");
```

The default export is a Workers `ExportedHandler`. This is sufficient for authless deployments.

### Pattern B: With OAuthProvider Wrapper (full OAuth 2.1)

Used when you want the Workers runtime to handle the complete OAuth flow:

```typescript
import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { MyMCP } from "./mcp";
import { MyAuthHandler } from "./auth-handler";

export default new OAuthProvider({
  apiRoute: "/mcp",
  apiHandler: MyMCP.Router,      // or MyMCP.serve("/mcp")
  defaultHandler: MyAuthHandler, // handles /authorize, /token, /callback
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
});
```

The `OAuthProvider` intercepts requests to the `apiRoute` and validates the Bearer token before forwarding to `MyMCP.Router`. Props are populated on `this.props` in the McpAgent instance.

### Pattern C: Custom Bearer Token Validation (no interactive OAuth)

When you have your own token issuer (e.g., Supabase JWTs) and do not want the Workers OAuth dance:

```typescript
import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

function createServer(userId: string) {
  const server = new McpServer({ name: "CallVault MCP", version: "1.0.0" });
  server.tool("example", {}, async () => ({
    content: [{ type: "text", text: `Authenticated as: ${userId}` }],
  }));
  return server;
}

export default {
  fetch: async (request: Request, env: Env, ctx: ExecutionContext) => {
    // Extract and validate Bearer token
    const authHeader = request.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response("Unauthorized", { status: 401 });
    }
    const token = authHeader.slice(7);

    // Validate token (call Supabase or verify JWT)
    const userId = await validateToken(token, env);
    if (!userId) {
      return new Response("Forbidden", { status: 403 });
    }

    // Create per-request server with auth context baked in
    const server = createServer(userId);
    return createMcpHandler(server, {
      authContext: { userId },
    })(request, env, ctx);
  },
};

async function validateToken(token: string, env: Env): Promise<string | null> {
  // Example: validate against Supabase
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user.id;
}
```

**Pattern C with McpAgent (stateful variant):** Inject props by wrapping `serve()` in a fetch handler that pre-processes the request. This is less documented — the `OAuthProvider` is the designed integration point for props injection into `McpAgent`. For Supabase OAuth 2.1, implement a custom `OAuthProvider`-compatible handler.

---

## 6. wrangler.jsonc Configuration

**Confidence: HIGH** — Verified from multiple official Cloudflare repositories and real deployed examples.

### Minimal Config (no auth)

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "callvault-mcp",
  "main": "src/index.ts",
  "compatibility_date": "2025-03-10",
  "compatibility_flags": ["nodejs_compat"],
  "migrations": [
    {
      "new_sqlite_classes": ["MyMCP"],
      "tag": "v1"
    }
  ],
  "durable_objects": {
    "bindings": [
      {
        "class_name": "MyMCP",
        "name": "MCP_OBJECT"
      }
    ]
  },
  "observability": {
    "enabled": true
  }
}
```

### With OAuth KV + Custom Domain

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "callvault-mcp",
  "main": "src/index.ts",
  "compatibility_date": "2025-03-10",
  "compatibility_flags": ["nodejs_compat"],
  "migrations": [
    {
      "new_sqlite_classes": ["MyMCP"],
      "tag": "v1"
    }
  ],
  "durable_objects": {
    "bindings": [
      {
        "class_name": "MyMCP",
        "name": "MCP_OBJECT"
      }
    ]
  },
  "kv_namespaces": [
    {
      "binding": "OAUTH_KV",
      "id": "<YOUR_KV_NAMESPACE_ID>"
    }
  ],
  "observability": {
    "enabled": true
  },
  "workers_dev": false,
  "routes": [
    { "pattern": "mcp.callvault.ai", "custom_domain": true }
  ],
  "vars": {
    "ENVIRONMENT": "production",
    "MCP_SERVER_NAME": "callvault",
    "MCP_SERVER_VERSION": "1.0.0"
  }
}
```

### Multi-Environment Pattern

```jsonc
{
  // ... base config ...
  "env": {
    "staging": {
      "name": "callvault-mcp-staging",
      "routes": [{ "pattern": "mcp-staging.callvault.ai", "custom_domain": true }],
      "kv_namespaces": [{ "binding": "OAUTH_KV", "id": "<STAGING_KV_ID>" }],
      "vars": { "ENVIRONMENT": "staging" }
    },
    "production": {
      "name": "callvault-mcp-production",
      "routes": [{ "pattern": "mcp.callvault.ai", "custom_domain": true }],
      "kv_namespaces": [{ "binding": "OAUTH_KV", "id": "<PROD_KV_ID>" }],
      "vars": { "ENVIRONMENT": "production" }
    }
  }
}
```

Sources:
- [cloudflare/mcp-server-cloudflare wrangler.jsonc](https://raw.githubusercontent.com/cloudflare/mcp-server-cloudflare/main/apps/workers-observability/wrangler.jsonc)
- [WilliamSuiself/remote-mcp wrangler.jsonc](https://glama.ai/mcp/servers/@WilliamSuiself/remote-mcp/blob/144d556ad0eedcce460f6b0b7daea56f589733dd/wrangler.jsonc)
- [Pedropfuenmayor/mcp-cloudflare wrangler.jsonc](https://github.com/Pedropfuenmayor/mcp-cloudflare/blob/main/wrangler.jsonc)

### Key Fields Explained

| Field | Value | Why |
|-------|-------|-----|
| `compatibility_date` | `"2025-03-10"` or later | Required for Streamable HTTP transport support |
| `compatibility_flags` | `["nodejs_compat"]` | Enables Node.js APIs needed by `@modelcontextprotocol/sdk` |
| `new_sqlite_classes` | `["MyMCP"]` | Required — not `new_classes`. Free plan only supports SQLite-backed DOs. Using `new_classes` fails with error 10097 on free tier. |
| `durable_objects.bindings` | `class_name` + `name` | Must match your exported `McpAgent` subclass name exactly |
| `kv_namespaces` | `OAUTH_KV` | Only needed if using `OAuthProvider` for token storage |

---

## 7. Auth Token Extraction

### Pattern 1: OAuthProvider (recommended for interactive OAuth 2.1)

The `OAuthProvider` from `@cloudflare/workers-oauth-provider` validates the Bearer token from the `Authorization` header automatically before `apiHandler` is invoked. User identity arrives in `this.props` on the `McpAgent` instance.

```typescript
// In your McpAgent tool — props are already validated and typed
export class MyMCP extends McpAgent<Env, {}, AuthProps> {
  async init() {
    this.server.tool("get-user", {}, async () => ({
      content: [{
        type: "text",
        text: `User: ${this.props.claims.sub}`,
      }],
    }));
  }
}
```

### Pattern 2: Manual Bearer Extraction (stateless, custom token issuer)

```typescript
export default {
  fetch: async (request: Request, env: Env, ctx: ExecutionContext) => {
    const authHeader = request.headers.get("Authorization") ?? "";

    if (!authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.slice(7);

    // Validate — example with Supabase
    const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.SUPABASE_ANON_KEY,
      },
    });

    if (!userRes.ok) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const user = await userRes.json();

    // Pass auth context through to MCP tools via getMcpAuthContext()
    const server = createServer();
    return createMcpHandler(server, {
      authContext: { userId: user.id, email: user.email },
    })(request, env, ctx);
  },
};
```

### Pattern 3: getMcpAuthContext() in Tool Handlers

When `authContext` is passed to `createMcpHandler`, tools can retrieve it:

```typescript
import { getMcpAuthContext } from "agents/mcp";

server.tool("whoami", {}, async () => {
  const auth = getMcpAuthContext<{ userId: string; email: string }>();
  return {
    content: [{ type: "text", text: `userId: ${auth?.userId}` }],
  };
});
```

Source: [createMcpHandler API Reference](https://developers.cloudflare.com/agents/model-context-protocol/mcp-handler-api/)

---

## 8. Stateless Per-Request Pattern — Memory and CPU Limits

**Confidence: MEDIUM** — Worker limits from Cloudflare docs, MCP-specific behavior inferred.

### Workers Limits

| Resource | Free Plan | Workers Paid (Bundled) |
|----------|-----------|----------------------|
| CPU time per request | 10ms | 30s |
| Memory per Worker | 128MB | 128MB |
| Request duration (HTTP) | 30s wall clock | Unlimited (with Durable Objects) |
| Durable Object requests | 1M req/month free | Pay per use above |

### Implications for Stateless MCP

- Create `McpServer` fresh on every request — minimal overhead, but tool registration runs each time
- Tool handlers must complete within CPU limits
- For long-running operations, use `ctx.waitUntil()` or offload to a Durable Object / Queue
- The `McpAgent` (stateful) model avoids re-initializing tools on every request because `init()` runs once per Durable Object instance lifetime

### Recommendation

For the CallVault use case (multiple tool calls per session, auth state needed), use `McpAgent` backed by Durable Objects rather than the stateless `createMcpHandler` pattern. The DO model amortizes initialization cost across the session and provides session continuity if the connection drops.

---

## 9. Deployment Commands

```bash
# Install Wrangler globally (if not present)
npm install -g wrangler

# Initialize from Cloudflare's authless template
npm create cloudflare@latest -- remote-mcp-server --template=cloudflare/ai/demos/remote-mcp-authless

# Initialize from OAuth template
npm create cloudflare@latest -- remote-mcp-server --template=cloudflare/ai/demos/remote-mcp-github-oauth

# Create KV namespace for OAuth storage (if using OAuthProvider)
wrangler kv namespace create OAUTH_KV
wrangler kv namespace create OAUTH_KV --preview

# Set secrets
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY

# Deploy
wrangler deploy

# Local dev (Workers dev server)
wrangler dev
```

Local dev endpoint: `http://localhost:8787/mcp`

---

## 10. Testing the MCP Server

### MCP Inspector

```bash
# Connects to local dev server
npx @modelcontextprotocol/inspector http://localhost:8787/mcp

# With Bearer token
npx @modelcontextprotocol/inspector \
  --header "Authorization: Bearer your-token" \
  http://localhost:8787/mcp
```

### mcp-remote Proxy (for clients that only support stdio)

```bash
# Claude Desktop, Cursor, Windsurf
npx mcp-remote http://localhost:8787/mcp
```

---

## Common Pitfalls

### Pitfall 1: Using `new_classes` Instead of `new_sqlite_classes`

**What goes wrong:** Deployment fails with error code 10097 on free plan. Paid plan deploys but creates non-SQLite DO.

**How to avoid:** Always use `new_sqlite_classes` in migrations. This works on both free and paid plans.

**Warning sign:** Error message: "In order to use Durable Objects with a free plan, you must create a namespace using a `new_sqlite_classes` migration"

### Pitfall 2: Sharing McpServer Instances Across Requests

**What goes wrong:** MCP SDK 1.26.0+ throws or leaks cross-client response data if a single `McpServer` is reused.

**How to avoid:** In the stateless pattern, always call `createServer()` inside the `fetch` handler to get a fresh instance per request. The `McpAgent` model avoids this because each DO instance is isolated.

### Pitfall 3: Missing `nodejs_compat` Flag

**What goes wrong:** `@modelcontextprotocol/sdk` uses Node.js built-ins (`stream`, `events`) that are not available in the standard Workers runtime.

**How to avoid:** Add `"compatibility_flags": ["nodejs_compat"]` to `wrangler.jsonc`.

### Pitfall 4: Forgetting to Export the McpAgent Class

**What goes wrong:** The Durable Object binding fails at runtime because the class is not exported from the Worker entry point.

**How to avoid:** Both `export class MyMCP extends McpAgent` and `export default MyMCP.serve("/mcp")` must be top-level named exports in the same file (or re-exported from the entry point).

```typescript
// CORRECT — both are named exports
export class MyMCP extends McpAgent { ... }
export default MyMCP.serve("/mcp");
```

### Pitfall 5: SSE Transport Assumed by Clients

**What goes wrong:** Older MCP clients (pre-March 2025 Claude Desktop versions) may try to connect to `/sse` and fail against a Streamable HTTP endpoint.

**How to avoid:** The August 2025 SDK update includes auto transport fallback. If you need explicit dual transport, implement both `serveSSE("/sse")` and `serve("/mcp")` in a manual fetch router. The `mcp-remote` npm proxy handles this translation for local clients.

### Pitfall 6: Durable Object Class Name Mismatch

**What goes wrong:** Runtime binding error if `class_name` in `wrangler.jsonc` does not exactly match the exported TypeScript class name.

**How to avoid:** Keep them identical. If your class is `export class CallVaultMCP`, then `class_name` must be `"CallVaultMCP"`.

---

## Architecture Decision: McpAgent vs createMcpHandler for CallVault

| Criterion | McpAgent (Stateful) | createMcpHandler (Stateless) |
|-----------|--------------------|-----------------------------|
| Auth via Supabase JWT | Requires wrapping in custom fetch or OAuthProvider adapter | Simple: check header, inject `authContext` |
| Session state | Persisted in DO SQLite | None (recreated per request) |
| Tool initialization cost | Once per DO lifetime | Every request |
| Durable Object billing | Yes (paid plan for production) | No |
| Connection resumption | Yes | No |
| Props injection | Via `OAuthProvider` or custom handler | Via `authContext` option |

**For CallVault (Supabase OAuth 2.1 integration):** The `McpAgent` approach is appropriate if you implement a Supabase-compatible `OAuthProvider` handler. The `createMcpHandler` approach is simpler if you validate Supabase tokens manually per-request and do not need session state across tool calls.

---

## Sources

### Primary (HIGH confidence)

- [Build a Remote MCP server — Cloudflare Agents Docs](https://developers.cloudflare.com/agents/guides/remote-mcp-server/)
- [McpAgent API Reference — Cloudflare Agents Docs](https://developers.cloudflare.com/agents/model-context-protocol/mcp-agent-api/)
- [createMcpHandler API Reference — Cloudflare Agents Docs](https://developers.cloudflare.com/agents/model-context-protocol/mcp-handler-api/)
- [Transport — Cloudflare Agents Docs](https://developers.cloudflare.com/agents/model-context-protocol/transport/)
- [Authorization — Cloudflare Agents Docs](https://developers.cloudflare.com/agents/model-context-protocol/authorization/)
- [Build MCP servers with the Agents SDK — Changelog 2025-04-07](https://developers.cloudflare.com/changelog/2025-04-07-mcp-servers-agents-sdk-updates/)
- [Agents SDK MCP Update — Changelog 2025-08-05](https://developers.cloudflare.com/changelog/2025-08-05-agents-mcp-update/)
- [cloudflare/mcp-server-cloudflare wrangler.jsonc (official repo)](https://raw.githubusercontent.com/cloudflare/mcp-server-cloudflare/main/apps/workers-observability/wrangler.jsonc)
- [Durable Objects on Workers Free Plan — Changelog 2025-04-07](https://developers.cloudflare.com/changelog/2025-04-07-durable-objects-free-tier/)

### Secondary (MEDIUM confidence — verified against official sources)

- [Build and deploy Remote MCP servers — Cloudflare Blog](https://blog.cloudflare.com/remote-model-context-protocol-servers-mcp/) — Code examples cross-verified with docs
- [WilliamSuiself/remote-mcp wrangler.jsonc](https://glama.ai/mcp/servers/@WilliamSuiself/remote-mcp/blob/144d556ad0eedcce460f6b0b7daea56f589733dd/wrangler.jsonc) — Matches official patterns
- [github.com/cloudflare/templates issue #459](https://github.com/cloudflare/templates/issues/459) — new_sqlite_classes requirement confirmed

### Tertiary (LOW confidence — supplementary)

- [MintMCP blog on Cloudflare MCP](https://www.mintmcp.com/blog/connect-cloudflare-worker-with-mcp) — Not independently verified
- [Auth0 Cloudflare MCP blog](https://auth0.com/blog/secure-and-deploy-remote-mcp-servers-with-auth0-and-cloudflare/) — Alternative auth pattern, not verified against current SDK version

---

## Open Questions

1. **Custom OAuthProvider for Supabase OAuth 2.1**
   - What we know: `OAuthProvider` from `@cloudflare/workers-oauth-provider` is designed for GitHub/Google-style OAuth flows. Supabase exposes an OAuth 2.1 compliant endpoint.
   - What is unclear: Whether `OAuthProvider`'s `defaultHandler` can be implemented as a thin proxy to Supabase's `/authorize` and `/token` endpoints without significant custom code, or whether a full custom implementation is required.
   - Recommendation: Research `@cloudflare/workers-oauth-provider` source and whether it supports custom upstream OAuth providers, or plan to implement the auth handler from scratch using Supabase's PKCE flow.

2. **McpAgent props injection without OAuthProvider**
   - What we know: `this.props` on `McpAgent` is populated by `OAuthProvider`. Direct injection without `OAuthProvider` is not documented.
   - What is unclear: Whether `McpAgent.serve()` accepts a middleware option for custom props injection.
   - Recommendation: If not possible, use `createMcpHandler` (stateless) with `authContext` for the Supabase JWT validation path, accepting no session persistence.

3. **Agents SDK version stability**
   - What we know: The `agents` package receives frequent updates (April 2025, August 2025 changelogs found). APIs have evolved.
   - Recommendation: Pin the `agents` package version in `package.json` at project start and review changelog before upgrading.

---

## Metadata

**Confidence breakdown:**
- Import paths and class structure: HIGH — Multiple official sources agree
- Transport (Streamable HTTP): HIGH — Official changelog and docs
- wrangler.jsonc configuration: HIGH — Verified from Cloudflare's own repository
- Auth/props injection: MEDIUM — Documented for OAuthProvider path; custom JWT path requires inference
- Worker CPU/memory limits: MEDIUM — General Workers limits applied to MCP use case

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (Agents SDK is actively developed; verify changelog before implementation)
