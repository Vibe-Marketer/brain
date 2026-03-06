# Phase 12: Codebase Analysis - callvault-mcp Migration to Cloudflare Workers

**Analyzed:** 2026-02-19
**Source codebase:** `/Users/Naegele/Developer/mcp/callvault-mcp/`
**Target deployment:** Cloudflare Worker with HTTP (SSE or Streamable HTTP) transport
**Auth target:** Supabase OAuth 2.1 / PKCE, token passed per-request (stateless)

---

## Executive Summary

The current callvault-mcp is a stdio-based MCP server designed for local execution via Claude Desktop. It assumes a persistent Node.js process with access to the local filesystem (`~/.callvault-mcp/session.json`), platform-specific log paths (`~/Library/Logs/Claude/`), and in-memory state (pagination `sessionsCache` Map).

Migration to a Cloudflare Worker requires replacing **five fundamental assumptions** the current code makes:

1. **Filesystem access** — `fs` module used in `auth.ts`, `utils.ts`, and `authorize.ts`. Workers have no `fs`.
2. **Session persistence** — Session tokens stored in `~/.callvault-mcp/session.json`. Workers are stateless; tokens must travel with each request.
3. **In-memory pagination state** — `sessionsCache` Map in `utils.ts` is per-process. Workers reset between requests.
4. **Stdio transport** — `StdioServerTransport` in `index.ts`. Workers must use HTTP transport (SSE or Streamable HTTP).
5. **Authorization flow** — `authorize.ts` runs a local HTTP server and opens a browser. Workers need a web-based OAuth redirect flow with a dedicated `/authorize` and `/callback` endpoint.

The business logic (all handlers, operations routing, prompts, response shaping) is **clean and fully portable** — it only touches Supabase via `@supabase/supabase-js`, which supports Workers natively.

---

## File-by-File Analysis

### `src/index.ts` — Entry Point

**Current functionality:**
- Creates an MCP `Server` instance with tools, resources, and prompts capabilities.
- Registers four meta-tools: `callvault_discover`, `callvault_get_schema`, `callvault_execute`, `callvault_continue`.
- Reads `operations.json` from disk using `readFileSync` + `path.dirname(fileURLToPath(import.meta.url))`.
- Mounts `StdioServerTransport` and calls `server.connect(transport)`.
- Exports nothing — it's a standalone process entry point.

**What needs to change:**

| Current | Target |
|---------|--------|
| `import { readFileSync } from "fs"` | Import operations JSON statically: `import OPERATIONS from "./operations.json" assert { type: "json" }` — or inline as a TypeScript object |
| `path.dirname(fileURLToPath(import.meta.url))` | Removed entirely. No `__dirname` needed once JSON is imported statically |
| `import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"` | Replaced with `StreamableHTTPServerTransport` from `@modelcontextprotocol/sdk/server/streamableHttp.js` |
| `async function main()` + `server.connect(transport)` | Replaced with Cloudflare Worker `export default { fetch(request, env) { ... } }` handler that creates transport per-request |
| `continueSession(sessionId)` call in `callvault_continue` | Must pass session state differently — see `utils.ts` section |

**Key constraint:** The MCP SDK's `StreamableHTTPServerTransport` (added in SDK v1.8+) expects to be instantiated per HTTP request, not once at startup. The `server` instance can be shared if it's stateless, or created per-request.

**Workers-compatible pattern:**
```typescript
// worker-entry.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import OPERATIONS from "./operations.json";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Extract access token from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response("Unauthorized", { status: 401 });
    }
    const accessToken = authHeader.slice(7);

    // Create per-request transport
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server = buildServer(OPERATIONS, env, accessToken);
    await server.connect(transport);
    return transport.handleRequest(request);
  }
};
```

---

### `src/auth.ts` — Session Cache (Filesystem-based)

**Current functionality:**
- `loadSession()` — reads `~/.callvault-mcp/session.json` via `fs.readFileSync`.
- `saveSession()` — writes session JSON to filesystem with `chmod 600`.
- `isSessionExpired()` — pure function checking `expires_at` against `Date.now()` — portable.

**What needs to change:**

The entire `loadSession` / `saveSession` pattern is eliminated. In a stateless Worker, the client is responsible for holding the access token and presenting it on every request.

**Workers approach — three options:**

