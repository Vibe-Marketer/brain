---
phase: 38-access-policy-share-link-key-migration-request-flow
plan: "17"
subsystem: database-security-and-release-gate
tags: [supabase, postgres, rls, migration, canary, production-safety]

# Dependency graph
requires:
  - phase: 38-16
    provides: stopped production preflight and the two unresolved legacy-row findings
provides:
  - guarded production-pending UUID bridge comment
  - forward-only idempotent share access-log restoration
  - exact six-user TEST canary lifecycle with zero-residue proof
  - fingerprint-bound nine-migration production authorization
affects: [38-18, production-rollout, phase-38-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - guarded historical migration statement with forward-only repair
    - exact-target synthetic canary and exact-ID cleanup
    - aggregate-only stable production inventory fingerprint

key-files:
  created:
    - supabase/migrations/20260919000009_phase38_restore_share_access_log.sql
    - src/test/migrations/phase38-restore-share-access-log.integration.test.ts
    - scripts/phase38-production-canary.ts
    - scripts/__tests__/phase38-production-canary.test.ts
    - .planning/phases/38-access-policy-share-link-key-migration-request-flow/38-REMEDIATION-EVIDENCE.md
  modified:
    - supabase/migrations/20260919000003_phase38_share_link_uuid_bridge.sql
    - src/test/migrations/phase38-access-migrations.test.ts
    - supabase/functions/share-call/__tests__/share-call.integration.test.ts
    - vitest.config.ts
    - .planning/phases/38-access-policy-share-link-key-migration-request-flow/38-PREPRODUCTION-VERIFICATION.md
    - .planning/phases/38-access-policy-share-link-key-migration-request-flow/38-VALIDATION.md

key-decisions:
  - "Preserve the two fingerprinted production legacy-only rows as unresolved and unavailable; never assign a cross-owner UUID."
  - "Repair the absent access-log table in forward-only migration 00009 while limiting the 00003 edit to its guarded comment."
  - "Allow production inventory to read the pre-00003 legacy schema only for the expected missing recording_id column; all other errors remain fail-closed."
  - "Use exact-ID cleanup for canary-created protected personal organizations and workspaces before deleting the six synthetic auth users."

requirements-completed: [ACCESS-01, ACCESS-02, ACCESS-03, ACCESS-04, ACCESS-05, ACCESS-06, ACCESS-07, ACCESS-08, ACCESS-09, EVT-06]

# Metrics
duration: 42m
completed: 2026-09-19
---

# Phase 38 Plan 17: Access-Log and Legacy-Gate Remediation Summary

**A guarded bridge, forward-only audit-table repair, exact six-user canary, and redacted two-row legacy invariant produced a fresh nine-migration production PASS bound to the final source tree.**

## Performance

- **Duration:** 42m
- **Started:** 2026-09-19T23:55:27Z
- **Completed:** 2026-09-20T00:37:00Z
- **Tasks:** 3
- **Files created or modified:** 11 plus this summary

## Accomplishments

- Limited the production-pending 00003 edit to a guarded comment and proved it
  is a semantic no-op when the table exists.
- Added idempotent migration 00009 to restore `call_share_access_log` with a
  nullable anonymous accessor, two foreign keys, indexes, RLS, owner-only
  reads, revoked browser mutations, service-role access, and comments.
- Applied only 00009 to TEST and confirmed the exact ordered Phase 38 migration
  history is now 00001 through 00009.
- Built and exercised the exact six-role synthetic canary lifecycle on TEST;
  cleanup left zero auth users and zero graph rows.
- Preserved the two production unresolved legacy rows and authorized their
  stable redacted classification: one source absent and one cross-owner-only,
  with zero ambiguity, unsafe assignment, or keyless rows.
- Issued a new production gate for source commit
  `11095ce8b5420e151dd8e5d852363cf1607e02e1` and non-planning fingerprint
  `13423c93d84e990e62a7d0a97bf1400916d4aa6f`.

## Task Commits

1. **Task 1 RED:** `1172d26b` — failing access-log restoration gates.
2. **Task 1 GREEN:** `0c654dec` — guarded bridge and forward-only audit repair.
3. **Task 2 RED:** `0ced7033` — failing guarded canary contracts and script-test discovery.
4. **Task 2 GREEN:** `a344649c` — exact six-user canary and redacted inventory.
5. **Task 2 cleanup fix:** `8d291021` — exact-ID cleanup of protected signup rows.
6. **Task 3 inventory fix:** `11095ce8` — pre-bridge production-schema fallback.
7. **Task 3 evidence:** `23fcf963` — fingerprint-bound remediation and production gate.

## Final Verification

| Gate | Result |
|---|---|
| Focused Phase 38 | 21 files, 223 tests passed, zero skips |
| Complete integration | 33 files and 251 tests passed; one known 15-test credential-gated file skipped |
| Complete unit | 281 files and 2,484 tests passed; one known 8-test file skipped |
| Type check | 0 new errors; baseline 299/299 |
| Lint | 0 errors; 129 existing warnings |
| Build | 4,839 modules transformed; exit 0 |
| Chromium/axe/privacy | 18 passed; zero skips |
| TEST canary | 6 users/graph present, then 0 users/0 graph rows |
| TEST catalog/integrity | nine migrations; restored table contract green; all integrity counts zero |
| Production read-only inventory | 2 unresolved: 1 source absent, 1 cross-owner-only; all unsafe counts zero |
| Final production gate | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Included script tests in Vitest discovery**

- **Found during:** Task 2 RED
- **Issue:** `scripts/__tests__/*.test.ts` was outside the configured Vitest
  include patterns, so the required canary contract suite could not run.
- **Fix:** Added the existing script-test directory to `vitest.config.ts`.
- **Files modified:** `vitest.config.ts`
- **Commit:** `0ced7033`

**2. [Rule 1 - Bug] Corrected real TEST canary identifiers and failure cleanup**

- **Found during:** Task 2 real TEST lifecycle
- **Issue:** Initial synthetic organization slugs violated existing constraints,
  and auth signup created protected personal organization/workspace rows that
  blocked direct admin user deletion.
- **Fix:** Generated constraint-safe identifiers and removed only the exact
  canary users' protected signup rows through the exact-ID admin cleanup RPC
  before exact auth-user deletion. Both failed attempts were cleaned to zero
  residue.
- **Files modified:** `scripts/phase38-production-canary.ts`,
  `scripts/__tests__/phase38-production-canary.test.ts`
- **Commits:** `a344649c`, `8d291021`

**3. [Rule 1 - Bug] Supported the production pre-bridge inventory shape**

- **Found during:** Task 3 production read-only inventory
- **Issue:** Production correctly lacks `call_share_links.recording_id` until
  pending migration 00003, so the first extended inventory SELECT failed.
- **Fix:** Retry the legacy column projection only for Postgres undefined-column
  error `42703` naming that canonical field, synthesize null canonical IDs in
  process, and keep permissions or unrelated errors fail-closed.
- **Files modified:** `scripts/phase38-production-canary.ts`,
  `scripts/__tests__/phase38-production-canary.test.ts`
- **Commit:** `11095ce8`

## TDD Gate Compliance

Task 1 and Task 2 each have a RED `test(38-17)` commit followed by their GREEN
implementation commits. The final suites pass on the committed source tree.

## Production Mutation Record

- Production migrations applied: none.
- Production canary provisioned: no.
- Customer rows changed: none.
- Edge Functions deployed: none.
- Git pushed or merged to `main`: no.
- Frontend deployed: no.
- Production access: target assertion plus aggregate/redacted read-only
  inventory only.

## Known Stubs

None. The generic unavailable response in the legacy tests is the required
privacy behavior, not a placeholder.

## Threat Flags

None. The migration, target guard, RLS/grant repair, canary lifecycle, cleanup,
and production inventory surfaces are covered by the Plan 17 threat model and
passing tests.

## Next Phase Readiness

Plan 18 may reconsider the production rollout only while the verified source
fingerprint, exact nine-migration set, and authorized unresolved-row fingerprint
still match `38-PREPRODUCTION-VERIFICATION.md`. Production must preserve the two
legacy-only unresolved rows and must not assign either a UUID.

## Self-Check: PASSED

All Plan 17 source, test, migration, evidence, validation, and summary files
exist. All seven task/evidence commits resolve in Git history. The final
non-planning fingerprint still matches the production authorization, the TEST
browser and canary manifests are absent, and the working tree contained only
this summary before the final documentation commit.

---
*Phase: 38-access-policy-share-link-key-migration-request-flow*
*Completed: 2026-09-19*
