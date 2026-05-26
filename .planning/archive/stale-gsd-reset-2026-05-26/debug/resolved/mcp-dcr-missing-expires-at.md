---
status: resolved
trigger: "[API_CLIENTS_ERROR] Dynamic client registration did not return a client_secret (Perplexity, second occurrence — fresh registration attempt, not a cache)"
created: 2026-05-13T04:00:00Z
updated: 2026-05-13T04:10:00Z
resolved: 2026-05-13T04:10:00Z
---

## Current Focus

Continuation of `.planning/debug/resolved/mcp-dcr-public-downgrade.md`. The earlier fix (remap unsupported auth methods to `client_secret_basic` instead of `none`) was necessary but NOT sufficient. Perplexity continued to fail with the same error after the deploy, prompting deeper inspection of the response shape against RFC 7591 §3.2.1.

## Symptoms

- Perplexity: `[API_CLIENTS_ERROR] Dynamic client registration did not return a client_secret` — even though `client_secret` IS present in our response. User confirmed via screenshot that they were doing a fresh "Add custom connector" with the correct canonical URL `https://api.callvaultai.com/mcp`, ruling out client-side caching.
- ChatGPT: still "We couldn't connect your account" — likely the same root cause.

## Eliminated (with evidence)

- NOT a missing `client_secret`. Verified empirically: all 4 confidential-client probes return `client_secret`.
- NOT a Cloudflare Worker routing bug. Endpoint reachable and forwarding correctly.
- NOT a discovery doc problem. `registration_endpoint = https://api.callvaultai.com/mcp-register` is correct.
- NOT a token_endpoint_auth_method mismatch. After the previous fix, all confidential paths return `client_secret_basic`.

## Evidence

Pre-fix response shape (from `curl POST /mcp-register {redirect_uris:[...]}`):

```json
{
  "client_id": "ce855069-d4eb-484d-89cc-2164648e5315",
  "client_secret": "g63B1lIFUaOOzLrmuPKPXNho_xpBVN9pyttxe82liAA",
  "client_type": "confidential",
  "redirect_uris": ["https://example.com/cb"],
  "token_endpoint_auth_method": "client_secret_basic",
  "grant_types": ["authorization_code","refresh_token"],
  "response_types": ["code"],
  "registration_type": "dynamic",
  "created_at": "2026-05-13T03:58:41.071369271Z",
  "updated_at": "2026-05-13T03:58:41.071488Z"
}
```

**Missing RFC 7591 §3.2.1 fields:**
- `client_secret_expires_at` — REQUIRED whenever `client_secret` is issued. RFC verbatim: "REQUIRED if `client_secret` is issued. Time at which the client secret will expire or 0 if it will not expire. The time is represented as the number of seconds from 1970-01-01T00:00:00Z as measured in UTC until the date/time of expiration."
- `client_id_issued_at` — RECOMMENDED. Same epoch-seconds format.

RFC 7591 example response from the spec includes BOTH fields. Spec-strict parsers (Perplexity, ChatGPT MCP connector) treat a missing `client_secret_expires_at` alongside a present `client_secret` as malformed and surface a generic "did not return a client_secret" error — misleading but consistent with how RFC 7591 §3.2.1 mandates the field be issued together.

## Root cause (plain English)

Our DCR response was missing one required timestamp field that Perplexity insists on per the spec. The `client_secret` was there, but without `client_secret_expires_at` next to it, Perplexity's parser flagged the whole thing as broken and bailed with a generic error that misleadingly said the secret was missing. The fix injects the field in the proxy on the way out. Supabase Auth doesn't emit it, so we synthesize it.

## Fix (deployed)

File: `supabase/functions/mcp-oauth-register/index.ts`

After the proxy fetches Supabase Auth's registration response, parse the body and inject:
- `client_id_issued_at`: derived from `created_at` epoch seconds (fallback to `Date.now()`)
- `client_secret_expires_at`: `0` (never expires per RFC 7591) — only when `client_secret` is present

