---
phase: 38-access-policy-share-link-key-migration-request-flow
plan: "07"
subsystem: api
tags: [supabase, edge-functions, mcp, sharing, uuid, compatibility]

requires:
  - phase: 38-06
    provides: Applied UUID share bridge, generated contracts, and dedicated test schema proof
provides:
  - UUID-native share-call create, resolve, revoke, and access-log authorization
  - UUID-native MCP create/list/revoke with isolated owner-scoped legacy fallback
  - Dedicated-test deployment and live compatibility evidence with production unchanged
affects: [38-08, frontend-sharing, mcp-server, share-call]

tech-stack:
  added: []
  patterns:
    - Canonical UUID writes with legacy-only owner-scoped provider fallback
    - Existing token rows and MCP markdown envelopes preserved across key migration

key-files:
  created:
    - .planning/phases/38-access-policy-share-link-key-migration-request-flow/38-TEST-SHARING-FUNCTION-EVIDENCE.md
  modified:
    - supabase/functions/share-call/index.ts
    - supabase/functions/share-call/__tests__/share-call.integration.test.ts
    - supabase/functions/mcp-server/tools/write/create_share_link.ts
    - supabase/functions/mcp-server/tools/read/list_shared_calls.ts
    - supabase/functions/mcp-server/tools/write/revoke_share_link.ts
    - supabase/functions/mcp-server/__tests__/sharing-uuid-bridge.test.ts

key-decisions:
  - "New share rows store only the canonical recording UUID; legacy provider IDs are read only for rows whose UUID key is null."
  - "Every legacy fallback matches both provider ID and share owner, and list resolution requires exactly one match."
  - "MCP sharing retains content[].text markdown and standardizes generated URLs on /s/<token>."

patterns-established:
  - "Share resolution: prefer call_share_links.recording_id; enter provider fallback only when recording_id is null and always scope by user_id."
  - "Deployment proof: two independent test-ref checks precede each --use-api deploy, followed by a read-only production relink."

requirements-completed: [ACCESS-07, ACCESS-08]

duration: 15min
completed: 2026-09-19
---

# Phase 38 Plan 07: UUID-First Sharing Compatibility Summary

**UUID-native share-call and MCP sharing for every recording provider, with unchanged legacy tokens and owner-scoped fallback proven on the dedicated test project**

## Performance

- **Duration:** 15 min
- **Started:** 2026-09-19T18:11:00Z
- **Completed:** 2026-09-19T18:26:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Replaced new share writes with canonical `recordings.id` UUIDs and removed numeric identity assumptions from `share-call`.
- Preserved anonymous teaser, recipient enforcement, authenticated content, revocation, signup-prefill, and access-log behavior for existing legacy token rows.
- Converted MCP create/list/revoke to UUID-native behavior while preserving markdown `content[].text` and the canonical `/s/<token>` URL.
- Deployed only `share-call` and the single `mcp-server` function to the dedicated test project, proved UUID and legacy paths, and relinked production without deploying there.

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert share-call to UUID-first reads and writes** - `aebf252f` (feat)
2. **Task 2: Convert MCP sharing without changing the MCP contract** - `b0cdd27a` (feat)
3. **Task 3: Deploy to dedicated test and prove compatibility** - `4e029f3f` (test/docs)

## Files Created/Modified

- `supabase/functions/share-call/index.ts` - Creates UUID-only share rows and resolves canonical or owner-scoped legacy recordings.
- `supabase/functions/share-call/__tests__/share-call.integration.test.ts` - Exercises deployed UUID create/resolve/list/revoke alongside the complete legacy response matrix.
- `supabase/functions/mcp-server/tools/write/create_share_link.ts` - Validates UUIDs, requires recording ownership, and emits `/s/` links.
- `supabase/functions/mcp-server/tools/read/list_shared_calls.ts` - Lists canonical UUID recordings with exact legacy fallback and org boundary enforcement.
- `supabase/functions/mcp-server/tools/write/revoke_share_link.ts` - Keeps owner-authorized revocation valid for either bridge state.
- `supabase/functions/mcp-server/__tests__/sharing-uuid-bridge.test.ts` - Promotes the UUID-only MCP contract to a normal passing test.
- `.planning/phases/38-access-policy-share-link-key-migration-request-flow/38-TEST-SHARING-FUNCTION-EVIDENCE.md` - Records target guards, deployments, live probes, test results, and production relink evidence.

