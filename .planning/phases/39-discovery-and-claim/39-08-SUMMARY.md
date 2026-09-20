---
phase: 39-discovery-and-claim
plan: "08"
subsystem: database
tags: [supabase, postgres, rls, edge-functions, integration-testing, schema-contract]

requires:
  - phase: 39-04
    provides: Verified-email discovery schema and real-database contract
  - phase: 39-06
    provides: Notification and disconnect lifecycle schema
  - phase: 39-07
    provides: Participation invitation and claim Edge boundaries
provides:
  - Exact three-migration Phase 39 schema applied and catalog-proven on dedicated TEST
  - Generated TypeScript contract for the reviewed Phase 39 schema delta
  - ACTIVE TEST deployments for both Phase 39 Edge Functions
  - Full real-database, Phase 38, RLS, cleanup, and production-pending evidence
affects: [39-10, 39-11, 39-12, production-rollout, frontend-verification]

tech-stack:
  added: []
  patterns: [exact migration allowlist, source fingerprinting, catalog security assertion, TEST-first deployment, independent fixture residue proof]

key-files:
  created:
    - .planning/phases/39-discovery-and-claim/39-TEST-SCHEMA-EVIDENCE.md
  modified:
    - src/types/supabase.ts
    - type-baseline.json
    - src/test/access-policy.integration.test.ts
    - src/test/reporter-comms.integration.test.ts
    - supabase/functions/share-call/__tests__/share-call.integration.test.ts

key-decisions:
  - "Keep the generated type update limited to exact TEST-generated Phase 39 blocks because a full TEST generation contains unrelated environment drift."
  - "Accept an idempotent migration replay when TEST already records the exact three reviewed migrations and both dry-run and push report the remote database up to date."
  - "Deploy committed Phase 38 share-call source to TEST only as an authorized dependency repair; the Phase 39 production function allowlist remains exactly two functions."
  - "Use the established 30-second budget for measured real-database matrices while preserving every authorization and privacy assertion."

patterns-established:
  - "Blocking hosted-schema gate: fingerprint source, apply to TEST, introspect catalogs, regenerate exact types, deploy, run real-DB suites, prove zero residue, then restore the production resting link."
  - "Production non-mutation proof: final read-only migration list and guarded dry-run must show the reviewed migrations still pending."

requirements-completed: [DISCO-01, DISCO-02, DISCO-03]

duration: 50min
completed: 2026-09-20
---

# Phase 39 Plan 08: Dedicated TEST Backend Contract Summary

**Three reviewed Phase 39 migrations, two claim Edge Functions, generated types, catalog security, and 301 repository integration checks now prove the complete backend contract on dedicated TEST while production remains untouched.**

## Performance

- **Duration:** 50 min
- **Started:** 2026-09-20T07:36:39Z
- **Completed:** 2026-09-20T08:26:23Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Proved the exact ordered `20260920000001..00003` migration allowlist is Local=Remote on TEST, with source commit and SHA-256 manifest evidence and no unrelated schema apply.
- Generated the exact Phase 39 TypeScript schema delta from TEST and catalog-verified columns, constraints, indexes, FORCE RLS, policies, grants, function signatures, defaults, bodies, owners, volatility, and `search_path`.
- Deployed `send-participation-claim` v7 and `participation-claim` v4 to TEST, then passed all focused Phase 39, Phase 38, RLS, Edge, static, type, and repository integration gates.
- Independently proved zero Phase 39 fixture users or rows remain and reran the catalog security assertion after testing.
- Restored the CLI resting link to production and proved a read-only production dry-run still lists exactly the three Phase 39 migrations as pending.

## Task Commits

1. **Task 1: Fingerprint, review, and apply exactly three migrations to TEST** - `d60f9658`
2. **Task 2: Regenerate types and introspect every security contract** - `80dcd125`
3. **Task 3 support: Stabilize the real-database regression gate** - `f64996a5`
4. **Task 3 support: Budget the Phase 38 boundary matrix** - `2ff1159f`
5. **Task 3 support: Budget the Phase 38 combined-role read test** - `02f24ae1`
6. **Task 3: Deploy TEST functions and prove all regressions/cleanup** - `5e1d15a8`

## Files Created/Modified

- `.planning/phases/39-discovery-and-claim/39-TEST-SCHEMA-EVIDENCE.md` - Source fingerprints, guarded migration/deploy evidence, catalog assertions, test counts, cleanup proof, and production non-mutation proof.
- `src/types/supabase.ts` - Exact TEST-generated Phase 39 table and RPC declarations only.
- `type-baseline.json` - Registered one structural TS2589 increase caused by the expanded generated contract.
- `src/test/access-policy.integration.test.ts` - Established integration time budgets for the measured boundary and combined-role matrices.
- `src/test/reporter-comms.integration.test.ts` - Established integration time budget for the multi-source notification denial matrix.
- `supabase/functions/share-call/__tests__/share-call.integration.test.ts` - Schema-valid tokens and foreign-key-valid denial fixtures.
- Five Phase 39 Wave 0 test files - ES2020-compatible UUID normalization and an explicit `unknown` component bridge.

## Decisions Made

