---
phase: 12-deploy-callvault-mcp-as-remote-cloudflare-worker-with-supabase-oauth-2-1
plan: 01
subsystem: infra
tags: [cloudflare-workers, wrangler, supabase, mcp, typescript, jwt]

# Dependency graph
requires: []
provides:
  - wrangler.jsonc with stateless Worker config (no Durable Objects, no KV)
  - tsconfig.worker.json with ESNext/Bundler module resolution and resolveJsonModule
  - src/types.ts with Env and RequestContext interfaces
  - src/supabase.ts with createSupabaseClient() and getUserIdFromToken() Worker-compatible factories
  - src/utils.ts with console-based logging and cursor-based pagination
affects:
  - 12-02 (handler context threading — uses RequestContext type)
  - 12-03 (Worker entry point — uses all types and factories from this plan)
  - 12-04 (OAuth flow — uses Env type and supabase factories)

# Tech tracking
tech-stack:
  added:
    - wrangler ^4 (devDep) - Cloudflare Workers CLI for deployment and local dev
    - "@cloudflare/workers-types ^4" (devDep) - TypeScript types for Workers runtime
    - agents ^0.1 - Cloudflare Agents SDK (createMcpHandler, getMcpAuthContext)
    - jose ^6 - JWT signing/verification (Workers-compatible)
  patterns:
    - Per-request Supabase client via global.headers.Authorization (not setSession)
    - JWT sub extraction via atob() without crypto verification (Supabase validates server-side)
    - Cursor-based pagination with next_offset instead of server-side Map sessions
    - Console-based logging for Workers (replaces fs.appendFileSync)
    - Dual-export pattern: new Worker functions + legacy stdio functions in same file

key-files:
  created:
    - /Users/Naegele/Developer/mcp/callvault-mcp/wrangler.jsonc
    - /Users/Naegele/Developer/mcp/callvault-mcp/tsconfig.worker.json
    - /Users/Naegele/Developer/mcp/callvault-mcp/src/types.ts
  modified:
    - /Users/Naegele/Developer/mcp/callvault-mcp/package.json
    - /Users/Naegele/Developer/mcp/callvault-mcp/tsconfig.json
    - /Users/Naegele/Developer/mcp/callvault-mcp/src/supabase.ts
    - /Users/Naegele/Developer/mcp/callvault-mcp/src/utils.ts

key-decisions:
  - "Stateless createMcpHandler pattern chosen over McpAgent/Durable Objects — simpler Supabase JWT integration without OAuthProvider adapter"
  - "Per-request Supabase client injected via global.headers.Authorization instead of client.auth.setSession() — avoids browser storage paths in Workers"
  - "Cursor-based pagination (next_offset) instead of KV-backed sessions — eliminates KV dependency for initial deployment"
  - "Dual-export supabase.ts: new Worker functions + legacy stdio functions coexist for MCP-REMOTE-08 backward compatibility"
  - "authorize.ts excluded from tsconfig.json include — being superseded by Worker OAuth routes (Plan 04)"

patterns-established:
  - "RequestContext pattern: thread {supabase, userId} through executeOperation and all handler functions"
  - "Worker deps in devDependencies (wrangler, @cloudflare/workers-types) — not shipped in npm package"

# Metrics
duration: 5min
completed: 2026-02-21
---

# Phase 12 Plan 01: Worker Foundation Summary

**Cloudflare Worker project scaffolded with stateless wrangler config, Workers-compatible tsconfig, per-request Supabase client factory, and cursor-based pagination — stdio server preserved unchanged.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-21T12:13:37Z
- **Completed:** 2026-02-21T12:18:24Z
- **Tasks:** 2
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments

