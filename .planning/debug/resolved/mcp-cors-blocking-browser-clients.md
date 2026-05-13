# MCP: CORS blocking browser-based clients (Perplexity, ChatGPT web)

**Status:** RESOLVED 2026-05-13
**Root cause:** Public OAuth/MCP discovery endpoints returned `Access-Control-Allow-Origin: https://app.callvaultai.com` — locking out every browser-based MCP client.
**Fix:** New `getPublicCorsHeaders()` helper that returns `*`. Applied to `mcp-server`, `mcp-oauth-register`, `mcp-oauth-metadata`.

---

## Symptom

Perplexity's "Add Custom Connector" wizard repeatedly failed for `https://mcp.callvaultai.com/mcp` with the generic error:

```
[API_CLIENTS_ERROR] Dynamic client registration did not return a client_secret
```

Server-side logs showed **zero** POSTs from Perplexity reaching `/mcp` or `/mcp-register`. From the server's point of view, Perplexity wasn't even calling us.

Claude Desktop (native, not browser) continued to work fine — 41 tools, fully connected.

## Investigation that landed on CORS

Seven prior fixes shipped over the preceding 48 hours (all real spec-compliance bugs that needed shipping anyway):

1. `mcp-server-missing-401-www-authenticate.md` — added RFC 9728 401 + `WWW-Authenticate` header.
2. `mcp-bypassable-bearer-validation.md` — bearer-token validation moved before `initialize` / `tools/list` dispatch.
3. `mcp-server-bypassable-auth.md` — same family: don't accept just *any* bearer-shaped string.
4. `mcp-dcr-default-auth-method-strict-clients.md` — DCR `token_endpoint_auth_method` defaults to `client_secret_post`.
5. `mcp-dcr-grant-types-rejection.md` — filter `grant_types` to Supabase-supported subset.
6. `mcp-dcr-public-downgrade.md` — preserve `none` for public clients.
7. `mcp-dcr-missing-expires-at.md` — synthesize `client_secret_expires_at` + `client_id_issued_at` in the DCR response.
8. `mcp-perplexity-still-failing-after-fixes.md` — added `mcp.callvaultai.com` hostname to bypass Perplexity's cached failure.

All eight were spec-correct fixes. None of them were the actual root cause Perplexity was hitting.

The breakthrough came from **external browser automation**: a cross-origin `fetch()` to `https://mcp.callvaultai.com/.well-known/*` from `https://www.perplexity.ai` was BLOCKED by the browser at the CORS layer. Perplexity's wizard runs in the browser. Their JS got back a response — but the browser refused to let JS read the body, so they reported a generic "missing client_secret" failure even though the server returned a fully-formed response.

Why the prior server-side curl tests missed it: **curl doesn't send an `Origin` header by default**, and the server doesn't enforce CORS on no-origin requests. CORS is a browser-only enforcement layer. Every server-side probe looked perfect because the server was, in fact, perfect — the browser was the blocker.

## Why our default CORS was wrong for these endpoints

The shared `cors.ts` `getCorsHeaders()` returns one of:
- `Access-Control-Allow-Origin: https://app.callvaultai.com` (or another allowlisted origin)
- `Access-Control-Allow-Origin: <first allowed origin>` (when the request comes from an unknown origin)

That allowlist is correct for endpoints that read/write user data via Supabase session cookies — locking down to `app.callvaultai.com` prevents random websites from making credentialed cross-origin requests.

But it's **wrong** for the public OAuth/MCP surface, because those endpoints:

1. **Serve world-readable content per spec.** RFC 9728 §3, RFC 8414 §3, OIDC Discovery 1.0 §4, and RFC 7591 §3 all describe these endpoints as public. They have no auth-protected content in the response body.
2. **Are explicitly intended for cross-origin consumption.** The whole point of OAuth dynamic client registration is that any client, anywhere, can call it.
3. **Already enforce auth at a different layer.** The `/mcp` JSON-RPC endpoint requires a bearer token. CORS is not a security boundary for it — the bearer-token check is.

Every production MCP server (Notion, Linear, GitHub, etc.) uses `Access-Control-Allow-Origin: *` on these endpoints for this exact reason.

## The fix

`supabase/functions/_shared/cors.ts` — added `getPublicCorsHeaders()` helper:

```ts
export function getPublicCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    // Critical: browser JS can't read non-safelisted response headers unless
    // they're in Access-Control-Expose-Headers. WWW-Authenticate carries the
    // resource_metadata URL clients need for RFC 9728 discovery — without
    // this line, browsers hide it and OAuth discovery silently breaks.
    'Access-Control-Expose-Headers': 'WWW-Authenticate',
    'Vary': 'Origin',
  };
}
```

