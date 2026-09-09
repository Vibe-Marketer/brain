---
phase: 36-live-organizations
plan: 02
subsystem: database
tags: [postgres, rls, security-definer, supabase, organizations, merge, canonical-entity]

# Dependency graph
requires:
  - phase: 36-live-organizations (Plan 01)
    provides: organization_domains/organization_aliases tables, dual-membership default (merge RPC does not touch organization_memberships), canonical_organization_id non-goal locked
provides:
  - "organizations.canonical_organization_id/merged_at/merged_by (nullable self-FK pointer, additive) + organizations_canonical_not_self CHECK + prevent_canonical_organization_chain() BEFORE INSERT/UPDATE trigger (chain/cycle rejection)"
  - "merge_organizations_atomic(uuid,uuid,uuid) -- has_role(ADMIN)-gated, pointer-only, non-destructive, EXECUTE revoked from client roles"
  - "unclaim_organization_domain_atomic(uuid,uuid) -- has_role(ADMIN)-gated, deletes an organization_domains row, EXECUTE revoked from client roles"
  - "Bespoke ORG-04 canonical-no-leak isolation block in rls-regression.test.ts (multi-org fixtures incl. a merged-away org, real JWTs, both-directions assertions)"
  - "src/test/org-merge-unclaim-rpc.integration.test.ts -- merge pointer set/clear, FK-non-rewrite, chain rejection (both directions), has_role gating proof for both RPCs"
affects: [36-03-frontend-org-identity-settings, 36-04-admin-merge-unclaim-ui-and-edge-functions, 36-06-prod-apply]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pointer/redirect merge: a nullable self-referencing FK (canonical_organization_id) plus metadata (merged_at/merged_by) instead of bulk FK rewrite -- reversal is clearing the pointer, mirrors identities/events' additive-nullable-column philosophy one level up"
    - "BEFORE INSERT OR UPDATE OF <col> trigger for chain/cycle prevention a CHECK constraint cannot express (cross-row subqueries)"
    - "Authority-by-parameter admin RPCs (has_role(p_admin_user_id,'ADMIN'), never auth.uid()) + REVOKE EXECUTE FROM PUBLIC/anon/authenticated -- service-role-only, reachable only via a future edge function that independently verifies has_role"
    - "RLS choke-point non-goal proven by live introspection, not just code review: pg_get_functiondef() diffed against the pre-phase byte-for-byte body for is_organization_member/is_organization_admin_or_owner"

key-files:
  created:
    - supabase/migrations/20260908140000_add_canonical_organization_id.sql
    - supabase/migrations/20260908140001_create_org_merge_unclaim_admin_rpcs.sql
    - src/test/org-merge-unclaim-rpc.integration.test.ts
  modified:
    - src/test/rls-regression.test.ts

key-decisions:
  - "Chain-prevention fixture setup in the RPC integration test uses the real merge_organizations_atomic RPC (not a raw UPDATE) to establish the M1->M2 precondition, since the RPC itself is what's under test and the setup doubles as an extra happy-path proof."
  - "The ORG-04 bespoke block's 'no widening' proof captures is_organization_member/is_organization_admin_or_owner's answer for Org C's user in beforeAll BEFORE the merge pointer is set, then compares against the post-merge answer in the assertion -- avoids mid-test DB mutation, keeps the pre-merge baseline authoritative."
  - "Task 2's acceptance criteria ('grep for organization_memberships/recordings must return 0 in the migration/RPC body') required rephrasing several explanatory SQL comments to avoid literal function/table names in prose -- same lesson Plan 01 hit with 'apply_event_match_atomic' substring-checks: acceptance-criteria greps operate on the whole file, so explanatory comments must paraphrase the very things they're proving are absent."

requirements-completed: [ORG-03, ORG-04]