| Option | Mechanism | Token storage |
|--------|-----------|---------------|
| A (simplest) | Client sends `Authorization: Bearer <access_token>` header each request | Client holds token |
| B (better UX) | Worker stores tokens in Cloudflare KV keyed by session ID (`mcp-session-id` cookie) | KV store |
| C (production) | Worker issues its own short-lived JWT after completing Supabase OAuth, stores refresh token in KV | KV + Worker JWT |

For initial deployment, **Option A** is correct: the MCP client (Claude Desktop or remote MCP client) is configured with the user's Supabase access token as a bearer token. The Worker validates it against Supabase on each request.

`isSessionExpired()` can be kept as a utility if token refresh is implemented, but the Worker should attempt the Supabase call and handle 401 responses by returning a proper MCP auth error.

**Files to delete/replace:** `src/auth.ts` is entirely replaced. The interface `CachedSession` may be kept as a type-only definition if useful.

---

### `src/supabase.ts` — Client Factory (Stateful)

**Current functionality:**
- Module-level singletons: `let client: SupabaseClient | null = null` and `let currentSession: CachedSession | null = null`.
- `getSupabaseClient()` — lazy-initializes client, loads session from `auth.ts`, refreshes if expired, calls `client.auth.setSession()` to attach token.
- `getCurrentUserId()` — reads from `currentSession` module-level variable.

**What needs to change:**

Module-level mutable singletons **cannot be shared** across Worker requests. Each request arrives in a fresh execution context (or a potentially reused V8 isolate). The client must be created per-request using the token from the incoming request.

**Workers pattern:**
```typescript
// supabase.ts (new)
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export function createSupabaseClient(
  supabaseUrl: string,
  supabaseAnonKey: string,
  accessToken: string
): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

export function getUserIdFromToken(accessToken: string): string {
  // Decode JWT payload (base64) — no crypto needed for reading claims
  const payload = JSON.parse(
    atob(accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
  );
  return payload.sub;
}
```

Key difference: instead of `client.auth.setSession()`, inject the token via `global.headers.Authorization`. This is the correct pattern for Cloudflare Workers since `setSession` triggers browser-specific storage paths.

**Dependencies to remove:** `loadSession`, `saveSession`, `isSessionExpired` are no longer imported.

---

### `src/utils.ts` — Logging and Pagination

**Current functionality:**
- `log()` — writes to `~/Library/Logs/Claude/mcp-server-callvault.log` via `fs.appendFileSync`. Uses `fs` and `path` modules.
- `extractFields()` / `truncateList()` — pure field projection utilities. **Fully portable.**
- `estimateTokens()` — pure JSON size estimation. **Fully portable.**
- `sessionsCache` — module-level `Map<string, PaginationSession>`. **Not portable** to Workers.
- `chunkResponse()` — creates pagination sessions, stores in `sessionsCache`. Returns `sessionId`.
- `continueSession()` — reads from `sessionsCache` to retrieve next chunk.

**What needs to change:**

Two separate problems:

**Problem 1: Filesystem logging**

Replace `fs.appendFileSync` with `console.log` / `console.error`. In Workers, these write to the Workers runtime log stream (visible in `wrangler tail`).

```typescript
// new log()
export function log(level: string, message: string): void {
  const timestamp = new Date().toISOString();
  const line = `${timestamp} [callvault-mcp] ${level.toUpperCase()}: ${message}`;
  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}
```

**Problem 2: In-memory pagination sessions**

`sessionsCache` is a process-level Map that persists between tool calls in stdio mode because the server is a long-running process. In Workers, each HTTP request may hit a different isolate. The Map will be empty on every new request.

**Options:**

| Option | Tradeoff |
|--------|----------|
| **A: Cloudflare KV** | Persistent across requests, ~50ms latency for reads, requires KV namespace binding. Best for multi-request pagination. |
| **B: Embed all data in session token** | No external storage. Encode paginated data as base64 in the `session_id` string. Limited to ~10KB safely. |
| **C: Remove chunking, use smaller page sizes** | Eliminate `sessionsCache` entirely. Return all results with a smaller `limit` ceiling. Works if transcript data fits in one response. |
| **D: Cloudflare Durable Objects** | Stateful per-session object. Overkill for pagination. |

**Recommended approach: Option A (KV) with Option C as fallback.**

If transcripts are large (the primary chunking case), store pagination state in KV with a 5-minute TTL:
```typescript
// KV key: `pagination:${sessionId}`
// Value: JSON.stringify({ chunks, currentIndex })
// TTL: 300 seconds
await env.PAGINATION_KV.put(sessionId, JSON.stringify(session), { expirationTtl: 300 });
```

