---
status: resolved
trigger: "Customer (john@clickableimpact.com) signed up, went through Fathom OAuth connect, connection failed with a 'non-200 error type'. Was working a few days ago. All connection areas route correctly but the actual connection fails."
created: 2026-06-18
updated: 2026-06-18
---

# Debug: Fathom connect fails with non-200 (all OAuth connectors)

## Symptoms
- Expected: completing Fathom OAuth during signup connects the account.
- Actual: OAuth flow completes, redirect returns, then the connect call fails. UI shows a "non-2xx status code" error. `is_active` stays false, no tokens stored.
- Timeline: worked until ~2026-06-12; broke for new connects after that.
- Repro: sign up → connect Fathom → authorize → callback fails. John retried 6× (14:01–14:07 UTC 2026-06-18), all failed identically.
- Scope: not Fathom-specific — all OAuth connectors (Fathom/Zoom/Read.ai/Grain/Plaud) + Fireflies share the same crypto path.

## Root Cause (CONFIRMED)
`fathom-oauth-callback` exchanges the code, then calls RPC `store_encrypted_oauth_tokens` to persist tokens. That RPC throws:

```
42883  function pgp_sym_encrypt(text, text) does not exist
```

Chain:
- `store_encrypted_oauth_tokens` (SECURITY DEFINER) → `encrypt_token()` → `armor(pgp_sym_encrypt(...))`.
- `encrypt_token`/`decrypt_token` call pgcrypto **unqualified** and have no `search_path` of their own, so they inherit the caller's.
- Migration `20260612160000_pin_function_search_paths.sql` pinned the wrappers to `SET search_path = public` (security-advisor "function_search_path_mutable" fix), labeled "No behavior change."
- But pgcrypto is installed in the `extensions` schema on Supabase. With the path pinned to `public` only, `pgp_sym_encrypt`/`armor` became unresolvable → RPC error → callback returns 500 → `supabase.functions.invoke` surfaces "Edge Function returned a non-2xx status code".

Decrypt was masked: `decrypt_token`'s `WHEN OTHERS` fallback swallowed the same error and returned ciphertext as-is, silently degrading refresh paths.

Precedent: same class of bug was fixed for MCP tokens in `20260601054000_fix_mcp_token_crypto_search_path.sql` — the OAuth leaf functions were missed.

## Fix
`supabase/migrations/20260618141500_fix_oauth_token_crypto_search_path.sql`:
- Redefined `encrypt_token` and `decrypt_token` to schema-qualify pgcrypto (`extensions.pgp_sym_encrypt`, `extensions.armor`, `extensions.pgp_sym_decrypt`, `extensions.dearmor`) and pin `SET search_path = extensions, public`.
- Leaf-level fix repairs every connector at once; keeps the wrappers' `search_path = public` hardening intact.

## Verification
- Reproduced 42883 via `encrypt_token` under `search_path = public` (pre-fix).
- Post-fix: encrypt + encrypt→decrypt round-trip succeed under `search_path = public`.
- `store_encrypted_oauth_tokens` RPC tested end-to-end on a real row: tokens encrypted, `is_active=true`, decrypt returns plaintext.
- Applied to production (project `vltmrnjsubfzrgrtdqey` / callvault-ai).

## Cleanup
- Deleted John's 6 dead Fathom stuck rows + test row; cleared stale `oauth_state`/`pending_import_source_id` on his `user_settings`. John now has 0 fathom connectors → clean "not connected" state, can reconnect.
- Blast radius: John was the only user who attempted an OAuth connect after the 06-12 regression. Older stuck rows (≤06-02, other users) predate the regression and have unrelated causes — left untouched.

## Follow-ups (optional)
- Audit `20260612160000_pin_function_search_paths.sql` for any OTHER pinned SECURITY DEFINER function that transitively calls an `extensions`-schema function (same trap).
- Consider an edge-function-level test that exercises the real `store_encrypted_oauth_tokens` RPC so a future search_path pin can't silently break connect.
