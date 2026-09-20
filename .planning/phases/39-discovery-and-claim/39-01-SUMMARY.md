---
phase: 39-discovery-and-claim
plan: "01"
subsystem: testing
tags: [supabase, postgres, rls, integration-tests, privacy, tdd]

requires:
  - phase: 38-access-policy-share-link-key-migration-request-flow
    provides: Recording access authority, confirmed-participation rules, webinar and participant-cap protections
  - phase: 34-identity-foundation
    provides: Identity and verified-alias evidence ledger
provides:
  - Exact TEST-project guard for every Phase 39 database fixture operation
  - Stable real-database authorization, privacy, request, cap, webinar, and notification fixture graph
  - Executable expected-failure contracts for discovery, direct event RLS, disconnect, and notification behavior
  - Static expected-failure security contract for the exact three-migration sequence
affects: [39-04, 39-05, 39-06, 39-08, discovery, claims, notifications]

tech-stack:
  added: []
  patterns:
    - Exact hosted-project allowlist before constructing any Phase 39 fixture client
    - Deterministic prefix-scoped real-DB graphs with checked child-first cleanup
    - Vitest expected-failure contracts that become red when implementation begins passing

key-files:
  created:
    - src/test/phase39-fixtures.ts
    - src/test/phase39-fixtures.integration.test.ts
    - src/test/discovery-claim.integration.test.ts
    - src/test/migrations/phase39-discovery-claim-migrations.test.ts
  modified: []

key-decisions:
  - "Phase 39 fixture I/O accepts only swjzxiddcrtaqixsfaac; production, local, and every other hosted ref fail before client construction."
  - "Core confirmed-primary and verified-alias participants deliberately keep identity_id null so authorization cannot depend on resolver enrichment."
  - "Implementation-dependent database tests use Vitest expected failures; legacy People compatibility remains an ordinary green assertion."

patterns-established:
  - "Fixture keys name every authorization and privacy case directly, so later plans can select a case without borrowing customer data."
  - "RED contracts assert raw database projections and direct RLS separately from UI behavior."

requirements-completed: [DISCO-01, DISCO-03]

duration: 19 min
completed: 2026-09-20
---

# Phase 39 Plan 01: Discovery and Claim Database Contract Summary

**An exact-ref TEST fixture graph and executable RED database contracts now pin verified-email discovery, privacy, revocation, notification, and migration security before schema implementation begins.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-09-20T05:11:57Z
- **Completed:** 2026-09-20T05:30:30Z
- **Tasks:** 3
- **Files created:** 4

## Accomplishments

- Built a deterministic real-database graph covering confirmed primary, active
  verified alias, disconnected and unverified aliases, conflicting ownership,
  name-only, organization-only, calendar-only, confirmed speech, mixed readable
  and restricted copies, all request states, webinar classification, exact
  49/50/51 participant boundaries, and notification baseline state.
- Proved two complete create/assert/cleanup cycles against the dedicated TEST
  Supabase project, leaving zero auth users and zero fixture graph rows each time.
- Added caller-RPC and direct-table RLS contracts for allow/deny evidence,
  deduplication, bounded cursor pagination, action ordering, restricted-field
  privacy, disconnect revocation, and future notification behavior.
- Preserved and proved the existing `get_people_summary(UUID)` and
  `get_recordings_for_person(UUID,TEXT,TEXT)` signatures and return keys.
- Pinned the exact ordered three-file migration sequence and its additive DDL,
  privilege, forced-RLS, SECURITY DEFINER, pagination, token hashing, row locking,
  notification uniqueness, and legacy compatibility invariants.

## Task Commits

1. **Task 1 RED: Fixture lifecycle contract** — `834de689`
2. **Task 1 GREEN: Guarded Phase 39 fixture graph** — `9c16c67e`
3. **Task 2 RED: Discovery and privacy database contracts** — `c4af8d87`
4. **Task 3 RED: Static migration security invariants** — `bbef2172`
5. **RED harness correction: Register intentional expected failures** — `61d1ed41`

## Files Created/Modified

- `src/test/phase39-fixtures.ts` — Creates typed TEST-only identity, event,
  recording, participant, request, grant, and notification graphs; cleans every
  dependency and reports residue.
- `src/test/phase39-fixtures.integration.test.ts` — Proves exact target rejection,
  stable fixture keys, two real lifecycle cycles, and zero residue.