- Full TEST type generation was not copied wholesale because it would remove production-only contracts and import unrelated TEST drift. Only exact generator-produced Phase 39 blocks were merged.
- Existing TEST migration history was accepted after exact source, history, catalog, dry-run, and no-op push agreement. Migration history was not rewritten to manufacture a second apply.
- The additional `share-call` deployment was limited to TEST and recorded as a dependency repair for committed Phase 38 source. No production function allowlist changed.
- Real-database cases that exceed Vitest's five-second unit-test default receive the established 30-second integration budget at the narrowest affected test scope.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Preserved unrelated schema contracts during TEST type generation**
- **Found during:** Task 2
- **Issue:** A full TEST-generated file would remove 15 production-only tables and introduce unrelated TEST drift.
- **Fix:** Extracted and merged only the two table and eleven RPC blocks generated for the reviewed Phase 39 delta.
- **Files modified:** `src/types/supabase.ts`
- **Verification:** Exact symbol diff, 225 additions/zero removals, type baseline gate, and live catalog agreement passed.
- **Committed in:** `80dcd125`

**2. [Rule 1 - Compile correctness] Corrected pre-existing Phase 39 Wave 0 TypeScript errors**
- **Found during:** Task 2 type gate
- **Issue:** Four tests used ES2021-only `replaceAll` under ES2020 and one component cast lacked the required `unknown` bridge.
- **Fix:** Used ES2020 regex replacement and an explicit safe test cast; registered the generated-contract TS2589 structural increase from 10 to 11.
- **Files modified:** Five Phase 39 test files and `type-baseline.json`
- **Verification:** `npm run type-check` passed with zero new baseline errors.
- **Committed in:** `80dcd125`

**3. [Rule 3 - Blocking dependency] Deployed committed Phase 38 share-call source to TEST**
- **Found during:** Task 3 full integration gate
- **Issue:** TEST `share-call` v9 predated committed anonymous access logging, so the full Phase 38 regression could not exercise the reviewed source.
- **Fix:** After explicit orchestrator authorization, fingerprinted and deployed only `share-call` to TEST as v10.
- **Files modified:** No source file; TEST deployment only.
- **Verification:** The share-call suite passed 18/18 and the repository integration gate passed.
- **Committed in:** Deployment evidence recorded in `5e1d15a8`.

**4. [Rule 1 - Test correctness] Repaired invalid share-call denial fixtures**
- **Found during:** Task 3 full integration gate
- **Issue:** Generated tokens exceeded `varchar(32)` and an unresolved link fixture contradicted the enforced provider-row foreign key.
- **Fix:** Shortened generated tokens and removed the impossible redundant unresolved row while preserving missing, expired, revoked, wrong-recipient, and no-log denial coverage.
- **Files modified:** `supabase/functions/share-call/__tests__/share-call.integration.test.ts`
- **Verification:** Focused share-call suite passed 18/18 inside the final full gate.
- **Committed in:** `f64996a5`

**5. [Rule 1 - Test timing] Applied measured real-database budgets**
- **Found during:** Task 3 full integration gate
- **Issue:** Reporter communications and two Phase 38 access-policy matrices exceeded Vitest's five-second unit-test default while their assertions remained green under normal hosted-database latency.
- **Fix:** Applied the established 30-second integration budget only to the affected test/matrix scopes.
- **Files modified:** `src/test/reporter-comms.integration.test.ts`, `src/test/access-policy.integration.test.ts`
- **Verification:** Focused cases and the final 301-test repository integration gate passed.
- **Committed in:** `f64996a5`, `2ff1159f`, `02f24ae1`

---

**Total deviations:** 5 auto-fixed (3 Rule 1 correctness fixes, 2 Rule 3 blockers).
**Impact on plan:** The fixes preserve the reviewed production contract and make its hosted TEST proof accurate; no product scope or production state changed.

## Issues Encountered

- The three allowlisted migrations were already present on TEST from Plans 39-04 through 39-06. Exact history/catalog agreement and idempotent no-op replay replaced a destructive reapply.
- Supabase CLI database dump tooling could not use Docker in this environment. Its guarded short-lived TEST login supported catalog assertions; service-role API probes independently proved auth and public-table cleanup without persisting secrets.
- Supabase JS reports its known multiple-GoTrueClient warning while constructing multi-user fixtures. All assertions and cleanup gates passed.

## Verification

- Migration history: exact three versions Local=Remote on TEST.
- Catalog: `CATALOG_SECURITY_GATE: PASS` before deployment and after all tests.
- Static migration contract: **9/9 passed**.
- Type gate: **PASS**, zero new baseline errors.
- Focused required backend gates: **222/222 passed**.
- Repository integration command: **301 passed, 19 credential-gated skipped, 0 failed** across 38 files.
- TEST functions: `send-participation-claim` ACTIVE v7; `participation-claim` ACTIVE v4; dependency `share-call` ACTIVE v10.
- Independent cleanup: zero marked auth users, organizations, workspaces, recordings, participants, aliases, requests, invitations, and notifications.
- Production read-only dry-run: exactly the three Phase 39 migrations remain pending.
- CLI resting link: production ref `vltmrnjsubfzrgrtdqey`.

## Known Stubs

None.

## User Setup Required

None.

## Next Phase Readiness

- Plans 39-10 through 39-12 can depend on the exact TEST backend contract and generated types.
- Production migration/function rollout remains intentionally pending for the approved production rollout plan.
- No blocker remains.

## Self-Check: PASSED

- Summary, TEST evidence, and generated type artifacts exist.
- All six Task 1–3 and stabilization commits resolve in Git history.
- The final TEST evidence ends `TEST-SCHEMA-GATE: PASS`.
- The local Supabase CLI project ref is restored to production.
- Stub and threat-surface scans found no new incomplete product path or unmodeled runtime boundary.

---
*Phase: 39-discovery-and-claim*
*Completed: 2026-09-20*
