---
status: resolved
trigger: "Perplexity 422 body: {\"error_code\":\"DCR_CLIENT_SECRET_REQUIRED\",\"message\":\"Dynamic client registration did not return a client_secret\"} — but DCR endpoint actually returns client_secret correctly; the real failure is upstream: /mcp returns HTTP 200 to unauthenticated requests so Perplexity never starts the OAuth dance."
created: 2026-05-13T04:15:00Z
updated: 2026-05-13T04:20:00Z
resolved: 2026-05-13T04:20:00Z
---

## Current Focus

THIRD iteration of MCP-Perplexity connectivity debug. Earlier fixes (DCR auth-method remap + RFC 7591 timestamp injection) were both necessary AND correct, but addressed symptoms downstream of the actual root cause. Perplexity's generic `DCR_CLIENT_SECRET_REQUIRED` error masked the real failure: the MCP server itself was returning HTTP 200 to unauthenticated `initialize` and `tools/list`, so Perplexity never discovered OAuth was required and never tried DCR at all — its parser then surfaced a catch-all error message that pointed in the wrong direction twice.

## Symptoms

- Perplexity 422 body: `{"detail":{"error_code":"DCR_CLIENT_SECRET_REQUIRED","message":"Dynamic client registration did not return a client_secret"}}` — exact same error text as previous iterations, but a NEW status code (422 vs earlier where the request reached DCR).
- Claude Code: unaffected. Uses static bearer token from `~/.claude.json`, so its first probe IS authenticated.

## Eliminated (with evidence)

- NOT a DCR shape issue. The previous fix correctly injects `client_secret`, `client_secret_expires_at: 0`, `client_id_issued_at`. Verified empirically still working post-this-fix.
- NOT a DCR auth-method downgrade. The earlier fix remapping unsupported `token_endpoint_auth_method` values to `client_secret_basic` is still in place and correct.
- NOT a Cloudflare Worker routing bug. `/mcp` reaches the function in <500ms.
- NOT a discovery doc problem. `https://api.callvaultai.com/.well-known/oauth-protected-resource` returns the correct canonical resource URI.

## Evidence

Pre-fix HTTP behavior (reproduced 2026-05-13 04:15 UTC):

```
$ curl -i -X POST https://api.callvaultai.com/mcp \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}'

HTTP/2 200
content-type: application/json
(no WWW-Authenticate header)

{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{...},"instructions":"..."}}
```

| Method (unauthenticated) | Pre-fix status | RFC 9728 / MCP 2025-06-18 says |
|---|---|---|
| `initialize` | HTTP 200 + result | HTTP 401 + WWW-Authenticate |
| `tools/list` | HTTP 200 + tools | HTTP 401 + WWW-Authenticate |
| `tools/call` | HTTP 401 + WWW-Authenticate ✓ | HTTP 401 + WWW-Authenticate |

The 401+WWW-Authenticate machinery was already in place for `tools/call` (lines 1022-1036 in `mcp-server/index.ts`). But the `initialize` and `tools/list` handlers were placed BEFORE the bearer-token check (lines 1004-1019), bypassing auth entirely. The original Phase 18 comment "initialize and tools/list must work before the client has a token" predates the MCP 2025-06-18 authorization spec which mandates 401 on ALL unauthenticated requests for OAuth-protected resources.

Why Perplexity (and likely ChatGPT) fails when initialize returns 200:
1. POSTs `initialize` to `/mcp` — gets HTTP 200 success
2. Concludes the server is open (no OAuth indicated by WWW-Authenticate)
3. Skips the full OAuth discovery cascade (`/.well-known/oauth-protected-resource` → `/.well-known/oauth-authorization-server` → DCR at `/mcp-register`)
4. Internal validator notices the connector flow lacks an OAuth client_id+secret pair
5. Bails with the generic `DCR_CLIENT_SECRET_REQUIRED` message — same string Perplexity emits for ANY "MCP server didn't behave like an OAuth-protected resource" failure mode

Why Claude Code worked anyway: it sends `Authorization: Bearer <hex-token>` from `~/.claude.json` on every request, so its first probe IS authenticated and never hits the unauthenticated codepath.

## Root cause (plain English)

Our MCP server was answering "come on in, no password needed" to the first knock at the door (`initialize`). Perplexity and ChatGPT only start looking for the password when the server says "show me your password first" (HTTP 401 + WWW-Authenticate). Because we said yes anonymously, they thought there was no OAuth at all, never tried DCR, and bailed with a misleading "did not return a client_secret" — which was actually their catch-all error for "this MCP server didn't look OAuth-protected to me." Fixed by gating ALL methods (including `initialize` and `tools/list`) behind the bearer-token check.

## Fix (deployed)

File: `supabase/functions/mcp-server/index.ts`

