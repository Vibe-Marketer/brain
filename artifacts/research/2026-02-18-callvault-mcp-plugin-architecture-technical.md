# Technical Research: CallVault Universal MCP Plugin Architecture

## Strategic Summary

The AI ecosystem has converged on MCP (Model Context Protocol) as the universal standard for tool integrations. Claude, ChatGPT, OpenClaw, Manus, VS Code, and Goose all now support MCP natively. **You only need to build ONE remote MCP server** — hosted on Cloudflare Workers with Streamable HTTP transport — and it will work as a "plugin" across all major AI platforms. Authentication is solved by enabling Supabase's built-in OAuth 2.1 Server, which CallVault already has the foundation for (Supabase Auth with Google OAuth). End users simply paste a URL and authenticate through their browser — zero installation, zero config files.

## Requirements

- **Single hosted endpoint** that works across Claude Desktop/Cowork, ChatGPT, OpenClaw, Manus
- **Zero local installation** for end users — just "add connector" and authenticate
- **Supabase Auth integration** — users log in with their existing CallVault accounts
- **OAuth 2.1 compliant** — mandatory per MCP spec (June 2025 revision)
- **Hosted on Cloudflare Workers** — user's existing infrastructure preference
- **All 16 existing operations** preserved from current MCP server

---

## The Convergence Event

As of early 2026, the major AI platforms have unified around MCP:

| Platform | MCP Support | How Users Connect |
|----------|-------------|-------------------|
| **Claude Desktop/Cowork** | Native MCP connector | Settings > Connectors > paste URL |
| **ChatGPT** | Apps SDK (built on MCP) | Developer mode > Add connector > paste URL |
| **OpenClaw** | Native MCP in `openclaw.json` | Config file or marketplace |
| **Manus** | MCP integration | Native connector |
| **VS Code** | MCP support | Settings > MCP servers |
| **Goose** | MCP support | Config file |

**Key insight:** OpenAI deprecated GPT Actions/Plugins and replaced them with the Apps SDK, which is built directly on MCP. This means a single MCP server IS your ChatGPT plugin, your Claude connector, and your OpenClaw integration — simultaneously.

---

## Approach 1: Cloudflare Workers + Supabase OAuth 2.1 Server (Recommended)

**How it works:** Deploy the existing CallVault MCP operations as a Cloudflare Worker using `createMcpHandler` from the Agents SDK. Enable Supabase's built-in OAuth 2.1 Server feature to handle all authentication. MCP clients auto-discover auth endpoints via `/.well-known/oauth-authorization-server`. Users authenticate through their browser with Google OAuth (existing flow), and the Worker validates their Supabase JWT on every request.

**Libraries/tools:**
- `@modelcontextprotocol/sdk` ^1.12+ (already in use)
- `agents` (Cloudflare Agents SDK — provides `createMcpHandler`, `WorkerTransport`)
- `@supabase/supabase-js` ^2.49+ (already in use)
- `wrangler` (Cloudflare CLI for deployment)
- Supabase OAuth 2.1 Server (dashboard toggle — no code needed)

**Architecture:**
```
User clicks "Add Connector" in Claude/ChatGPT/OpenClaw
    ↓
MCP Client discovers OAuth config from Supabase
    /.well-known/oauth-authorization-server/auth/v1
    ↓
User redirected to Supabase Auth (Google OAuth consent)
    ↓
Supabase issues access_token + refresh_token
    ↓
MCP Client calls Cloudflare Worker with Bearer token
    https://callvault-mcp.callvault.workers.dev/mcp
    ↓
Worker validates JWT → executes operation → returns result
```

**Server code structure:**
```typescript
// src/index.ts — Cloudflare Worker entry point
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "agents/mcp";
import { createClient } from "@supabase/supabase-js";

function createServer(env: Env, token: string) {
  const server = new McpServer({ name: "callvault", version: "2.0.0" });
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

  // Set user session from OAuth token
  supabase.auth.setSession({ access_token: token, refresh_token: "" });

  // Register all 16 operations as tools
  server.tool("callvault_discover", "Browse operations", { category: z.string().optional() },
    async (params) => { /* ... */ });
  server.tool("callvault_execute", "Run operation", { operation: z.string(), params: z.any() },
    async (params) => { /* ... */ });
  // ... etc

  return server;
}

export default {
  fetch: async (request: Request, env: Env, ctx: ExecutionContext) => {
    // Extract Bearer token from Authorization header
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    const server = createServer(env, token);
    return createMcpHandler(server)(request, env, ctx);
  }
};
```

