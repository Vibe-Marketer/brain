---
phase: 38-access-policy-share-link-key-migration-request-flow
plan: "05"
subsystem: database
tags: [postgres, supabase, share-links, uuid-migration, event-identity]

requires:
  - phase: 38-access-policy-share-link-key-migration-request-flow
    plans: ["01", "02", "03"]
    provides: Dedicated-test safety, migration source gates, and UUID/event preservation contracts
provides:
  - Additive UUID bridge for legacy call share links without row or token replacement
  - Owner-scoped exact-one-match backfill and service-only bridge inventory
  - UUID-native shared-with-me RPC with a BIGINT compatibility wrapper
  - Event identity preservation in all three current cross-org copy/routing functions
affects: [38-06, 38-07, share-call, mcp-server, data-movement]

tech-stack:
  added: []
  patterns:
    - Expand, backfill, and dual-read for legacy BIGINT to canonical UUID migrations
    - Destination copy INSERTs preserve event identity while omitting independent policy columns

key-files:
  created:
    - supabase/migrations/20260919000003_phase38_share_link_uuid_bridge.sql
    - supabase/migrations/20260919000004_phase38_copy_event_preservation.sql
  modified: []

key-decisions:
  - "Legacy share rows backfill only when provider ID plus owner resolves to exactly one canonical recording; ambiguous and unresolved rows retain the legacy key."
  - "get_calls_shared_with_me_v3 returns canonical UUIDs, while v2 remains a BIGINT compatibility wrapper for provider-backed recordings."
  - "Cross-org copy functions copy event_id only for new rows and never overwrite an existing deduplicated destination's event association."

patterns-established:
  - "Share bridge: preserve row ID, token, status, timestamps, recipient, access logs, and legacy key while adding a nullable UUID FK."
  - "Copy policy independence: omit access_level and access_policy_origin so the destination owner's INSERT trigger supplies policy defaults."

requirements-completed: [ACCESS-07, ACCESS-08, EVT-06]

duration: 9 min
completed: 2026-09-19
---

# Phase 38 Plan 05: Share UUID Bridge and Event Preservation Summary

**In-place share-link UUID compatibility with exact owner-scoped backfill, plus event-preserving definitions for every current cross-org copy path.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-09-19T17:23:00Z
- **Completed:** 2026-09-19T17:31:42Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `call_share_links.recording_id` as a nullable UUID foreign key, retained nullable `call_recording_id`, and enforced that every row has at least one recording key.
- Backfilled only exact owner-scoped matches in place, with no share-row insertion/deletion, token rewrite, or access-log change; a service-only helper reports unresolved and ambiguous counts without exposing share data.
- Added `get_calls_shared_with_me_v3()` for canonical UUID results and rebuilt v2 as the unchanged BIGINT compatibility signature over v3.
- Replaced all three latest cross-org copy/routing bodies with definitions that include exact `v_source.event_id` propagation while preserving dedup, retry, membership, workspace, timeout, and deletion behavior.
- Left `access_level` and `access_policy_origin` out of destination INSERTs so each new copy receives the destination owner's current default independently.

## Task Commits

Each task was committed atomically:

1. **Task 1: Bridge share links to recording UUIDs without row/token replacement** - `d9d6d853` (feat)
2. **Task 2: Preserve event_id in all current copy/routing definitions** - `eef7bb2a` (fix)

## Files Created/Modified

- `supabase/migrations/20260919000003_phase38_share_link_uuid_bridge.sql` - Adds the UUID FK, deterministic backfill, dual-key constraint/indexes, inventory RPC, UUID-native shared-with-me RPC, and v2 compatibility wrapper.
- `supabase/migrations/20260919000004_phase38_copy_event_preservation.sql` - Replaces the three latest copy/routing functions with exact event preservation and explicit hardened grants.

## Decisions Made

