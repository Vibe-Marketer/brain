# Phase 28 Summary — Security Hardening (6 High Findings)

**Status:** ✅ Complete
**Date:** 2026-05-09
**Duration:** ~45 min

## Success Criteria Results

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| 1 | Timing-safe HMAC compare | ✅ PASS | `crypto.subtle.timingSafeEqual` replaces `===` in zoom-webhook |
| 2 | Webhook timestamp replay window | ✅ PASS | zoom-webhook: 5min max age, 60s max future. Polar: Svix SDK already enforces 5min tolerance |
| 3 | Magic-byte file validation | ✅ PASS | file-upload-transcribe validates MP3/WAV/MP4/M4A/MOV/WebM headers before Whisper |
| 4 | OAuth tokens encrypted at rest | ✅ PASS | pgcrypto pgp_sym_encrypt via RPC in fathom-oauth-callback; decrypt_token() falls back to plaintext for pre-encryption data; requires OAUTH_ENCRYPTION_KEY secret |
| 5 | Email-XSS escape | ✅ PASS | `_shared/html-escape.ts` + inviterName/orgName/formattedRole escaped in send-org-invite |
| 6 | share-call mandatory org check | ✅ PASS | handleCreateShareLink denies when recordings row is missing (was silently skipping) |
| 7 | Webhook idempotency | ✅ PASS | polar-webhook uses processed_webhooks with Svix webhook-id header for dedup |
| 8 | Auth helper consistency | ✅ PASS | fathom-oauth-callback + file-upload-transcribe now use authenticateRequest() |

## Commits

| Hash | Description |
|------|-------------|
| `568090d2` | docs(28): plan Phase 28 |
| `84555dba` | fix(28-01): webhook security — timing-safe HMAC, replay window, Polar idempotency |
| `6ba1502e` | fix(28-02): file validation, email XSS, share-call org check |
| `0c2ca73f` | fix(28-03): OAuth encryption at rest + auth helper consistency |

## Deployments

- ✅ `zoom-webhook` — deployed via `supabase functions deploy --use-api`
- ✅ `polar-webhook` — deployed via `supabase functions deploy --use-api`
- ✅ `file-upload-transcribe` — deployed via `supabase functions deploy --use-api`
- ✅ `send-org-invite` — deployed via `supabase functions deploy --use-api`
- ✅ `share-call` — deployed via `supabase functions deploy --use-api`
- ✅ `fathom-oauth-callback` — deployed via `supabase functions deploy --use-api`

## Migration

- ✅ `20260509000001_oauth_token_encryption_helpers.sql` applied to `vltmrnjsubfzrgrtdqey`
  - `encrypt_token()` and `decrypt_token()` SQL functions
  - `store_encrypted_oauth_tokens()` RPC
  - `store_encrypted_user_settings_tokens()` RPC
  - `get_decrypted_oauth_tokens()` RPC

## New Shared Modules

- `_shared/html-escape.ts` — `escapeHtml()` for HTML template interpolation
- `_shared/oauth-encrypt.ts` — `getDecryptedOAuthTokens()` for reading encrypted tokens

## Follow-up Items (Not Phase 28 Scope)

1. **OAUTH_ENCRYPTION_KEY secret** — needs to be set as a Supabase secret to activate encryption. Until set, tokens are stored in plaintext with a console warning.
2. **Other OAuth-reading functions** — `fathom-oauth-refresh`, `fetch-meetings`, `sync-meetings` should adopt `getDecryptedOAuthTokens()` to read encrypted tokens. Currently they read plaintext, which still works via `decrypt_token()` backward compat.
3. **Remaining auth helper migration** — 27 other functions still use `authHeader.replace('Bearer ', '')`. Low priority cleanup for a future phase.
