---
phase: 38-access-policy-share-link-key-migration-request-flow
plan: "02"
subsystem: testing
tags: [supabase, integration-tests, rls, access-policy, migrations, event-id]

requires:
  - phase: 38-access-policy-share-link-key-migration-request-flow
    provides: Dedicated-test guard, reusable authorization fixture graph, and provider boundary fixtures from Plan 01
provides:
  - Real-database RED contracts for all six recording access policies and owner-only mutations
  - Privacy-safe discovery, provider classification, verified participation, and exact 49/50 boundary coverage
  - Request, approval, denial, cooldown, revocation, audit, notification, and client-write-denial contracts
  - RLS inventory coverage for new lifecycle tables and invocation coverage for all three copy/routing signatures
  - Static additive migration, legacy share preservation, security-definer, and event-copy safety gates
affects: [38-04, 38-05, 38-06, access-policy, share-links, data-movement]

tech-stack:
  added: []
  patterns:
    - Use Vitest expected-failure contracts for behavior intentionally absent before additive schema plans
    - Exercise authorization with signed user clients while reserving service role for setup, cleanup, and inspection
    - Register future RLS objects now and isolate their RED coverage until migrations land

key-files:
  created:
    - src/test/access-policy.integration.test.ts
    - src/test/migrations/phase38-access-migrations.test.ts
  modified:
    - src/test/rls-regression.test.ts
    - src/services/__tests__/data-movement.dedup.integration.test.ts

key-decisions:
  - "Wave 0 database behavior uses Vitest it.fails contracts so missing Phase 38 objects are executable RED requirements without breaking the established integration baseline."
  - "The 49/50 cutoff is exercised independently for neutral unknown and explicit non-webinar evidence, and request creation repeats the same server-side gate."
  - "All three current copy signatures are invoked with both null and non-null event_id values; source and destination policies remain independently editable across dedup retries."

patterns-established:
  - "Discovery payload gates compare exact key allowlists and separately reject every protected owner, provider, content, source, org, URL, duration, and thumbnail field."
  - "Migration source gates strip comments before negative assertions so safety prose cannot invalidate additive DDL checks."

requirements-completed: [ACCESS-01, ACCESS-02, ACCESS-03, ACCESS-04, ACCESS-05, ACCESS-08, ACCESS-09, EVT-06]

duration: 17 min
completed: 2026-09-19
---

# Phase 38 Plan 02: Access Policy Acceptance Coverage Summary

**Real-database access, discovery, lifecycle, RLS, copy preservation, and migration safety contracts now define the Phase 38 database boundary before schema implementation.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-09-19T16:38:45Z
- **Completed:** 2026-09-19T16:55:46Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Added 82 signed-client acceptance cases spanning six access levels, default snapshots, owner-only mutation, exact discovery payloads, every provider fixture, positive-webinar aggregation, verified participation, independent 49/50 limits, lifecycle idempotency, and the exact 30-day cooldown boundary.
- Extended the canonical RLS inventories with request, grant, audit, and outbox objects, with explicit owner/requester/grantee positives and unrelated-actor/client-write denials.
- Invoked `copy_recording_to_org`, `copy_recording_to_organization`, and `route_recording_cross_org` with null and non-null `event_id`, plus dedup retry and independent destination-policy contracts.
- Added static gates for the exact four Phase 38 migration files, additive-only DDL, legacy share key/token/log preservation, notification INSERT tightening, hardened security-definer functions, and `v_source.event_id` propagation.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define policy, discovery, and lifecycle behavior against real Supabase** - `78acb722`
2. **Task 2: Extend RLS and copy/routing regression matrices** - `d8e7e63a`
3. **Task 3: Add additive migration and function-hardening source gates** - `a3ddd420`

## Files Created/Modified

- `src/test/access-policy.integration.test.ts` - Signed-client RED matrix for policies, discovery, provider evidence, lifecycle, cooldown, content separation, and client DML denial.
- `src/test/rls-regression.test.ts` - Canonical lifecycle-table inventories plus Phase 38 positive and negative RLS contracts.
- `src/services/__tests__/data-movement.dedup.integration.test.ts` - All current copy/routing signatures with exact event and destination-policy preservation cases.
- `src/test/migrations/phase38-access-migrations.test.ts` - Exact-file, additive DDL, legacy compatibility, notification, function hardening, and copy-body source gates.