Public clients (no secret) get `client_id_issued_at` but correctly OMIT `client_secret_expires_at` (nothing to expire).

Non-JSON responses or non-2xx are passed through unchanged (defensive).

**Commit:** `fix(mcp): add RFC 7591-required client_secret_expires_at to DCR response`
**Deploy:** `supabase functions deploy mcp-oauth-register --use-api` — 2026-05-13 04:06 UTC

## Verification (all PASS)

| # | Probe | Expected | Result |
|---|---|---|---|
| 1 | `token_endpoint_auth_method: "private_key_jwt"` | confidential + `client_secret_expires_at: 0` + `client_id_issued_at: <epoch>` | PASS — `client_secret_expires_at: 0`, `client_id_issued_at: 1778645158` |
| 2 | default (no auth method specified) | confidential + both timestamps | PASS — `client_secret_expires_at: 0`, `client_id_issued_at: 1778645159` |
| 3 | `token_endpoint_auth_method: "none"` (public) | public, NO `client_secret_expires_at`, YES `client_id_issued_at` | PASS — only `client_id_issued_at: 1778645159` present, no `client_secret_expires_at` (correct — no secret to expire) |
| 4 | Perplexity-shape body + Accept header + UA | confidential + both timestamps | PASS — `client_secret_expires_at: 0` |
| 5 | Claude Code regression: `claude mcp list` + `tools/list` + `tools/call list_workspaces` | callvault Connected, 41/41 tools, 6 workspaces | PASS — Connected, 41/41, 6 workspaces |

## Why the earlier fix wasn't enough

The previous session (`mcp-dcr-public-downgrade.md`) fixed a real bug — confidential auth method requests were being silently downgraded to public clients — but it only addressed one of two RFC 7591 violations Perplexity was tripping on. Once confidential clients started getting `client_secret`, Perplexity moved one step further in its validation and then failed on the missing `client_secret_expires_at`. The `[API_CLIENTS_ERROR]` message text was IDENTICAL across both failure modes because Perplexity's catch-all for malformed DCR responses is "did not return a client_secret" regardless of the actual missing field.

Lesson for future debug sessions: when a client error message hasn't changed but the underlying server behavior has, don't assume the bug is unfixed — verify the full response shape against the relevant spec line by line.

## Resolution

root_cause: Supabase Auth's `/auth/v1/oauth/clients/register` endpoint does not emit `client_secret_expires_at` (REQUIRED per RFC 7591 §3.2.1 whenever `client_secret` is issued) or `client_id_issued_at` (RECOMMENDED). Spec-strict MCP clients (Perplexity, likely ChatGPT) treat the missing required field as a malformed response and report it via a generic "did not return a client_secret" error.

fix: In `supabase/functions/mcp-oauth-register/index.ts`, augment Supabase's response in the proxy on 2xx: inject `client_id_issued_at` (from `created_at`) and `client_secret_expires_at: 0` (only when `client_secret` is present). Defensive: pass through unchanged on parse failure or non-2xx.

verification: 5/5 verification probes PASS. Claude Code unaffected — still Connected, 41 spec-compliant tools, list_workspaces returns 6 workspaces.

files_changed:
  - supabase/functions/mcp-oauth-register/index.ts (added response augmentation block)

commit: `fix(mcp): add RFC 7591-required client_secret_expires_at to DCR response`
deploy: `supabase functions deploy mcp-oauth-register --use-api` (2026-05-13 04:06 UTC)

## Next user actions

1. Retry Perplexity custom connector at `https://api.callvaultai.com/mcp` — expect success.
2. Retry ChatGPT MCP connector at same URL — expect success.
3. If EITHER still fails, capture the EXACT response Perplexity/ChatGPT sees by inspecting browser DevTools Network tab during the connect attempt — paste the response body verbatim. That's the only way to identify the next missing field (if any).
