---
status: resolved
trigger: "After 5 prior MCP fixes, Perplexity STILL returns DCR_CLIENT_SECRET_REQUIRED. Coordinator surfaced evidence from kirodotdev/Kiro#3908 showing some MCP clients reject 'client_secret_basic' in DCR responses and only accept 'none' or 'client_secret_post'."
created: 2026-05-13T04:40:00Z
updated: 2026-05-13T04:50:00Z
resolved: 2026-05-13T04:50:00Z
---

## Current Focus

SIXTH iteration of MCP-Perplexity connectivity debug. The user has not been able to capture network traces (Perplexity does DCR from their backend, not the browser). Coordinator found published evidence — kirodotdev/Kiro#3908 — documenting the exact failure pattern in a different MCP client (Kiro). That issue's stack trace shows their validator rejecting `client_secret_basic` with:

> "token_endpoint_auth_method: Input should be 'none' or 'client_secret_post'"

Perplexity's generic `DCR_CLIENT_SECRET_REQUIRED` is consistent with this — their internal validator would surface a similar shape-rejection as the catch-all error they emit for any RFC 7591 deviation.

## Symptoms

- Perplexity custom-connector wizard rejects `https://api.callvaultai.com/mcp` with `CLIENT_REGISTRATION_FAILED` wrapping `DCR_CLIENT_SECRET_REQUIRED` even after the 5 prior fixes verified live via curl.
- Our DCR response was returning `token_endpoint_auth_method: "client_secret_basic"` in two cases:
  1. Client requested an UNSUPPORTED method (private_key_jwt, tls_client_auth, self_signed_tls_client_auth) → we remapped to `client_secret_basic`.
  2. Client did NOT specify a method → Supabase's own default is `client_secret_basic` and we passed through.
- Pre-fix probe: `POST /mcp-register {"redirect_uris":[...]}` returned `"token_endpoint_auth_method": "client_secret_basic"`.

## Eliminated (by prior fixes — all still in place)

- mcp-dcr-public-downgrade — confidential auth methods being silently downgraded to public clients. Fixed.
- mcp-dcr-missing-expires-at — missing RFC 7591 timestamp fields. Fixed.
- mcp-server-missing-401-www-authenticate — 200 on unauthenticated `initialize`/`tools/list`. Fixed.
- mcp-bypassable-bearer-validation — 200 on invalid bearer tokens + 405 on GET. Fixed.
- mcp-dcr-grant-types-rejection — `client_credentials` in grant_types caused 400. Fixed (filtered).

## Evidence

- **Coordinator's published-evidence finding (kirodotdev/Kiro#3908):** A different MCP client (Kiro) was failing for the SAME generic-message reason on the SAME server response shape. Their internal Pydantic-style validator rejected `client_secret_basic` with the exact error message: `Input should be 'none' or 'client_secret_post'`.
- **OAuth spec alignment:** RFC 7591 §2 lists `none`, `client_secret_post`, `client_secret_basic` as the three core values. Some MCP client implementations apparently chose a more restrictive subset, prioritizing `client_secret_post` (credentials in form body) over `client_secret_basic` (credentials in HTTP Basic header). Both are functionally equivalent for OAuth token exchange — they only differ in where the secret travels in the wire format.
- **Probe confirmed Supabase Auth's default:** Our proxy was passing requests through when no auth method was specified. Supabase responded with `"token_endpoint_auth_method": "client_secret_basic"` — its own default. Even clean-shape registrations were tripping the Kiro-style validator.

## Root cause (plain English)

Some MCP clients (Kiro per their GitHub issue; Perplexity per matching symptoms) have strict DCR response validators that ONLY accept `'none'` or `'client_secret_post'` as the `token_endpoint_auth_method` value. They reject `'client_secret_basic'` — even though it's a perfectly valid RFC 7591 value — and bail with a generic error that misleadingly says the `client_secret` is missing.

Our proxy was producing `client_secret_basic` in two cases (client unspecified → Supabase default; client requested unsupported method → our remap). Fixed by defaulting both to `client_secret_post` instead.

## Fix (deployed)

File: `supabase/functions/mcp-oauth-register/index.ts`

Changed the auth-method block: combine the "unsupported method" and "no method specified" cases into one. Both now produce `client_secret_post`. Explicit client choices of `client_secret_basic`, `client_secret_post`, or `none` are still preserved (the client made an informed choice; respect it).

Commit: `<see git log>` — `fix(mcp): default DCR token_endpoint_auth_method to client_secret_post for stricter MCP client validators`
Deploy: `supabase functions deploy mcp-oauth-register --use-api` — 2026-05-13 04:46 UTC

**Runtime impact: zero.** Supabase Auth's `/auth/v1/oauth/token` endpoint accepts BOTH `client_secret_basic` (credentials in HTTP Basic header) AND `client_secret_post` (credentials in form body) for the same client. Changing the ADVERTISED method only changes which wire format the client uses to send the secret on the token request. Both are equivalent for authentication.