## Decisions Made

- Expected failures are tied to absent Phase 38 schema/RPC behavior with `it.fails`; Plan 38-04 and Plan 38-05 must remove the markers as implementations satisfy the contracts.
- Service-role clients only prepare and inspect fixtures. Every policy, discovery, lifecycle, RLS, and user-authorized copy assertion uses a signed user client unless the production function is intentionally service-role-only.
- Unknown provider evidence stays neutral. The suite never treats free-form Grain text containing “webinar” as authoritative and never promotes unknown to non-webinar.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Shortened the generated fixture prefix**
- **Found during:** Task 1 targeted real-database run
- **Issue:** The initial prefix exceeded the live test schema's combined organization/workspace subdomain length constraint.
- **Fix:** Switched to a bounded base-36 timestamp prefix and removed the one partially created test organization and its reserved test users.
- **Files modified:** `src/test/access-policy.integration.test.ts`
- **Verification:** All 82 access-policy expected-failure contracts executed against the dedicated test project.
- **Committed in:** `78acb722`

**2. [Rule 1 - Bug] Completed extra source-recording cleanup**
- **Found during:** Task 2 targeted data-movement run
- **Issue:** Extra copy-signature fixtures could receive workspace entries, causing the protective recording-delete trigger to block organization cleanup.
- **Fix:** Delete workspace entries for every extra source recording before deleting recordings, then verified the fixture graph cleans fully.
- **Files modified:** `src/services/__tests__/data-movement.dedup.integration.test.ts`
- **Verification:** Targeted data-movement suite passed 7/7 with no cleanup failure on a repeat run.
- **Committed in:** `d8e7e63a`

---

**Total deviations:** 2 auto-fixed bugs.
**Impact on plan:** Both fixes preserve deterministic, zero-residue real-database execution without changing product behavior or touching production.

## Issues Encountered

- The first complete integration run had one unrelated `reporter-comms.integration.test.ts` case exceed its 5-second timeout by a few milliseconds. Its isolated rerun passed, and the repeated complete integration run exited successfully.
- Supabase-js emits the existing multiple-GoTrue-client warning for multi-actor fixtures. All clients disable session persistence and the integration runner remains serial.

## Verification

- `npm test -- src/test/rls-regression.test.ts src/test/migrations/phase38-access-migrations.test.ts` - **91 passed**.
- Targeted data movement integration - **7 passed**, including four Phase 38 expected-failure contracts.
- Targeted access policy integration - **82 expected-failure contracts passed** against the dedicated test project.
- `npm run test:integration` - repeated complete run **passed**; expected total is 225 passed with the existing credential-dependent skips.
- `npm run type-check` - **0 new errors**, existing baseline remains 321/321.
- Focused ESLint - **0 errors** across all four owned files.
- `git diff --exit-code 7937b9d9 -- package.json package-lock.json` - passed; no dependency changes.

## TDD Gate Compliance

This is a Wave 0 acceptance-only plan. Each task produced a `test(38)` RED-contract commit; no production implementation commit belongs in Plan 02. The expected-failure markers keep the baseline green while forcing Plans 04-05 to turn every contract into an ordinary passing test.

## Known Stubs

None. The `it.fails` cases are intentional executable RED contracts assigned to Plans 38-04 and 38-05, not placeholder product behavior.

## Threat Flags

None. This plan adds test coverage only and introduces no runtime endpoint, authorization path, file-access path, or schema change.

## User Setup Required

None - the existing dedicated test Supabase environment was used and production was untouched.

## Next Phase Readiness

- Plan 38-04 can implement access-policy schema, RLS, discovery, and lifecycle RPCs directly against the signed-client matrix.
- Plan 38-05 can implement the UUID share bridge and all three event-preserving copy bodies against the static and real-database gates.
- Expected-failure markers must be removed only when their corresponding implementation passes against the dedicated test project.

## Self-Check: PASSED

- All four owned artifacts exist.
- Task commits `78acb722`, `d8e7e63a`, and `a3ddd420` exist in git history.
- Targeted RLS/static, access-policy, data-movement, full integration, type-check, lint, and lockfile gates were executed.

---
*Phase: 38-access-policy-share-link-key-migration-request-flow*
*Completed: 2026-09-19*
