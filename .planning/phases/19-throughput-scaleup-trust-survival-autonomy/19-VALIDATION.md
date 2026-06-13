---
phase: 19
slug: throughput-scaleup-trust-survival-autonomy
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-13
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Brain: Vitest + Supabase CLI; Autopilot: Bun test + TypeScript typecheck |
| **Config file** | Brain: `vitest.config.ts`; Autopilot: `/Users/admin/dev/autopilot/tsconfig.json` |
| **Quick run command** | Brain: `npm test -- src/services/__tests__/admin-dashboard.service.test.ts`; Autopilot: `cd /Users/admin/dev/autopilot && bun test <touched tests>` |
| **Full suite command** | Brain: `npm test && npm run type-check && npm run build`; Autopilot: `cd /Users/admin/dev/autopilot && bun test && bun run typecheck` |
| **Estimated runtime** | Quick: ~20-90s depending on touched repo; full phase gate: ~4-8m plus linked Supabase push/type generation |

## Sampling Rate
- **After every task commit:** Run that task's `<automated>` commands exactly.
- **After every plan wave:** Brain targeted tests + typecheck for Brain waves; Autopilot touched Bun tests + typecheck for Autopilot waves.
- **Before `/gsd-verify-work`:** Brain `npm test && npm run type-check && npm run build`; Autopilot `bun test && bun run typecheck`; linked schema proof from Plan 19-01 retained in summary.
- **Max feedback latency:** 90s for targeted code tests; linked schema push/type generation may exceed this and is explicitly blocking.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | TRU-01, TRU-02, TRU-03 | T-19-01/T-19-02/T-19-03/T-19-05 | Admin-only trust schema; no silent auto promotion; defers excluded from survival | static SQL | `grep -v '^--' supabase/migrations/20260613200000_phase19_autopilot_trust.sql | grep -E "autopilot_category_trust|autopilot_trust_events|autopilot_trust_metrics|survival_due_at|canary_next_run_at"` | ❌ W0 | ⬜ pending |
| 19-01-02 | 01 | 1 | TRU-01, TRU-02, TRU-03 | T-19-01/T-19-02/T-19-05 | Linked schema is live and typed before consumers run | linked Supabase | `supabase db push --linked && supabase gen types typescript --linked --schema public > src/types/supabase.ts` | ✅ | ⬜ pending |
| 19-02-01 | 02 | 2 | TRU-02 | T-19-06/T-19-07/T-19-08 | Admin promotion requires verified admin and eligible gate, with audit | unit | `npm test -- supabase/functions/autopilot-trust-admin/__tests__/autopilot-trust-admin.test.ts` | ❌ W0 | ⬜ pending |
| 19-02-02 | 02 | 2 | TRU-01, TRU-02, TRU-03 | T-19-09 | Dashboard service uses admin RPC and mutation hooks, no direct component Supabase calls | unit/type | `npm test -- src/services/__tests__/admin-dashboard.service.test.ts && npm run type-check` | ✅ | ⬜ pending |
| 19-02-03 | 02 | 2 | TRU-01, TRU-02, TRU-03 | T-19-09 | Admin UI makes promotion explicit and shows survival as primary metric | type/static | `npm run type-check` | ✅ | ⬜ pending |
| 19-03-01 | 03 | 2 | ACT-02 | T-19-11 | Run cap/cadence only; concurrency remains 1; quiet-hours reserve headroom | bun unit/static | `cd /Users/admin/dev/autopilot && bun test src/claimer.test.ts` | ❌ W0 | ⬜ pending |
| 19-03-02 | 03 | 2 | ACT-02, TRU-01 | T-19-12/T-19-13 | Rate-limit defer releases claim with backoff, atomically restores claim-time `tickets.attempts` so attempts are unchanged versus before claim, and records separate defer accounting such as `rate_limit_defer_count` instead of failure | bun unit/static | `cd /Users/admin/dev/autopilot && bun test src/lib/claim.test.ts && grep -R "rate_limit_defer_count\\|attempts" src/lib/claim.ts src/lib/claim.test.ts` | ✅ | ⬜ pending |
| 19-03-03 | 03 | 2 | ACT-02, TRU-01 | T-19-10/T-19-13 | Runner routes rate-limit transcripts to `deferred:rate-limit`, not max-attempt failure | bun unit | `cd /Users/admin/dev/autopilot && bun test src/runner.test.ts src/lib/claim.test.ts src/lib/evidence.test.ts` | ❌ W0 | ⬜ pending |
| 19-04-01 | 04 | 3 | TRU-01, TRU-02 | T-19-14/T-19-17 | Ladder helper fails closed; auto-demotion durably updates trust rung and inserts audit event | bun unit/static | `cd /Users/admin/dev/autopilot && bun test src/lib/trust.test.ts && grep -R "auto_demoted\\|autopilot_category_trust\\|autopilot_trust_events" src/lib/trust.ts src/lib/trust.test.ts` | ❌ W0 | ⬜ pending |
| 19-04-02 | 04 | 3 | TRU-02 | T-19-14/T-19-15/T-19-16 | Approval candidates require stored auto rung plus current survival gate; no forged admin events | bun unit | `cd /Users/admin/dev/autopilot && bun test src/lib/approval.test.ts src/lib/trust.test.ts` | ✅ / ❌ W0 | ⬜ pending |
| 19-04-03 | 04 | 3 | ACT-02, TRU-02 | T-19-16 | One-cycle claimer processes trust-aware approvals without changing concurrency | bun unit/type | `cd /Users/admin/dev/autopilot && bun test src/claimer.test.ts src/lib/approval.test.ts src/lib/trust.test.ts && bun run typecheck` | ❌ W0 | ⬜ pending |
| 19-05-01 | 05 | 4 | TRU-03 | T-19-18 | Canary selects due merged fixes and uses safe replay only | bun unit | `cd /Users/admin/dev/autopilot && bun test src/lib/canary.test.ts src/lib/evidence.test.ts` | ❌ W0 | ⬜ pending |
| 19-05-02 | 05 | 4 | TRU-03 | T-19-19 | Canary failure reopens originating ticket and links run/event; no new ticket | bun unit/static | `cd /Users/admin/dev/autopilot && bun test src/lib/canary.test.ts` | ❌ W0 | ⬜ pending |
| 19-05-03 | 05 | 4 | TRU-02, ACT-02 | T-19-20/T-19-21/T-19-22 | Tier-2 obeys ladder, uses Claude-family command/model distinct from Tier-1 Codex, emits solution digest only, and runs on a distinct one-cycle cadence | bun unit/type/static | `cd /Users/admin/dev/autopilot && bun test src/lib/tier2.test.ts src/lib/trust.test.ts src/lib/canary.test.ts && bun run typecheck && grep -R "agentCommand\\|modelFamily\\|[Cc]laude\\|Hermes" autopilot.config.ts src/lib/tier2.ts src/lib/tier2.test.ts launchd/com.callvault.autopilot-tier2.plist && grep -R "ProgramArguments\\|StartInterval\\|StartCalendarInterval" launchd/com.callvault.autopilot.plist launchd/com.callvault.autopilot-tier2.plist` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