If KV is not set up, remove `chunkResponse` chunking and return a `next_offset` cursor instead, letting clients request subsequent pages explicitly via `callvault_execute` with `offset` param.

---

### `src/handlers/index.ts` — Operation Router

**Current functionality:**
- Flat `HANDLERS` Record mapping operation strings to async functions.
- `executeOperation(operation, params)` — looks up handler and calls it.
- All handlers are imported at module top level.

**What needs to change:**

The router pattern is fine, but handlers currently call `getSupabaseClient()` and `getCurrentUserId()` from the module-level singleton in `supabase.ts`. In Workers, these must receive the Supabase client as a parameter.

**Required signature change — two approaches:**

**Approach A: Thread client via params (minimal refactor)**
```typescript
// Each handler receives supabase client and userId in params
type HandlerFn = (params: any, context: RequestContext) => Promise<unknown>;

interface RequestContext {
  supabase: SupabaseClient;
  userId: string;
}

export async function executeOperation(
  operation: string,
  params: Record<string, unknown>,
  context: RequestContext
): Promise<unknown> {
  const handler = HANDLERS[operation];
  return handler(params, context);
}
```

**Approach B: Factory pattern (cleaner)**
```typescript
// Each handler module exports a factory
export function createNavigationHandlers(context: RequestContext) {
  return {
    listBanks: () => listBanks(context),
    listVaults: (params) => listVaults(params, context),
    // ...
  };
}
```

Approach A requires the least rewriting of handler internals and is recommended for the initial migration.

---

### `src/handlers/navigation.ts` — Navigation Handlers

**Current functionality:**
- `listBanks()` — queries `bank_memberships` JOIN `banks`.
- `listVaults(params)` — queries `vault_memberships` JOIN `vaults`, then counts members.
- `listFolders(params)` — queries `folders` with bank/parent filtering.
- `listTags()` — queries `call_tags`.
- All call `getSupabaseClient()` and `getCurrentUserId()` at the top.

**What needs to change:**

Replace the two import calls with context parameter. No logic changes needed.

```typescript
// Before
const supabase = await getSupabaseClient();
const userId = getCurrentUserId();

// After
const { supabase, userId } = context;
```

All Supabase query patterns (`from`, `select`, `eq`, `order`, `filter`) work identically in Workers.

**Note on `listFolders`:** The try/catch around `query.eq("bank_id", params.bank_id)` is a code smell — this will always succeed at the TypeScript level; the runtime error would come from the query response. This can be left as-is or cleaned up.

**Workers compatibility:** HIGH — no changes to query logic needed.

---

### `src/handlers/recordings.ts` — Recording Handlers

**Current functionality:**
- `searchRecordings(params)` — queries `vault_entries` JOIN `recordings`, applies client-side filters for title, source, date, tags.
- `getRecording(params)` — tries `recordings` table first, falls back to `fathom_calls`. Fetches speakers from `fathom_transcripts`.
- `listRecordings(params)` — queries `vault_entries` JOIN `recordings` with pagination.
- Uses `chunkResponse()` for large result sets.

**What needs to change:**

1. Replace `getSupabaseClient()` / `getCurrentUserId()` with context parameter.
2. `chunkResponse()` pagination state — see `utils.ts` section above.

**Client-side filtering concern:** `searchRecordings` fetches up to 50 results then filters in JavaScript. This is tolerable for Workers (CPU time is not billed in the same way as Node), but pulls more data over the wire than necessary. A future optimization would push filters to Supabase PostgREST queries. Not a blocker for initial migration.

**Workers compatibility:** HIGH after context threading.

---

### `src/handlers/transcripts.ts` — Transcript Handlers

**Current functionality:**
- `getTranscriptText(recordingId)` — private helper, tries `recordings` then `fathom_calls`.
- `getSpeakerEmails(legacyId)` — private helper, queries `fathom_transcripts` for speaker email map.
- `parseTranscript(text)` — pure regex parser. **Fully portable.**
- `getTranscriptRaw(params)` — strips speaker labels, returns plain text.
- `getTranscriptStructured(params)` — groups segments into speaker turns, uses `chunkResponse`.
- `getTranscriptTimestamped(params)` — fetches from `fathom_transcripts` table, uses `chunkResponse`.

**What needs to change:**