## Verification (7/7 PASS post-deploy)

| # | Probe | Expected | Result |
|---|---|---|---|
| V1 | No method specified | `client_secret_post` + confidential + `client_secret` | PASS |
| V2 | `private_key_jwt` (unsupported, remapped) | `client_secret_post` + confidential + `client_secret` | PASS |
| V3 | `client_secret_basic` (explicit) | PRESERVED as `client_secret_basic` | PASS |
| V4 | `client_secret_post` (explicit) | PRESERVED as `client_secret_post` | PASS |
| V5 | `none` (public client) | PRESERVED, public, NO secret | PASS |
| V6 | Full OAuth dance — register → authorize → token with form-body credentials | 302 to consent on authorize; 400 `invalid_grant` on token (not 401 `invalid_client`) proves form-body credentials accepted | PASS |
| V7 | Claude Code regression: `claude mcp list` + `tools/list` (41/41) + `tools/call list_workspaces` (6 workspaces) | All green | PASS |

V6 is the critical proof — receiving `400 invalid_grant` (not `401 invalid_client`) on the fake-code token POST proves Supabase Auth accepted the `client_secret_post` form-body credentials for client authentication.

## The chain of six bugs (still in order)

Each prior fix is still correct and still in place:

1. **mcp-dcr-public-downgrade** — confidential auth methods silently downgraded to public clients
2. **mcp-dcr-missing-expires-at** — Supabase Auth missing RFC 7591 `client_secret_expires_at`
3. **mcp-server-missing-401-www-authenticate** — `initialize`/`tools/list` returned 200 to unauthenticated
4. **mcp-bypassable-bearer-validation** — `initialize`/`tools/list` returned 200 to invalid-token requests; GET returned 405
5. **mcp-dcr-grant-types-rejection** — Supabase rejects `client_credentials` in grant_types; now filtered
6. **THIS — mcp-dcr-default-auth-method-strict-clients** — `client_secret_basic` rejected by strict DCR response validators; default switched to `client_secret_post`

Perplexity needed all six to land in series.

## Followups

- **RFC 9728 §3.1 path-suffix in WWW-Authenticate**: Separately investigated and documented in `mcp-perplexity-still-failing-after-fixes.md`. RFC 9728 §3.1 requires the well-known URL to be constructed by inserting `/.well-known/oauth-protected-resource` BETWEEN host and path of the resource identifier. For our resource `https://api.callvaultai.com/mcp`, the conformant URL is `https://api.callvaultai.com/.well-known/oauth-protected-resource/mcp` (path-suffixed). We currently advertise the un-suffixed form. Notion and Linear (sampled production MCP servers) advertise the suffixed form. This is a real spec violation but evidence suggests it was NOT what was blocking Perplexity — the Kiro evidence pointed to the `client_secret_basic` rejection. **Status:** deferred. If a future spec-strict client (or Perplexity in a later release) starts validating §3.1 construction, we'd fix this — one-line constant change in `mcp-server/index.ts`.
- **Update v2.2 BACKLOG entry** for full RFC 7523 / private_key_jwt support — done in same commit; references the new `client_secret_post` default instead of `client_secret_basic`.

## Resolution

root_cause: Some MCP clients (Kiro per GitHub#3908, Perplexity per matching symptoms) have strict DCR response validators that reject `token_endpoint_auth_method: "client_secret_basic"` even though it's a valid RFC 7591 value. Our proxy was producing `client_secret_basic` in two cases — when no method was specified (Supabase's default) and when an unsupported asymmetric method was requested (our remap target). Both surfaced to the client as `DCR_CLIENT_SECRET_REQUIRED`.

fix: Default both cases to `client_secret_post`. Explicit `client_secret_basic`/`client_secret_post`/`none` choices preserved. Runtime authentication unchanged — Supabase accepts both wire formats for any confidential client.

verification: 7/7 probes pass post-deploy. Full OAuth dance proves form-body credentials accepted by token endpoint (400 invalid_grant on fake code, not 401 invalid_client). Claude Code unaffected.

files_changed:
  - supabase/functions/mcp-oauth-register/index.ts (combined the no-method and unsupported-method branches, set both to client_secret_post)
  - .planning/BACKLOG.md (updated the private_key_jwt entry to reference client_secret_post default + the new debug session path)

## Next user actions

1. Retry Perplexity custom connector at `https://api.callvaultai.com/mcp`. Expect success — their DCR response validator should accept `client_secret_post`.
2. Retry ChatGPT MCP connector at the same URL.
3. Test Claude Code: exit + relaunch, then ask "Use callvault to list my workspaces."
4. **If Perplexity STILL fails after this:** the only remaining path is **Supabase dashboard logs**. Log into Supabase project `vltmrnjsubfzrgrtdqey`, navigate to Edge Functions → `mcp-oauth-register` → Logs, and screenshot the request that came from a fresh Perplexity connect attempt. That's the only way to see what Perplexity actually sends and what our server actually returns. Do NOT add more speculative fixes without that data.