- `src/test/discovery-claim.integration.test.ts` — Pins DISCO-01/DISCO-03 caller
  RPC, direct RLS, privacy, notification, disconnect, and legacy People behavior.
- `src/test/migrations/phase39-discovery-claim-migrations.test.ts` — Pins the
  exact migration allowlist and static schema/security invariants.

## Decisions Made

- The Phase 39 guard is stricter than the shared integration guard: it accepts
  exactly `swjzxiddcrtaqixsfaac.supabase.co`, because these fixtures must never
  run against an arbitrary hosted project or local database.
- Confirmed primary and verified-alias discovery rows are intentionally unlinked
  (`identity_id = null`) to reproduce the live sparse-link condition and force
  Plans 04-06 to authorize from current verified email evidence.
- Boundary fixtures use 150 distinct verified identities across the 49/50/51
  events so the existing Phase 38 cutoff logic is exercised with real rows.
- Implementation contracts use `it.fails`; they report green while the named
  behavior is absent and automatically fail once an implementation begins
  satisfying them, forcing the implementing plan to remove the marker and prove
  the complete contract.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test correctness] Registered RED assertions as expected failures**

- **Found during:** Task 3 plan-level verification
- **Issue:** Ordinary failing tests encoded the right missing contracts but made
  the Wave 0 verification command indistinguishable from fixture or cleanup
  breakage.
- **Fix:** Converted only implementation-dependent assertions to Vitest
  `it.fails`; the legacy People compatibility assertion remains ordinarily green.
- **Files modified:** `src/test/discovery-claim.integration.test.ts`,
  `src/test/migrations/phase39-discovery-claim-migrations.test.ts`
- **Verification:** Discovery suite 14/14 and static suite 8/8 pass while retaining
  the exact PGRST202/missing-file RED causes.
- **Committed in:** `61d1ed41`

---

**Total deviations:** 1 auto-fixed test-harness correctness issue.
**Impact on plan:** No product or schema scope changed; the correction makes RED
status machine-verifiable and preserves automatic transition pressure.

## Issues Encountered

- The exact combined verification run recorded 169 passing tests, the 13 named
  Phase 39 RED contracts, and two Phase 38 participant-boundary tests that
  exceeded their pre-existing 5-second test timeout. Both timeout cases passed
  independently (2/2) with a 15-second timeout; no assertion or database behavior
  failed. The Phase 39 fixture/auth/cleanup paths remained green.
- Supabase-js emits its known multiple-GoTrue-client warning because the fixture
  authenticates ten isolated roles. Every client disables persisted sessions,
  execution is serial, and both cleanup cycles reached zero residue.

## Verification

- Phase 39 fixture lifecycle: **3/3 passed**, including two full TEST cycles and
  zero residue after each.
- Discovery/privacy suite: **14/14 passed** — 13 intentional RED contracts plus
  one ordinary green legacy People compatibility contract.
- Static migration suite: **8/8 passed** as intentional RED contracts for the
  three absent planned migration files.
- Combined TEST run before expected-failure registration: **169 passed**;
  failures were the 13 named Phase 39 contracts plus two 5-second Phase 38
  timeouts. Targeted Phase 38 rerun at 15 seconds: **2/2 passed**.
- Type check: **0 new errors**; existing baseline remains 299/299.
- Production guard: production ref, localhost, and an arbitrary hosted ref all
  rejected before Phase 39 fixture client construction.
- Package and lockfiles: unchanged.

## Known Stubs

None. Expected-failure tests are executable contracts owned by Plans 04-06,
not placeholder implementation.

## User Setup Required

None.

## Next Phase Readiness

- Plans 04-06 can consume stable fixture keys directly and remove each
  `it.fails` marker only after its real TEST behavior passes.
- The three migration filenames and security invariants are locked before any
  schema file is authored.
- No production database, production frontend, or `main` branch was changed.

## Self-Check: PASSED

- All four plan artifacts exist.
- All five task/TDD commits resolve in Git history.
- Acceptance scans, exact TEST lifecycle cycles, RED suites, targeted Phase 38
  timeout rerun, type check, and zero-residue checks completed.
- No package, lockfile, migration, production, or main-branch change occurred.

---
*Phase: 39-discovery-and-claim*
*Completed: 2026-09-20*