1. Thread context through all private helpers (they also call `getSupabaseClient()`/`getCurrentUserId()`).
2. `chunkResponse` pagination — per `utils.ts` section.
3. `TRANSCRIPT_REGEX` has `lastIndex` manually reset — this pattern is correct and portable.

**Workers compatibility:** HIGH after context threading.

---

### `src/handlers/search.ts` — Semantic Search Handler

**Current functionality:**
- `semanticSearch(params)` — calls Supabase Edge Function `semantic-search` via `supabase.functions.invoke()`.
- Passes `query`, `limit`, `user_id` to the Edge Function.
- Applies client-side date and speaker filters.
- The Edge Function itself handles vector embedding via OpenAI (key is stored server-side in Supabase secrets, not in the MCP server).

**What needs to change:**

1. Thread context (the `userId` comes from `getCurrentUserId()`).
2. `supabase.functions.invoke()` works in Workers — it makes an HTTP request to the Supabase Edge Function URL. No changes needed to the invocation pattern.

**Important:** The OpenAI key is NOT needed in the MCP server or Worker. It is already handled server-side in the Supabase Edge Function. This is a clean boundary.

**Workers compatibility:** HIGH. `supabase.functions.invoke()` is HTTP-based and fully supported.

---

### `src/handlers/contacts.ts` — Contact Handlers

**Current functionality:**
- `listContacts(params)` — fetches contacts, then fetches `contact_call_appearances` to compute call counts client-side.
- `getContactHistory(params)` — fetches contact record, then appearances, then recording titles.
- `getAttendees(params)` — fetches `calendar_invitees` from `fathom_calls`, merges with transcript speakers.

**What needs to change:**

1. Thread context — `getCurrentUserId()` used in all three functions.
2. No other changes needed.

**Performance note:** `listContacts` makes two serial queries (contacts, then all appearances to compute counts). Consider a Postgres aggregate subquery if this is slow, but not a migration blocker.

**Workers compatibility:** HIGH after context threading.

---

### `src/handlers/analysis.ts` — Analysis Handlers

**Current functionality:**
- `compareRecordings(params)` — loops over up to 5 recording IDs, tries `recordings` then `fathom_calls` for each, fetches speakers.
- `trackSpeaker(params)` — queries `fathom_transcripts` filtered by speaker name/email, resolves UUID recording IDs to legacy numeric IDs, fetches call titles.

**What needs to change:**

1. Thread context — `getCurrentUserId()` used in both functions.
2. `compareRecordings` makes N sequential Supabase queries in a loop (one per recording). Consider `Promise.all()` for parallel fetching, but not a migration blocker.

**Workers compatibility:** HIGH after context threading.

---

### `src/prompts.ts` — Prompt Templates

**Current functionality:**
- Defines 5 prompts: `call_analysis`, `meeting_prep`, `weekly_digest`, `action_items`, `sales_pipeline`.
- `getPromptMessages()` — pure function returning `PromptMessage[]` objects.
- No I/O, no imports beyond MCP SDK types.

**What needs to change:** Nothing. This file is 100% portable as-is.

**Workers compatibility:** PERFECT — pure TypeScript.

---

### `src/operations.json` — Operation Catalog

**Current functionality:**
- Loaded via `readFileSync` + `JSON.parse` in `index.ts`.
- Defines 16 operations across 6 categories with parameter schemas.

**What needs to change:**

Replace the `readFileSync` load with a static import:

```typescript
// Current (Node.js only)
import { readFileSync } from "fs";
const OPERATIONS = JSON.parse(readFileSync(operationsPath, "utf-8"));

// Target (Workers compatible)
import OPERATIONS from "./operations.json";
// Requires tsconfig: "resolveJsonModule": true (already set)
// Requires wrangler.toml or build config to bundle JSON
```

Alternatively, convert `operations.json` to a TypeScript const — more explicit, better type safety.

**Workers compatibility:** JSON import works in Workers via bundler (esbuild/wrangler).

---

### `authorize.ts` — OAuth Bootstrap

**Current functionality:**
- Standalone script that spins up a local HTTP server on a random port.
- Opens browser to Supabase OAuth URL with `redirectTo: http://127.0.0.1:{port}/callback`.
- Captures auth code from callback, exchanges for session, writes to `~/.callvault-mcp/session.json`.
- Uses: `http`, `fs`, `path`, `fileURLToPath`, `open` (npm package).

**What needs to change:**

This script does **not run in the Worker**. It is replaced by OAuth endpoints in the Worker itself:

