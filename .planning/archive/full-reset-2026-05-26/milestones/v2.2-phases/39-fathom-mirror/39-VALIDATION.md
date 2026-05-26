---
phase: 39
slug: fathom-mirror
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-12
---

# Phase 39 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Vitest 3.x (existing) |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- --run --reporter=dot src/lib/__tests__` |
| Full suite command | `npm test -- --run` |
| Integration tests | `*.integration.test.ts` — require `.env.test` w/ `SUPABASE_SERVICE_ROLE_KEY` |
| Estimated runtime | ~60s unit + ~120s integration |

## Sampling Rate

- After every task commit: run quick suite for changed files
- After every plan wave: run full unit suite
- Before phase verification: full unit + integration suites green
- Max feedback latency: 120 seconds

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|--------|
| 39-01-T01 | 01 | 1 | FEAT-01 | — | Mirror schema additions present (mirror_version, import_source_id, indexes) | integration | `npm test -- --run supabase/__tests__/fathom-mirror-schema.integration.test.ts` | pending |
| 39-02-T01 | 02 | 2 | FEAT-01 | — | fathom-reconcile responds to backfill mode (auth required, processes pages) | unit | `npm test -- --run supabase/functions/fathom-reconcile/__tests__/fathom-reconcile.test.ts` | pending |
| 39-02-T02 | 02 | 2 | FEAT-01 | T-39-01 | Reconcile mode rejects without RECONCILE_SECRET | unit | included in same suite | pending |
| 39-03-T01 | 03 | 3 | FEAT-01 | — | OAuth callback fires backfill via EdgeRuntime.waitUntil | unit | `npm test -- --run supabase/functions/fathom-oauth-callback/__tests__/oauth-callback-backfill.test.ts` | pending |
| 39-03-T02 | 03 | 3 | FEAT-01 | — | create-fathom-webhook auto-invoked from oauth-callback | unit | included in same suite | pending |
| 39-04-T01 | 04 | 4 | FEAT-01 | — | Cron migration registers schedule (or graceful pg_cron fallback) | integration | `npm test -- --run supabase/__tests__/fathom-reconcile-cron.integration.test.ts` | pending |
| 39-05-T01 | 05 | 5 | FEAT-01 | — | p95 of 100 searches against 5000-row mirror < 200ms | integration | `npm test -- --run src/hooks/__tests__/useGlobalSearch.p95.integration.test.ts` | pending |
| 39-05-T02 | 05 | 5 | FEAT-01 | — | Reconcile closes 5-row artificial gap | integration | included in fathom-mirror-schema suite | pending |
| 39-05-T03 | 05 | 5 | FEAT-01 | — | Multi-account: 2 fathom sources -> both contribute to library | integration | included in fathom-reconcile-cron suite | pending |

## Wave 0 Requirements

- [ ] `supabase/__tests__/fathom-mirror-schema.integration.test.ts` — schema column presence, backfill idempotency
- [ ] `supabase/functions/fathom-reconcile/__tests__/fathom-reconcile.test.ts` — unit (auth, mode routing, error paths)
- [ ] `supabase/functions/fathom-oauth-callback/__tests__/oauth-callback-backfill.test.ts` — unit (waitUntil triggered, webhook invoked)
- [ ] `supabase/__tests__/fathom-reconcile-cron.integration.test.ts` — integration (cron schedule registered, multi-account)
- [ ] `src/hooks/__tests__/useGlobalSearch.p95.integration.test.ts` — performance benchmark (5000 row seed)

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real OAuth connect -> banner appears -> calls show in library within 2 min | FEAT-01 #2 | OAuth requires real Fathom credentials | Use `.env.local` test account; sign in to app.callvaultai.com; connect Fathom; observe banner; wait; refresh library |
| Production cron fires daily at 07:00 UTC | FEAT-01 #3 | Real-time observability needs prod DB | Query `cron.job` in prod after deploy; observe next-run timestamp |

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-12
