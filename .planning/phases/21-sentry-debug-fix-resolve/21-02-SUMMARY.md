# Phase 21 Plan 02 Summary — sentry-resolve Edge Function

**Status:** COMPLETE with one external verification note  
**Started:** 2026-06-14T01:25:23Z  
**Completed:** 2026-06-14T01:37:00Z

## Objective

Built and deployed the new `sentry-resolve` Edge Function for SEN-05. The function is the Sentry write-back secret holder: it accepts only the service-role daemon bearer, validates a numeric Sentry `issue_id`, and performs the raw Sentry resolve `PUT` with `{"status":"resolved"}`.

## Completed Tasks

| Task | Result | Commit |
|------|--------|--------|
| Task 1: Pure resolve logic + Deno unit test | Added `resolveInputSchema`, `stripFingerprintPrefix`, `buildResolveUrl`, `RESOLVE_BODY`; Deno unit tests pass. | `e427c401` |
| Task 2: Handler | Added daemon-only service-role authz, fail-closed config checks, zod validation, idempotent raw Sentry `PUT`, generic error responses, and `verify_jwt = true` config. | `bb4af052` |
| Task 3: Mocked integration test | Added Deno handler tests with mocked outbound Sentry fetch plus Vitest wrapper and config assertion. | `ae7d228c` |
| Task 4: Deploy + secrets | Deployed `sentry-resolve` via Supabase API and set `SENTRY_AUTH_TOKEN` + `SENTRY_ORG`; `SUPABASE_SERVICE_ROLE_KEY` is present in project secrets. | n/a |

## Verification

- `deno test supabase/functions/sentry-resolve/__tests__/sentry-resolve.deno.test.ts` — PASS, 5 tests.
- Handler grep from plan — PASS (`Deno.serve`, `resolveInputSchema`, `503`, no token logging pattern).
- `deno check supabase/functions/sentry-resolve/index.ts` — PASS.
- Config assertion — PASS; `[functions.sentry-resolve]` has `verify_jwt = true` and no `verify_jwt = false`.
- `deno test supabase/functions/sentry-resolve/__tests__/sentry-resolve.handler.deno.test.ts` — PASS, 9 mocked handler tests.
- `VITEST_INTEGRATION_OK=true ./node_modules/.bin/vitest run --reporter=verbose supabase/functions/sentry-resolve/__tests__/sentry-resolve.integration.test.ts` — PASS, 2 tests.
- `npm run test:integration -- sentry-resolve` — new `sentry-resolve` tests PASS, but the broad npm script also collected unrelated integration suites and failed on pre-existing donor fixture / QA-ingest issues outside this plan.
- `supabase functions deploy sentry-resolve --use-api` — PASS, deployed to linked project `vltmrnjsubfzrgrtdqey`.
- `supabase secrets list` — confirmed `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SUPABASE_SERVICE_ROLE_KEY` names present.
- Deployed smoke with service-role bearer and invalid `issue_id` — PASS: returned `400 {"error":"issue_id must be numeric"}`. This proves deployed auth/config/validation path without making an outbound Sentry resolve call.
- `git diff -- package.json package-lock.json` — clean; zero new npm packages.

## Deviations / Notes

- The plan's config checkpoint command used `! awk ... END{exit bad ? 1 : 0}`, which inverts a clean result under `set -e`. Used the corrected assertion without `!`.
- Supabase CLI v2.101.0 does not support `supabase secrets set --linked`; the project was already linked, so secrets were set without `--linked`.
- Supabase CLI refuses setting custom secrets that start with `SUPABASE_`; `SUPABASE_SERVICE_ROLE_KEY` was already present in project secrets.
- I could not independently verify the Sentry token scope in the Sentry UI from this CLI session. The function is deployed safely; Plan 06 will be the first real caller, and a bad token scope would surface as a generic Sentry error without leaking the token.

## Files Changed

- `supabase/config.toml`
- `supabase/functions/sentry-resolve/index.ts`
- `supabase/functions/sentry-resolve/lib.ts`
- `supabase/functions/sentry-resolve/__tests__/sentry-resolve.deno.test.ts`
- `supabase/functions/sentry-resolve/__tests__/sentry-resolve.handler.deno.test.ts`
- `supabase/functions/sentry-resolve/__tests__/sentry-resolve.integration.test.ts`
