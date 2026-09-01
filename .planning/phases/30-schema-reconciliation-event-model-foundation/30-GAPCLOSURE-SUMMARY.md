---
phase: 30-schema-reconciliation-event-model-foundation
plan: GAPCLOSURE
subsystem: testing
tags: [rls, supabase, postgres, vitest, security-testing, events]

# Dependency graph
requires:
  - phase: 30-schema-reconciliation-event-model-foundation
    provides: events table + RLS policy (20260831000001_create_events_and_extend_participants.sql), CR-01 fix migration (20260831020000_fix_events_participation_rls_and_updated_at_trigger.sql, already committed and applied to TEST prior to this gap-closure work)
provides:
  - RLS regression coverage that isolates the `events` participation grant from the ownership grant (closes 30-REVIEW.md WR-01)
  - Empirical, automated proof that CR-01's fix migration (public.user_participates_in_event SECURITY DEFINER helper) actually restores the participation grant
affects: [31-event-matching-engine, rls-regression-suite]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three-fixture RLS isolation pattern: when a policy has an OR'd ownership+participation grant, a fixture where one user satisfies both conditions cannot distinguish which branch actually works. Add a fixture that satisfies ONLY the branch under test."

key-files:
  created: []
  modified:
    - src/test/rls-regression.test.ts

key-decisions:
  - "Participant-only fixture reuses recordingAId/orgAId as the call_participants row's recording_id/organization_id (both NOT NULL columns) -- only the row's email differs from userAEmail, and that user gets no organization_memberships row and owns no recording, so ownership/org-membership are genuinely absent even though the call_participants row's organization_id column is populated."
  - "No dedicated afterAll cleanup step added for the participant-only fixture: its call_participants row cascades away when recordingAId is deleted (ON DELETE CASCADE), and its auth.users row is caught by the existing cleanup_test_fixture_users RPC sweep via the shared @callvault.test domain match -- identical to how userA/userB's auth.users rows are already cleaned up."

requirements-completed: []

# Metrics
duration: ~25min
completed: 2026-09-01
---

# Phase 30 Gap Closure: WR-01 Test Coverage + CR-01 Fix Verification Summary

**Added a participant-only RLS fixture to `rls-regression.test.ts` that isolates the `events` table's participation grant from its ownership grant, and used it to empirically prove CR-01's fix migration (already applied to TEST) actually works -- 50/50 tests pass.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-01T19:09:50Z
- **Tasks:** 1 (test coverage gap closure + verification)
- **Files modified:** 1

## Background

Phase 30's code review (`30-REVIEW.md`) found two related findings on the new `events` table:

- **CR-01 (Critical):** the `events` SELECT policy's participation branch queried `call_participants` directly in an `EXISTS` subquery. Because `call_participants` has its own `FORCE ROW LEVEL SECURITY` policy restricting SELECT to organization members, that subquery silently returned zero rows for any real participant who was not also a member of the recording's organization -- defeating the entire design intent of the `events` table (visibility via participation OR ownership, never org-scoping). A fix migration (`supabase/migrations/20260831020000_fix_events_participation_rls_and_updated_at_trigger.sql`) was already authored, committed (`43965200`), and applied to the TEST project (`swjzxiddcrtaqixsfaac`) in prior work -- **not** re-authored or re-applied here.
- **WR-01 (Warning):** the existing RLS regression test for `events` couldn't have caught CR-01, because its only fixture (User A) was simultaneously the recording owner, an Org A member, AND the `call_participants` email match. The "positive" assertion passed on the ownership grant alone and gave zero signal about whether the participation grant worked in isolation.

This gap-closure plan addresses WR-01 only: add the missing test isolation, then use it to prove CR-01's already-applied fix actually resolves the bug.

## Accomplishments

- Added a third fixture to the bespoke `events` isolation block in `src/test/rls-regression.test.ts`: a participant with **no ownership and no org-membership relationship** to Org A's recording -- only a `call_participants` row naming them (`event_id = eventAId`, distinct email).
- Added the test `"a participant with no ownership/org-membership relationship still reads the event via participation alone"`, asserting this participant-only client reads exactly 1 row from `events` via `.eq("id", eventAId)`.
- Ran the full `rls-regression.test.ts` suite against the TEST Supabase project (`swjzxiddcrtaqixsfaac`): **50/50 tests passed**, including the new test.
- Confirmed via `npm run type-check`: 0 new TypeScript errors (baseline unchanged at 319/319).
- Confirmed via `eslint`: clean, no warnings or errors on the modified file.

## Task Commits

1. **Add WR-01 participant-only RLS fixture + test** - `b52044ff` (test)

_No plan-metadata commit -- this is a gap-closure summary, not a numbered PLAN.md execution; STATE.md/ROADMAP.md updates are owned by the orchestrator per task instructions._

## Files Created/Modified

- `src/test/rls-regression.test.ts` - Added `participantOnlyEmail`/`participantOnlyPassword`/`clientParticipantOnly` fixture state, user creation + `call_participants` insert in `beforeAll` (step "5e"), sign-in for the third client, and a new `it(...)` block in the bespoke `events` isolation section asserting the participation grant is independently reachable. Extended the block's header comment to document the WR-01/CR-01 relationship for future readers.

