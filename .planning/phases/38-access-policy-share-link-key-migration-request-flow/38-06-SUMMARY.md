---
phase: 38-access-policy-share-link-key-migration-request-flow
plan: "06"
subsystem: database
tags: [supabase, postgres, rls, migrations, integration-tests, generated-types]

requires:
  - phase: 38-04
    provides: access-policy migration source and real-database contracts
  - phase: 38-05
    provides: UUID share bridge and event-preserving copy migrations
provides:
  - four reviewed Phase 38 migrations proven on the dedicated test project
  - live catalog and real-database security evidence
  - reviewed Phase 38 generated TypeScript database contracts
  - production CLI relink with all four migrations still pending
affects: [38-07, 38-08, production-schema-apply, access-policy-ui]

tech-stack:
  added: []
  patterns: [dual-ref Supabase target guard, migration dry-run allowlist, generated-type delta allowlist]

key-files:
  created:
    - .planning/phases/38-access-policy-share-link-key-migration-request-flow/38-TEST-SCHEMA-EVIDENCE.md
  modified:
    - supabase/migrations/20260919000004_phase38_copy_event_preservation.sql
    - src/types/supabase.ts
    - src/test/access-policy.integration.test.ts
    - src/test/rls-regression.test.ts
    - src/services/__tests__/data-movement.dedup.integration.test.ts
    - supabase/functions/public-recording/__tests__/public-recording.integration.test.ts
    - src/services/recordings.service.ts

key-decisions:
  - "Reject raw generated-type drift and transfer only the four reviewed migrations' schema delta."
  - "Keep production untouched and relink it only for a read-only pending-history proof."
  - "Preserve existing notification update/delete behavior while restricting notification creation to service-role paths."

patterns-established:
  - "Remote schema writes require matching temp-ref and independently parsed active-project guards in the same fail-closed command."
  - "Generated database types are reviewed as a complete diff and unrelated test/project drift is excluded."

requirements-completed: [ACCESS-01, ACCESS-02, ACCESS-03, ACCESS-04, ACCESS-05, ACCESS-07, ACCESS-08, ACCESS-09, EVT-06]

duration: 30min
completed: 2026-09-19
---

# Phase 38 Plan 06: Dedicated Test Schema Apply and Proof Summary

**Four additive access-policy/share migrations applied only to `swjzxiddcrtaqixsfaac`, proven through live catalog and real-database contracts, with reviewed types generated and production left pending**

## Performance

- **Duration:** 30 min
- **Started:** 2026-09-19T17:40:04Z
- **Completed:** 2026-09-19T18:09:52Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Applied exactly migrations `20260919000001` through `20260919000004` to the dedicated test project after two independent ref checks and an exact dry-run allowlist.
- Proved RLS/FORCE RLS, policy and grant shape, pinned definer search paths, lifecycle isolation, participant/event boundaries, legacy share compatibility, and event-preserving copy behavior on the live test database.
- Generated database types from the proven schema, rejected unrelated raw generator drift, and transferred only the reviewed Phase 38 delta.
- Relinked the CLI to production and confirmed read-only that all four Phase 38 migrations remain pending there.

## Task Commits

Each task was committed atomically:

1. **Task 1: Apply only the reviewed migrations to the dedicated test project** - `b431ceb7`
2. **Task 2: Introspect security/compatibility shape and run real-DB suites** - `c46ee120`
3. **Task 3: Generate types, review delta, and restore production link** - `64e7b3c9`

## Files Created/Modified

- `.planning/phases/38-access-policy-share-link-key-migration-request-flow/38-TEST-SCHEMA-EVIDENCE.md` - Target, migration, catalog, test, type-diff, and final relink evidence.
- `supabase/migrations/20260919000004_phase38_copy_event_preservation.sql` - Pins the nested home-entry trigger path and closes the routing RPC grant.
- `src/types/supabase.ts` - Adds the reviewed access lifecycle, access fields, UUID share bridge, and RPC contracts.
- `src/test/access-policy.integration.test.ts` - Promotes implemented contracts and makes fixture isolation deterministic.
- `src/test/rls-regression.test.ts` - Promotes the applied Phase 38 RLS contract.
- `src/services/__tests__/data-movement.dedup.integration.test.ts` - Promotes event-preservation contracts for all copy signatures.
- `supabase/functions/public-recording/__tests__/public-recording.integration.test.ts` - Normalizes the now-green generic unavailable response contract.
- `src/services/recordings.service.ts` - Narrows the detail type to the columns its query selects.

