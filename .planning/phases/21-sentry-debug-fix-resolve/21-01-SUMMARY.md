# Phase 21 Plan 01 Summary — Sentry Debounce + Cycle-Time + Cap Schema

**Status:** complete  
**Completed:** 2026-06-14T01:24:00Z  
**Executor:** gsd-executor / Codex

## Commits

| Task | Commit | Notes |
| --- | --- | --- |
| Task 1 — migration | `ebe250d5` | Added Sentry debounce/cycle-time/cap schema. |
| Task 2 — integration test | `b8988bfa` | Added TEST-project integration coverage. |
| Task 1 fix | `25495e47` | Renamed migration to avoid an existing local timestamp collision. |
| Schema typegen | `3df49c37` | Regenerated `src/types/supabase.ts` from linked schema. |
| Type fallout fix | `bb46bbdd` | Kept type-check green after live type regeneration. |

## What Changed

- Added `public.tickets.sentry_resolved_at`.
- Added service-role-only `public.sentry_fingerprint_cap` with RLS enabled and no user policies.
- Added service-role-only RPCs:
  - `record_fingerprint_fix_attempt(p_fingerprint, p_cap)`
  - `sentry_ticket_fixable(p_ticket_id, p_min_occurrences, p_window_minutes)`
  - `sentry_resolve_cycle_time_metrics(p_target_minutes)`
- Added integration coverage for:
  - Sentry debounce false at one occurrence.
  - Sentry debounce true at three occurrences within 15 minutes.
  - Non-Sentry tickets bypassing Sentry debounce.
  - Fingerprint cap freezing on call 4 with `newly_frozen=true` exactly once.
  - Resolved Sentry ticket appearing in resolve-ASAP metrics.
- Regenerated `src/types/supabase.ts` and adjusted local type fallout.

## Deviations

- **Migration filename:** PLAN requested `20260613230000_sentry_debounce_cycletime_cap.sql`, but the repo already had `20260613230000_admin_delete_user_orphan_profile_cleanup.sql`. Supabase CLI cannot push duplicate local migration versions. I renamed the Sentry migration to `20260613230001_sentry_debounce_cycletime_cap.sql`.
- **Full integration script:** `npm run test:integration -- sentry-cap-debounce` runs all integration globs before applying the trailing filter. It failed on unrelated suites:
  - `auto-tag-calls.integration.test.ts`: no donor recording found.
  - `share-call.integration.test.ts`: no donor recording found.
  - `qa-ticket-ingestion.integration.test.ts`: existing Phase 20 expectation conflicts with current high/critical rejection behavior.
  The Phase 21 single-file test passes against the migrated TEST project.

## Schema Push

- Linked project push:
  - `supabase db push --linked --include-all` passed.
  - Remote migration ledger shows:
    - `20260613230000`
    - `20260613230001`
- TEST project push:
  - `supabase db push --db-url "$SUPABASE_TEST_DB_URL" --include-all` passed.
- Linked RPC probe passed:
  - `record_fingerprint_fix_attempt` returned a cap row.
  - `sentry_ticket_fixable` returned `false` for a missing UUID.
  - `sentry_resolve_cycle_time_metrics` returned successfully.

## Verification

- `MIGRATION_OK` static grep: pass.
- `VITEST_INTEGRATION_OK=true node_modules/.bin/vitest run --reporter=verbose supabase/functions/sentry-resolve/__tests__/sentry-cap-debounce.integration.test.ts`: pass, 4 tests.
- `npm run type-check`: pass, 0 new errors; baseline remains 322/346.
- `npm run build`: pass.
- `git diff --exit-code -- package.json package-lock.json`: pass; zero package changes.

## Deferred

- Do not treat the full integration-script failures as Phase 21 failures. They are unrelated test-environment / prior-phase expectation issues and were not changed by this plan.