coverage:
  - id: D1
    description: "organizations.canonical_organization_id/merged_at/merged_by additive columns + not-self CHECK + chain-prevention trigger live on TEST; migration never references is_organization_member/is_organization_admin_or_owner (grep=0)"
    requirement: "ORG-03"
    verification:
      - kind: integration
        ref: "Live TEST introspection (information_schema.columns, pg_constraint, pg_trigger) + rtk grep -Eic on the migration file"
        status: pass
    human_judgment: false
  - id: D2
    description: "merge_organizations_atomic / unclaim_organization_domain_atomic gated by has_role(p_admin_user_id,'ADMIN') (never is_organization_admin_or_owner), EXECUTE revoked from PUBLIC/anon/authenticated, SECURITY DEFINER confirmed live"
    requirement: "ORG-03"
    verification:
      - kind: integration
        ref: "Live TEST introspection (pg_proc.prosecdef, has_function_privilege for anon/authenticated/service_role) + src/test/org-merge-unclaim-rpc.integration.test.ts (Access denied tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Merge is non-destructive (recordings.organization_id + both orgs' organization_memberships byte-unchanged) and reversible (clearing the pointer fully restores state); chain-prevention rejects both directions"
    requirement: "ORG-03"
    verification:
      - kind: integration
        ref: "src/test/org-merge-unclaim-rpc.integration.test.ts (7/7 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A member of an unrelated org (Org B) and a member of a merged-away org (Org C) each read 0 rows of Org A's recordings/workspaces/call_participants despite a claimed domain + incoming merge pointer; Org A's own member reads exactly 1 row (positive control); is_organization_member/is_organization_admin_or_owner answers are byte-identical before/after the merge pointer exists"
    requirement: "ORG-04"
    verification:
      - kind: integration
        ref: "src/test/rls-regression.test.ts bespoke ORG-04 block (8 new tests, full suite 75/75) + live introspection confirming is_organization_member/is_organization_admin_or_owner are byte-for-byte unchanged from their 20260301000001 definitions"
        status: pass
    human_judgment: false

duration: ~30min
completed: 2026-09-09
status: complete
---

# Phase 36 Plan 02: Organization Merge & Canonical Pointer Summary

