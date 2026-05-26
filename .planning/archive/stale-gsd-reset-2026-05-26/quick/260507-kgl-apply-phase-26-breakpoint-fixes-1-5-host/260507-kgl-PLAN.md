---
quick_id: 260507-kgl
type: execute
autonomous: true
files_modified:
  - cloudflare/api-proxy/worker.ts
  - supabase/functions/mcp-oauth-metadata/index.ts
  - supabase/functions/mcp-server/index.ts
must_haves:
  truths:
    - "Worker forwards X-Forwarded-Host, X-Forwarded-Proto, and X-Forwarded-For to the Supabase upstream"
    - "Worker returns a structured 502 JSON-RPC error envelope when the upstream fetch throws (no Cloudflare HTML error page)"
    - "mcp-oauth-metadata advertises a resource URI matching the host that served the request (api.callvaultai.com → api.callvaultai.com/mcp; app.callvaultai.com → app.callvaultai.com/api/mcp)"
    - "mcp-server's 401 WWW-Authenticate header points to the same host the client called (no cross-host bounce)"
    - "Responses from /.well-known/* include Vary: Origin so Cloudflare cannot serve a cached response with the wrong CORS origin"
  artifacts:
    - path: "cloudflare/api-proxy/worker.ts"
      provides: "Header-forwarding + error-handling reverse proxy"
      contains: "x-forwarded-host"
    - path: "supabase/functions/mcp-oauth-metadata/index.ts"
      provides: "Host-aware OAuth discovery documents"
      contains: "x-forwarded-host"
    - path: "supabase/functions/mcp-server/index.ts"
      provides: "Host-aware WWW-Authenticate header on 401"
      contains: "x-forwarded-host"
  key_links:
    - from: "cloudflare/api-proxy/worker.ts"
      to: "supabase/functions/mcp-oauth-metadata"
      via: "x-forwarded-host header"
      pattern: "x-forwarded-host"
    - from: "cloudflare/api-proxy/worker.ts"
      to: "supabase/functions/mcp-server"
      via: "x-forwarded-host header"
      pattern: "x-forwarded-host"
---

<objective>
Apply 5 surgical fixes from the Phase 26 Breakpoint analysis on the api.callvaultai.com vanity MCP domain.

Purpose: The Cloudflare Worker is byte-transparent and the MCP traffic flows correctly, but OAuth discovery is broken — the metadata served at `api.callvaultai.com/.well-known/*` still hardcodes `app.callvaultai.com/api/mcp` as the resource. Any MCP client doing OAuth against the vanity domain gets bounced to the old domain (RFC 8707 violation). These fixes also harden the worker against upstream errors, restore real client IPs to upstream logs, and prevent CF cache poisoning of CORS responses.

Output: 3 atomic commits — one worker (combined fixes 1/2/3/5 forwarding+error+XFF prerequisites), one mcp-oauth-metadata (Fix 1), one mcp-server (Fix 2). Vary: Origin (Fix 4) is verified — `_shared/cors.ts` already sets it, so no code change is required unless that proves wrong on inspection.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@./supabase/CLAUDE.md
@cloudflare/api-proxy/worker.ts
@cloudflare/api-proxy/wrangler.toml
@supabase/functions/mcp-oauth-metadata/index.ts
@supabase/functions/_shared/cors.ts
@supabase/functions/mcp-server/index.ts

<interfaces>
<!-- Key contracts the executor needs. Extracted directly from the codebase. -->
<!-- Use these as-is — no exploration needed. -->

From `supabase/functions/_shared/cors.ts`:
```typescript
export function getCorsHeaders(requestOrigin?: string | null): Record<string, string>;
// Returns headers including 'Vary': 'Origin' on every call. So any function
// that spreads `...corsHeaders` into its response already advertises Vary: Origin.
// Fix 4 is therefore largely already in place — verify and skip code change if so.
```

From `cloudflare/api-proxy/worker.ts` (current state):
```typescript
const STRIP_REQUEST_HEADERS = ["cf-connecting-ip", "cf-ipcountry", "cf-ray", "cf-visitor", "cf-worker"];
// Inside fetch(): forwardHeaders.set("host", new URL(target).host);
// Then: const upstream = await fetch(forwarded);  // <-- bare, no try/catch
```

