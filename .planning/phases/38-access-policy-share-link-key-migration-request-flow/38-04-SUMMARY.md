---
phase: 38-access-policy-share-link-key-migration-request-flow
plan: "04"
subsystem: database
tags: [postgres, supabase, rls, security-definer, access-policy, audit]

requires:
  - phase: 38-access-policy-share-link-key-migration-request-flow
    plans: ["01", "02", "03"]
    provides: Locked Phase 38 decisions, provider fixtures, real-database acceptance contracts, and static migration gates
provides:
  - Six-level recording policy snapshots with account defaults and owner overrides
  - Normalized confirmed-participant evidence and durable request, grant, audit, and email ledgers
  - Additive recording authorization, privacy-safe event discovery, and owner-controlled lifecycle RPCs
affects: [38-06, 38-07, 38-08, 38-09, 38-10, 38-11, access-policy, recording-rls]

tech-stack:
  added: []
  patterns:
    - Snapshot account defaults in a BEFORE INSERT trigger so every ingest and copy path shares one interception point
    - Keep content authorization separate from event existence and expose only purpose-built discovery projections
    - Write request, audit, notification, and outbox state in one locked database transaction

key-files:
  created:
    - supabase/migrations/20260919000001_phase38_access_policy_schema.sql
    - supabase/migrations/20260919000002_phase38_access_policy_rls_rpcs.sql
  modified: []

key-decisions:
  - "Existing recording SELECT policies remain intact; Phase 38 adds a separate policy/grant predicate and keeps link/public raw-table reads denied."
  - "Unknown provider evidence is neutral, any authoritative Zoom webinar type wins, and 50 distinct verified confirmed identities suppress discovery independently."
  - "The deterministic p_test_now seam is accepted only for JWTs issued by the dedicated test project, preventing production cooldown bypass."

patterns-established:
  - "All Phase 38 SECURITY DEFINER functions pin an empty search path, qualify database objects, derive actors from auth.uid(), and declare explicit execution grants."
  - "Resolved requests and revoked grants remain historical rows; audit and outbox request references use ON DELETE SET NULL."

requirements-completed: [ACCESS-01, ACCESS-02, ACCESS-03, ACCESS-04, ACCESS-05, ACCESS-09]

duration: 13min
completed: 2026-09-19
---

# Phase 38 Plan 04: Access Policy Database Layer Summary

**Additive PostgreSQL policy snapshots, verified-participant discovery, and an atomic request/grant lifecycle now enforce D-01 through D-17 at the database boundary.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-09-19T17:24:55Z
- **Completed:** 2026-09-19T17:37:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added the six recording access levels, account default snapshots, per-recording origin tracking, and a single `BEFORE INSERT` trigger covering connectors, paste, MCP, direct inserts, and copied recordings.
- Normalized explicit transcript, speaker, host, organizer, and calendar-only evidence without promoting invitations into confirmed attendance.
- Added request, grant, audit, and email outbox storage with partial uniqueness for one pending request and one active grant, durable history, and exact denial cooldown fields.
- Added FORCE RLS, direct-write denial, owner/requester/grantee read boundaries, strict notification insertion, and hardened policy/discovery/lifecycle RPCs.
- Kept Public and Anyone-with-link content behind allowlisted/token-mediated application paths while preserving legacy recipient share access and all pre-existing recording SELECT policies.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add constrained policy snapshots and lifecycle storage** - `8e16c1bd` (feat)
2. **Task 2: Add hardened authorization, discovery, and lifecycle RPCs** - `4680e72e` (feat)

## Files Created/Modified

- `supabase/migrations/20260919000001_phase38_access_policy_schema.sql` - Policy/default columns, snapshot and evidence triggers, lifecycle tables, constraints, and indexes.
- `supabase/migrations/20260919000002_phase38_access_policy_rls_rpcs.sql` - RLS, notification hardening, authorization predicates, safe discovery, and owner-controlled lifecycle functions.

## Decisions Made