## Wave 0 Requirements
- [x] No separate Wave 0 plan is required: every missing test file is created by the first task that needs it before production behavior changes, and every such task has `<automated>` verification.
- [x] Missing Autopilot tests are explicitly named in task files: `src/claimer.test.ts`, `src/runner.test.ts`, `src/lib/trust.test.ts`, `src/lib/canary.test.ts`, and `src/lib/tier2.test.ts`.
- [x] Missing Brain Edge Function test is explicitly named in Plan 19-02: `supabase/functions/autopilot-trust-admin/__tests__/autopilot-trust-admin.test.ts`.
- [x] Linked schema push/type generation is a blocking task in Plan 19-01 before downstream consumers.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Admin trust card visual fit | TRU-01, TRU-02, TRU-03 | Layout/readability requires screenshot inspection | After Plan 19-02, open Admin Dashboard, capture desktop and mobile screenshots, and confirm survival card text/buttons do not overlap and promotion is explicit. |
| Post-activation rate-limit re-probe | ACT-02 | D-01 defers live volume raise/re-probe until Phase 17-05 activation; cannot truthfully measure in planning/execution before activation | Record `SKIPPED - gated by Phase 17-05 activation` in summary unless activation is already proven; do not raise live maxRuns during Phase 19. |

## Validation Sign-Off
- [x] All tasks have `<automated>` verify or Wave 0 deps
- [x] No 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] `nyquist_compliant: true` set

**Approval:** ready for execution; manual visual/rate-limit items are documented and do not replace automated gates.
