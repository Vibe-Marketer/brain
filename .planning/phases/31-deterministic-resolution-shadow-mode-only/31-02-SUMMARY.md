---
phase: 31-deterministic-resolution-shadow-mode-only
plan: 02
subsystem: database
tags: [postgres, plpgsql, security-definer, supabase-edge-functions, vitest, pg_cron, reversibility]

# Dependency graph
requires:
  - phase: 31-deterministic-resolution-shadow-mode-only
    plan: 01
    provides: event_match_decisions ledger, organization_feature_flags gate, _shared/event-resolver.ts (runShadowSweep), resolve-events edge function -- all live on TEST
provides:
  - apply_event_match_atomic / reverse_event_match_atomic RPC pair (MATCH-10), SECURITY DEFINER, service-role-only, proven by a direct integration test, never wired to the automatic sweep
  - event-resolution-sweep pg_cron job (every 15 min -> resolve-events, mode=shadow), mirrors fathom-daily-reconcile
  - event_match_decisions' UNIQUE constraint corrected to a partial index so merge_proposed / merge_applied / reversed rows can coexist for the same pair+tier
affects: [31-03, 31-04-prod-apply-and-cron, phase-32-metadata-tier]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ownership validated BY PARAMETER via NOT EXISTS (SELECT ... WHERE id=... AND owner_user_id=...), never auth.uid() or a raw <> comparison -- mirrors split_recording_atomic exactly and correctly denies when owner_user_id IS NULL"
    - "Partial UNIQUE index scoped to a specific decision value (WHERE decision = 'merge_proposed') instead of a table-wide UNIQUE constraint -- lets an append-only ledger enforce idempotency for one write path (the automatic sweep) while allowing other write paths (apply/reverse) to add further rows for the same natural key"
    - "Canonical pair ordering (IF a < b THEN ... ELSE swap) computed inline in the RPC body, matching the CHECK constraint and the sweep's own findDeterministicMatches ordering"

key-files:
  created:
    - supabase/migrations/20260901000003_create_event_match_apply_reverse_rpcs.sql
    - supabase/migrations/20260901000004_event_resolution_sweep_cron.sql
    - src/test/event-match-apply-reverse.integration.test.ts
  modified:
    - type-baseline.json
    - .planning/phases/31-deterministic-resolution-shadow-mode-only/deferred-items.md

key-decisions:
  - "Rule 1 bug fix: replaced event_match_decisions' table-wide UNIQUE(recording_id_a, recording_id_b, tier) (from 20260901000002) with a partial unique index scoped to decision='merge_proposed' -- the wide constraint made it structurally impossible for a merge_applied row (this plan's own deliverable) to ever coexist with a prior row for the same pair+tier, contradicting MATCH-10 itself. Verified against the live TEST constraint name before touching it. Preserves the shadow sweep's Pattern-3 idempotency unchanged (confirmed by re-running Plan 01's own sweep test)."
  - "reverse_event_match_atomic's decided_by is hardcoded to 'admin' -- the locked signature (31-01 Task 1 gate) carries no actor-role parameter, and every caller of a service-role-only, never-automated reversal capability is an admin action by construction"
  - "apply_event_match_atomic derives the new event's canonical_start_time/canonical_end_time as LEAST(start)/GREATEST(end) across the merged pair -- proven by a dedicated assertion using two recordings with deliberately distinct, non-overlapping-in-a-trivial-way start/end times"
  - "Rule 1 fix (out-of-plan-file but zero-risk): registered one new, permanently-expected type-check baseline key for _shared/event-resolver.ts's Deno esm.sh import (unresolvable under Node's tsc by construction) -- Plan 01 created the file but never ran --update-baseline; this plan's own files introduced zero new type errors"

patterns-established:
  - "Reversible atomic merge/reverse pair, built and integration-tested as a standalone capability, deliberately never imported by the automatic path that would otherwise be tempted to call it -- the SAFE-02 boundary is proven both by a grep-style acceptance check (Task 1) and a runtime source-scan assertion inside the test suite itself (Task 2)"

requirements-completed: [MATCH-10, SAFE-02]