**Pros:**
- Single deployment serves ALL platforms (Claude, ChatGPT, OpenClaw, Manus, etc.)
- Supabase OAuth 2.1 Server is a dashboard toggle — nearly zero auth code
- Existing Supabase RLS automatically enforces data isolation
- Cloudflare Workers = edge-deployed, low latency, generous free tier
- `createMcpHandler` handles Streamable HTTP protocol details
- Users connect with just a URL — zero installation
- MCP clients handle token refresh automatically
- Existing operation logic (handlers/) can be reused with minimal changes

**Cons:**
- Must refactor from stdio transport to HTTP (moderate effort)
- Supabase OAuth 2.1 Server is relatively new (launched late 2025)
- Need to handle stateless sessions (no `session.json` cache)
- Cloudflare Workers have 128MB memory limit and 30s CPU time limit per request
- Dynamic Client Registration needs to be enabled and monitored

**Best when:** You want one deployment that works everywhere with minimal ongoing maintenance.

**Complexity:** M (Medium) — mostly porting existing code to Worker format + enabling Supabase OAuth

---

## Approach 2: Cloudflare Workers + Custom OAuth Provider

**How it works:** Same Cloudflare Worker deployment, but instead of using Supabase's OAuth 2.1 Server, implement a custom OAuth provider using Cloudflare KV for session storage and Workers for the authorization/token endpoints. The Worker itself serves as both the OAuth authorization server and the MCP resource server.

**Libraries/tools:**
- `@modelcontextprotocol/sdk` ^1.12+
- `agents` (Cloudflare Agents SDK)
- `@supabase/supabase-js` ^2.49+
- Cloudflare KV (session/token storage)
- Custom OAuth endpoints in the Worker

**Pros:**
- Full control over the OAuth flow
- No dependency on Supabase's OAuth 2.1 Server feature
- Can customize consent screens and scopes
- Works even if Supabase changes their OAuth implementation

**Cons:**
- Significant additional code to write (authorization server, token endpoints, PKCE verification, consent UI)
- Must implement token storage, rotation, and revocation manually
- Must implement `/.well-known/oauth-authorization-server` discovery endpoint
- Must implement Dynamic Client Registration if you want auto-discovery
- More attack surface to secure
- Duplicates what Supabase already provides

**Best when:** You need custom OAuth scopes, consent flows, or can't use Supabase OAuth 2.1 Server.

**Complexity:** L (Large) — building a spec-compliant OAuth 2.1 authorization server is substantial

---

## Approach 3: Dual Architecture (Remote MCP + OpenAPI Shim)

**How it works:** Deploy the remote MCP server on Cloudflare Workers for MCP-native platforms, and additionally expose an OpenAPI REST API on the same Worker for platforms that don't support MCP natively. The OpenAPI spec can be auto-generated from the MCP tool definitions.

**Libraries/tools:**
- Everything from Approach 1, plus:
- `hono` or `itty-router` (lightweight router for REST endpoints)
- OpenAPI 3.1 spec generation
- Swagger UI for documentation

**Pros:**
- Covers hypothetical future platforms that might not adopt MCP
- REST API is familiar to web developers
- Can serve both MCP and REST from the same Worker
- OpenAPI spec enables API marketplace listings

**Cons:**
- Unnecessary complexity now that ChatGPT has adopted MCP
- Two API surfaces to maintain and test
- REST doesn't get automatic tool discovery like MCP
- REST clients need more manual integration work
- Doubles the documentation burden

**Best when:** You need a public REST API alongside MCP (e.g., for web app integrations or third-party developers).

**Complexity:** L (Large) — maintaining two protocol surfaces

---

## Comparison

| Aspect | Approach 1: Supabase OAuth | Approach 2: Custom OAuth | Approach 3: Dual Architecture |
|--------|---------------------------|--------------------------|-------------------------------|
| Complexity | M | L | L |
| Time to ship | 1-2 weeks | 3-5 weeks | 4-6 weeks |
| Platform coverage | All MCP clients | All MCP clients | MCP + REST |
| Auth effort | Enable toggle + config | Build from scratch | Enable toggle + config |
| Maintenance | Low | Medium | High |
| Future-proof | Good (MCP is the standard) | Good | Overkill |
| User experience | Paste URL, click approve | Paste URL, click approve | Varies by protocol |

