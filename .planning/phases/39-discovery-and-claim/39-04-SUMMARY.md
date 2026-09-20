---
phase: 39-discovery-and-claim
plan: "04"
subsystem: database
tags: [postgres, supabase, rls, security-definer, jwt, pagination, privacy]

requires:
  - phase: 34-event-centric-data-model
    provides: Canonical events and participant evidence
  - phase: 38-access-policy-share-link-key-migration-request-flow
    provides: Recording content authorization, lifecycle request rules, and discovery caps
  - phase: 39-discovery-and-claim
    provides: Real database discovery contracts and approved threat boundaries
provides:
  - Caller identity seam derived from confirmed primary email and active verified aliases
  - Direct event RLS aligned with confirmed participation while preserving owner access
  - Bounded count and cursor-paginated discovery RPCs with privacy-safe copy projections
  - Sparse-identity Phase 38 helper compatibility without changing legacy People RPCs
affects: [39-09, 39-10, discovery, events, recording-access, privacy]

tech-stack:
  added: []
  patterns:
    - SECURITY DEFINER functions use an empty search path, qualified relations, and explicit grants
    - Caller-scoped authorization derives auth.uid internally and accepts no subject or email argument
    - Restricted recordings expose anonymous ordinal and request state only

key-files:
  created:
    - supabase/migrations/20260920000001_phase39_verified_email_discovery.sql
  modified:
    - src/test/discovery-claim.integration.test.ts
    - src/test/migrations/phase39-discovery-claim-migrations.test.ts
    - src/test/rls-regression.test.ts

key-decisions:
  - "Confirmed auth.users primary email and active verified aliases are the only caller email authorities; sparse identity_id links do not prevent authorization."
  - "Direct event discovery and recording content authorization remain separate: Phase 39 gates event existence while Phase 38 gates readable copy fields."
  - "Legacy get_people_summary(UUID) and get_recordings_for_person(UUID,TEXT,TEXT) remain unchanged; new discovery is exposed through distinct caller-scoped RPCs."

patterns-established:
  - "Verified-email seam: private caller email helper feeds direct RLS and Phase 38 participant checks from current database evidence."
  - "Safe discovery projection: one bounded SQL query deduplicates events, orders lifecycle groups, and redacts restricted copies."

requirements-completed: [DISCO-01, DISCO-03]

duration: 22min
completed: 2026-09-20
---

# Phase 39 Plan 04: Verified Email Discovery Summary

**Confirmed-email authorization now drives direct event RLS and bounded caller-scoped discovery while Phase 38 continues to control every recording-content field.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-20T06:02:05Z
- **Completed:** 2026-09-20T06:23:56Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added a private current-caller email seam that accepts no caller-supplied
  identity, includes confirmed primary email plus active verified aliases, and
  works when participant `identity_id` is null.
- Aligned direct `events` SELECT RLS and the Phase 38 participation/discovery
  helpers around authoritative speech, host, or organizer evidence while
  preserving owned-recording access, webinar exclusion, and the strict
  less-than-50 participant boundary.
- Added distinct event count and max-50 cursor pagination RPCs with stable
  action-needed, available, waiting, timestamp, and UUID ordering.
- Kept readable copies behind `phase38_user_can_access_recording` and limited
  restricted copies to anonymous ordinal and request-state fields.
- Preserved the legacy organization-scoped People function signatures, grants,
  and result keys exactly.

## Task Commits

1. **Task 1: Add verified-email authorization seam** — `5ba0811b`
2. **Task 2: Add bounded caller event discovery** — `f419d9ce`
3. **Test correction: Align direct RLS positive control with confirmed evidence** — `9a46cfff`
4. **Migration correction: Preserve discovery RPC defaults on replay** — `5f69fd53`

## Files Created/Modified

- `supabase/migrations/20260920000001_phase39_verified_email_discovery.sql`
  — indexed confirmed-email lookup, private caller helper, direct RLS repair,
  sparse-identity Phase 38 helper bodies, and safe count/list RPCs.
- `src/test/discovery-claim.integration.test.ts` — promoted implemented contracts,
  added caller participation to the 49/50/51 boundary fixture, and restored the
  exact original fixture during cleanup.
- `src/test/migrations/phase39-discovery-claim-migrations.test.ts` — accepts the
  explicit SQL defaults required for idempotent PostgreSQL function replay.
- `src/test/rls-regression.test.ts` — updates the participant-only positive
  control to contain authoritative transcript-backed speech evidence.

## Decisions Made

- The database is the authorization authority: the authenticated user's
  confirmed primary email and currently active verified aliases are resolved
  on every call. Display name, domain, organization membership, calendar-only
  attendance, stale aliases, and caller-supplied identity values are excluded.
- Direct event visibility proves only discoverable event existence. Recording
  metadata and content are projected only after the existing Phase 38
  authorization function succeeds.