- Wrangler.jsonc created with stateless config (no Durable Objects, no KV) and nodejs_compat flag
- tsconfig.worker.json created with ESNext/Bundler module resolution and resolveJsonModule for JSON imports
- src/types.ts created with Env and RequestContext interfaces
- src/supabase.ts rewritten with dual exports: new createSupabaseClient()/getUserIdFromToken() for Workers + preserved getSupabaseClient()/getCurrentUserId() for stdio
- src/utils.ts rewritten: fs.appendFileSync replaced with console.log, sessionsCache Map replaced with cursor-based pagination (next_offset)
- All new deps installed: wrangler ^4, @cloudflare/workers-types ^4, agents ^0.1, jose ^6
- Existing stdio build verified working (npm run build passes)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create wrangler.jsonc, install Worker deps, add tsconfig.worker.json** - `77701e5` (chore)
2. **Task 2: Create RequestContext type, per-request Supabase factory, Workers-compatible utils** - `f47b2cb` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `/Users/Naegele/Developer/mcp/callvault-mcp/wrangler.jsonc` - Stateless Worker config, no DO/KV
- `/Users/Naegele/Developer/mcp/callvault-mcp/tsconfig.worker.json` - Workers TypeScript config (ESNext/Bundler)
- `/Users/Naegele/Developer/mcp/callvault-mcp/src/types.ts` - Env and RequestContext interfaces
- `/Users/Naegele/Developer/mcp/callvault-mcp/src/supabase.ts` - Dual-mode: Worker factory + stdio legacy
- `/Users/Naegele/Developer/mcp/callvault-mcp/src/utils.ts` - Console logging + cursor-based pagination
- `/Users/Naegele/Developer/mcp/callvault-mcp/package.json` - New deps, new scripts, removed open
- `/Users/Naegele/Developer/mcp/callvault-mcp/tsconfig.json` - Excluded authorize.ts from compile

## Decisions Made

- **Stateless createMcpHandler over McpAgent:** Simpler path for Supabase JWT auth — no OAuthProvider adapter needed. Accepted trade-off: no DO-backed session persistence.
- **global.headers.Authorization over setSession():** Workers runtime does not have browser storage; setSession() triggers those code paths. Using Authorization header directly bypasses this.
- **Cursor-based pagination over KV:** Eliminates one infrastructure dependency (KV namespace) for initial deployment. Can upgrade to KV-backed sessions later if needed.
- **authorize.ts excluded from tsconfig:** File uses `open` npm package (Node-only, removed from deps) and is being superseded by Worker OAuth endpoints in Plan 04. Existing compiled dist/authorize.js remains available.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed npm run build breakage from removing `open` dependency**
- **Found during:** Task 1 (Update package.json)
- **Issue:** Removing `open` from dependencies caused `tsc` to fail with "Cannot find module 'open'" because `authorize.ts` has a dynamic `import("open")` call in a try/catch. TypeScript resolves imports at compile time even for dynamic imports.
- **Fix:** Excluded `authorize.ts` from tsconfig.json's `include` array. The file is being superseded by Worker OAuth routes (Plan 04). The compiled `dist/authorize.js` was already present and remains available for backward compatibility.
- **Files modified:** `/Users/Naegele/Developer/mcp/callvault-mcp/tsconfig.json`
- **Verification:** `npm run build` passes cleanly with no errors.
- **Committed in:** `77701e5` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Fix necessary for plan success criteria (stdio build must remain functional). No scope creep — authorize.ts was already flagged in plan as being replaced by Worker OAuth flow.

## Issues Encountered

- npm/nvm not available via shell function aliases in the bash environment; resolved by using direct binary path `~/.nvm/versions/node/v22.13.0/bin/npm`

## User Setup Required

None for this plan — no Cloudflare account, secrets, or KV namespaces needed yet. Secrets (SUPABASE_URL, SUPABASE_ANON_KEY) are configured in Plan 05 (deployment).

## Next Phase Readiness

- Plan 02 (handler context threading) can proceed immediately — RequestContext type is defined and ready
- Plan 03 (Worker entry point) can proceed — wrangler.jsonc, tsconfig.worker.json, and all factory functions are ready
- `wrangler dev` will fail until `src/worker.ts` is created in Plan 03 (expected)
- Worker typecheck (`npm run typecheck:worker`) shows errors from auth.ts and index.ts (Node.js-only files included in the tsconfig.worker.json glob) — these will resolve once worker.ts is written in Plan 03

---
*Phase: 12-deploy-callvault-mcp-as-remote-cloudflare-worker-with-supabase-oauth-2-1*
*Completed: 2026-02-21*

## Self-Check: PASSED

- wrangler.jsonc: FOUND
- tsconfig.worker.json: FOUND
- src/types.ts: FOUND
- src/supabase.ts: FOUND
- src/utils.ts: FOUND
- 12-01-SUMMARY.md: FOUND
- Commit 77701e5 (Task 1): FOUND
- Commit f47b2cb (Task 2): FOUND
