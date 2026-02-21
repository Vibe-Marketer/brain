---
phase: 12-deploy-callvault-mcp-as-remote-cloudflare-worker-with-supabase-oauth-2-1
plan: 03
subsystem: infra
tags: [cloudflare-workers, mcp, jose, jwt, oauth, supabase, streamable-http]

# Dependency graph
requires:
  - phase: 12-01
    provides: "RequestContext type, createSupabaseClient factory, Workers-compatible utils"
  - phase: 12-02
    provides: "All 6 handler files accept (params, context: RequestContext), executeOperation(operation, params, context)"

provides:
  - "src/auth-middleware.ts: validateSupabaseToken() via jose + Supabase JWKS (RS256)"
  - "src/worker.ts: Cloudflare Worker entry point with CORS, OAuth discovery, JWT auth, stateless MCP handler"
  - "Per-request McpServer with all 4 meta-tools, resources, and 5 prompts registered"
  - "src/index.ts: backward-compatible stdio server with proper RequestContext from session"

affects: ["12-05-deploy-and-verify", "any future Worker extension"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "WebStandardStreamableHTTPServerTransport for Cloudflare Workers MCP (stateless per-request)"
    - "Per-request McpServer factory pattern (createMcpServer) closes over RequestContext"
    - "JWKS caching via createRemoteJWKSet with module-level cache per isolate"
    - "RFC 9728 OAuth Protected Resource Metadata at /.well-known/oauth-protected-resource"
    - "globalThis for cross-runtime Node.js API access in auth.ts and supabase.ts"
    - "Explicit include lists in tsconfig for Worker vs stdio separation"

key-files:
  created:
    - /Users/Naegele/Developer/mcp/callvault-mcp/src/auth-middleware.ts
    - /Users/Naegele/Developer/mcp/callvault-mcp/src/worker.ts
  modified:
    - /Users/Naegele/Developer/mcp/callvault-mcp/src/index.ts
    - /Users/Naegele/Developer/mcp/callvault-mcp/src/auth.ts
    - /Users/Naegele/Developer/mcp/callvault-mcp/src/supabase.ts
    - /Users/Naegele/Developer/mcp/callvault-mcp/tsconfig.json
    - /Users/Naegele/Developer/mcp/callvault-mcp/tsconfig.worker.json

key-decisions:
  - "WebStandardStreamableHTTPServerTransport instead of createMcpHandler (which doesn't exist in agents/mcp)"
  - "Per-request McpServer factory closes over RequestContext (stateless, no shared state)"
  - "auth.ts refactored to use globalThis for all Node.js API access (fs, path, process)"
  - "supabase.ts uses dynamic import for auth.ts and globalThis for process.env"
  - "tsconfig.json excludes worker.ts and auth-middleware.ts (Worker files use ExecutionContext)"
  - "tsconfig.worker.json uses explicit include list excluding src/index.ts"

patterns-established:
  - "Worker files use WebStandardStreamableHTTPServerTransport + McpServer.connect() + transport.handleRequest()"
  - "ctx.waitUntil(server.close()) for graceful cleanup after response is sent"

# Metrics
duration: 35min
completed: 2026-02-21
---

# Phase 12 Plan 03: Worker Entry Point Summary

**Cloudflare Worker glue layer: CORS, RFC 9728 OAuth discovery, Supabase JWKS JWT validation, and stateless per-request McpServer with 4 tools, resources, and 5 prompts**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-02-21T12:28:00Z
- **Completed:** 2026-02-21T13:03:35Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Created `auth-middleware.ts` with `validateSupabaseToken()` using jose + Supabase JWKS (RS256, no shared secret), with module-level JWKS caching
- Created `worker.ts` as the Cloudflare Worker entry point handling CORS preflight, RFC 9728 OAuth discovery, JWT validation, and MCP requests via `WebStandardStreamableHTTPServerTransport`
- Updated `index.ts` to create `RequestContext` from stdio session and pass to `executeOperation()`, removing the `@ts-expect-error` from Plan 02
- Refactored `auth.ts` and `supabase.ts` to use `globalThis` for Node.js API access, enabling both files to compile cleanly in the Worker TypeScript context
- Both Worker (`tsconfig.worker.json`) and stdio (`tsconfig.json`) TypeScript builds pass cleanly

## Task Commits

1. **Task 1: Create auth-middleware.ts and worker.ts entry point** - `998db8f` (feat)
2. **Task 2: Update stdio entry point (index.ts) for backward compatibility** - `5915b67` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `/Users/Naegele/Developer/mcp/callvault-mcp/src/auth-middleware.ts` - JWT validation via jose + Supabase JWKS; JWKS cached per isolate
- `/Users/Naegele/Developer/mcp/callvault-mcp/src/worker.ts` - Cloudflare Worker entry: CORS, OAuth discovery, auth, stateless MCP handler with 4 tools + resources + 5 prompts
- `/Users/Naegele/Developer/mcp/callvault-mcp/src/index.ts` - RequestContext from stdio session, @ts-expect-error removed
- `/Users/Naegele/Developer/mcp/callvault-mcp/src/auth.ts` - Refactored to use globalThis for all Node.js APIs (Workers TS compat)
- `/Users/Naegele/Developer/mcp/callvault-mcp/src/supabase.ts` - Dynamic import for auth.ts, globalThis for process.env, CachedSession inlined
- `/Users/Naegele/Developer/mcp/callvault-mcp/tsconfig.json` - Excludes worker.ts and auth-middleware.ts (Worker-only files)
- `/Users/Naegele/Developer/mcp/callvault-mcp/tsconfig.worker.json` - Explicit include list, excludes src/index.ts

## Decisions Made

- Used `WebStandardStreamableHTTPServerTransport` from MCP SDK instead of `createMcpHandler` from `agents/mcp` — the latter does not exist; the former is the correct Cloudflare Workers-native transport
- Per-request `McpServer` factory (`createMcpServer`) closes over `RequestContext` — no shared state between requests
- `ctx.waitUntil(server.close())` for graceful server cleanup after response streaming completes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `createMcpHandler` does not exist in agents/mcp package**
- **Found during:** Task 1 (worker.ts creation)
- **Issue:** Plan specified `import { createMcpHandler } from "agents/mcp"` but the `agents/mcp` package only exports `McpAgent` (class for Durable Object-based MCP). No `createMcpHandler` function exists.
- **Fix:** Used `WebStandardStreamableHTTPServerTransport` from `@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js` — the correct stateless handler for Cloudflare Workers. Pattern: create McpServer, connect transport, call `transport.handleRequest(request)`.
- **Files modified:** src/worker.ts
- **Verification:** Worker TypeScript build passes; all 4 meta-tools, resources, and prompts verified present
- **Committed in:** 998db8f (Task 1 commit)

**2. [Rule 3 - Blocking] `tsconfig.worker.json` included Node.js-only files causing TS errors**
- **Found during:** Task 1 (TypeScript worker check)
- **Issue:** Worker tsconfig included all `src/**/*` files but `src/auth.ts`, `src/index.ts`, `src/supabase.ts` used Node.js APIs (`fs`, `path`, `process`), causing TS2307/TS2591 errors in the Workers context.
- **Fix:** (a) Refactored `auth.ts` to use `globalThis` casts for all Node.js API access; (b) Updated `supabase.ts` to use dynamic import for auth.ts and `globalThis` for process.env; (c) Updated `tsconfig.worker.json` to use explicit include list, excluding `src/index.ts`; (d) Updated `tsconfig.json` to exclude worker-only files.
- **Files modified:** src/auth.ts, src/supabase.ts, tsconfig.worker.json, tsconfig.json
- **Verification:** Both `npx tsc --noEmit -p tsconfig.worker.json` and `npm run build` pass with zero errors
- **Committed in:** 998db8f (Task 1 commit) and 5915b67 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes essential for the Worker to compile and run correctly. No scope creep — the final implementation is functionally equivalent to what the plan intended.

## Issues Encountered

- The `agents` package v0.1.6 does not include a `createMcpHandler` function — only `McpAgent` for Durable Object-based sessions. The stateless approach uses `WebStandardStreamableHTTPServerTransport` directly from the MCP SDK, which is the correct architecture for request-scoped MCP handling.

## User Setup Required

None — no new external service configuration required. Deployment secrets (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) are set via `wrangler secret put` as documented in Plan 01.

## Next Phase Readiness

- Worker entry point is complete and ready for `wrangler deploy` (Plan 05)
- All 4 meta-tools registered, all 5 prompts registered, all resources registered
- JWT validation wired to Supabase JWKS
- Both Worker and stdio TypeScript builds pass cleanly

## Self-Check: PASSED

- FOUND: /Users/Naegele/Developer/mcp/callvault-mcp/src/auth-middleware.ts
- FOUND: /Users/Naegele/Developer/mcp/callvault-mcp/src/worker.ts
- FOUND: /Users/Naegele/Developer/mcp/callvault-mcp/src/index.ts
- FOUND: commit 998db8f (feat(12-03): create auth-middleware.ts and worker.ts entry point)
- FOUND: commit 5915b67 (feat(12-03): update stdio entry point for backward compatibility)

---
*Phase: 12-deploy-callvault-mcp-as-remote-cloudflare-worker-with-supabase-oauth-2-1*
*Completed: 2026-02-21*
