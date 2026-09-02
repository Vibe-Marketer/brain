---
phase: 32-match-rule-hardening-provider-agnostic-matcher
plan: 03
subsystem: database
tags: [postgres, plpgsql, security-definer, rls, supabase, vitest, integration-testing]

# Dependency graph
requires:
  - phase: 31-deterministic-resolution-shadow-mode-only
    provides: event_match_decisions ledger, apply_event_match_atomic/reverse_event_match_atomic RPC pair, organization_feature_flags table
  - phase: 30-schema-reconciliation-event-model-foundation
    provides: events table + participation/owned-capture RLS (EVT-04), recordings.event_id
provides:
  - kill_switch_revert_event_merges SECURITY DEFINER RPC (SAFE-03) -- bulk-reverts all merge_applied decisions in a time range, optionally org-scoped, one atomic PL/pgSQL operation
  - SAFE-04 live cross-org isolation proof extended into rls-regression.test.ts's bespoke events block
affects: [32-04-prod-apply, event-resolution-admin-tooling]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bulk admin SECURITY DEFINER RPC with an internal FOR loop (one implicit transaction), no per-caller ownership check -- authorization is service-role-only via REVOKE EXECUTE, since a bulk action spans potentially many different owners (extends apply_event_match_atomic/reverse_event_match_atomic's per-decision ownership-by-parameter pattern to the bulk case)"
    - "Kill-switch HALT vs REVERT split: HALT reuses the existing organization_feature_flags flag_key row (no new table); REVERT is new PL/pgSQL"

key-files:
  created:
    - supabase/migrations/20260902000002_kill_switch_revert_event_merges.sql
    - src/test/event-resolution-kill-switch.integration.test.ts
  modified:
    - src/test/rls-regression.test.ts

key-decisions:
  - "kill_switch_revert_event_merges has NO per-caller ownership check (unlike reverse_event_match_atomic) -- a bulk admin action spans potentially many different recording owners; authorization is service-role-only via REVOKE EXECUTE FROM PUBLIC/anon/authenticated, mirroring apply/reverse_event_match_atomic's REVOKE pattern exactly"
  - "HALT half of the kill switch is the existing organization_feature_flags 'event_resolution' enabled=false row (sweep already skips non-enabled orgs) -- no new flag/table added, avoiding new FORCE-RLS surface"
  - "SAFE-04 proof uses two brand-new Org-A recordings (recordingA3Id/recordingA4Id), not the pre-existing recordingAId/recordingA2Id fixtures -- recordingAId already carries eventAId (asserted on by the Phase 30 block above) and recordingA2Id must stay merge_proposed/unapplied for the Phase 31 event_match_decisions block; reusing either would have silently broken an existing assertion"
  - "Kill-switch integration test derives its time-range boundaries from actual DB-recorded created_at timestamps (read back after each apply), never local Date.now() -- avoids test-runner/DB clock-skew flakiness when proving the out-of-window-untouched guarantee"

patterns-established:
  - "Bulk-reversal RPC pattern: FOR loop over matching ledger rows, one UPDATE + one INSERT per row, all inside one function body -- reusable for any future bulk admin action over event_match_decisions"

requirements-completed: [SAFE-03, SAFE-04]

coverage:
  - id: D1
    description: "kill_switch_revert_event_merges RPC reverts all merge_applied decisions in a time range (optionally org-scoped) in one atomic operation, writing a reversed ledger row per reversal, service-role-only"
    requirement: "SAFE-03"
    verification:
      - kind: integration
        ref: "src/test/event-resolution-kill-switch.integration.test.ts#reverts both org-A merges in the time window, leaves the out-of-window merge and the other org's merge untouched, and writes a reversed ledger row per reversal"
        status: pass
      - kind: integration
        ref: "src/test/event-resolution-kill-switch.integration.test.ts#a second, org-B-scoped call over the same window reverts exactly the org-B merge and does not re-revert the already-reverted org-A merges"
        status: pass
      - kind: integration
        ref: "src/test/event-resolution-kill-switch.integration.test.ts#kill_switch_revert_event_merges rejects p_start_time > p_end_time"
        status: pass
    human_judgment: false
  - id: D2
    description: "Live cross-org RLS proof: resolving two same-org recordings into one event via apply_event_match_atomic never widens either recording's or the event's readable audience to an unrelated org"
    requirement: "SAFE-04"
    verification:
      - kind: integration
        ref: "src/test/rls-regression.test.ts#Org B (unrelated org) cannot read the merged event by id"
        status: pass
      - kind: integration
        ref: "src/test/rls-regression.test.ts#Org B (unrelated org) cannot read either merged recording by id"
        status: pass
      - kind: integration
        ref: "src/test/rls-regression.test.ts#service role sees the merged event and both merged recordings (existence proof, mirrors T-31-03-03)"
        status: pass
    human_judgment: false

# Metrics
duration: ~27min
completed: 2026-09-02
status: complete
---

# Phase 32 Plan 03: SAFE-03 Kill Switch + SAFE-04 Cross-Org Proof Summary

**New `kill_switch_revert_event_merges` SECURITY DEFINER RPC bulk-reverts applied event merges in one atomic transaction; live JWT-driven RLS test proves resolving two same-org recordings into one event never widens cross-org readable audience.**

## Performance

- **Duration:** ~27 min
- **Started:** 2026-09-02T09:36:00Z (approx.)
- **Completed:** 2026-09-02T10:03:05Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- `kill_switch_revert_event_merges(p_start_time, p_end_time, p_organization_id DEFAULT NULL)` -- a new SECURITY DEFINER PL/pgSQL function that loops over every `event_match_decisions` row with `decision='merge_applied'` in the given range (optionally filtered to one org via `recording_id_a`'s owning recording), nulls `event_id` on both recordings in the pair, and inserts a `'reversed'` ledger row referencing the decision it undoes -- all inside one function body (one implicit transaction), satisfying SAFE-03's "in one operation" requirement. `REVOKE EXECUTE FROM PUBLIC, anon, authenticated` makes it service-role-only, mirroring `apply_event_match_atomic`/`reverse_event_match_atomic` exactly. No new table -- the migration's own comment documents that the kill switch's HALT half is the existing `organization_feature_flags` `'event_resolution'` row.
- Applied cleanly to the TEST project (`callvault-test`) via `supabase db push --linked`; confirmed NOT applied to production (`vltmrnjsubfzrgrtdqey` migration list shows `20260902000002` Local-only, Remote blank) after relinking back.
- New integration test (`event-resolution-kill-switch.integration.test.ts`, 3 test cases) proves: the `p_start_time > p_end_time` guard rejects; an org-A-scoped call reverts exactly the 2 in-window org-A merges while leaving an out-of-window merge AND an in-window org-B merge untouched; a second org-B-scoped call over the same window reverts exactly the org-B merge without double-reverting the already-reverted org-A decisions.
- Extended `rls-regression.test.ts`'s bespoke `events` isolation block with 3 new tests proving SAFE-04: a genuinely resolved (via `apply_event_match_atomic`, not just proposed) pair of Org-A recordings produces a merged event that an unrelated Org B JWT reads zero rows for -- both for the event itself and for both merged recordings -- with a service-role existence proof guarding against an empty-table false pass.
- Full suite re-run twice consecutively (56/56, then 56/56 again) confirming the new fixtures' `afterAll` cleanup is idempotent and the suite is re-runnable.

## Task Commits

Each task was committed atomically:

1. **Task 1: kill_switch_revert_event_merges bulk-reversal RPC (SAFE-03)** - `99c2ae7c` (feat)
2. **Task 2: SAFE-04 cross-org no-audience-widening proof (extend rls-regression)** - `f8047425` (test)

**Plan metadata:** _pending -- recorded below in state updates_

## Files Created/Modified

- `supabase/migrations/20260902000002_kill_switch_revert_event_merges.sql` - New SAFE-03 RPC + REVOKE grants; applied to TEST only, prod apply is Plan 04
- `src/test/event-resolution-kill-switch.integration.test.ts` - Apply -> kill-switch-revert round-trip proof (guard rejection, org-A revert, org-B revert, out-of-window untouched)
- `src/test/rls-regression.test.ts` - New SAFE-04 fixtures (recordingA3Id/recordingA4Id/mergedEventId) + 3 new bespoke-block assertions + afterAll cleanup

## Decisions Made

- `kill_switch_revert_event_merges` deliberately omits a per-caller ownership check (32-RESEARCH.md Pitfall 3) -- a bulk admin action spans potentially many different recording owners, so `reverse_event_match_atomic`'s per-decision ownership-by-parameter check doesn't fit. Authorization is service-role-only via `REVOKE EXECUTE`.
- No new table or flag column for the kill switch's HALT half -- the migration comment documents that setting the existing `organization_feature_flags` `'event_resolution'` row `enabled=false` already halts the sweep (it already skips non-flagged orgs), per 32-RESEARCH.md's explicit anti-pattern guidance ("Don't create a new table for the kill-switch flag").
- SAFE-04's merge fixture uses two brand-new Org-A recordings (`recordingA3Id`/`recordingA4Id`) rather than reusing `recordingAId` (which already carries `eventAId` from the Phase 30 block, asserted on by an existing test) or `recordingA2Id` (deliberately left `merge_proposed`/unapplied for the Phase 31 `event_match_decisions` deny-table block). Reusing either would have silently corrupted an existing assertion's fixture state.
- The kill-switch test derives `p_start_time`/`p_end_time` from actual `event_match_decisions.created_at` values read back from the DB after each `apply_event_match_atomic` call, rather than local `Date.now()` -- avoids any test-runner/DB clock-skew flakiness in the out-of-window-untouched proof.

## Deviations from Plan

None - plan executed exactly as written. The interpretation choice above (new recordings vs. reusing `recordingAId`) was made within the plan's own stated intent ("mirror the existing recordingA2 fixture pattern") and is documented as a decision, not a deviation from a locked requirement.

## Issues Encountered

- `npm run test:integration -- <file1> <file2>` does not restrict the run to those files -- the npm script hardcodes its own glob (`src/**/*.integration.test.ts supabase/functions/**/__tests__/*.integration.test.ts`), and appended args union into that glob rather than filtering it. Running the full ~20-file glob surfaced the already-known cross-file integration-test race (STATE.md, Phase 31 P02: every integration test's `afterAll` calls `cleanup_test_fixture_users(p_max_age_minutes: 0)`, which races when many files run concurrently against the same TEST project) -- 7 files failed, including this plan's own 2 files plus 5 entirely unrelated ones (`event-match-apply-reverse`, `event-resolution-shadow`, `qa-ticket-ingestion`, `reporter-comms`, `share-call`). Re-running with a direct `npx vitest run` invocation limited to just this plan's 2 files passed 100% (59/59), proving the failures were the pre-existing race, not a regression from this plan's changes. Logged to `deferred-items.md` (out of scope -- repo-wide pattern already declined for a fix in Phase 31 P02).
- Full unit suite (`npx vitest run`) shows exactly the same 13 pre-existing failures across 5 files that Plan 01 already documented in `deferred-items.md` -- confirmed zero new unit regressions (`numFailedTests: 13` both before and after this plan's changes, same files).

## User Setup Required

None - no external service configuration required. This plan's migration was applied to TEST only; production apply is explicitly deferred to Plan 04 per this plan's own scope.

## Next Phase Readiness

- SAFE-03 and SAFE-04 are both proven on TEST and ready for Plan 04's prod-apply list. Exact migration filename for Plan 04: `supabase/migrations/20260902000002_kill_switch_revert_event_merges.sql`.
- Plan 04 should apply `20260902000001` (Plan 01's `recurring_call_titles` security-invoker fix) and `20260902000002` (this plan's kill-switch RPC) together -- CLI confirmed both are currently Local-only against production, Remote blank, after this plan's work.
- No blockers. The cross-file integration-test race (see Issues Encountered) remains a repo-wide, pre-existing, explicitly out-of-scope item across three plans now (31-02, 32-01 implicitly, 32-03) -- worth prioritizing in a future hardening pass given it now has three independent confirmations.

---
*Phase: 32-match-rule-hardening-provider-agnostic-matcher*
*Completed: 2026-09-02*

## Self-Check: PASSED

- FOUND: supabase/migrations/20260902000002_kill_switch_revert_event_merges.sql
- FOUND: src/test/event-resolution-kill-switch.integration.test.ts
- FOUND: src/test/rls-regression.test.ts
- FOUND: .planning/phases/32-match-rule-hardening-provider-agnostic-matcher/deferred-items.md
- FOUND commit: 99c2ae7c
- FOUND commit: f8047425