---

## Recommendation

**Approach 1 (Cloudflare Workers + Supabase OAuth 2.1 Server)** is the clear winner. Here's why:

1. **MCP is now the universal standard.** ChatGPT, Claude, OpenClaw, Manus, VS Code, and Goose all support it. Building one MCP server gives you all platforms.

2. **Supabase already does your auth.** CallVault users already authenticate via Supabase Auth with Google OAuth. Enabling the OAuth 2.1 Server feature is literally a dashboard toggle — your existing users become OAuth-capable immediately.

3. **The user experience is unbeatable.** End user flow:
   - Open Claude Desktop > Settings > Connectors > Enter `https://callvault-mcp.callvault.workers.dev/mcp`
   - Browser opens > "Sign in with Google" (or already signed in)
   - Done. All 16 operations available immediately.

4. **Approach 2 reinvents what Supabase provides.** Building a spec-compliant OAuth 2.1 authorization server with PKCE, Dynamic Client Registration, and token rotation is weeks of work for no user-facing benefit.

5. **Approach 3 solves a problem that no longer exists.** The OpenAPI shim was necessary when ChatGPT used Actions — it doesn't anymore.

---

## Implementation Context

<claude_context>
<chosen_approach>
- name: Cloudflare Workers + Supabase OAuth 2.1 Server
- libraries:
  - @modelcontextprotocol/sdk@^1.12.1 (existing)
  - agents (Cloudflare Agents SDK — createMcpHandler)
  - @supabase/supabase-js@^2.49.4 (existing)
  - zod@^3.24.0 (existing)
  - wrangler (Cloudflare CLI)
- install:
  - npm create cloudflare@latest -- callvault-mcp-remote --template=cloudflare/ai/demos/remote-mcp-authless
  - npm install @modelcontextprotocol/sdk @supabase/supabase-js zod
</chosen_approach>

<architecture>
- pattern: Stateless MCP server on Cloudflare Workers, Supabase as OAuth authorization server + database
- components:
  1. Cloudflare Worker (MCP endpoint at /mcp) — handles Streamable HTTP transport
  2. Supabase OAuth 2.1 Server — handles auth discovery, authorization, token exchange
  3. Supabase Database — existing tables with RLS, queried using user's JWT
  4. Operation handlers — ported from existing src/handlers/ with minimal changes
- data_flow:
  1. MCP Client discovers OAuth at /.well-known/oauth-authorization-server/auth/v1
  2. User authenticates via Supabase Auth (Google OAuth)
  3. MCP Client receives access_token + refresh_token
  4. Client sends requests to Worker with Bearer token
  5. Worker creates Supabase client with user's token
  6. Supabase RLS enforces data isolation
  7. Worker returns MCP-formatted responses
</architecture>

<files>
- create:
  - wrangler.jsonc (Worker config with routes, KV bindings, secrets)
  - src/index.ts (Worker entry — createMcpHandler + auth extraction)
  - src/server.ts (McpServer factory — registers all 16 tools)
  - src/supabase.ts (stateless Supabase client factory — no session.json)
  - src/handlers/ (port existing handlers, remove getCurrentUserId() dependency)
  - src/operations.json (copy from existing, no changes)
- structure:
  ~/Developer/mcp/callvault-mcp-remote/
    ├── wrangler.jsonc
    ├── package.json
    ├── tsconfig.json
    ├── src/
    │   ├── index.ts          # Worker entry point
    │   ├── server.ts         # MCP server factory
    │   ├── supabase.ts       # Stateless Supabase client
    │   ├── operations.json   # Operation catalog
    │   └── handlers/
    │       ├── navigation.ts
    │       ├── recordings.ts
    │       ├── transcripts.ts
    │       ├── search.ts
    │       ├── contacts.ts
    │       └── analysis.ts
    └── README.md
- reference:
  - /Users/Naegele/Developer/mcp/callvault-mcp/ (existing stdio MCP — port handlers from here)
  - Cloudflare remote-mcp-authless template (starting point)
  - Supabase MCP auth docs (OAuth 2.1 Server setup)
</reference>
</files>