- The new RPCs do not overload the legacy People functions. This avoids a
  PostgREST ambiguity and retains existing organization-scoped consumers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test correctness] Added the caller to participant-cap boundary fixtures**

- **Found during:** Task 1 real database verification
- **Issue:** The 49/50/51 event fixtures counted participants but did not include
  the authenticated caller, so they could not prove the intended positive
  boundary even when the database behavior was correct.
- **Fix:** Temporarily replace one participant email in each boundary event with
  the confirmed primary caller and restore the exact original values in
  `finally` cleanup.
- **Files modified:** `src/test/discovery-claim.integration.test.ts`
- **Verification:** Discovery suite passed all 14 contracts, including visible
  at 49 and denied at 50, 51, and webinar.
- **Committed in:** `f419d9ce`

**2. [Rule 1 - Test correctness] Repaired stale direct-RLS positive control**

- **Found during:** Final Phase 38 RLS regression
- **Issue:** The positive fixture represented calendar-only attendee evidence,
  which D-20 now intentionally denies. It therefore contradicted the test's
  participant-with-confirmed-evidence intent.
- **Fix:** Seeded the positive control as a transcript-backed speaker with
  `has_confirmed_speech: true`; the separate calendar-only denial remained
  unchanged.
- **Files modified:** `src/test/rls-regression.test.ts`
- **Verification:** Focused RLS suite passed 81/81 and the full combined real
  database suite passed 184/184.
- **Committed in:** `9a46cfff`

**3. [Rule 3 - Blocking] Made the migration idempotent with existing RPC defaults**

- **Found during:** Exact migration replay on TEST
- **Issue:** PostgreSQL rejected `CREATE OR REPLACE FUNCTION` when the replayed
  definition removed existing parameter defaults (SQLSTATE 42P13).
- **Fix:** Retained the explicit `DEFAULT 25` and `DEFAULT NULL` declarations and
  adjusted the static contract to allow those fixed SQL defaults without
  allowing caller identity defaults.
- **Files modified:**
  `supabase/migrations/20260920000001_phase39_verified_email_discovery.sql`,
  `src/test/migrations/phase39-discovery-claim-migrations.test.ts`
- **Verification:** Guarded TEST recovery dry-run found exactly one migration;
  replay applied successfully and local/remote history both report
  `20260920000001`.
- **Committed in:** `5f69fd53`

---

**Total deviations:** 3 auto-fixed (2 test-correctness, 1 blocking SQL replay).
**Impact on plan:** The corrections make the intended security boundaries
provable and the additive migration replay-safe. Product scope did not widen.

## Issues Encountered

- The first exact TEST replay exposed PostgreSQL's prohibition on removing
  function parameter defaults through `CREATE OR REPLACE FUNCTION`. Migration
  history was repaired only on the dedicated TEST project, the source was
  corrected, and the exact migration then applied successfully.
- Supabase JS emitted non-fatal multiple-GoTrueClient warnings during sequential
  integration setup. All assertions and checked cleanup passed.

## Verification

- Static migration security suite: **1 file, 8/8 passed**.
- Combined real TEST Supabase suite: **3 files, 184/184 passed** in 188.90s:
  discovery **14/14**, Phase 38 access policy **89/89**, RLS regression
  **81/81**.
- Dedicated TEST project verified before and after mutation:
  `swjzxiddcrtaqixsfaac` (`callvault-test`, `ACTIVE_HEALTHY`).
- TEST migration history verified local/remote exact at `20260920000001`.
- CLI relinked to production project `vltmrnjsubfzrgrtdqey` after testing.
  Production migration history shows local `20260920000001` with no remote
  counterpart, proving the Phase 39 migration remains unapplied there.
- `git diff --check` passed and the working tree was clean before summary
  creation.
- No production database mutation, frontend deployment, `main` branch change,
  or push occurred.

## Known Stubs

None. Expected-failure markers for notification, claim, and later migration
behavior remain executable contracts assigned to later Phase 39 plans.

## User Setup Required

None.

## Next Phase Readiness

- Plans 05-08 can use the caller email seam and discovery-safe projection for
  claim and notification work without changing the established authorization
  source.
- Plans 09-10 can wire services and UI to the distinct count/list RPCs.
- No blocker remains for the next Phase 39 plan.

## Self-Check: PASSED

- The migration and all three modified test files exist.
- Commits `5ba0811b`, `f419d9ce`, `9a46cfff`, and `5f69fd53` resolve in Git
  history.
- Static and real TEST suites passed against the exact applied source.
- The production project is relinked locally and Phase 39 remains pending there.
- No raw caller email argument, weakened Phase 38 boundary, legacy People RPC
  replacement, deployment, or untracked artifact remains.

---
*Phase: 39-discovery-and-claim*
*Completed: 2026-09-20*
