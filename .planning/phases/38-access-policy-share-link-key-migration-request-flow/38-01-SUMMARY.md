---
phase: 38-access-policy-share-link-key-migration-request-flow
plan: "01"
subsystem: testing
tags: [supabase, integration-tests, access-policy, share-links, fixtures]

requires:
  - phase: 37-transcript-reconciliation
    provides: Canonical events, recording event links, and verified identity evidence
provides:
  - Fail-closed dedicated-test Supabase environment guard
  - Reusable synthetic Phase 38 authorization and identity fixture graph
  - Complete provider event-kind and 49/50 discovery boundary fixtures
  - Legacy share compatibility matrix and intentional UUID bridge RED contract
affects: [38-02, 38-03, 38-04, 38-05, 38-06, 38-07]

tech-stack:
  added: []
  patterns:
    - Guard every integration client before Supabase client construction
    - Use deterministic UUID-prefixed synthetic real-database fixtures with checked cleanup
    - Express deferred database compatibility behavior with Vitest expected-failure contracts

key-files:
  created:
    - src/test/integration-setup.test.ts
    - src/test/phase38-fixtures.ts
    - src/test/phase38-fixtures.integration.test.ts
    - src/test/fixtures/phase38-provider-event-kind.ts
  modified:
    - src/test/integration-setup.ts
    - supabase/functions/share-call/__tests__/share-call.integration.test.ts

key-decisions:
  - "All Phase 38 integration clients require dedicated test URL, anon key, and service-role key; the production ref is rejected independently of environment aliases."
  - "Request/grant/audit fixture seeding is exported separately so later plans can enable it immediately after the additive lifecycle tables exist."
  - "The UUID-only share bridge contract uses Vitest it.fails until Plans 05-07 add and deploy the recording_id path; a passing implementation will force removal of the expected-failure marker."

patterns-established:
  - "Fixture graph: create isolated auth, org, event, recording, identity, participant, and share resources from one prefix; clean each dependency independently and assert zero residue."
  - "Provider classification: only Zoom 5/6/9 is webinar; unknown is neutral; any webinar signal and the independent 50-person cutoff suppress discovery."

requirements-completed: [ACCESS-01, ACCESS-02, ACCESS-03, ACCESS-04, ACCESS-05, ACCESS-07, ACCESS-08, ACCESS-09, EVT-06]

duration: 22 min
completed: 2026-09-19
---

# Phase 38 Plan 01: Test Safety and Compatibility Foundation Summary

**Production-ref rejection, synthetic authorization fixtures, provider boundary matrices, and a real-database legacy/UUID share compatibility contract now protect the remaining Phase 38 work.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-19T16:12:06Z
- **Completed:** 2026-09-19T16:34:14Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Centralized integration setup now requires all three dedicated-test credentials, rejects the production project ref before client creation, and gives share-call no production-named fallback.
- Added a reusable real-database fixture graph with eight signed user roles, isolated org/workspace/event/recording state, verified aliases, confirmed and invitee-only participants, legacy share/access-log rows, lifecycle seeders, checked cleanup, and two-cycle zero-residue proof.
- Checked in every Zoom and supported-source provider classification case, positive-webinar aggregation precedence, neutral-unknown passage, unverified/invitee/org-only denials, and 49/50 participant boundaries.
- Expanded share-call coverage for old row/token identity, recipient/status/access-log preservation, anonymous safety, wrong recipient, owner/recipient, expired, and revoked behavior. UUID-only create/resolve/list/revoke is pinned as an intentional expected failure until the bridge lands.

## Task Commits

Each task was committed atomically:

1. **Task 1: Enforce the dedicated-test environment boundary** - `c19acbfd` (RED), `cfadce17` (GREEN)
2. **Task 2: Create isolated Phase 38 fixture graphs** - `2905b25f` (RED), `bf165a74` (GREEN), `799ab508` (REFACTOR)
3. **Task 3: Pin old-token and UUID-native share behavior in RED tests** - `b04c67db` (RED contract with green legacy matrix)

## Files Created/Modified

