---
status: resolved
trigger: "Perplexity now reaches DCR but gets HTTP 400 + invalid_client_metadata; user-side error code CLIENT_REGISTRATION_FAILED. Supabase Auth rejects grant_types containing 'client_credentials' (only 'authorization_code' and 'refresh_token' allowed)."
created: 2026-05-13T04:25:00Z
updated: 2026-05-13T04:30:00Z
resolved: 2026-05-13T04:30:00Z
---

## Current Focus

FIFTH iteration of MCP-Perplexity connectivity debug. Each prior fix was correct and necessary — Perplexity finally REACHED DCR (progress!) and then failed on Supabase's strict grant_types validation.

## Symptoms

- Perplexity error: `CLIENT_REGISTRATION_FAILED` wrapping `invalid_client_metadata`.
- Direct probe of `/mcp-register` with `grant_types: ["authorization_code", "refresh_token", "client_credentials"]`:
  ```
  HTTP/2 400
  {"code":400,"error_code":"validation_failed","msg":"400: grant_types must only contain 'authorization_code' and/or 'refresh_token'"}
  ```
- Probing only `grant_types: ["client_credentials"]` → same HTTP 400 (rules out any client_credentials being acceptable).
- Probing `response_types: ["code", "token", "id_token"]` → currently HTTP 201 (Supabase tolerates it today, but defensive filter still warranted).

## Eliminated

- NOT a DCR shape issue (mcp-dcr-missing-expires-at, still fixed).
- NOT an auth-method downgrade (mcp-dcr-public-downgrade, still fixed).
- NOT a missing-401 on the MCP server itself (mcp-server-missing-401-www-authenticate + mcp-bypassable-bearer-validation, still fixed).
- NOT a Cloudflare Worker routing problem.

## Evidence

Supabase Auth `/auth/v1/oauth/clients/register` hard-validates `grant_types` against a whitelist of exactly `['authorization_code', 'refresh_token']`. Any extra value triggers HTTP 400 with `error_code: validation_failed`. Perplexity (and likely ChatGPT) include `client_credentials` in their registration body — common for server-to-server validation or pre-OAuth handshake testing — and our proxy was forwarding it raw.

The fix is the same courteous-proxy pattern we already use for `token_endpoint_auth_method`: filter unsupported values to what Supabase accepts, default to a sensible pair if filtering removes everything.

## Root cause (plain English)

Perplexity asked for a grant type we don't support (`client_credentials`), so Supabase bounced their registration. Fix: we quietly drop the unsupported parts and accept what we can. Same approach as the auth-method remap from earlier.

## Fix (deployed)

File: `supabase/functions/mcp-oauth-register/index.ts`

Inserted between the existing `token_endpoint_auth_method` remap block and the body-forward step:

1. **Filter `grant_types`** — keep only `authorization_code` and `refresh_token`. If client requested ONLY unsupported grants (e.g. only `client_credentials`), default to the standard pair rather than send `[]` (which Supabase also rejects).
2. **Filter `response_types`** — keep only `code` per MCP spec (authorization-code flow only). Supabase today tolerates `token`/`id_token`, but stripping them matches MCP intent and protects against future Supabase tightening.
3. **Observability logs** — `console.log` each dropped value for future debug sessions.

Commit: `35a47ef9 fix(mcp): filter unsupported DCR grant_types and response_types to supabase-allowed subset`
Deploy: `supabase functions deploy mcp-oauth-register --use-api` — 2026-05-13 04:28 UTC

## Verification (6/6 PASS post-deploy)