From `supabase/functions/mcp-oauth-metadata/index.ts`:
```typescript
// Currently uses two module-level constants PROTECTED_RESOURCE and AUTHORIZATION_SERVER
// built from a single hardcoded APP_URL = 'https://app.callvaultai.com'.
// Both must become per-request, derived from the inbound host header.
```

From `supabase/functions/mcp-server/index.ts` line 733:
```typescript
'WWW-Authenticate': `Bearer resource_metadata="https://app.callvaultai.com/.well-known/oauth-protected-resource"`
```

Host → resource URI mapping table (canonical for both Fix 1 and Fix 2):
| Inbound host | resource | base origin (issuer, registration_endpoint, service_documentation) |
|---|---|---|
| `api.callvaultai.com` | `https://api.callvaultai.com/mcp` | `https://api.callvaultai.com` |
| `app.callvaultai.com` | `https://app.callvaultai.com/api/mcp` | `https://app.callvaultai.com` |
| anything else (preview, raw supabase URL, localhost) | `https://api.callvaultai.com/mcp` | `https://api.callvaultai.com` |

Host detection priority (both functions): `x-forwarded-host` → `host` → fallback to `api.callvaultai.com`.

Note on registration_endpoint when host = api.callvaultai.com:
The metadata should advertise `https://api.callvaultai.com/mcp-register`, but the worker does NOT yet route that path. **Defer the worker route addition** — for this PR, advertise `https://app.callvaultai.com/api/mcp-register` for ALL hosts so registration keeps working. Note this as a follow-up in the SUMMARY. (Rationale: a broken registration endpoint is worse than a cross-host one. The cross-host registration call still succeeds today; an `api.callvaultai.com/mcp-register` 404 would not.)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Worker — forward host headers, capture client IP, structured 502 on upstream errors</name>
  <files>cloudflare/api-proxy/worker.ts</files>
  <action>
Make 4 edits to the worker, all in the `fetch` handler in `cloudflare/api-proxy/worker.ts`. Order matters — apply in this sequence so each edit operates on the previous edit's output.

**Edit A — Capture CF-Connecting-IP into X-Forwarded-For BEFORE stripping it.**
In the block that builds `forwardHeaders`, BEFORE the `for (const h of STRIP_REQUEST_HEADERS) forwardHeaders.delete(h);` line, insert:

```ts
// Preserve the real client IP for upstream abuse detection / audit logs.
// CF-Connecting-IP is Cloudflare's authoritative client IP. Append to any
// existing X-Forwarded-For chain (RFC 7239 standard reverse-proxy pattern).
const clientIp = forwardHeaders.get("cf-connecting-ip");
if (clientIp) {
  const existingXff = forwardHeaders.get("x-forwarded-for");
  forwardHeaders.set("x-forwarded-for", existingXff ? `${existingXff}, ${clientIp}` : clientIp);
}
```

**Edit B — Set X-Forwarded-Host and X-Forwarded-Proto BEFORE the existing `forwardHeaders.set("host", ...)` line.**
The upstream Supabase functions need to know the original public hostname the client used (not the rewritten `*.supabase.co` host). Insert before the existing `forwardHeaders.set("host", ...)`:

```ts
// Tell the upstream which public host the client originally hit. Without this,
// the upstream sees Host: <project>.supabase.co (because we rewrite Host below)
// and can't generate host-aware responses (OAuth metadata, WWW-Authenticate, etc).
forwardHeaders.set("x-forwarded-host", url.hostname);
forwardHeaders.set("x-forwarded-proto", url.protocol.replace(":", ""));
```

The existing `forwardHeaders.set("host", new URL(target).host);` line stays untouched after these inserts.

**Edit C — Wrap the upstream fetch in try/catch with a structured error response.**
Replace the line `const upstream = await fetch(forwarded);` and the response-passthrough block immediately after it with:

```ts
let upstream: Response;
try {
  upstream = await fetch(forwarded);
} catch (err) {
  // NEVER log the request body or Authorization header. URL + error message only.
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[api-proxy] upstream fetch failed: ${target} — ${message}`);

  // /mcp is a JSON-RPC endpoint → return a JSON-RPC error envelope so MCP
  // clients can parse it. /.well-known/* is plain JSON.
  const isJsonRpc = url.pathname === "/mcp" || url.pathname.startsWith("/mcp/");
  const errorBody = isJsonRpc
    ? {
        jsonrpc: "2.0",
        error: {
          code: -32603, // JSON-RPC internal error
          message: "Upstream proxy error",
          data: { upstream_status: 502 },
        },
        id: null,
      }
    : { error: "Upstream proxy error", upstream_status: 502 };

  return new Response(JSON.stringify(errorBody), {
    status: 502,
    headers: { "Content-Type": "application/json" },
  });
}

// Pass response through, stripping internal headers.
const responseHeaders = new Headers(upstream.headers);
for (const h of STRIP_RESPONSE_HEADERS) responseHeaders.delete(h);

return new Response(upstream.body, {
  status: upstream.status,
  statusText: upstream.statusText,
  headers: responseHeaders,
});
```

**Edit D — Update the file header comment** to mention the new behavior. Edit the comment block at the top to add a line under "What this proxy does":

```
 *   - Forwards X-Forwarded-Host / -Proto / -For so upstream functions can
 *     generate host-aware responses and log real client IPs.
 *   - Returns a structured 502 JSON envelope on upstream fetch errors instead
 *     of Cloudflare's generic HTML error page.