Moved the bearer-token check ABOVE the `initialize` and `tools/list` handlers. The same 401+WWW-Authenticate response that was already returned for `tools/call` is now returned for ALL methods when the request lacks `Authorization: Bearer <token>`. Authenticated requests still flow through to the protocol-method handlers unchanged.

Also added `realm="callvault"` to the `WWW-Authenticate` value per RFC 6750 §3.

Commit: `fix(mcp): return 401 + WWW-Authenticate resource_metadata for unauthenticated requests` (d873a14c)
Deploy: `supabase functions deploy mcp-server --use-api` — 2026-05-13 04:17 UTC

## Verification (7/7 PASS post-deploy)

| # | Probe | Expected | Result |
|---|---|---|---|
| 1 | Unauth `initialize` | HTTP 401 + WWW-Authenticate | PASS — `WWW-Authenticate: Bearer realm="callvault", resource_metadata="https://api.callvaultai.com/.well-known/oauth-protected-resource"` |
| 2 | Unauth `tools/list` | HTTP 401 + WWW-Authenticate | PASS — same header |
| 3 | Unauth `tools/call` | HTTP 401 + WWW-Authenticate (regression) | PASS — unchanged |
| 4 | Auth `initialize` | HTTP 200 | PASS |
| 5 | Auth `tools/list` | HTTP 200 + 41/41 spec-compliant tools | PASS — 41/41 outputSchema.type === object |
| 6 | Auth `tools/call list_workspaces` | 6 workspaces returned | PASS |
| 7 | `claude mcp list` | callvault Connected | PASS |

## Why the earlier fixes weren't enough (and why they're still right)

This is the third bug in a chain — each was necessary, none individually sufficient:

1. **mcp-dcr-public-downgrade** — remap unsupported `token_endpoint_auth_method` to `client_secret_basic`. NEEDED: clients asking for `private_key_jwt` were being silently downgraded to public clients with no secret. STILL CORRECT.
2. **mcp-dcr-missing-expires-at** — inject RFC 7591-required `client_secret_expires_at: 0` and `client_id_issued_at` into the DCR response. NEEDED: Supabase Auth doesn't emit these, and spec-strict parsers reject the response without them. STILL CORRECT.
3. **THIS: mcp-server-missing-401-www-authenticate** — return 401+WWW-Authenticate on unauthenticated `initialize`/`tools/list`. NEEDED: without this, Perplexity never starts the OAuth dance at all, so the previous two fixes never matter for Perplexity (only for clients like Claude Code that already have a token).

The misleading common factor: Perplexity's error message text NEVER CHANGED across all three iterations (`DCR_CLIENT_SECRET_REQUIRED` / `Dynamic client registration did not return a client_secret`) even though the underlying failure mode was completely different each time. Their error catch-all triggers on ANY divergence from RFC 9728 + RFC 7591 + MCP 2025-06-18, regardless of where in the chain things went wrong.

**Lesson for future MCP debug sessions:** when a client error message is generic and points at one layer (DCR), but server logs show no traffic at that layer, look at the layer BEFORE — the client probably never got far enough to fail where the error claims.

## Resolution

root_cause: `/mcp` returned HTTP 200 to unauthenticated `initialize` and `tools/list` requests because those handlers were placed above the bearer-token check. RFC 9728 + MCP 2025-06-18 require 401+WWW-Authenticate on EVERY unauthenticated request to an OAuth-protected MCP resource. Spec-strict clients (Perplexity, ChatGPT) treat a 200 on `initialize` as "no OAuth required", skip discovery, and surface a generic catch-all error.

fix: Move the bearer-token check above the `initialize` / `tools/list` handlers in `supabase/functions/mcp-server/index.ts`. All requests now require `Authorization: Bearer <token>`; anonymous requests get the same 401+WWW-Authenticate that was already returned for `tools/call`. Authenticated request handling unchanged.

verification: 7/7 verification probes PASS. Claude Code unaffected (always authenticates). Unauth init/list/call all return 401 with proper WWW-Authenticate. Auth init/list/call all succeed.

files_changed:
  - supabase/functions/mcp-server/index.ts (move auth check above protocol-method handlers; add realm="callvault")

commit: d873a14c — fix(mcp): return 401 + WWW-Authenticate resource_metadata for unauthenticated requests
deploy: supabase functions deploy mcp-server --use-api (2026-05-13 04:17 UTC)

## Next user actions

1. Retry Perplexity custom connector at `https://api.callvaultai.com/mcp` — expect success this time.
2. Retry ChatGPT MCP connector at the same URL — likely same root cause.
3. To test Claude Code: exit + relaunch, then ask "Use callvault to list my workspaces."
4. If Perplexity STILL fails: capture the response from `/mcp` (initialize) AND the response from `/mcp-register` from browser DevTools Network tab. Paste both response bodies verbatim. The error text will still be the misleading "did not return a client_secret" no matter what's wrong — only the raw response bodies tell the truth.