## Decisions Made

- The raw type generation contained substantial pre-existing test/project drift, so only identifiers introduced or replaced by the four reviewed migrations were accepted.
- An empty test-project share inventory was recorded honestly; post-migration fixtures supply the available identity/token/status/recipient/log compatibility proof.
- Existing user notification read/dismiss privileges were preserved; only client insertion is prohibited.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Schema-qualified the nested recording home-entry trigger**
- **Found during:** Task 2 data-movement proof
- **Issue:** Hardened copy RPCs used an empty search path, exposing the pre-existing trigger's unqualified `workspaces` lookup.
- **Fix:** Pinned the invoker trigger to `search_path=''` and schema-qualified both referenced tables.
- **Files modified:** `supabase/migrations/20260919000004_phase38_copy_event_preservation.sql`
- **Verification:** All three copy/routing signatures passed the 7-case real-database suite.
- **Committed in:** `c46ee120`

**2. [Rule 2 - Missing Critical] Closed inherited authenticated routing EXECUTE**
- **Found during:** Task 2 live ACL introspection
- **Issue:** `route_recording_cross_org` revoked PUBLIC and anon but retained an inherited authenticated grant.
- **Fix:** Revoked authenticated EXECUTE and verified only postgres/service_role remain.
- **Files modified:** `supabase/migrations/20260919000004_phase38_copy_event_preservation.sql`
- **Verification:** Live `pg_proc` ACL inspection plus RLS/static suites.
- **Committed in:** `c46ee120`

**3. [Rule 1 - Bug] Isolated lifecycle fixtures after expected-failure promotion**
- **Found during:** Task 2 access-policy proof
- **Issue:** Previously expected-failing cases leaked access-policy and lifecycle state into later cases.
- **Fix:** Reset policy/lifecycle state and seed team membership explicitly per boundary case.
- **Files modified:** `src/test/access-policy.integration.test.ts`
- **Verification:** 80/80 access-policy real-database cases passed twice in the full serial suite.
- **Committed in:** `c46ee120`

**4. [Rule 1 - Bug] Narrowed a stale full-row service type**
- **Found during:** Task 3 generated-type gate
- **Issue:** A detail query returned a selected column subset while declaring the complete recordings row type; new non-null access columns surfaced the mismatch.
- **Fix:** Defined `RecordingDetail` as the exact selected column set.
- **Files modified:** `src/services/recordings.service.ts`
- **Verification:** `npm run type-check` passed with zero new errors.
- **Committed in:** `64e7b3c9`

---

**Total deviations:** 4 auto-fixed (3 Rule 1, 1 Rule 2)
**Impact on plan:** The fixes were required for safe execution, accurate verification, and a closed privilege boundary. No production schema or application deployment occurred.

## Issues Encountered

- The first complete integration run found a stale `it.fails` marker for generic missing/malformed public-recording responses. The assertion passed as a normal test, then the complete suite passed with 232 tests and 19 unrelated credential/deployment skips.
- The test project had no historical share rows before apply. This limits apply-time backfill proof to a zero-row inventory; the dedicated legacy fixture proves compatibility after the migration.

## Known Stubs

- `supabase/functions/share-call/__tests__/share-call.integration.test.ts` retains the intentional expected-failure marker for UUID-only create/resolve/list/revoke behavior. The schema is ready; Plan 38-07 owns the application and Edge Function update.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 38-07 can target the proven access lifecycle and UUID share contracts.
- Production is linked read-only and still shows all four migrations pending; the deliberate production additive apply remains a later gated step.
- Full evidence is recorded in [38-TEST-SCHEMA-EVIDENCE.md](./38-TEST-SCHEMA-EVIDENCE.md).

## Self-Check: PASSED

- Evidence and summary files exist.
- Task commits `b431ceb7`, `c46ee120`, and `64e7b3c9` exist on `v2.2-event-resolution`.
- Final CLI ref is production and the four Phase 38 migrations remain pending there.

---
*Phase: 38-access-policy-share-link-key-migration-request-flow*
*Completed: 2026-09-19*
