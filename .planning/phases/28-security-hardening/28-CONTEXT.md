# Phase 28 Context — Security Hardening (6 High Findings)

## Source
2026-05-07 Edge Function security audit — 6 High-severity findings.

## Decisions

- **D-01**: Timing-safe HMAC — use `crypto.subtle.timingSafeEqual` (Web Crypto API available in Deno)
- **D-02**: Replay window — 5 min max age, 60s max future tolerance (same for Zoom + Polar)
- **D-03**: Magic bytes — validate first 12 bytes against known signatures; reject mismatches before sending to Whisper
- **D-04**: OAuth encryption at rest — `pgp_sym_encrypt`/`pgp_sym_decrypt` via pgcrypto; key from `OAUTH_ENCRYPTION_KEY` env secret; migration needed for column type changes (text → bytea or keep text with armored output)
- **D-05**: HTML escape — new `_shared/html-escape.ts` shared helper; escape `&`, `<`, `>`, `"`, `'`
- **D-06**: share-call org check — when `recording` is null (no canonical recordings row), deny the request instead of silently skipping org check
- **D-07**: Polar webhook idempotency — same `processed_webhooks` table pattern as zoom-webhook; generate event ID from `event.type` + subscription/customer ID + timestamp
- **D-08**: Auth helper consistency — replace `authHeader.replace('Bearer ', '')` with `authenticateRequest()` only in `fathom-oauth-callback` and `file-upload-transcribe` (the two files called out in the audit). Other files are out-of-scope for Phase 28 but should be migrated in a future cleanup phase.

## Constraints

- No frontend changes
- No breaking API changes
- All fixes deployed via `supabase functions deploy <name> --use-api`
- D-04 (OAuth encryption) requires a DB migration + new env secret