## Decisions Made

- UUID presence is authoritative. A missing or stale UUID never falls through to a provider key; only a genuinely legacy row with `recording_id IS NULL` can use fallback.
- Share creation requires canonical ownership in addition to existing workspace/org access. This prevents an MCP credential from sharing another member's accessible recording.
- Legacy token content retains the prior Fathom payload shape, including its numeric recording ID, while UUID-native content returns the canonical UUID.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added explicit owner authorization to MCP share creation**
- **Found during:** Task 2
- **Issue:** The existing access helper proved workspace/org visibility but did not prove the MCP user owned the recording, leaving the spoofing threat in the plan unresolved.
- **Fix:** Required `recordings.owner_user_id = mcpToken.user_id` before inserting a share.
- **Files modified:** `supabase/functions/mcp-server/tools/write/create_share_link.ts`
- **Verification:** The real database UUID fixture passed and the query contains the explicit owner predicate.
- **Committed in:** `b0cdd27a`

**2. [Rule 2 - Missing Critical] Required exact-one-match legacy listing**
- **Found during:** Task 2
- **Issue:** A provider ID can repeat across owners and, in corrupted historical data, more than once for one owner. Selecting an arbitrary match would disclose the wrong recording.
- **Fix:** Scoped fallback by owner and accepted it only when the candidate count equals one.
- **Files modified:** `supabase/functions/mcp-server/tools/read/list_shared_calls.ts`
- **Verification:** The legacy bridge test passed and static inspection confirms UUID-null gating, owner matching, and a two-row ambiguity check.
- **Committed in:** `b0cdd27a`

**3. [Rule 3 - Blocking] Strengthened the UUID share test to exercise the deployed endpoint**
- **Found during:** Task 3
- **Issue:** The inherited RED test inserted and revoked the UUID row directly, so it could not prove the deployed POST/DELETE implementation.
- **Fix:** Changed the test to authenticate as the fixture owner and call the deployed create and revoke endpoints, while retaining direct database assertions for stored bridge shape.
- **Files modified:** `supabase/functions/share-call/__tests__/share-call.integration.test.ts`
- **Verification:** The deployed share-call matrix passed 10/10.
- **Committed in:** `4e029f3f`

---

**Total deviations:** 3 auto-fixed (2 missing security requirements, 1 blocking verification gap).
**Impact on plan:** All changes directly enforce the plan threat model or make its deployment proof real. No package, schema, production, or frontend change was added.

## Issues Encountered

- The complete serial integration command reached 207 passing tests but did not exit zero because unrelated files retain three worktree-only dependency resolution failures, six stale `public-recording` expected-failure markers, one shared-fixture cleanup race, and one five-second timeout. The focused deployed sharing suite passed 10/10 and the focused MCP/golden/category suite passed 31 with one unrelated skip. Details are in `38-TEST-SHARING-FUNCTION-EVIDENCE.md`.
- The installed Supabase CLI reported a newer version was available. The installed pinned environment was retained and no dependency or tool upgrade occurred.

## TDD Gate Compliance

- RED contracts already existed from Plan 38-03 as `it.fails` cases for UUID-only share-call and MCP behavior.
- GREEN implementation commits `aebf252f` and `b0cdd27a` followed those contracts.
- Commit `4e029f3f` promoted the contracts after the dedicated-test functions were deployed and the live behavior passed.

## Known Stubs

None.

## User Setup Required

None - no external configuration is required. Production functions were not deployed.

## Next Phase Readiness

- Plan 38-08 can move frontend sharing callers to the canonical UUID request shape.
- Dedicated test function versions and compatibility evidence are recorded; production remains on its pre-plan 2026-09-10 function versions.
- The repository-wide integration failures listed above remain outside this plan's sharing scope and should be reconciled by the phase orchestrator with their owning plans.

## Self-Check: PASSED

- All seven created/modified files exist.
- Task commits `aebf252f`, `b0cdd27a`, and `4e029f3f` exist in git history.
- Share-call Deno checking, MCP Deno checking, source acceptance scans, 10 deployed share-call cases, and 31 focused MCP/golden/category tests passed.
- The final local Supabase ref is production, and read-only metadata proves neither production function was redeployed during this plan.

---
*Phase: 38-access-policy-share-link-key-migration-request-flow*
*Completed: 2026-09-19*
