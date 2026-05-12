# Plan 37-04 Summary — Encrypt Existing Plaintext OAuth Tokens

**Status:** TOOLING COMPLETE; manual ops run pending
**Date:** 2026-05-12
**Requirements:** SEC-09 (closes the "encrypt existing rows" tail of SEC-09)

## What Shipped

1. **Migration** `supabase/migrations/20260512000001_encrypt_existing_oauth_tokens.sql`:
   - `encrypt_existing_oauth_tokens(p_key TEXT)` RPC — idempotent, returns JSON count summary.
   - `oauth_token_encryption_status` view — ops visibility before/after.

2. **Runbook** `.planning/security/2026-05-Q2-token-encryption-baseline.md`:
   - Pre-run baseline capture procedure.
   - Encryption run command.
   - Post-run verification.
   - Key rotation guidance for future.

## Why the Run Is Manual

The encryption key is a secret (`OAUTH_ENCRYPTION_KEY`) that must not appear in source-controlled migrations. The migration installs the function; ops invokes it once with the key.

## Operator Action Required (Post-Deploy)

```sql
SELECT * FROM oauth_token_encryption_status;  -- baseline
SELECT encrypt_existing_oauth_tokens('<OAUTH_ENCRYPTION_KEY value>');
SELECT * FROM oauth_token_encryption_status;  -- verify plaintext_rows == 0
```

Capture all three outputs in the deployment log.

## Acceptance

- [x] Migration file shipped.
- [x] Audit view created.
- [x] Runbook documented.
- [ ] (ops) plaintext_rows == 0 post-run.
