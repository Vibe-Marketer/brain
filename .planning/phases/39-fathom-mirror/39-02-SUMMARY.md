# Plan 39-02 Summary — fathom-reconcile Dual-Mode Edge Function

**Status:** COMPLETE (code) / PENDING-DEPLOY (edge function + RECONCILE_SECRET)
**Date:** 2026-05-12

## Deliverables

- `supabase/functions/fathom-reconcile/index.ts` (~400 lines)
  - Two modes routed on `body.mode`:
    - `backfill` (default): JWT-authenticated via `authenticateRequest`; runs
      full Fathom pagination for one source (maxPages=100).
    - `reconcile`: `X-Reconcile-Secret` header gate; iterates ALL active
      fathom `import_sources` globally, runs 30-day diff per source
      (maxPages=20).
  - Reuses `_shared`: `FathomClient.fetchWithRetry`, `runPipeline`,
    `authenticateRequest`, `getCorsHeaders`.
  - `OAUTH_ENCRYPTION_KEY` honored via `decrypt_oauth_tokens` RPC; plaintext
    fallback when key absent.
  - Inline token refresh (5-min expiry buffer) — preserves long reconcile runs.
  - Mirror writes stamp `import_source_id` (from Phase 39 schema) and
    `mirror_version=1`.
- `supabase/functions/fathom-reconcile/__tests__/fathom-reconcile.test.ts`
  - Static-analysis contract test (9 assertions, all passing).

## Operator action required

```bash
# Generate a random 32-byte hex for RECONCILE_SECRET
openssl rand -hex 32

# Set the secret on the edge function
supabase secrets set RECONCILE_SECRET=<value> --project-ref vltmrnjsubfzrgrtdqey

# Deploy with --no-verify-jwt (cron path requires it)
supabase functions deploy fathom-reconcile --use-api --no-verify-jwt
```
