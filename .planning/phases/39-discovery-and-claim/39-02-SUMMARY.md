---
phase: 39-discovery-and-claim
plan: "02"
subsystem: testing
tags: [supabase, edge-functions, integration-tests, security, tdd, claims]

requires:
  - phase: 39-discovery-and-claim
    provides: Exact-ref TEST fixture graph and production-ref rejection from Plan 01
  - phase: 38-access-policy-share-link-key-migration-request-flow
    provides: Content-denial and recording-owner authorization boundaries
provides:
  - Real-TEST owner authorization and participation invitation lifecycle RED contracts
  - Non-consuming inspect and atomic single-use participation claim RED contracts
  - Runtime-only token, generic failure, alias conflict, reminder race, and content-denial coverage
affects: [39-05, 39-07, 39-08, participation-claims, invitation-reminders]

tech-stack:
  added: []
  patterns:
    - Runtime-generated claim values with SHA-256 digest-only database assertions
    - Expected-failure Edge integration contracts with ordinary green fixture and cleanup gates

key-files:
  created:
    - supabase/functions/send-participation-claim/__tests__/send-participation-claim.integration.test.ts
    - supabase/functions/participation-claim/__tests__/participation-claim.integration.test.ts
  modified: []

key-decisions:
  - "Invitation tests derive owner, recording, recipient, and eligibility from canonical TEST rows and reject organization-admin or workspace-member authority."
  - "Claim values are generated at runtime and only their SHA-256 digests may reach the planned private ledger."
  - "Only absent Plan 05 and Plan 07 behavior uses Vitest expected-failure semantics; setup, authentication fixtures, teardown, and residue checks remain ordinary green gates."

patterns-established:
  - "Edge RED suites: a missing table or function is an intentional contract failure, while fixture setup or cleanup failure fails the suite normally."
  - "Claim privacy scans cover HTTP bodies, full database rows, restricted recording reads, and generic terminal equivalence without printing an opaque claim value."

requirements-completed: [DISCO-02, DISCO-03]

duration: 14min
completed: 2026-09-20
---

# Phase 39 Plan 02: Invitation and Claim Lifecycle Contract Summary

**Twenty-seven real-TEST RED contracts now pin recording-owner invitations, hash-only seven-day claims, non-consuming inspection, explicit account confirmation, and one-winner consumption before the schema and Edge Functions exist.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-09-20T05:43:00Z
- **Completed:** 2026-09-20T05:57:00Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- Added 15 invitation contracts for owner-only authorization, canonical participant
  selection, ineligible evidence, narrow input validation, idempotent concurrent
  send, seven-day resend rotation, optional one-time reminders, digest-only state,
  and direct-client ledger denial.
- Added 12 claim contracts for authenticated non-consuming inspection, intended and
  different-primary account paths, explicit email attachment, email-wide matching,
  conflicting nonnull-link preservation, parallel single-use consumption, sibling
  supersession, and generic terminal outcomes.
- Kept every opaque claim value runtime-only and asserted that HTTP responses and
  full ledger projections cannot contain it or private event metadata.
- Proved every fixture run cleans its synthetic users and graph back to zero while
  retaining Phase 38 recording-content denial after a successful claim.

## Task Commits

1. **Task 1: Owner-authorized invitation lifecycle RED contracts** — `535e6fb5`
2. **Task 2: Non-consuming inspect and atomic claim RED contracts** — `135bdcde`

## Files Created/Modified

- `supabase/functions/send-participation-claim/__tests__/send-participation-claim.integration.test.ts`
  — Owner, eligibility, input-injection, duplicate-send, resend, reminder, hash,
  privacy, concurrency, RLS, and zero-residue contracts.
- `supabase/functions/participation-claim/__tests__/participation-claim.integration.test.ts`
  — Inspect, confirmation, consume race, alias ownership, sibling, terminal,
  digest, discovery, content-denial, RLS, and zero-residue contracts.

## Decisions Made

- Organization admins and workspace members remain unauthorized when they are not
  the recording owner; tests prove that broader organization access cannot become
  invitation authority.
- Different-primary confirmation uses an unowned synthetic email so the positive
  attachment path is distinct from the verified-alias conflict denial path.
- Three same-email participants prove current-match behavior: two null identity
  links may attach to the caller identity, while a conflicting nonnull link must
  remain untouched.
- Terminal, expired, replayed, superseded, conflicting, malformed, and unknown
  claim inputs must return the same status and body.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test correctness] Shortened the Task 1 fixture prefix**

- **Found during:** Task 1 focused real-TEST run
- **Issue:** The first timestamped prefix made the organization plus workspace
  subdomain exceed the existing database length constraint during fixture setup.
- **Fix:** Shortened the prefix while preserving the required `phase39-` namespace,
  then removed the partial synthetic setup with the existing TEST cleanup RPC.
- **Files modified:**
  `supabase/functions/send-participation-claim/__tests__/send-participation-claim.integration.test.ts`
- **Verification:** The focused suite passed 15/15 and its teardown reported zero
  Phase 39 fixture residue.
- **Committed in:** `535e6fb5`

---

**Total deviations:** 1 auto-fixed test-correctness issue.
**Impact on plan:** No schema, function, product, or security scope changed.

## Issues Encountered

- Repository type-check currently reports five new errors in already committed
  Plan 39-03 test files: one component cast and four `replaceAll` target-library
  errors. Neither Plan 39-02 file appears in the error report. These unrelated
  errors were reported to the orchestrator and left unchanged under the plan
  scope boundary.
- Supabase-js prints its known multiple-GoTrue-client warning because the shared
  fixture authenticates isolated roles. Sessions are non-persistent, execution is
  serial, and teardown reached zero residue in every run.

## Verification

- Invitation suite: **15/15 passed** as intentional RED contracts; fixture setup,
  auth sessions, teardown, and residue assertions remained ordinary green gates.
- Claim suite: **12/12 passed** as intentional RED contracts; runtime token creation,
  fixture setup, teardown, and residue assertions remained ordinary green gates.
- Combined focused real-TEST run: **2 files, 27/27 passed** in 54.11 seconds.
- Production guard: inherited exact TEST allowlist accepts only
  `swjzxiddcrtaqixsfaac`; production ref `vltmrnjsubfzrgrtdqey` is rejected before
  fixture client construction.
- Type check: Plan 39-02 files introduced no reported TypeScript error; the command
  remains nonzero because of the five out-of-scope Plan 39-03 errors listed above.
- Package, lockfile, migration, deployed function, production database, frontend,
  and `main` branch: unchanged.

## Known Stubs

None. Expected-failure tests are executable contracts assigned to Plans 05 and 07,
not placeholder product behavior.

## User Setup Required

None.

## Next Phase Readiness

- Plan 05 can implement the private invitation ledger and atomic RPCs against exact
  owner, digest, reminder, confirmation, conflict, and race assertions.
- Plan 07 can implement both Edge Functions and remove expected-failure markers only
  when every server-boundary contract becomes ordinarily green.
- No unresolved HIGH threat remains in this Wave 0 test scope.

## Self-Check: PASSED

- Both planned test artifacts exist.
- Both task commits resolve in Git history.
- All 27 focused real-TEST contracts collected and passed with zero fixture residue.
- No static opaque claim value, deployment, migration, production mutation, or
  unrelated source edit was introduced.

---
*Phase: 39-discovery-and-claim*
*Completed: 2026-09-20*
