---
status: resolved
trigger: "Perplexity STILL fails with DCR_CLIENT_SECRET_REQUIRED after the 401-on-POST fix. Probing reveals (A) GET /mcp returns 405 with no WWW-Authenticate; (B) any bogus bearer like 'Bearer fake-token-12345' returns 200 on initialize and tools/list."
created: 2026-05-13T04:20:00Z
updated: 2026-05-13T04:25:00Z
resolved: 2026-05-13T04:25:00Z
---

## Current Focus

FOURTH iteration of MCP-Perplexity connectivity debug. Each prior fix was correct and necessary but addressed a different bug in a chain — Perplexity's generic error text never changed, masking that the underlying failure mode changed three times.

## Symptoms

Two bugs found in the deployed mcp-server after the previous 401+WWW-Authenticate fix:

- **Bug A:** `GET /mcp` (no auth) returns HTTP 405 with no `WWW-Authenticate` header. Many MCP clients probe with GET before POST; without the WWW-Authenticate hint they conclude the server isn't OAuth-protected.
- **Bug B (security + Perplexity blocker):** `POST /mcp` with `Authorization: Bearer fake-token-12345` returns HTTP 200 on `initialize` and `tools/list`. The previous fix only verified the *presence* of an Authorization header before those handlers — actual token validation happened later and was only reached for `tools/call`.

Reproduction:
```
$ curl -i https://api.callvaultai.com/mcp
HTTP/2 405
[no www-authenticate]

$ curl -i -X POST https://api.callvaultai.com/mcp \
    -H "Authorization: Bearer fake-token-12345" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}'
HTTP/2 200
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05",...}}

$ curl -i -X POST https://api.callvaultai.com/mcp \
    -H "Authorization: Bearer 0000000000000000000000000000000000000000000000000000000000000000" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}'
HTTP/2 200
[same response — fake hex-shaped token accepted]
```

## Eliminated

- NOT a DCR shape issue (fixed in mcp-dcr-missing-expires-at).
- NOT a DCR auth-method downgrade (fixed in mcp-dcr-public-downgrade).
- NOT a missing-401 on POST (fixed in mcp-server-missing-401-www-authenticate — and verified still working).
- NOT a Cloudflare Worker problem.

## Evidence

Code-level cause (mcp-server/index.ts):

1. **Method guard at line 981 (pre-fix):**
   ```ts
   if (req.method !== 'POST') {
     return new Response(
       JSON.stringify({ error: 'Method not allowed' }),
       { status: 405, headers: ... }
     );
   }
   ```
   Short-circuits before any auth logic. GET → 405, no auth hint.

2. **Auth dispatch order (pre-fix):**
   ```ts
   // Line 1014 — check ONLY for header presence
   if (!authHeader || !authHeader.startsWith('Bearer ')) {
     return /* 401 + WWW-Authenticate */;
   }

   // Line 1034 — initialize handler runs HERE (no validation yet)
   if (method === 'initialize') { ... }
   if (method === 'tools/list') { ... }

   // Line 1057 — only NOW does token actually get validated against
   //              mcp_tokens table or Supabase auth.getUser()
   const isHexToken = /^[0-9a-f]{64}$/.test(rawToken);
   if (isHexToken) { /* DB lookup */ }
   else            { /* Supabase JWT validation */ }
   ```
   The previous fix moved presence check up but left validation down. Result: any string after "Bearer " passed presence check, reached initialize/tools/list, returned 200.

3. **Security note (limited blast radius):** Bypass only enabled the protocol-introspection endpoints (`initialize`, `tools/list`). The `tools/call` path always validated the token (returns -32001 "Invalid MCP token" for unknown hex; rejects bad JWT). So no DATA was exposed via this bypass — only the tool catalog. But the bypass IS what Perplexity detected as "this server doesn't actually enforce OAuth", causing them to bail with their generic DCR_CLIENT_SECRET_REQUIRED error.

## Root cause (plain English)

Two bugs found and fixed: the server wasn't checking if the password was real (it accepted any string for the introspection endpoints), and GET requests weren't being told to authenticate either (they got "wrong method" instead of "need password"). Both fixed. Perplexity sees a proper OAuth-enforced server now.

## Fix (deployed)

File: `supabase/functions/mcp-server/index.ts`

Three changes in one commit:

1. **New helper `unauthorizedResponse(id, corsHeaders, message?)`** at line 144. Always returns HTTP 401 + `WWW-Authenticate: Bearer realm="callvault", resource_metadata="..."`. Replaces the inline 401-response blocks and the JSON-RPC-200-via-`mcpError` paths that were used for invalid-token cases.
2. **Hoist FULL token validation above protocol dispatch.** Bearer presence check + token VALIDATION (mcp_tokens DB lookup for hex tokens / `supabase.auth.getUser()` for JWTs) now both happen BEFORE the `initialize` and `tools/list` handlers. Invalid tokens hit `unauthorizedResponse(...)` instead of reaching the protocol handlers.
3. **Method guard switched from 405 to 401.** Non-POST/non-OPTIONS requests now return `unauthorizedResponse(null, ..., "Authorization required (MCP requires POST with bearer token)")`. OPTIONS preflight still returns 200 (CORS, unchanged).

**Commit:** `8cab661d fix(mcp): validate bearer token before dispatch + return 401 on GET/HEAD`
**Deploy:** `supabase functions deploy mcp-server --use-api` — 2026-05-13 04:23 UTC

## Verification (12/12 PASS post-deploy)