| Current | Target |
|---------|--------|
| `authorize.ts` local script | `/authorize` route in Worker — redirects to Supabase OAuth |
| Local HTTP server on random port | `/callback` route in Worker — handles OAuth redirect from Supabase |
| Saves to `~/.callvault-mcp/session.json` | Returns tokens to MCP client via response / stores in KV |
| `open` npm package (browser launcher) | Not needed — user navigates directly in browser |

**New OAuth flow for Workers:**

```
User/MCP client → GET /authorize
  → Worker generates PKCE code_verifier + code_challenge
  → Store code_verifier in KV (keyed by state param, TTL 10min)
  → Redirect to Supabase OAuth URL with code_challenge, state, redirectTo=/callback

Supabase Auth → POST /callback (with code + state)
  → Worker reads code_verifier from KV using state param
  → Exchanges code for session via supabase.auth.exchangeCodeForSession()
  → Returns access_token and refresh_token to MCP client
    (either via JSON response body or redirect with tokens in URL fragment)
```

The `pkce-challenge` npm package is already in `node_modules` (pulled in by `@supabase/supabase-js`). Workers have `crypto.subtle` available for PKCE generation without npm packages.

---

### `package.json` — Dependencies

**Current dependencies:**

| Package | Version | Workers compatible? | Notes |
|---------|---------|---------------------|-------|
| `@modelcontextprotocol/sdk` | ^1.12.1 | YES | Has HTTP transports since v1.8 |
| `@supabase/supabase-js` | ^2.49.4 | YES | Workers-compatible since v2.x |
| `open` | ^10.1.0 | NO | Node-only browser launcher. Only used in `authorize.ts`. Deleted. |
| `zod` | ^3.24.0 | YES | Pure JS, works everywhere |

**New dependencies to add:**

| Package | Purpose |
|---------|---------|
| `wrangler` (devDep) | Cloudflare Workers CLI for deployment and local dev |
| `@cloudflare/workers-types` (devDep) | TypeScript types for `Request`, `Response`, `KVNamespace`, `Env` |

**Scripts to add:**
```json
{
  "scripts": {
    "dev:worker": "wrangler dev",
    "deploy": "wrangler deploy",
    "build:worker": "wrangler build"
  }
}
```

---

### `tsconfig.json` — TypeScript Config

