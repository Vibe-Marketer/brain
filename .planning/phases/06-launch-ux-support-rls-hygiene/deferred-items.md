# Phase 06 — Deferred Items

Out-of-scope discoveries logged during execution. Not fixed; tracked for future phases.

## 2026-06-11 (plan 06-07)

- **Pre-existing `deno check` failure in `supabase/functions/fetch-meetings/index.ts`** — `TS2345: SupabaseClient<any, "public", ...> not assignable to SupabaseClient<unknown, { PostgrestVersion: string }, never, ...>` at the `getDecryptedOAuthTokens(supabase, ...)` call. Confirmed identical on the pre-06-07 file (HEAD~1) — caused by esm.sh supabase-js type-version drift between the function's `@supabase/supabase-js@2` import and `_shared/oauth-encrypt.ts`'s client type. Does not block `--use-api` deploys (server-side bundling does not run strict type-check) and the function runs in production. Fix belongs in a dedicated edge-function type-hygiene pass, not a credential-hygiene gap-closure plan.
