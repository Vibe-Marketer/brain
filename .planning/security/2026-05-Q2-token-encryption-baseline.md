# OAuth Token Encryption — Baseline & Runbook (Phase 37 Plan 37-04)

**Date:** 2026-05-12
**Related migration:** `supabase/migrations/20260512000001_encrypt_existing_oauth_tokens.sql`
**Related infra:** `supabase/migrations/20260509000001_oauth_token_encryption_helpers.sql`, `supabase/functions/_shared/oauth-encrypt.ts`

## What This Plan Delivers

Phase 27/28 shipped the OAuth token encryption infrastructure (pgcrypto RPCs + helper module + edge function integration). New OAuth flows write encrypted tokens when `OAUTH_ENCRYPTION_KEY` is set.

**Existing plaintext rows from before the infrastructure landed are still plaintext.** Plan 37-04 ships the one-shot migration tooling to encrypt them in-place, plus an audit view so ops can verify before/after counts.

## Baseline (To Be Captured at Run Time)

Baseline counts are NOT measured at plan time (operator runs in their Supabase project). Before running the encrypt function, capture the baseline:

```sql
-- Run in Supabase SQL editor with service-role access
SELECT * FROM oauth_token_encryption_status;
```

Expected columns: `table_name`, `plaintext_rows`, `encrypted_rows`, `total_rows`.

Record those numbers in the deployment log.

## Runbook — Encrypting Existing Tokens

**Prerequisites:**
1. `OAUTH_ENCRYPTION_KEY` is set as a Supabase secret (256-bit hex, generated with `openssl rand -hex 32`).
2. Migration `20260512000001_encrypt_existing_oauth_tokens.sql` has been applied (auto-applied by `supabase db push`).

**Procedure:**

```sql
-- Step 1: capture baseline
SELECT * FROM oauth_token_encryption_status;

-- Step 2: encrypt (replace <KEY> with the actual OAUTH_ENCRYPTION_KEY value)
SELECT encrypt_existing_oauth_tokens('<KEY>');
-- Returns: { "import_sources_encrypted": <N>, "user_settings_encrypted": <M> }

-- Step 3: verify all rows are now encrypted
SELECT * FROM oauth_token_encryption_status;
-- Expected: plaintext_rows = 0 for both tables; encrypted_rows = total_rows.
```

**Safety properties:**
- Idempotent: re-running step 2 skips rows whose values already start with the PGP armor header (`-----BEGIN PGP MESSAGE-----`).
- Per-row atomic: each `UPDATE` is in one transaction.
- Skips NULL values: rows with no token (`oauth_access_token IS NULL`) are untouched.

**Rollback:**
If the migration encrypts with a wrong key (operational error), the only way back is to invoke each user's OAuth refresh flow to obtain fresh plaintext tokens, which will then be re-encrypted with the correct key. There is NO decrypt-and-restore-plaintext path — once a token is encrypted, the cleartext is gone. This is by design.

## Key Rotation (Future)

If `OAUTH_ENCRYPTION_KEY` must change (e.g., suspected compromise), write a one-shot script:

```sql
-- Pseudocode — exact form depends on rotation context
UPDATE import_sources
SET
  oauth_access_token  = encrypt_token(decrypt_token(oauth_access_token,  '<OLD_KEY>'), '<NEW_KEY>'),
  oauth_refresh_token = encrypt_token(decrypt_token(oauth_refresh_token, '<OLD_KEY>'), '<NEW_KEY>')
WHERE oauth_access_token LIKE '-----BEGIN PGP MESSAGE-----%';
```

Same for `user_settings`. Document in v2.3 ops runbook when needed.

## SEC-09 Acceptance

- [x] Encryption infrastructure shipped (`store_encrypted_oauth_tokens` RPC + pgcrypto wrappers).
- [x] Edge function (`fathom-oauth-callback`) uses encrypted path when `OAUTH_ENCRYPTION_KEY` is set.
- [x] One-shot migration tooling for existing plaintext rows shipped (this plan).
- [ ] **Operator action required:** run `SELECT encrypt_existing_oauth_tokens('<key>')` in production after this phase deploys. Baseline + result captured in the deployment log.

The last item is a manual ops step because the encryption key is a secret that must not appear in source control or migrations.