- `src/test/integration-setup.ts` - Validates dedicated targets and builds guarded service-role/anon clients.
- `src/test/integration-setup.test.ts` - Proves missing credentials, production rejection, and test-project acceptance without a network call.
- `src/test/phase38-fixtures.ts` - Creates and cleans the reusable Phase 38 real-database fixture graph and future lifecycle rows.
- `src/test/phase38-fixtures.integration.test.ts` - Runs two independent create/cleanup cycles and verifies zero residue.
- `src/test/fixtures/phase38-provider-event-kind.ts` - Defines the complete provider, aggregation, evidence, and participant-count matrix.
- `supabase/functions/share-call/__tests__/share-call.integration.test.ts` - Pins legacy behavior and UUID-native bridge requirements.

## Decisions Made

- The production project ref check is hard-coded and URL-parsed so an absent or incorrect production env alias cannot weaken it.
- Missing credentials return collection-safe throwing proxies without calling `createClient`; live suites remain explicitly skipped while no fake or production-derived client is constructed.
- Lifecycle rows use a separate seeder because their tables intentionally do not exist before later additive Phase 38 migrations.
- UUID bridge assertions use `it.fails`: the suite stays green now, but automatically becomes red when the feature starts passing until later plans remove the marker and verify the full sequence.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added a focused non-network guard test**
- **Found during:** Task 1
- **Issue:** The listed integration file is skipped when credentials are absent, so it could not prove missing credentials and production rejection without depending on live setup.
- **Fix:** Added `src/test/integration-setup.test.ts` to exercise pure guard functions with injected environment objects.
- **Files modified:** `src/test/integration-setup.test.ts`
- **Verification:** 3/3 targeted tests pass without a remote call.
- **Committed in:** `c19acbfd`, `cfadce17`

**2. [Rule 1 - Bug] Aligned fixture values and cleanup with live schema constraints**
- **Found during:** Task 2 real-database RED/GREEN cycle
- **Issue:** Live TEST enforces alphanumeric slugs, `personal|business` organization types, protective last-workspace-owner triggers, and the cleanup RPC's reserved test-email patterns.
- **Fix:** Used bounded alphanumeric slugs, `business` orgs, non-owner workspace fixture roles, and `@example.invalid` users. All cleanup operations check errors and zero-residue assertions run twice.
- **Files modified:** `src/test/phase38-fixtures.ts`
- **Verification:** Both full fixture cycles passed with zero rows/users remaining.
- **Committed in:** `bf165a74`

---

**Total deviations:** 2 auto-fixed (1 missing critical test, 1 live-schema correctness fix).
**Impact on plan:** Both changes strengthen the required safety and cleanup contract without changing product behavior or touching production.

## Issues Encountered

- Early fixture RED/GREEN iterations created 48 synthetic test users before live slug/type/cleanup constraints were fully reflected. Their emails were converted to the reserved test domain, the approved cleanup RPC removed them, and four temporary fixture organizations were deleted. No customer or production data was used or changed.
- Supabase-js warns about multiple GoTrue clients in one browser context while the eight signed roles are created. Sessions use `persistSession: false`, tests run serially, and the warning did not affect behavior.

## Verification

- `npm run test:integration` — **139 passed, 19 skipped** across 31 files; all real-database suites green.
- `npm run type-check` — **0 new errors**; existing 321-error baseline unchanged.
- Targeted environment guard — **3 passed**.
- Targeted share-call matrix — **10 passed**, including the intentional UUID expected-failure contract.
- Focused ESLint — **0 errors**; one expected ignore warning for the Edge Function test path.
- `git diff --exit-code -- package.json package-lock.json` — passed; no supply-chain changes.

## Known Stubs

None. The UUID bridge case is an intentional executable RED contract owned by later Phase 38 plans, not placeholder implementation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The dedicated TEST environment and reusable fixture graph are ready for Phase 38 schema, RLS, RPC, data movement, and share bridge plans.
- Later lifecycle plans should call `createPhase38LifecycleFixtures()` after adding the three access lifecycle tables.
- Plans 05-07 must implement `call_share_links.recording_id`, then remove `it.fails` only after create, resolve, list, and revoke pass for a UUID-only non-Fathom recording.

## Self-Check: PASSED

- All six created/modified artifacts exist.
- All six task commits exist in git history.
- Task acceptance scans, full integration verification, type-check, lint, and lockfile checks passed.

---
*Phase: 38-access-policy-share-link-key-migration-request-flow*
*Completed: 2026-09-19*
