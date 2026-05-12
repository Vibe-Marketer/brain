---
status: resolved
trigger: "[API_CLIENTS_ERROR] Dynamic client registration did not return a client_secret (Perplexity); ChatGPT shows connector but says 'We couldn't connect your account'"
created: 2026-05-12T23:20:00Z
updated: 2026-05-12T23:40:00Z
resolved: 2026-05-12T23:40:00Z
---

## Current Focus

Investigated `/mcp-register` endpoint behavior. Bug confirmed, but it's NOT what the coordinator hypothesized.

next_action: present root cause + fix at checkpoint, then apply.

## Symptoms

- **Perplexity:** "[API_CLIENTS_ERROR] Dynamic client registration did not return a client_secret" (confirmed by user).
- **ChatGPT:** "We couldn't connect your account. Please try again" (generic — could be same root cause OR different OAuth step).
- **Claude Code:** Working (uses static bearer token in `~/.claude.json`, doesn't do DCR).

## Eliminated (with evidence)

- NOT a generic "we never return client_secret" bug. Direct verification:
  - `curl POST /mcp-register {"redirect_uris":["..."]}` -> returns `client_secret`, `client_type: "confidential"`, `token_endpoint_auth_method: "client_secret_basic"`.
  - With `token_endpoint_auth_method: "client_secret_basic"` -> returns `client_secret`.
  - With `token_endpoint_auth_method: "client_secret_post"` -> returns `client_secret`.
  - With `token_endpoint_auth_method: "none"` (explicit public) -> NO secret (correct).
- NOT a missing migration. Supabase manages `oauth_clients` internally; no changes needed on our side.
- NOT a Cloudflare Worker routing bug. The route works: `POST /mcp-register` reaches the function in <500ms.
- NOT a discovery doc issue. `registration_endpoint` correctly resolves to `https://api.callvaultai.com/mcp-register`.

## Evidence

- Code at `supabase/functions/mcp-oauth-register/index.ts:54-63`:
  ```
  if (requestedAuth && !SUPPORTED_AUTH_METHODS.includes(requestedAuth)) {
    parsedBody.token_endpoint_auth_method = 'none';
    delete parsedBody.token_endpoint_auth_signing_alg;
    delete parsedBody.jwks_uri;
  }
  ```
  `SUPPORTED_AUTH_METHODS = ['none', 'client_secret_basic', 'client_secret_post']`.

- Probes confirming the downgrade misbehavior:
  - `private_key_jwt` -> response: `client_type: "public"`, no `client_secret`.
  - `tls_client_auth` -> response: `client_type: "public"`, no `client_secret`.
  - `self_signed_tls_client_auth` -> response: `client_type: "public"`, no `client_secret`.

- No real-world Perplexity/ChatGPT traffic in `function_logs` for last 24h. Either the discovery doc cache made them hit the old (now-removed) `app.callvaultai.com/api/mcp-register` path AND that path served the same downgrade behavior, OR they haven't retried since the previous deploy. Either way, the downgrade bug is real and will bite the next confidential-only client that retries.

- Full OAuth dance after correct DCR works: probe registered, hit `/auth/v1/oauth/authorize`, got a proper 302 redirect to the client's callback with an OAuth error envelope (only erroring because my test PKCE challenge was too short). Auth + token endpoints are wired correctly through the Cloudflare Worker.

## Root cause (plain English)

When Perplexity or ChatGPT registers with us, they say "we want to use a fancy auth method called private_key_jwt." Supabase doesn't support that, so our proxy silently rewrites their request as "use no auth at all (public client)" and Supabase happily creates a public client — which doesn't get a `client_secret`. The client then sees the response, doesn't find a secret, and gives up. The remap was well-intentioned (it prevents 400 errors) but it converts confidential-method requests into public-client responses, which is the OPPOSITE of what the client wanted.

In one sentence: the proxy downgrades "I want a strong auth method" into "I want no auth at all," when the right downgrade is "use the basic-password auth method (you still get a client_secret, just used differently)."

## Fix plan (single commit, single deploy)

**Commit 1 — fix(mcp): remap unsupported DCR auth methods to client_secret_basic, not none**

File: `supabase/functions/mcp-oauth-register/index.ts`

Change the remap target from `'none'` to `'client_secret_basic'`:

```diff
- parsedBody.token_endpoint_auth_method = 'none';
- delete parsedBody.token_endpoint_auth_signing_alg;
- delete parsedBody.jwks_uri;
+ // Remap to client_secret_basic so the response still includes a client_secret.
+ // Falling through to 'none' produced a public client with no secret, which
+ // spec-strict clients (Perplexity, ChatGPT MCP connector) reject with
+ // "Dynamic client registration did not return a client_secret".
+ parsedBody.token_endpoint_auth_method = 'client_secret_basic';
+ delete parsedBody.token_endpoint_auth_signing_alg;
+ delete parsedBody.jwks_uri;
```

Also update the comment block (lines 41-45) + the log line (line 56-58) to explain the new behavior.

**Deploy:**
- `supabase functions deploy mcp-oauth-register --use-api`

**Verification (executed after deploy):**

1. `curl POST /mcp-register {token_endpoint_auth_method:"private_key_jwt"}` -> expect `client_type: "confidential"` + `client_secret` present + `token_endpoint_auth_method: "client_secret_basic"`.
2. `curl POST /mcp-register {token_endpoint_auth_method:"tls_client_auth"}` -> expect `client_type: "confidential"` + `client_secret` present.
3. `curl POST /mcp-register {token_endpoint_auth_method:"none"}` -> expect `client_type: "public"` + NO secret (regression check — explicit public still works).
4. `curl POST /mcp-register {token_endpoint_auth_method:"client_secret_basic"}` -> expect confidential + secret (regression check).
5. Run a full OAuth dance with the newly-issued client_id+client_secret: hit `/auth/v1/oauth/authorize` -> get a code -> POST code+secret to `/auth/v1/oauth/token` -> expect access_token+refresh_token.
6. Claude Code regression: `claude mcp list` should still show callvault Connected. `curl tools/list` should still return 41 spec-compliant tools.

**User-facing followup (after I've verified):**
- Tell user to re-add Perplexity MCP at `https://api.callvaultai.com/mcp`. Expect success.
- Tell user to disconnect+reconnect CallVault MCP in ChatGPT. Expect success. If still fails, that's a new investigation.

## Resolution

root_cause: `/mcp-register` proxy was remapping unsupported `token_endpoint_auth_method` values (private_key_jwt, tls_client_auth, self_signed_tls_client_auth) to `"none"`, which made Supabase issue a PUBLIC client with no client_secret. Spec-strict clients (Perplexity, ChatGPT) rejected the registration with "Dynamic client registration did not return a client_secret".

fix: Changed remap target in `supabase/functions/mcp-oauth-register/index.ts` from `'none'` to `'client_secret_basic'`. Confidential-method requests now get confidential clients with a `client_secret` returned in the response.

verification: All 6 post-deploy checks PASS:
  1. POST /mcp-register {token_endpoint_auth_method:"private_key_jwt"} -> client_type:confidential, client_secret present, remapped to client_secret_basic. PASS.
  2. POST /mcp-register {token_endpoint_auth_method:"tls_client_auth"} -> same shape as #1. PASS.
  3. POST /mcp-register {token_endpoint_auth_method:"none"} -> client_type:public, NO secret (regression check that explicit public still works). PASS.
  4. POST /mcp-register {token_endpoint_auth_method:"client_secret_basic"} -> confidential + secret (regression check for already-supported methods). PASS.
  5. Full OAuth dance: registered (private_key_jwt -> remapped), authorize endpoint returned 302 to /oauth/consent with real authorization_id, token endpoint returned 400 invalid_grant (NOT 401 invalid_client) which proves client_secret accepted via HTTP Basic auth. PASS.
  6. Claude Code regression: `claude mcp list` shows callvault Connected. tools/list returns 41/41 spec-compliant tools. tools/call list_workspaces returns 6 workspaces. PASS.

files_changed:
  - supabase/functions/mcp-oauth-register/index.ts (remap target + comment + log message)
  - .planning/BACKLOG.md (filed RFC 7523 / private_key_jwt support followup)

commit: fix(mcp): remap unsupported DCR auth methods to client_secret_basic, not none
deploy: supabase functions deploy mcp-oauth-register --use-api (2026-05-12 23:38 UTC)