# Metrics
duration: ~55min
completed: 2026-09-01
---

# Phase 31 Plan 02: Reversible Merge RPCs + Sweep Cron Summary

**Atomic `apply_event_match_atomic`/`reverse_event_match_atomic` RPC pair proven via a 6-assertion direct integration test (round trip, both ownership guards, SAFE-02 source-scan) on TEST, plus the `event-resolution-sweep` pg_cron job -- and a real pre-existing schema bug found and fixed along the way: the ledger's original UNIQUE constraint made reversibility structurally impossible.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-09-01
- **Tasks:** 2 (both executed)
- **Files created:** 3 (2 migrations, 1 integration test)
- **Files modified:** 2 (type-baseline.json, deferred-items.md)

## Accomplishments

- Authored and applied `apply_event_match_atomic` / `reverse_event_match_atomic` to TEST: both SECURITY DEFINER, `SET search_path = public`, ownership validated by parameter via the exact `NOT EXISTS` idiom `split_recording_atomic` uses, `REVOKE EXECUTE FROM PUBLIC/anon/authenticated` (verified live via `has_function_privilege` -- anon/authenticated both `false`, service_role `true`)
- Found and fixed a real, verified-live schema bug before it could block MATCH-10: `event_match_decisions`' table-wide `UNIQUE(recording_id_a, recording_id_b, tier)` (from Plan 01) made it impossible for a `merge_applied` row to ever coexist with a prior row for the same pair+tier -- replaced with a partial unique index scoped to `decision = 'merge_proposed'`, which preserves the shadow sweep's idempotency exactly while unblocking apply/reverse
- Authored and applied the `event-resolution-sweep` pg_cron job (every 15 minutes -> `resolve-events`, `{"mode":"shadow"}`), mirroring `fathom-daily-reconcile`'s structure exactly, confirmed registered and active on TEST
- Proved the full round trip with a direct integration test: apply creates an event (canonical start/end correctly derived as LEAST/GREATEST across the merged pair) and sets both recordings' `event_id`; reverse nulls both back to NULL and writes a `reversed` row referencing the applied decision; both RPCs reject a non-owner `p_owner_user_id`; a runtime source-scan proves `_shared/event-resolver.ts` never references either RPC name (SAFE-02)
- Confirmed via `supabase migration list --linked` against prod (`vltmrnjsubfzrgrtdqey`) that neither of this plan's migrations -- nor Plan 01's -- have an entry in the Remote column; both migrations exist on TEST only
- Root-caused (not guessed) the "full-suite integration run corrupts in-flight fixtures" symptom Plan 01 could only speculate about: every integration test's `afterAll` calls `cleanup_test_fixture_users(p_max_age_minutes: 0)`, which defeats that RPC's own documented age-threshold protection against racing in-flight test runs. Confirmed with a direct `23503` FK-violation trace, swept the resulting orphaned Phase-30 fixture rows off TEST, and logged the finding with two concrete remediation options for whoever owns integration test infra next

## Task Commits

1. **Task 1: Author the apply/reverse RPC pair + the sweep cron, apply both to TEST** - `d8c359f5` (feat)
2. **Task 2: Prove apply->reverse round-trips atomically, called directly** - `f9d8b42e` (test)
3. **Deferred-items log + type-baseline fix (found during Task 2 verification)** - `cf9263d9` (docs)

**Plan metadata:** (this commit, immediately following)

## Files Created/Modified

- `supabase/migrations/20260901000003_create_event_match_apply_reverse_rpcs.sql` - Constraint-compatibility fix (partial unique index) + both RPCs + REVOKE EXECUTE + COMMENTs
- `supabase/migrations/20260901000004_event_resolution_sweep_cron.sql` - `event-resolution-sweep` pg_cron job, mirrors `fathom-daily-reconcile` exactly
- `src/test/event-match-apply-reverse.integration.test.ts` - 6-assertion direct round-trip proof on TEST
- `type-baseline.json` - Registered one pre-existing, permanently-expected Deno-import type-check key from Plan 01's `event-resolver.ts`
- `.planning/phases/31-deterministic-resolution-shadow-mode-only/deferred-items.md` - Root-caused and logged the cross-file test-fixture-cleanup race