**canonical_organization_id self-FK pointer + chain-prevention trigger + has_role-gated merge/unclaim admin RPCs, with a bespoke RLS test proving a merged-away org's member gains zero capture access to the surviving org**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-09-09T05:04:00Z
- **Tasks:** 3 (all auto)
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- `organizations` gains `canonical_organization_id`/`merged_at`/`merged_by` (additive, nullable self-FK) plus a `BEFORE INSERT OR UPDATE OF canonical_organization_id` trigger (`prevent_canonical_organization_chain`) that rejects merge-into-already-merged and merge-of-an-already-pointed-to org -- the two chain/cycle cases a Postgres `CHECK` constraint cannot express. Confirmed via grep that this migration never references `is_organization_member`/`is_organization_admin_or_owner` anywhere -- the phase's single highest-risk non-goal.
- `merge_organizations_atomic` + `unclaim_organization_domain_atomic` SECURITY DEFINER RPCs: both gate on `has_role(p_admin_user_id,'ADMIN')` (never org membership -- this codebase shipped a real incident from exactly that confusion), both `REVOKE EXECUTE`'d from `PUBLIC`/`anon`/`authenticated`, both confirmed live on TEST as `prosecdef=true` with EXECUTE denied to client roles.
- Bespoke ORG-04 isolation block added to `rls-regression.test.ts`: a brand-new Org C (never used elsewhere in the file) merged INTO Org A proves a merged-away org's member reads zero rows of the surviving org's recordings/workspaces/call_participants, matching Org B's (unrelated-org) same result -- plus a positive control and a live before/after comparison proving `is_organization_member`/`is_organization_admin_or_owner` never change their answer because of the pointer. Full suite 75/75 green (67 baseline + 8 new).
- New `org-merge-unclaim-rpc.integration.test.ts` (7/7 tests) proves the merge is genuinely non-destructive (`recordings.organization_id` and both orgs' `organization_memberships` rows byte-unchanged via before/after JSON comparison) and genuinely reversible (clearing the pointer fully restores state), plus both chain-rejection directions and the admin gate for both RPCs, all invoked exactly as a real edge function would (service-role client, authority by parameter).
- Live TEST introspection confirmed `is_organization_member`/`is_organization_admin_or_owner`'s `pg_get_functiondef()` output is byte-for-byte identical to their pre-phase (`20260301000001`) definitions -- the ORG-04 non-goal is not just asserted in comments, it's empirically proven against the live database.

## Task Commits

Each task was committed atomically:

1. **Task 1: canonical_organization_id columns + chain-prevention trigger** - `afb1a12d` (feat)
2. **Task 2: merge_organizations_atomic + unclaim_organization_domain_atomic admin RPCs** - `857b7751` (feat)
3. **Task 3: ORG-04 bespoke canonical-no-leak block + merge/unclaim RPC integration proof** - `e036b7bd` (test)

**Plan metadata commit:** pending (this commit)

## Files Created/Modified

- `supabase/migrations/20260908140000_add_canonical_organization_id.sql` - `canonical_organization_id`/`merged_at`/`merged_by` columns, not-self CHECK, `prevent_canonical_organization_chain()` trigger function + `organizations_prevent_canonical_chain` trigger
- `supabase/migrations/20260908140001_create_org_merge_unclaim_admin_rpcs.sql` - `merge_organizations_atomic`, `unclaim_organization_domain_atomic` SECURITY DEFINER functions, `has_role`-gated, `REVOKE EXECUTE`'d from client roles
- `src/test/org-merge-unclaim-rpc.integration.test.ts` - Integration proof of merge pointer set/clear, FK-non-rewrite, chain rejection (both directions), and has_role gating for both RPCs against a real TEST DB
- `src/test/rls-regression.test.ts` - New Org C fixture (merged into Org A) + bespoke ORG-04 isolation block (8 tests: 3x Org B leak, 3x Org C leak, 1x positive control, 1x no-widening proof)

## Decisions Made

- **Chain-prevention fixture setup uses the real RPC, not a raw UPDATE:** the integration test's chain-rejection fixture (`chainM1Id` merged into `chainM2Id`) is established by calling `merge_organizations_atomic` itself rather than seeding the pointer directly -- this doubles as an extra happy-path proof of the RPC while setting up the precondition for both rejection-direction tests.
- **ORG-04 "no widening" proof captures the pre-merge baseline in `beforeAll`, before the pointer is set** -- avoids mutating DB state mid-`it`-block; the post-merge assertion simply compares the live RPC answer against the already-captured pre-merge value.
- **Task 2 acceptance criteria required removing literal function/table names from explanatory SQL comments** -- the grep-based acceptance check ("no `recordings` or `organization_memberships` reference") operates on the whole file text, not just executable statements, so several comments were rephrased to describe intent without naming the exact identifiers the check is proving absent (mirrors Plan 01's own `apply_event_match_atomic` substring-check lesson from `36-01-SUMMARY.md`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a silent test-cleanup failure in the new RPC integration test, caused by a protective recordings-delete trigger**

- **Found during:** Task 3, immediately after the first green run of `org-merge-unclaim-rpc.integration.test.ts`, during the mandatory orphan-check sweep of TEST
- **Issue:** `afterAll` deleted `recordingLosingId` directly via `.from("recordings").delete()`, but `recordings` has a `protect_recording_delete` `BEFORE DELETE` trigger (`prevent_recording_hard_delete()`) that blocks a hard delete while the row is still linked via `workspace_entries` -- and every new recording is auto-filed into its org's Home Workspace by the `auto_home_workspace_entry` `AFTER INSERT` trigger. Because `supabase-js` returns `{ error }` rather than throwing, and the original `afterAll` didn't check `.error` on any delete call, this failure was completely silent: the recording survived, which then blocked the org's own `DELETE` (via the `ON DELETE CASCADE` FK attempting to cascade into the still-protected recording, which itself re-fired the same trigger and aborted the whole statement) -- also silently, for the same unchecked-`.error` reason. Net effect: 3 orphaned test organizations were left in TEST across 3 test runs before this was caught. This is the exact same bug class Phase 31 Plan 01 already root-caused and fixed in its own file ("Fixed by deleting `workspace_entries` first + checking `.error` on every cleanup step") -- that lesson didn't transfer to this brand-new file.
- **Fix:** `afterAll` now deletes `workspace_entries` (filtered by `recording_id`) *before* deleting the recording, and every delete/update call in `afterAll` now checks and logs `.error` explicitly via `console.warn` instead of relying on a bare `try/catch` (which never fires for a returned Postgres error).
- **Files modified:** `src/test/org-merge-unclaim-rpc.integration.test.ts`
- **Verification:** Manually deleted the 3 orphaned test organizations from TEST via direct SQL, re-ran the suite (7/7 green, no warnings logged), then confirmed via live TEST queries that zero orphaned organizations/`workspace_entries`/`auth.users` rows remain for this suite's tag.
- **Committed in:** `e036b7bd` (Task 3 commit -- the fix was found and applied before this file was ever committed, so there is no separate broken-then-fixed commit pair)
- **Downstream flag:** any future new integration test file that creates a `recordings` row and needs to hard-delete it in `afterAll` must delete `workspace_entries` (filtered by `recording_id`) first, and must check `.error` on cleanup calls rather than relying on `try/catch` alone -- this is now the second time this exact bug class has been hit (first: Phase 31 Plan 01's own file; second: this file). A third occurrence should probably become a shared test-cleanup helper rather than a repeated inline comment.

---

**Total deviations:** 1 auto-fixed (1 bug, self-contained to a test file this plan created; zero production/migration impact)
**Impact on plan:** No scope creep. The bug was in code this plan itself wrote (not pre-existing), found and fixed before the file was committed, and the fix is defensive/general rather than narrowly patched.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None - no external service configuration required. Both migrations applied directly to TEST via the Supabase CLI; CLI confirmed relinked to prod (`vltmrnjsubfzrgrtdqey`) after each task, per the mandatory TEST-then-prod discipline. Nothing in this plan touches production -- prod apply is explicitly Plan 06's job.

## Next Phase Readiness

- ORG-03 (non-destructive, reversible merge with chain/cycle prevention) and ORG-04 (org association confers zero capture access, including the merge pointer specifically) are both proven end-to-end on TEST.
- Plan 04 (admin merge/unclaim UI + edge functions) can build directly on `merge_organizations_atomic`/`unclaim_organization_domain_atomic` exactly as documented in this plan's `<interfaces>` block -- both RPCs are service-role-only and expect `p_admin_user_id` to be the edge function's own independently-verified `has_role` check result, never a client-supplied value.
- Downstream test-infra flag: consider a shared `deleteRecordingHard(admin, recordingId)` test helper (delete `workspace_entries` then `recordings`, checking `.error` on both) given this is now a 2x-repeated bug class across integration test files.
- No blockers.

## Self-Check: PASSED

- `supabase/migrations/20260908140000_add_canonical_organization_id.sql` -- FOUND on disk.
- `supabase/migrations/20260908140001_create_org_merge_unclaim_admin_rpcs.sql` -- FOUND on disk.
- `src/test/org-merge-unclaim-rpc.integration.test.ts` -- FOUND on disk.
- `src/test/rls-regression.test.ts` -- FOUND on disk (modified).
- Commit `afb1a12d` (Task 1) -- FOUND in `git log`.
- Commit `857b7751` (Task 2) -- FOUND in `git log`.
- Commit `e036b7bd` (Task 3) -- FOUND in `git log`.
- TEST introspection: `canonical_organization_id`/`merged_at`/`merged_by` columns + `organizations_canonical_not_self` CHECK + `organizations_prevent_canonical_chain` trigger all confirmed live via `information_schema.columns`/`pg_constraint`/`pg_trigger` -- CONFIRMED against `swjzxiddcrtaqixsfaac`.
- TEST introspection: both RPCs `prosecdef=true`, `has_function_privilege` false for `anon`/`authenticated`, true for `service_role` -- CONFIRMED.
- TEST introspection: `is_organization_member`/`is_organization_admin_or_owner` `pg_get_functiondef()` output byte-identical to their pre-phase bodies -- CONFIRMED.
- `npx vitest run src/test/rls-regression.test.ts` -- 75/75 PASS.
- `VITEST_INTEGRATION_OK=true npx vitest run src/test/org-merge-unclaim-rpc.integration.test.ts` -- 7/7 PASS.
- Orphan sweep: 0 leftover organizations/`workspace_entries`/`auth.users` rows on TEST matching this plan's fixture tags after both suites ran.
- CLI relinked to prod (`vltmrnjsubfzrgrtdqey`) at the end of every task -- CONFIRMED via `supabase/.temp/project-ref`.
- `npm run type-check` -- 0 new errors, baseline unchanged (320/320).

---
*Phase: 36-live-organizations*
*Completed: 2026-09-09*