| # | Probe | Expected | Result |
|---|---|---|---|
| V1 | `grant_types: [authorization_code, refresh_token, client_credentials]` | HTTP 201 + grant_types filtered to {ac, rt} | PASS — `client_id` issued, `client_secret` present, response shows `["authorization_code","refresh_token"]` |
| V2 | `grant_types: [client_credentials]` only | HTTP 201 + fallback to default pair | PASS — response shows `["authorization_code","refresh_token"]` |
| V3 | `grant_types: [authorization_code]` only (regression) | HTTP 201 + grant_types unchanged | PASS — response shows `["authorization_code"]` |
| V4 | `response_types: [code, token, id_token]` | HTTP 201 + response_types filtered to {code} | PASS — response shows `["code"]` |
| V5 | Full Perplexity-shape (kitchen sink: `private_key_jwt` + `client_credentials` + scope/grant_types/response_types) | HTTP 201 + all filters engaged + RFC 7591 fields present | PASS — `client_id`, `client_secret`, `client_secret_expires_at: 0`, `client_id_issued_at: 1778646590`, `token_endpoint_auth_method: client_secret_basic` (remapped), `grant_types: [ac, rt]` (filtered), `response_types: [code]` (filtered) |
| V6 | Claude Code regression: `claude mcp list` + `tools/list` + `tools/call list_workspaces` | callvault Connected, 41/41 tools, 6 workspaces | PASS |

## The chain of five bugs (still in order)

Each prior fix is still correct and still in place — Perplexity needed all five to land in series:

1. **mcp-dcr-public-downgrade** — confidential auth methods silently downgraded to public clients.
2. **mcp-dcr-missing-expires-at** — Supabase Auth missing RFC 7591 `client_secret_expires_at`.
3. **mcp-server-missing-401-www-authenticate** — `initialize`/`tools/list` returned 200 to *un*authenticated requests.
4. **mcp-bypassable-bearer-validation** — `initialize`/`tools/list` returned 200 to *invalid-token* requests; GET returned 405 with no auth hint.
5. **THIS — mcp-dcr-grant-types-rejection** — Supabase rejects `client_credentials` in grant_types; we now filter to the supported pair before forwarding.

## Resolution

root_cause: Supabase Auth's `/auth/v1/oauth/clients/register` hard-rejects any `grant_types` entry outside `{authorization_code, refresh_token}` with HTTP 400 `validation_failed`. The proxy was forwarding client-supplied grant_types raw (including Perplexity's `client_credentials`), surfacing the validation error to spec-strict clients as `invalid_client_metadata` / `CLIENT_REGISTRATION_FAILED`.

fix: Filter `grant_types` (and defensively `response_types`) in the proxy to the Supabase-allowed subset before forwarding. Default to the standard pair if filtering would produce an empty array. Log dropped values for observability.

verification: 6/6 probes pass. Mixed grant_types with `client_credentials` now succeed (HTTP 201) with filtered grants in the response. Only-`client_credentials` registrations succeed with fallback. Only-`authorization_code` unaffected (regression check). Full Perplexity-shape kitchen-sink registration produces a complete, RFC 7591-compliant response with every prior fix engaged. Claude Code still Connected, 41/41 tools spec-compliant, list_workspaces returns 6 rows.

files_changed:
  - supabase/functions/mcp-oauth-register/index.ts (added grant_types + response_types filter blocks)

commit: 35a47ef9 — fix(mcp): filter unsupported DCR grant_types and response_types to supabase-allowed subset
deploy: supabase functions deploy mcp-oauth-register --use-api (2026-05-13 04:28 UTC)

## Next user actions

1. Retry Perplexity custom connector at `https://api.callvaultai.com/mcp`. Expect success — they will now register cleanly, get a valid client_id+client_secret pair, and proceed through the OAuth authorization code flow.
2. Retry ChatGPT MCP connector at the same URL.
3. To test Claude Code: exit + relaunch, then ask "Use callvault to list my workspaces."
4. If EITHER still fails: capture from browser DevTools the next request after `/mcp-register` succeeds — almost certainly a 302 from `/auth/v1/oauth/authorize` or a POST to `/auth/v1/oauth/token`. Paste the response headers + body verbatim. The error text will probably still say "did not return a client_secret" or some other catch-all — only the raw response tells the truth.