<implementation>
- start_with: Supabase OAuth 2.1 Server setup (dashboard toggle + config)
- order:
  1. Enable Supabase OAuth 2.1 Server in Supabase dashboard (Authentication > OAuth Server)
  2. Enable Dynamic Client Registration (for auto-discovery by MCP clients)
  3. Scaffold Cloudflare Worker from template
  4. Port handlers from existing MCP to stateless format (remove session.json dependency)
  5. Wire up createMcpHandler with Bearer token extraction
  6. Deploy to Cloudflare Workers
  7. Test with MCP Inspector locally
  8. Test with Claude Desktop connector
  9. Test with ChatGPT Apps SDK connector
  10. Test with OpenClaw config
- gotchas:
  - Must create NEW McpServer instance per request (stateless — Cloudflare requirement)
  - Supabase client must be created per-request with the user's Bearer token
  - No session.json — token comes from Authorization header on every request
  - Cloudflare Workers 30s CPU time limit — large transcript fetches may need chunking
  - Dynamic Client Registration must be enabled for ChatGPT/Claude auto-discovery
  - CORS must be configured on the Worker for browser-based OAuth redirects
  - operations.json needs to be bundled (not read from filesystem — no fs in Workers)
- testing:
  - MCP Inspector (npx @modelcontextprotocol/inspector@latest) for protocol validation
  - curl with Bearer token for direct HTTP testing
  - Claude Desktop connector for end-to-end user flow
  - ChatGPT developer mode connector for cross-platform validation
</testing>
</implementation>
</claude_context>

---

## Platform Connection Guides (Post-Deployment)

### Claude Desktop / Cowork
1. Settings > Connectors (or Settings > Developer > MCP Servers)
2. Enter: `https://callvault-mcp.callvault.workers.dev/mcp`
3. Browser opens for Google OAuth
4. Done

### ChatGPT
1. Enable Developer Mode (Settings > Developer mode)
2. Add connector > Enter MCP server URL
3. Browser opens for Google OAuth
4. Done

### OpenClaw
Add to `openclaw.json`:
```json
{
  "mcpServers": {
    "callvault": {
      "url": "https://callvault-mcp.callvault.workers.dev/mcp",
      "transport": "streamable-http"
    }
  }
}
```

### Any MCP Client
Any client supporting the MCP Streamable HTTP transport can connect with just the URL. OAuth discovery is automatic via Supabase's `/.well-known/` endpoint.

---

## Pending Prerequisite

**Before building the remote MCP:** The semantic search operation (`search.semantic`) requires a valid OpenAI API key in Supabase secrets. Run:
```bash
supabase secrets set OPENAI_API_KEY=sk-proj-...
```

---

## Next Action

Begin implementation: Enable Supabase OAuth 2.1 Server, scaffold Cloudflare Worker, port existing handlers.

---

## Sources

- [Cloudflare: Build a Remote MCP Server](https://developers.cloudflare.com/agents/guides/remote-mcp-server/)
- [Cloudflare: createMcpHandler API Reference](https://developers.cloudflare.com/agents/model-context-protocol/mcp-handler-api/)
- [Cloudflare: MCP Transport](https://developers.cloudflare.com/agents/model-context-protocol/transport/)
- [Supabase: OAuth 2.1 Server](https://supabase.com/docs/guides/auth/oauth-server)
- [Supabase: MCP Authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication)
- [Supabase: Getting Started with OAuth 2.1](https://supabase.com/docs/guides/auth/oauth-server/getting-started)
- [OpenAI: Building MCP Servers for ChatGPT](https://platform.openai.com/docs/mcp)
- [OpenAI: Apps SDK MCP Server Concepts](https://developers.openai.com/apps-sdk/concepts/mcp-server/)
- [OpenAI: Build Your MCP Server](https://developers.openai.com/apps-sdk/build/mcp-server/)
- [OpenAI: Introducing Apps in ChatGPT](https://openai.com/index/introducing-apps-in-chatgpt/)
- [MCP Blog: MCP Apps](http://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/)
- [OpenClaw Wikipedia](https://en.wikipedia.org/wiki/OpenClaw)
- [SafeClaw: How to Use MCP With OpenClaw](https://safeclaw.io/blog/openclaw-mcp)
- [PropelAuth: Production-ready MCP on Cloudflare Workers](https://www.propelauth.com/post/cloudflare-worker-mcp-server)
- [Natoma: Deploy MCP Server to Cloudflare Workers](https://natoma.ai/blog/how-to-deploy-mcp-server-to-cloudflare-workers)