Then swapped `getCorsHeaders(origin)` → `getPublicCorsHeaders()` in:

- `supabase/functions/mcp-server/index.ts` (the `/mcp` JSON-RPC endpoint)
- `supabase/functions/mcp-oauth-register/index.ts` (RFC 7591 DCR)
- `supabase/functions/mcp-oauth-metadata/index.ts` (all three `/.well-known/*` discovery docs)

The existing app-origin-locked `getCorsHeaders(origin)` is untouched and still in use by every other function (auth-sensitive endpoints, user-data endpoints, etc.).

The Cloudflare Worker (`cloudflare/api-proxy/worker.ts`) was inspected and confirmed to pass response headers through unchanged — no worker redeploy needed.

## Verification

All run against `https://mcp.callvaultai.com` AND `https://api.callvaultai.com`:

```
# OPTIONS preflight (the smoking-gun test — server-side curl was blind to it
# until we added -H "Origin: ...")
curl -s -D - -o /dev/null -X OPTIONS https://mcp.callvaultai.com/mcp \
  -H "Origin: https://www.perplexity.ai" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type, authorization"
→ access-control-allow-origin: *
→ access-control-expose-headers: WWW-Authenticate

# Browser-style unauth POST
curl -s -D - -X POST https://mcp.callvaultai.com/mcp \
  -H "Origin: https://www.perplexity.ai" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}'
→ HTTP/2 401
→ access-control-allow-origin: *
→ www-authenticate: Bearer realm="callvault", resource_metadata="https://mcp.callvaultai.com/.well-known/oauth-protected-resource/mcp"
→ access-control-expose-headers: WWW-Authenticate

# Authenticated tools/list still works (regression check)
curl -s -X POST https://mcp.callvaultai.com/mcp \
  -H "Authorization: Bearer <claude-code-token>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
→ 41 tools returned

# Claude Code regression
claude mcp list | grep callvault
→ callvault: https://api.callvaultai.com/mcp (HTTP) - ✓ Connected
```

All five public endpoints verified:

| Endpoint | OPTIONS preflight | Notes |
|---|---|---|
| `/mcp` | ✓ `Allow-Origin: *` | Bearer auth still enforced inside |
| `/mcp-register` | ✓ `Allow-Origin: *` | RFC 7591 DCR — public per spec |
| `/.well-known/oauth-protected-resource` | ✓ `Allow-Origin: *` | RFC 9728 |
| `/.well-known/oauth-protected-resource/mcp` | ✓ `Allow-Origin: *` | Path-suffixed variant |
| `/.well-known/oauth-authorization-server` | ✓ `Allow-Origin: *` | RFC 8414 |
| `/.well-known/openid-configuration` | ✓ `Allow-Origin: *` | OIDC Discovery 1.0 |

## Lessons

1. **CORS issues are invisible to server-side curl tests.** Curl doesn't send an `Origin` header by default, and servers don't enforce CORS on no-origin requests. When debugging browser-based connector flows (Perplexity, ChatGPT web), every probe must include `-H "Origin: <client-origin>"` — otherwise the result is meaningless for diagnosing the actual failure.
2. **A spec-compliant server can still be unreachable by spec-compliant clients.** The previous seven fixes were all real bugs. The eighth fix (this one) was the actual blocker Perplexity reported. The other seven still needed to ship — but none of them were the reason Perplexity's wizard failed.
3. **Auth-layer CORS ≠ data-layer CORS.** Endpoints that enforce auth via bearer tokens should NOT also enforce CORS via origin allowlists. The bearer token is the access boundary; the CORS allowlist is just a browser-layer denial-of-service against the client, not a security control.
4. **`Access-Control-Expose-Headers` is a hidden trap.** A browser's `fetch()` can only read response headers in the CORS-safelisted set OR explicitly listed in `Access-Control-Expose-Headers`. `WWW-Authenticate` is NOT safelisted. Without exposing it, the RFC 9728 discovery hand-off is silently broken even when the server emits the header correctly.

## Files touched

- `supabase/functions/_shared/cors.ts` — added `getPublicCorsHeaders()`.
- `supabase/functions/mcp-server/index.ts` — use `getPublicCorsHeaders()`.
- `supabase/functions/mcp-oauth-register/index.ts` — use `getPublicCorsHeaders()`.
- `supabase/functions/mcp-oauth-metadata/index.ts` — use `getPublicCorsHeaders()`.

Cloudflare Worker (`cloudflare/api-proxy/worker.ts`) inspected — passes response headers through unchanged. No worker redeploy required.

Deploys:
```
supabase functions deploy mcp-server --use-api
supabase functions deploy mcp-oauth-register --use-api
supabase functions deploy mcp-oauth-metadata --use-api
```