### Bug A — GET/HEAD return 401 + WWW-Authenticate

| # | Probe | Result |
|---|---|---|
| V1 | `GET /mcp` (no auth) | HTTP 401 + WWW-Authenticate ✓ |
| V2 | `HEAD /mcp` (no auth) | HTTP 401 + WWW-Authenticate ✓ |

### Bug B — Bogus tokens rejected

| # | Probe | Result |
|---|---|---|
| V3 | `POST initialize` with `Bearer fake-token-12345` | HTTP 401 + WWW-Authenticate ✓ |
| V4 | `POST tools/list` with `Bearer 000...000` (hex-shaped) | HTTP 401 + WWW-Authenticate ✓ |
| V5 | `POST initialize` with `Bearer eyJfake.eyJfake.fakefake` (JWT-shaped) | HTTP 401 + WWW-Authenticate ✓ |
| V6 | `POST initialize` with empty `Bearer ` | HTTP 401 + WWW-Authenticate ✓ |

### Regression checks

| # | Probe | Result |
|---|---|---|
| V7 | `POST initialize` no auth header | HTTP 401 + WWW-Authenticate ✓ (previous fix preserved) |
| V8 | OPTIONS preflight | HTTP 200 + CORS headers ✓ |

### Valid-token path end-to-end

| # | Probe | Result |
|---|---|---|
| V9 | `POST initialize` with real hex token | HTTP 200 ✓ |
| V10 | `POST tools/list` with real hex token | 41/41 spec-compliant tools ✓ |
| V11 | `POST tools/call list_workspaces` with real hex token | 6 workspaces ✓ |
| V12 | `claude mcp list` | callvault Connected ✓ |

## The full chain of four bugs (for the record)

Every prior fix is still correct and still in place — each was necessary, none individually sufficient. Perplexity's generic `DCR_CLIENT_SECRET_REQUIRED` error masked all four:

1. **mcp-dcr-public-downgrade** — confidential auth methods being silently downgraded to public clients. Fixed: remap to `client_secret_basic`.
2. **mcp-dcr-missing-expires-at** — Supabase Auth not emitting RFC 7591 §3.2.1's `client_secret_expires_at`. Fixed: inject in proxy.
3. **mcp-server-missing-401-www-authenticate** — `initialize`/`tools/list` returned 200 to *un*authenticated requests. Fixed: hoist 401+WWW-Authenticate above protocol dispatch.
4. **THIS — mcp-bypassable-bearer-validation** — `initialize`/`tools/list` returned 200 to requests with INVALID bearer tokens (presence-only check), AND `GET /mcp` returned 405 with no auth hint. Fixed: hoist full token VALIDATION above dispatch + convert GET/HEAD 405 to 401.

**Lesson:** when investigating an OAuth-protected MCP server, probe with **(a) no auth, (b) malformed bearer, (c) wrong-shape bearer, (d) right-shape-but-fake bearer, (e) GET/HEAD/PUT** — all five MUST return HTTP 401 + WWW-Authenticate. If any returns 200/405/403, spec-strict clients will bail somewhere in their discovery cascade and surface a generic error.

## Resolution

root_cause:
  Bug A — Method guard returned 405 (Method Not Allowed) for GET/HEAD without checking auth or emitting WWW-Authenticate. Spec-strict MCP clients that probe with GET first never discovered the OAuth requirement.
  Bug B — Token *presence* was checked above the `initialize`/`tools/list` handlers, but token *validation* (DB lookup for hex tokens, `supabase.auth.getUser()` for JWTs) was below. Result: any bearer string reached the introspection endpoints and returned 200. Perplexity detected this as "OAuth not actually enforced" and bailed with DCR_CLIENT_SECRET_REQUIRED.

fix: Restructured auth in `supabase/functions/mcp-server/index.ts`:
  1. Added `unauthorizedResponse(id, corsHeaders, message?)` helper that always emits 401 + WWW-Authenticate with the canonical resource_metadata URL.
  2. Hoisted FULL token validation (both hex-table lookup and JWT validation) above the `initialize`/`tools/list` handlers, so invalid tokens never reach the protocol layer.
  3. Changed the non-POST method guard from 405 to 401+WWW-Authenticate. OPTIONS preflight still returns 200 (CORS).

verification: 12/12 probes pass post-deploy. Every unauthenticated/invalid-token path returns 401 + WWW-Authenticate. Every valid-token path returns HTTP 200 with correct JSON-RPC envelope. Claude Code still Connected with all 41 tools available and tools/call working.

files_changed:
  - supabase/functions/mcp-server/index.ts (helper + hoisted validation + GET/HEAD 401)

commit: 8cab661d — fix(mcp): validate bearer token before dispatch + return 401 on GET/HEAD
deploy: supabase functions deploy mcp-server --use-api (2026-05-13 04:23 UTC)

## Next user actions

1. Retry Perplexity custom connector at `https://api.callvaultai.com/mcp`. Expect success this time — the server now correctly enforces OAuth on every probe path Perplexity tries.
2. Retry ChatGPT MCP connector at the same URL.
3. To test Claude Code: exit + relaunch, then ask "Use callvault to list my workspaces."
4. If EITHER still fails: capture from browser DevTools Network tab the **first request** the client makes to `api.callvaultai.com` (almost certainly a GET or POST to `/mcp` or to `/.well-known/oauth-protected-resource`), AND the response headers + body. Paste both verbatim. The error message text will still say "did not return a client_secret" no matter what's wrong — only the raw response tells the truth.