**Current config:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    ...
  }
}
```

**What needs to change:**

Wrangler uses esbuild for bundling, not `tsc` directly. Two options:

**Option A: Separate tsconfig for worker**
```json
// tsconfig.worker.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"]
  }
}
```

**Option B: Single tsconfig, wrangler handles bundling**
Keep existing `tsconfig.json` for type checking, let wrangler/esbuild handle the actual compilation. Add `@cloudflare/workers-types` to `types` array.

The `module: "Node16"` setting causes issues with Workers because Workers use the `Bundler` module resolution, not Node's. `"module": "ESNext"` + `"moduleResolution": "Bundler"` is the correct Workers target.

---

## Migration Impact Summary

### Components requiring NO changes (fully portable)

| Component | Reason |
|-----------|--------|
| `src/prompts.ts` | Pure TypeScript, no I/O |
| `src/operations.json` | Data only, load mechanism changes |
| `src/handlers/index.ts` | Router logic only, needs context threading |
| All Supabase query logic in handlers | `@supabase/supabase-js` is Workers-compatible |
| `parseTranscript()` regex in `transcripts.ts` | Pure function |
| `extractFields()`, `truncateList()`, `estimateTokens()` in `utils.ts` | Pure functions |
| `isSessionExpired()` in `auth.ts` | Pure function (may be deleted) |

### Components requiring MODIFICATION (keep, refactor)

| Component | Change Required | Effort |
|-----------|----------------|--------|
| `src/supabase.ts` | Remove singletons, create client from request token | Low |
| `src/utils.ts` | Replace `fs` logging with `console`, replace `sessionsCache` with KV | Medium |
| `src/index.ts` | Replace `StdioServerTransport` with HTTP transport, remove `fs`/`path` imports, wire per-request context | High |
| All handler files (6) | Thread `context: { supabase, userId }` instead of calling module singletons | Low per file |

### Components requiring REPLACEMENT (delete, rewrite)

| Component | What replaces it | Effort |
|-----------|-----------------|--------|
| `src/auth.ts` (entire file) | Token extracted from `Authorization` header each request | Low |
| `authorize.ts` (entire file) | `/authorize` + `/callback` HTTP routes in Worker entry point | High |

---

## New File Architecture (Target State)

```
callvault-mcp-worker/
├── src/
│   ├── worker.ts            # NEW: Cloudflare Worker entry (replaces index.ts)
│   │   ├── fetch() handler  # Handles /authorize, /callback, /mcp
│   │   └── MCP Server setup with HTTP transport
│   ├── server.ts            # NEW: MCP Server factory, accepts context
│   ├── supabase.ts          # MODIFIED: createSupabaseClient(url, key, token)
│   │                        #           getUserIdFromToken(token)
│   ├── utils.ts             # MODIFIED: console-based log, KV-backed pagination
│   ├── operations.json      # UNCHANGED: static import
│   ├── prompts.ts           # UNCHANGED
│   └── handlers/
│       ├── index.ts         # MODIFIED: executeOperation(op, params, context)
│       ├── navigation.ts    # MODIFIED: context param threading
│       ├── recordings.ts    # MODIFIED: context param threading
│       ├── transcripts.ts   # MODIFIED: context param threading
│       ├── search.ts        # MODIFIED: context param threading
│       ├── contacts.ts      # MODIFIED: context param threading
│       └── analysis.ts      # MODIFIED: context param threading
├── wrangler.toml            # NEW: Cloudflare deployment config
├── package.json             # MODIFIED: add wrangler, remove open
└── tsconfig.json            # MODIFIED: add @cloudflare/workers-types
```

---

## Critical Patterns to Preserve

### 1. MCP Tool Structure (Do Not Change)
The four-tool architecture (`callvault_discover`, `callvault_get_schema`, `callvault_execute`, `callvault_continue`) works with any MCP transport. Preserve these tool names and schemas exactly.

### 2. Dual-Schema Fallback Pattern
All handlers that try `recordings` first then fall back to `fathom_calls` must be preserved. This is not tech debt — it reflects an active database migration that is not yet complete.

### 3. `chunkResponse` / `continueSession` Contract
The `callvault_continue` tool expects `session_id` strings in the format `sess_{timestamp}_{random}`. If implementing KV-backed pagination, generate session IDs in the same format. The MCP client behavior depends on this contract.

### 4. Field Truncation via `FIELD_CONFIGS`
The `truncateList()` field projection is important for keeping MCP response sizes manageable. Preserve this even if pagination changes.

---

## Workers Runtime Constraints Checklist

| Constraint | Status | Mitigation |
|------------|--------|------------|
| No `fs` module | BLOCKED in current code | Replace all `fs` usage (3 locations) |
| No `path` module | BLOCKED in current code | Replace path joins (3 locations) |
| No `process.env.HOME` | BLOCKED in current code | Eliminated with filesystem removal |
| No `http` module | BLOCKED in `authorize.ts` | Replace with Worker fetch handler |
| No `open` npm package | BLOCKED (Node-only) | Delete — not needed in Worker |
| CPU time limit (30ms soft / 30s hard) | RISK for heavy operations | Transcript chunking is pure JS — acceptable |
| 128MB memory limit | LOW RISK | Supabase client is small; pagination chunks are bounded |
| No persistent in-memory state | RISK for `sessionsCache` | KV-backed pagination or cursor-based |
| Request size limit (32MB upload) | NOT APPLICABLE | All operations are reads |
| `crypto.subtle` available | AVAILABLE | Use for PKCE generation in `/authorize` |
| `atob`/`btoa` available | AVAILABLE | Use for JWT claim decoding |

---

## Recommended Migration Order

1. **Unblock the runtime** — Remove all `fs`, `path`, `process.env.HOME` usage (`auth.ts`, `utils.ts`).
2. **Thread context** — Add `RequestContext` type, pass `{supabase, userId}` through `executeOperation` and all handlers. This is the bulk of the mechanical work (6 handler files).
3. **Replace transport** — Swap `StdioServerTransport` for `StreamableHTTPServerTransport` in the entry point. Wrap in a Worker `fetch()` handler that extracts the bearer token and builds the context.
4. **Replace JSON loading** — Switch from `readFileSync` to static `import`.
5. **Add wrangler config** — `wrangler.toml` with KV namespace binding for pagination.
6. **Implement OAuth routes** — `/authorize` and `/callback` endpoints in the Worker for the PKCE flow.
7. **Port pagination to KV** — Replace `sessionsCache` Map with KV reads/writes.
8. **Deploy and test** — `wrangler deploy`, validate all 16 operations via a remote MCP client.