```

(Place this in or after the existing header comment — exact placement at the executor's discretion as long as it documents the new behavior.)

DO NOT redeploy. The user will run `wrangler deploy` manually after reviewing all 3 commits.
  </action>
  <verify>
    <automated>cd /Users/Naegele/dev/brain && grep -c "x-forwarded-host" cloudflare/api-proxy/worker.ts | grep -q "^1$" || (echo "FAIL: x-forwarded-host should appear exactly once" && exit 1) ; grep -c "x-forwarded-for" cloudflare/api-proxy/worker.ts | grep -q "^1$" || (echo "FAIL: x-forwarded-for should appear exactly once" && exit 1) ; grep -q "try {" cloudflare/api-proxy/worker.ts && grep -q "Upstream proxy error" cloudflare/api-proxy/worker.ts && grep -q "\-32603" cloudflare/api-proxy/worker.ts || (echo "FAIL: try/catch + structured 502 missing" && exit 1) ; echo "OK"</automated>

Manual smoke (DO NOT execute — note for user when they deploy):
  - `cd cloudflare/api-proxy && wrangler deploy`
  - `wrangler tail` in one terminal
  - `curl -i https://api.callvaultai.com/mcp -X POST -H 'content-type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'` → expect 200 (forwarded successfully)
  - To trigger the 502 path: temporarily change `SUPABASE_BASE` to a bogus host, redeploy, hit again, expect `{"jsonrpc":"2.0","error":{"code":-32603,...}}` with HTTP 502. Revert.
  </verify>
  <done>
    - cf-connecting-ip is captured into x-forwarded-for before being stripped
    - x-forwarded-host and x-forwarded-proto are set on every forwarded request
    - Upstream fetch is wrapped in try/catch returning a structured 502 (JSON-RPC envelope for /mcp paths, plain JSON for /.well-known/*)
    - Existing behavior (Host rewrite, header stripping, body passthrough) is preserved
    - File header comment updated to document new behavior
    - Commit message: `fix(26): worker — forward x-forwarded-* headers, structured 502, real client IP`
  </done>
</task>

<task type="auto">
  <name>Task 2: mcp-oauth-metadata — host-aware discovery documents</name>
  <files>supabase/functions/mcp-oauth-metadata/index.ts</files>
  <action>
Convert `mcp-oauth-metadata` from module-level constants to per-request, host-aware document generation.

**Edit A — Remove the module-level `APP_URL`, `PROTECTED_RESOURCE`, and `AUTHORIZATION_SERVER` constants** (lines 14–42). Keep `SUPABASE_URL` since it's reused.

**Edit B — Add a `resolveResourceContext(req)` helper above `Deno.serve`:**

```ts
// Map the inbound host to (resource URI, base origin). Per Phase 26 Breakpoint
// fix #1: the metadata MUST advertise the resource URI matching the host that
// served the request, or MCP clients doing OAuth against api.callvaultai.com
// get bounced to app.callvaultai.com (RFC 8707 audience binding).
function resolveResourceContext(req: Request): { resource: string; baseOrigin: string } {
  const forwardedHost = req.headers.get('x-forwarded-host');
  const hostHeader = req.headers.get('host');
  // Vercel sets x-forwarded-host. Cloudflare Worker sets it explicitly (Phase 26).
  // Direct supabase URLs / unknown hosts fall through to the api.callvaultai.com default.
  const host = (forwardedHost || hostHeader || '').toLowerCase().split(':')[0];

  if (host === 'app.callvaultai.com') {
    // Back-compat for tokens / clients still pointing at the old URL.
    return {
      resource: 'https://app.callvaultai.com/api/mcp',
      baseOrigin: 'https://app.callvaultai.com',
    };
  }

  // api.callvaultai.com (Phase 26 vanity), preview deploys, raw supabase URL,
  // localhost — all canonicalize to the api.callvaultai.com vanity domain.
  return {
    resource: 'https://api.callvaultai.com/mcp',
    baseOrigin: 'https://api.callvaultai.com',
  };
}
```

**Edit C — Build the documents per-request inside the `Deno.serve` handler.** Replace the body-selection block (currently `const isProtectedResource = doc === 'protected-resource'; const body = isProtectedResource ? PROTECTED_RESOURCE : AUTHORIZATION_SERVER;`) with:

```ts
const { resource, baseOrigin } = resolveResourceContext(req);

// RFC 9728: OAuth Protected Resource Metadata
const protectedResource = {
  resource,
  authorization_servers: [baseOrigin],
  bearer_methods_supported: ['header'],
  scopes_supported: ['openid', 'email', 'profile', 'phone'],
};

// RFC 8414: OAuth Authorization Server Metadata
// NOTE: registration_endpoint is intentionally pinned to app.callvaultai.com
// regardless of the inbound host — the Cloudflare Worker does not yet route
// /mcp-register on api.callvaultai.com. Tracked as Phase 26 follow-up.
const authorizationServer = {
  issuer: baseOrigin,
  authorization_endpoint: `${SUPABASE_URL}/auth/v1/oauth/authorize`,
  token_endpoint: `${SUPABASE_URL}/auth/v1/oauth/token`,
  registration_endpoint: 'https://app.callvaultai.com/api/mcp-register',
  jwks_uri: `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
  scopes_supported: ['openid', 'email', 'profile', 'phone'],
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
  code_challenge_methods_supported: ['S256', 'plain'],
  token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
  service_documentation: `${baseOrigin}/settings/mcp`,
};

const isProtectedResource = doc === 'protected-resource';
const body = isProtectedResource ? protectedResource : authorizationServer;
```

**Edit D — Verify Vary: Origin handling (Fix 4).**
The response already spreads `...corsHeaders` (which `_shared/cors.ts:37` provides as `'Vary': 'Origin'`). No change required. If, after the edits above, you accidentally drop the `...corsHeaders` spread, restore it. Do NOT add a duplicate `Vary` header.

**Edit E — Update the top-of-file doc comment** to note that the metadata is now host-aware.

DO NOT redeploy. Note for user: deploy with `supabase functions deploy mcp-oauth-metadata --use-api` after reviewing.
  </action>
  <verify>
    <automated>cd /Users/Naegele/dev/brain && grep -q "resolveResourceContext" supabase/functions/mcp-oauth-metadata/index.ts && grep -q "x-forwarded-host" supabase/functions/mcp-oauth-metadata/index.ts && grep -q "api.callvaultai.com/mcp" supabase/functions/mcp-oauth-metadata/index.ts && grep -q "app.callvaultai.com/api/mcp" supabase/functions/mcp-oauth-metadata/index.ts || (echo "FAIL: host-aware logic missing" && exit 1) ; grep -c "^const PROTECTED_RESOURCE" supabase/functions/mcp-oauth-metadata/index.ts | grep -q "^0$" || (echo "FAIL: stale PROTECTED_RESOURCE constant still present" && exit 1) ; grep -c "^const AUTHORIZATION_SERVER" supabase/functions/mcp-oauth-metadata/index.ts | grep -q "^0$" || (echo "FAIL: stale AUTHORIZATION_SERVER constant still present" && exit 1) ; deno check supabase/functions/mcp-oauth-metadata/index.ts 2>&1 | tail -5 ; echo "OK if no type errors above"</automated>

Manual smoke (DO NOT execute — note for user when they deploy):
  - `supabase functions deploy mcp-oauth-metadata --use-api`
  - `curl -s https://api.callvaultai.com/.well-known/oauth-protected-resource | jq .resource` → expect `"https://api.callvaultai.com/mcp"`
  - `curl -s https://app.callvaultai.com/api/mcp/.well-known/oauth-protected-resource | jq .resource` → expect `"https://app.callvaultai.com/api/mcp"`
  - `curl -sI https://api.callvaultai.com/.well-known/oauth-protected-resource | grep -i vary` → expect `Vary: Origin`
  - `curl -s https://api.callvaultai.com/.well-known/oauth-authorization-server | jq .issuer` → expect `"https://api.callvaultai.com"`
  </verify>
  <done>
    - Module-level PROTECTED_RESOURCE and AUTHORIZATION_SERVER constants removed
    - resolveResourceContext(req) maps inbound host to (resource, baseOrigin)
    - Both documents are constructed per-request from that context
    - registration_endpoint pinned to app.callvaultai.com with comment explaining why (worker route deferred)
    - Vary: Origin still present on response (verified by grep on the response builder spreading corsHeaders)
    - `deno check` passes with no errors
    - Commit message: `fix(26): mcp-oauth-metadata — host-aware OAuth discovery (RFC 8707)`
  </done>
</task>

<task type="auto">
  <name>Task 3: mcp-server — host-aware WWW-Authenticate on 401</name>
  <files>supabase/functions/mcp-server/index.ts</files>
  <action>
Make the 401 `WWW-Authenticate` header point to the host the client originally called, so MCP clients fetch the correct discovery document instead of being bounced cross-host.

**Edit A — Add a `resolveResourceMetadataUrl(req)` helper near the top of `mcp-server/index.ts`** (after imports, before `Deno.serve`). If similar host-resolution logic already exists in this file, reuse it; otherwise add:

```ts
// Phase 26 Breakpoint fix #2: emit a WWW-Authenticate resource_metadata URL
// matching the host the client called. Without this, a client hitting
// api.callvaultai.com/mcp with no auth gets pointed at app.callvaultai.com's
// metadata, which advertises a different resource URI — RFC 8707 violation.
function resolveResourceMetadataUrl(req: Request): string {
  const forwardedHost = req.headers.get('x-forwarded-host');
  const hostHeader = req.headers.get('host');
  const host = (forwardedHost || hostHeader || '').toLowerCase().split(':')[0];

  if (host === 'app.callvaultai.com') {
    return 'https://app.callvaultai.com/.well-known/oauth-protected-resource';
  }
  // api.callvaultai.com (Phase 26), previews, raw supabase, localhost
  return 'https://api.callvaultai.com/.well-known/oauth-protected-resource';
}
```

**Edit B — At line ~733, replace the hardcoded WWW-Authenticate value.** Change:

```ts
'WWW-Authenticate': `Bearer resource_metadata="https://app.callvaultai.com/.well-known/oauth-protected-resource"`,
```

to:

```ts
'WWW-Authenticate': `Bearer resource_metadata="${resolveResourceMetadataUrl(req)}"`,
```

(The `req` variable is already in scope inside `Deno.serve(async (req) => { ... })`. If the 401 branch is in a helper that doesn't receive `req`, plumb it through or move the helper call up.)

**Edit C — Audit for other 401s in this file.** Run a quick check:

```bash
grep -n "WWW-Authenticate\|resource_metadata\|app.callvaultai.com/.well-known" supabase/functions/mcp-server/index.ts
```

If there are additional hardcoded references, update them with `resolveResourceMetadataUrl(req)` too. If no other references, leave alone.

DO NOT redeploy. Note for user: deploy with `supabase functions deploy mcp-server --use-api` after reviewing.
  </action>
  <verify>
    <automated>cd /Users/Naegele/dev/brain && grep -q "resolveResourceMetadataUrl" supabase/functions/mcp-server/index.ts && grep -q "x-forwarded-host" supabase/functions/mcp-server/index.ts || (echo "FAIL: helper or x-forwarded-host missing" && exit 1) ; grep -c "https://app.callvaultai.com/.well-known/oauth-protected-resource" supabase/functions/mcp-server/index.ts | { read n; [ "$n" -le 1 ] || { echo "FAIL: hardcoded app.callvaultai.com .well-known URL still appears $n times — should be 0 (in helper-only) or 1 (only inside resolveResourceMetadataUrl helper)"; exit 1; }; } ; deno check supabase/functions/mcp-server/index.ts 2>&1 | tail -10 ; echo "OK if no type errors above"</automated>

Manual smoke (DO NOT execute — note for user when they deploy):
  - `supabase functions deploy mcp-server --use-api`
  - `curl -i https://api.callvaultai.com/mcp -X POST -H 'content-type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_calls","arguments":{}}}'` → expect 401 with `WWW-Authenticate: Bearer resource_metadata="https://api.callvaultai.com/.well-known/oauth-protected-resource"`
  - Same call against `https://app.callvaultai.com/api/mcp` → expect `resource_metadata="https://app.callvaultai.com/.well-known/oauth-protected-resource"`
  </verify>
  <done>
    - resolveResourceMetadataUrl(req) helper added
    - WWW-Authenticate at line ~733 emits a host-aware resource_metadata URL
    - Any other hardcoded references to the old metadata URL in this file are also updated
    - `deno check` passes
    - Commit message: `fix(26): mcp-server — host-aware WWW-Authenticate header`
  </done>
</task>

</tasks>

<verification>
After all 3 tasks land (no deployments yet):

1. `git log --oneline -3` shows three commits with `fix(26):` prefix
2. `git diff main~3 main -- cloudflare/api-proxy/worker.ts supabase/functions/mcp-oauth-metadata/index.ts supabase/functions/mcp-server/index.ts` shows only the changes described above — no unrelated edits
3. No NEW external dependencies added (`git diff main~3 main -- package.json` empty)
4. `_shared/cors.ts` is unchanged (Fix 4 already covered there — no edit needed)

User then deploys (out of scope for this plan):
  - `cd cloudflare/api-proxy && wrangler deploy`
  - `supabase functions deploy mcp-oauth-metadata mcp-server --use-api`
</verification>

<success_criteria>
- 3 atomic commits, each touching exactly one deploy target (worker / oauth-metadata / mcp-server)
- All 5 Breakpoint fixes addressed:
  - Fix 1 (host-aware metadata) → Task 2
  - Fix 2 (host-aware WWW-Authenticate) → Task 3
  - Fix 3 (worker try/catch + 502) → Task 1
  - Fix 4 (Vary: Origin) → already covered by `_shared/cors.ts`, verified in Task 2
  - Fix 5 (X-Forwarded-For policy + X-Forwarded-Host prerequisite) → Task 1
- No deployments triggered by the executor — user reviews all 3 commits then deploys manually
- All automated `<verify>` greps pass
- Both `deno check` runs are clean
</success_criteria>

<output>
After completion, create `.planning/quick/260507-kgl-apply-phase-26-breakpoint-fixes-1-5-host/260507-kgl-SUMMARY.md` containing:
- The 3 commit SHAs
- The 5 Breakpoint fixes mapped to commits (table)
- The deferred follow-up: add `/mcp-register` route to the Cloudflare Worker so `registration_endpoint` can also be host-aware
- Manual deploy commands for the user, in order:
  1. `cd cloudflare/api-proxy && wrangler deploy`
  2. `supabase functions deploy mcp-oauth-metadata mcp-server --use-api`
- Smoke-test curl commands the user can paste after each deploy
</output>