- Kept every existing recording SELECT policy. The new policy is an additive union for active grants, verified Attendees/Invitees, Organization access, and existing recipient-specific shares.
- Used exact Zoom values `5/6/9` for webinar and `1/2/3/4/7/8/99` for non-webinar. Every other provider or malformed/unrecognized value stays `unknown` and cannot itself suppress discovery.
- Counted distinct verified confirmed identities for the 49/50 boundary so duplicate participant rows across copies do not inflate the event size.
- Stored no requester message and no private denial reason. Denial notification copy remains generic and the database calculates `denied_at + 30 days` exactly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Restricted deterministic clock control to the dedicated test project**
- **Found during:** Task 2 lifecycle RPC implementation
- **Issue:** The acceptance contract passes `p_test_now` to prove the exact cooldown boundary. Honoring that parameter for production JWTs would let a requester advance time and bypass the 30-day cooldown.
- **Fix:** The RPC rejects `p_test_now` unless the JWT issuer is the dedicated test Supabase project. Production callers always use server time.
- **Files modified:** `supabase/migrations/20260919000002_phase38_access_policy_rls_rpcs.sql`
- **Verification:** Source gate confirms the `TEST_CLOCK_FORBIDDEN` branch precedes every lifecycle lookup and mutation.
- **Committed in:** `4680e72e`

---

**Total deviations:** 1 auto-fixed (1 Rule 2 security requirement).
**Impact on plan:** The test remains deterministic on the dedicated project without adding a production cooldown bypass or changing product behavior.

## Issues Encountered

- The shared static suite intentionally wraps all four Phase 38 migration contracts in `it.fails`. With the two Plan 04 files now present, three satisfied contracts report as expected “unexpected passes”: the two file-existence gates and notification hardening. The coordinating executor owns converting those markers after the parallel Plan 05 branch is integrated; this branch did not edit the shared test file.
- Plan 04 is source-authoring only. Per the plan, neither migration was applied to the dedicated test project or production, so real-database RPC/RLS execution remains the blocking responsibility of Plan 06.

## Verification

- Task 1 source acceptance gates - **passed**: transactional/additive DDL, six levels, two origins, universal INSERT snapshot trigger, partial pending/active uniqueness, and history-preserving request references.
- Task 2 source acceptance gates - **passed**: FORCE RLS, owner-only mutations, repeated participant/provider/count checks, exact discovery return shape, no raw Public/Link policy, exact 30-day cooldown, and production test-clock denial.
- Security-definer source audit - **passed**: 16 definer functions have empty pinned search paths, schema-qualified Phase 38 objects, and explicit PUBLIC/anon revocations.
- `git diff --check de381730..HEAD` - **passed**.
- `git diff --exit-code de381730 -- package.json package-lock.json` - **passed**; no dependency changes.
- `npm test -- src/test/migrations/phase38-access-migrations.test.ts` - **coordination result:** 7 expected-failure contracts passed and 3 satisfied Plan 04 contracts surfaced as intentional unexpected passes pending integrated marker conversion.

## TDD Gate Compliance

- Plan 38-02 supplied the RED contracts in `78acb722`, `d8e7e63a`, and `a3ddd420` before this implementation.
- This plan supplied the GREEN implementation commits `8e16c1bd` and `4680e72e`.
- Test-marker conversion is intentionally centralized after Plans 04 and 05 integrate, avoiding an isolated-worktree conflict in the shared migration test.

## Known Stubs

None. The migrations contain complete forward SQL. Test-project application and catalog/behavior verification are assigned to Plan 06 rather than represented by placeholder code here.

## User Setup Required

None - no migration was linked, applied, deployed, or pushed from this plan.

## Next Phase Readiness

- Plan 05 can add the UUID share bridge and exact event-preserving copy bodies without changing these policy/lifecycle migrations.
- After both migration branches integrate and satisfied RED markers are converted, Plan 06 must apply all four migrations to the dedicated test project, run the real RLS/RPC/provider/lifecycle matrix, and inspect the live catalog before any production application.

## Self-Check: PASSED

- Both migration files exist and commits `8e16c1bd` and `4680e72e` are present.
- No tracked files were deleted, no package files changed, and the worktree was clean before summary creation.
- Stub and threat-surface scans found no unplanned endpoint, package, or schema surface beyond the plan threat model.

---
*Phase: 38-access-policy-share-link-key-migration-request-flow*
*Completed: 2026-09-19*