- Ambiguous legacy mappings are never assigned a UUID. They remain usable through `call_recording_id` and appear only as aggregate inventory counts for service-role operators.
- UUID rows are authoritative in v3. Legacy fallback requires exactly one owner-scoped match, preventing arbitrary selection when provider IDs collide.
- The v2 wrapper omits UUID-only recordings because its locked return type is BIGINT; callers needing all shares must migrate to v3.
- Dedup retries return the existing destination without updating its event association. `event_id` is copied only when a new destination row is inserted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Hardened the copied SECURITY DEFINER bodies and explicit grants**
- **Found during:** Task 2
- **Issue:** The latest source definitions used `search_path = public`, unqualified relation/helper references, and implicit PUBLIC execution on the two user-facing copy functions. The Phase 38 security source gate requires an empty search path, qualified objects, and explicit intended-role grants.
- **Fix:** Set `search_path = ''`, schema-qualified every table/helper reference, revoked execution from PUBLIC/anon, granted the user copy functions to authenticated/service_role, and retained service-role-only execution for cross-org routing.
- **Files modified:** `supabase/migrations/20260919000004_phase38_copy_event_preservation.sql`
- **Verification:** Static scans found three hardened function blocks, three explicit revoke/grant pairs, and no unqualified Phase 38 relations in the copied bodies.
- **Committed in:** `eef7bb2a`

---

**Total deviations:** 1 auto-fixed missing security requirement.
**Impact on plan:** Authorization logic and intended callers remain unchanged; implicit execution privileges became explicit and the functions no longer depend on a mutable schema search path.

## Issues Encountered

- The checked-in migration tests intentionally use `it.fails` while implementation files are absent. After these migrations were added, four Plan-05 RED markers reported “Expect test to fail,” which is the expected signal that the existence, share bridge, and three-function event contracts now pass. Per parallel-file ownership, the shared test was not edited here. A temporary verification copy converted only those four Plan-05 markers and passed all 10 migration tests; the parent executor will convert the shared markers after merging Plans 04 and 05.
- The first temporary verification command allowed shell backtick substitution in a Perl expression. It printed two harmless `command not found: RED:` messages, still ran green, and left no file behind. The verification was immediately repeated with a safely quoted Python transformation and passed 10/10.

## Verification

- Baseline targeted migration suite before implementation: **10/10 passed** with all missing-feature contracts behaving as expected failures.
- Checked-in targeted suite after implementation: **4 intentional unexpected-pass marker failures**, exactly the Plan-05 file-existence, share-bridge, and event-copy contracts.
- Temporary marker-adjusted targeted suite: **10/10 passed**; temporary test removed after the run.
- Static share safety scan: no INSERT/DELETE of `call_share_links`, no token rewrite, legacy key retained, exact-one owner match present, dual-key constraint present.
- Static copy scan: three exact signatures, exactly three `v_source.event_id` values, no policy columns in executable SQL, three empty search paths, and three explicit revoke/grant pairs.
- Source diff against `20260730160000_fix_cross_org_copy_dedup.sql`: only header, event propagation, schema qualification/search-path hardening, and explicit grants changed.
- `git diff --exit-code HEAD -- package.json package-lock.json`: passed; no dependency or lockfile changes.
- No migration was applied to production or the dedicated test project in this plan.

## Known Stubs

None.

## User Setup Required

None - Plan 06 owns dedicated-test migration application and later production-safe rollout steps.

## Next Phase Readiness

- Plan 06 can apply all Phase 38 migrations to the dedicated test project in order, convert the shared RED markers, and run the real-database share/event compatibility matrices.
- Plans 07 and later can move share-call, MCP, frontend sharing, and generated types to the UUID-native v3 surface while keeping legacy tokens operational.

## Self-Check: PASSED

- Both migration files exist and are committed.
- Task commits `d9d6d853` and `eef7bb2a` exist in git history.
- No tracked or untracked implementation files remain outside the two migrations and this summary.

---
*Phase: 38-access-policy-share-link-key-migration-request-flow*
*Completed: 2026-09-19*