## Full Test Run Result

```
Test Files  1 passed (1)
     Tests  50 passed (50)
  Duration  8.93s
```

Ran via `npx vitest run src/test/rls-regression.test.ts --reporter=verbose` against the TEST project (env vars loaded from the existing gitignored `.env.test`, cached from Plan 30-03's work -- no new credentials created or requested). The new test appears in the verbose log as:

```
✓ [phase-38-01 rls-regression] cross-org RLS isolation > a participant with no ownership/org-membership relationship still reads the event via participation alone  65ms
```

All 46 cross-org isolation tests (23 tables x 2 directions), the 1 client-deny-table test, and all 3 bespoke `events` tests (2 pre-existing + 1 new) passed. No skips, no failures.

## Confirmation: CR-01 Fix Verified Working

**This test run is direct, empirical proof that CR-01's fix migration (`20260831020000_fix_events_participation_rls_and_updated_at_trigger.sql`, already applied to TEST) resolves the participation-grant defect.** The new fixture user has zero rows in `organization_memberships` and does not own any recording -- the only path by which they could read the `events` row is the participation branch of `"participants_and_owners_can_view_events"`, which now calls `public.user_participates_in_event(events.id, LOWER(auth.email()))` (a `SECURITY DEFINER` helper that bypasses `call_participants`' own org-membership-only SELECT policy). The test asserting `data?.length === 1` passing confirms that call succeeds end-to-end against the live TEST database, not just that the migration applied without error.

Per CR-01's own empirical proof (pre-fix), this exact scenario returned 0 rows. Post-fix, with this new isolated fixture, it returns 1. That delta is the fix working.

## Decisions Made

- Reused `recordingAId`/`orgAId` as the new `call_participants` row's `recording_id`/`organization_id` (both NOT NULL columns on that table) -- the isolation comes from the fixture *user* having no `organization_memberships` row and no owned recording, not from the `call_participants` row's own organization tag (which CR-01's fix correctly ignores; only `event_id` + `email` are checked).
- No dedicated `afterAll` cleanup step was added for the new fixture: the `call_participants` row cascades away via `ON DELETE CASCADE` when `recordingAId` is deleted (existing step 1c), and the new `auth.users` row is caught by the existing `cleanup_test_fixture_users` RPC sweep (existing step 2) via its `@callvault.test` domain match -- identical to how `userA`/`userB`'s `auth.users` rows are already cleaned up. Verified idempotent by design (matches the file's own documented cleanup contract).
- Test/variable naming mirrors the file's existing `phase38-rls-*` convention (`phase38-rls-participant-only-${stamp}@callvault.test`) rather than the review's suggested `${SUITE_TAG}-participant-only-...` literal, since `SUITE_TAG` (`"[phase-38-01 rls-regression]"`) contains spaces/brackets that are not valid in an email local-part.

## Deviations from Plan

None - task executed exactly as specified. WR-02 and WR-03 from `30-REVIEW.md` were explicitly out of scope for this gap-closure task (WR-03 is already resolved by the same already-applied CR-01 fix migration, which also added the `events_updated_at` trigger; WR-02 is a documentation-only fix not assigned to this task).

## Issues Encountered

None. `.env.test` credentials were already cached from prior Plan 30-03 work as expected; the TEST project was reachable on the first attempt.

## Production Impact

None. No production database access. No STATE.md or ROADMAP.md changes (owned by the orchestrator per task instructions). Test-only change to `src/test/rls-regression.test.ts`, executed and verified exclusively against the TEST Supabase project (`swjzxiddcrtaqixsfaac`).

## Next Phase Readiness

- WR-01 closed: the `events` RLS regression suite now has real signal on the participation grant, not just the ownership grant.
- CR-01's fix is now proven correct by an automated, repeatable test rather than only by the one-off manual empirical proof in `30-REVIEW.md` -- this test will catch any future regression of the participation grant (e.g., if a future migration reintroduces a direct `call_participants` query in the `events` policy).
- WR-02 (migration header comment misstates deployment status) and WR-03 (already resolved by the applied fix migration, per its own header) remain for a separate pass if Andrew wants the phase fully closed out.
- Phase 31 (event matching/resolution engine) can proceed with confidence that both grant paths on `events` are independently exercised by CI.

---
*Phase: 30-schema-reconciliation-event-model-foundation (gap closure)*
*Completed: 2026-09-01*

## Self-Check: PASSED

- FOUND: `src/test/rls-regression.test.ts` (modified, committed)
- FOUND: `.planning/phases/30-schema-reconciliation-event-model-foundation/30-GAPCLOSURE-SUMMARY.md`
- FOUND: commit `b52044ff` in `git log --oneline --all`
- Full `rls-regression.test.ts` suite run against TEST project: 50/50 passed, 0 failed, 0 skipped
- `afterAll` cleanup completed with no `console.warn` output (no cleanup-step failures)
- `npm run type-check`: 0 new errors (baseline 319/319 unchanged)
- `eslint src/test/rls-regression.test.ts`: clean