## Decisions Made

- **Constraint fix (Rule 1):** Verified the live TEST constraint name (`event_match_decisions_recording_id_a_recording_id_b_tier_key`) before touching it, then replaced it with `event_match_decisions_proposed_pair_tier_key`, a partial unique index `WHERE decision = 'merge_proposed'`. Re-ran Plan 01's own `event-resolution-shadow.integration.test.ts` in isolation afterward to confirm zero regression to the sweep's idempotency proof.
- **`reverse_event_match_atomic`'s `decided_by` hardcoded to `'admin'`** -- the locked signature (31-01 Task 1 gate) has no actor-role parameter; this RPC is never reachable from any automated path, so every caller is an admin action by construction.
- **Event canonical time derivation:** `LEAST(start_a, start_b)` / `GREATEST(end_a, end_b)`, chosen as the most defensible reading of the plan's "may be derived from the two recordings' recording_start_time/recording_end_time" instruction, and directly asserted by the test using two recordings with deliberately distinct times.
- **Type-baseline fix (Rule 1, out-of-plan-file):** Plan 01 created `_shared/event-resolver.ts` with a standard Deno `esm.sh` import but never ran `--update-baseline`, so `npm run type-check` was silently failing project-wide on a permanently-expected false positive (Deno-style imports never resolve under Node's `tsc`). Registered the one new key; verified 319 pre-existing baseline errors are unchanged and this plan's own files introduced zero new ones.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, significant] `event_match_decisions`' UNIQUE constraint blocked the exact reversibility this migration exists to prove**
- **Found during:** Task 1, while authoring the RPC bodies
- **Issue:** `20260901000002` (Plan 01) declared `UNIQUE (recording_id_a, recording_id_b, tier)` table-wide. Correct for its own purpose (the shadow sweep's `merge_proposed` idempotency), but it also makes a second row for the same pair+tier structurally impossible once a first row exists -- so `apply_event_match_atomic`'s `merge_applied` INSERT would either collide with a prior `merge_proposed` row, or (if no prior proposal existed) `reverse_event_match_atomic`'s subsequent `reversed` INSERT would collide with the `merge_applied` row `apply` had just written. This directly contradicts MATCH-10 and 20260901000002's own column comment ("...has somewhere to record which event a decision resolved into").
- **Fix:** Verified the live constraint name on TEST (`event_match_decisions_recording_id_a_recording_id_b_tier_key`) via `pg_get_constraintdef`, dropped it, and added a partial unique index scoped to `decision = 'merge_proposed'` (`event_match_decisions_proposed_pair_tier_key`). This preserves the sweep's exact idempotency guarantee (still at most one `merge_proposed` row per pair+tier) while allowing `merge_applied` and `reversed` rows to coexist for the same pair+tier.
- **Files modified:** `supabase/migrations/20260901000003_create_event_match_apply_reverse_rpcs.sql` (Section 0)
- **Verification:** `supabase db query --linked` confirmed the old constraint is gone (`old_constraint_count: 0`) and the new partial index exists with the expected `WHERE (decision = 'merge_proposed'::text)` clause; the full apply->reverse round trip then passed 6/6; Plan 01's own sweep idempotency test re-verified unaffected.
- **Committed in:** `d8c359f5`

**2. [Rule 1 - Bug, out-of-plan-file] Type-check baseline missing a new, permanently-expected key from Plan 01**
- **Found during:** Task 2, running `npm run type-check` as part of pre-commit verification discipline
- **Issue:** `npm run type-check` failed with `TS2307 Cannot find module 'https://esm.sh/@supabase/supabase-js@2'` in `supabase/functions/_shared/event-resolver.ts` -- a file created by Plan 01, not touched by this plan. Deno-style `esm.sh` URL imports are standard across every Supabase Edge Function in this repo and will always fail to resolve under Node's `tsc`; Plan 01 never ran `--update-baseline` after creating the file.
- **Fix:** Ran `node scripts/type-check.mjs --update-baseline`. Confirmed the resulting diff added exactly one key (320 total, up from 319) with no other changes, and that this plan's own new files (2 migrations, 1 test) introduced zero new errors.
- **Files modified:** `type-baseline.json`
- **Verification:** `npm run type-check` now passes (`TYPE CHECK PASSED: 0 new errors`, `320/320`)
- **Committed in:** `cf9263d9`

---

**Total deviations:** 2 auto-fixed (1 significant Rule 1 schema bug directly blocking this plan's own deliverable, 1 Rule 1 type-baseline gap from a prior plan's file)
**Impact on plan:** Both fixes were necessary -- the constraint fix for MATCH-10 to be provable at all, the baseline fix to keep the project's type-check gate an accurate signal. No scope creep: the constraint fix lives inside this plan's own migration file; the baseline fix touches only the accounting record, not behavior.

## Issues Encountered

- **Cross-file integration-test race (not a bug in this plan's deliverable):** Running the plan's literal acceptance command (`npm run test:integration -- event-match-apply-reverse.integration.test.ts`) runs the FULL integration suite (same pre-existing npm-script glob issue Plan 01 documented). This time it surfaced a genuine, previously-only-suspected root cause: every integration test's `afterAll` calls `cleanup_test_fixture_users({ p_max_age_minutes: 0 })`, which defeats that RPC's own documented protection against racing in-flight test runs (its migration comment: "Age threshold ... prevents racing with in-flight test runs" -- but every call site passes 0). Under vitest's default parallel file execution, any file's cleanup can delete another still-running file's fixture `auth.users` rows mid-test. Directly observed: my own `reverse_event_match_atomic` test hit a `23503` FK violation on a recording that had passed its ownership check moments earlier in the same function call -- the row was deleted by a concurrent session between statements. `event-resolution-shadow.integration.test.ts` (Plan 01) and `event-schema-noop.integration.test.ts` (Phase 30) failed the same run for the identical reason; the latter left 7 orphaned organizations on TEST (confirming Plan 01's own prediction about that file's latent unchecked-`.error` cleanup bug). Swept the orphans manually; verified TEST clean. Running this plan's test FILE ALONE (bypassing the glob) passed 6/6 cleanly, twice (before and after the sweep) -- this is the authoritative, deterministic proof of MATCH-10. Full root cause and two remediation options logged to `deferred-items.md`; not fixed (repo-wide pattern spanning every integration test file, well outside this plan's scope).

## User Setup Required

None - no external service configuration required. `RECONCILE_SECRET` and the `app.supabase_url` / `app.reconcile_secret` GUCs remain deferred to Plan 04, unchanged from Plan 01's own note -- until set, the new cron's `net.http_post` calls will 401 harmlessly against `resolve-events`' shared-secret gate, and the flag being off (SAFE-01) means the sweep has nothing to do regardless.

## Next Phase Readiness

- MATCH-10 is proven: every merge is reversible in one atomic operation, the reversal recorded in the same ledger, exercised only by a direct test -- never by the automatic sweep (SAFE-02's firewall confirmed both by Task 1's grep-absence check and Task 2's runtime source-scan assertion).
- `event-resolution-sweep` exists on TEST, registered and active, ready for Plan 04 to wire the missing GUCs/secret and confirm live firing.
- Plan 04 has three concrete prerequisites now on record: confirm `.env` exists before prod DDL (Plan 01), provision `RECONCILE_SECRET` (Plan 01), and be aware the sweep's cadence (`*/15 * * * *`) is a tunable, not a fixed design decision (31-RESEARCH.md Assumption A2).
- Whoever next touches integration test infrastructure has a root-caused, actionable finding waiting in `deferred-items.md` (the `cleanup_test_fixture_users(0)` race) -- not blocking, but worth fixing before the integration suite grows further.
- No blockers for Plan 03 or Plan 04.

---
*Phase: 31-deterministic-resolution-shadow-mode-only*
*Completed: 2026-09-01*

## Self-Check: PASSED

All 6 claimed files verified present on disk; all 3 claimed commit hashes verified present in `git log --oneline --all`. No missing items.
