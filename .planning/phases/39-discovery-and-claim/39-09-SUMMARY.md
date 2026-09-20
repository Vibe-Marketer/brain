---
phase: 39-discovery-and-claim
plan: "09"
subsystem: frontend-data-access
tags: [typescript, tanstack-query, supabase, privacy, cache-invalidation]

requires:
  - phase: 39-03
    provides: Proven additive discovery and claim database contracts
  - phase: 39-08
    provides: Dedicated TEST backend, generated types, and schema evidence
provides:
  - Strict privacy-safe Phase 39 domain contracts
  - Pure service parsing for discovery, invitations, claims, notifications, and alias disconnect
  - TanStack queries and mutations with complete settlement invalidation
  - TEST-proven request handles and owner-authorized reminder cancellation
affects: [39-10, 39-11, 39-12, discovery-ui, claim-ui]

tech-stack:
  added: []
  patterns: [exact-key unknown parsing, service-hook separation, mutation settlement invalidation]

key-files:
  created:
    - src/types/event-discovery.ts
    - src/services/event-discovery.service.ts
    - src/hooks/useEventDiscovery.ts
  modified:
    - src/lib/query-config.ts
    - src/services/__tests__/event-discovery.service.test.ts
    - src/hooks/__tests__/useEventDiscovery.test.ts
    - supabase/migrations/20260920000001_phase39_verified_email_discovery.sql
    - supabase/migrations/20260920000002_phase39_participation_claims.sql
    - supabase/functions/send-participation-claim/index.ts

key-decisions:
  - "Restricted-copy request targets remain opaque service-layer action handles and exist only while the server marks the action available."
  - "Reminder cancellation accepts only a participant ID; the Edge function derives invitation, owner, provider, and ledger state server-side."
  - "Every Phase 39 response is parsed from unknown with exact keys, bounded inputs, and no metadata escape hatch."
  - "Claim and disconnect settlement invalidates discovery, alias, notification, access-policy, and full call-list caches on both success and error."

patterns-established:
  - "Strict service boundary: Supabase snake_case payloads never cross directly into React."
  - "Server order authority: infinite-query pages preserve the returned order without hidden client reconstruction."
  - "Ephemeral bearer handling: claim tokens appear only in mutation request bodies, never query keys, logs, errors, or durable cache data."

requirements-completed: [DISCO-01, DISCO-02, DISCO-03]

duration: 26min
completed: 2026-09-20
---

# Phase 39 Plan 09: Strict Discovery Service and Hook Boundary Summary

**Privacy-safe discovery, invitation, claim, notification, and disconnect operations now cross one strict service layer and one cache-complete TanStack hook layer.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-09-20T08:29:58Z
- **Completed:** 2026-09-20T08:55:19Z
- **Tasks:** 3
- **Files modified:** 18 including plan evidence and tracking

## Accomplishments

- Defined exhaustive domain types that cannot represent restricted owner, provider, title, content, roster, source, or open metadata fields.
- Implemented pure async services that validate UUIDs, tokens, cursors, page limits, masked email, exact response keys, and authoritative server states.
- Added stable query families and TanStack hooks for discovery, invitation status, claims, notification sync, reminder cancellation, and verified-email disconnect.
- Proved every mutation's `onSettled` invalidation on success and error, including `invalidateCallListCaches(queryClient)` where authorization or call membership can change.
- Closed two blocking backend gaps on TEST: restricted-copy request action handles and current-owner reminder cancellation.

## Task Commits

Each task was committed atomically:

1. **Backend contract prerequisite: request handle and reminder cancellation** - `131e160b` (fix)
2. **Task 1: Define allowlisted Phase 39 domain contracts** - `306bf83e` (feat)
3. **Task 2: Implement strict discovery services** - `47749617` (feat)
4. **Task 3: Implement query keys, hooks, and invalidation** - `35fee4c6` (feat)
5. **Contract hardening discovered by TEST verification** - `f591ae31` (fix)

## Files Created/Modified

- `src/types/event-discovery.ts` - Exhaustive safe domain types for discovery, invitations, claims, notifications, and disconnect.
- `src/services/event-discovery.service.ts` - Pure Supabase/Edge boundary with strict unknown parsing and generic safe failures.
- `src/hooks/useEventDiscovery.ts` - TanStack queries and mutations with serialized claims and complete settlement invalidation.
- `src/lib/query-config.ts` - Stable Phase 39 query-key families without bearer tokens.
- `src/services/__tests__/event-discovery.service.test.ts` - Fail-closed parser, input-bound, privacy, and action-body coverage.
- `src/hooks/__tests__/useEventDiscovery.test.ts` - Success/error invalidation, serialization, no-token-cache, and sync-before-read coverage.
- `supabase/migrations/20260920000001_phase39_verified_email_discovery.sql` - Privacy-safe request action handle with null-safe availability logic.
- `supabase/migrations/20260920000002_phase39_participation_claims.sql` - Server-derived invitation eligibility/status plus service-only reminder cancellation support.
- `supabase/functions/send-participation-claim/index.ts` - Narrow authenticated current-owner cancellation action.
- `src/test/discovery-claim.integration.test.ts` - Raw-payload privacy and available/pending action-handle proof.
- `supabase/functions/send-participation-claim/__tests__/send-participation-claim.integration.test.ts` - Real owner authorization and cancellation proof.
- `.planning/phases/39-discovery-and-claim/39-TEST-SCHEMA-EVIDENCE.md` - Preproduction source correction, fingerprints, catalog, and production-resting evidence.

## Decisions Made

- A request action handle uses the already established Phase 38 recording request identifier. It is transported as an opaque internal value and never rendered.
- Invitation status, resend eligibility, and reminder cancellation state are computed by the server. The browser supplies no owner, email, recording, provider, or capability assertion.
- Count and paged discovery reads first invoke the idempotent caller-pulled notification sync, preserving silent activation without timers or import-pipeline coupling.
- Claim inspect and consume use serialized mutations. A raw claim token never becomes a query identity or cached result.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Contract] Added a request action handle for eligible restricted copies**
- **Found during:** Task 2 service implementation
- **Issue:** The TEST discovery projection exposed request state but no privacy-safe identifier that the existing Phase 38 request mutation could act on.
- **Fix:** Added an opaque `request_target` only for server-authorized available copies; pending/cooldown copies receive null and all private copy fields remain absent.
- **Files modified:** Phase 39 discovery migration, integration/privacy test, domain type, service tests.
- **Verification:** TEST replay, live catalog fingerprint, and discovery/privacy 14/14.
- **Committed in:** `131e160b`, hardened in `f591ae31`.

**2. [Rule 3 - Blocking Contract] Added owner-authorized reminder cancellation**
- **Found during:** Task 2 service implementation
- **Issue:** The planned cancellation hook had no authenticated server path; the existing cancellation RPC was intentionally service-only.
- **Fix:** Added a narrow `cancel_reminder` Edge action that authenticates the caller, derives every sensitive field server-side, verifies current recording ownership, cancels the provider reminder, and records the result through the service-only RPC.
- **Files modified:** `send-participation-claim` source/integration test and service/hook contracts.
- **Verification:** Deno check, deployed TEST version 8, Edge/database 19/19, access-policy 89/89, RLS 81/81.
- **Committed in:** `131e160b`.

**3. [Rule 2 - Missing Critical Functionality] Returned authoritative invitation eligibility and capabilities**
- **Found during:** Task 2 invitation-status parsing
- **Issue:** The status RPC could not represent eligible participants before an invitation existed or authorize resend/cancel controls without client reconstruction.
- **Fix:** Recreated the unshipped status function with server-derived eligibility, lifecycle, resend capability, and reminder cancellation state.
- **Files modified:** Phase 39 claims migration and generated Supabase function result type.
- **Verification:** Exact-key service tests, migration static tests, TEST catalog result signature, and Edge integration.
- **Committed in:** `131e160b`.

**4. [Rule 1 - Bug] Fixed SQL null semantics for first-time request handles**
- **Found during:** Final real TEST privacy gate
- **Issue:** `NOT (request_status = 'pending' OR ...)` evaluates to null when no prior request exists, producing a null handle while labelling the action available.
- **Fix:** Used `IS DISTINCT FROM 'pending'` and pinned the predicate in migration static coverage.
- **Files modified:** Discovery migration and real/static tests.
- **Verification:** Exact-source TEST replay and discovery/privacy 14/14.
- **Committed in:** `f591ae31`.

**5. [Rule 1 - Bug] Rejected unmasked claim emails at the service boundary**
- **Found during:** Final parser review
- **Issue:** The initial email shape validator accepted a syntactically valid full email even though inspect may expose only a masked address.
- **Fix:** Required an asterisk in the address local part and added a negative full-email test.
- **Files modified:** Discovery service and service tests.
- **Verification:** Focused service/hook/static run 34/34 and strict type-check.
- **Committed in:** `f591ae31`.

---

**Total deviations:** 5 auto-fixed (2 Rule 3, 1 Rule 2, 2 Rule 1).
**Impact on plan:** Each change was required to make the planned UI boundary actionable, authoritative, and privacy-safe. The production rollout allowlist remains exactly the three Phase 39 migrations and two Phase 39 functions; production was untouched.

## Issues Encountered

- The original Wave 0 test mock used a stale top-level page envelope while the proven TEST RPC returns an array of event rows. The service and test were aligned to the live contract without reconstructing order.
- One first-pass privacy assertion assumed a specific restricted copy was requestable. The stronger final test checks every restricted payload's exact keys and separately proves available and pending server branches.

## Verification

- `VITEST_INTEGRATION_OK=true npx vitest run src/test/discovery-claim.integration.test.ts --maxWorkers=1 --reporter=verbose` - 14/14 passed.
- Combined real TEST gate - `send-participation-claim` 19/19, Phase 38 access-policy 89/89, full RLS 81/81; discovery's initial 13/14 test expectation was corrected and rerun to 14/14.
- `npx vitest run src/test/migrations/phase39-discovery-claim-migrations.test.ts src/hooks/__tests__/useEventDiscovery.test.ts src/services/__tests__/event-discovery.service.test.ts --maxWorkers=1 --reporter=verbose` - 34/34 passed.
- `npm run type-check` - passed with zero new errors.
- `deno check supabase/functions/send-participation-claim/index.ts` - passed.
- TEST catalog - hardened search paths, reviewed result signatures, request-target predicate present, reminder-cancel RPC service-only.
- Production dry run - exactly migrations `20260920000001` through `20260920000003` pending; no production Phase 39 functions deployed.
- Source scan - no Phase 39 component/page bypass of the service-hook boundary.
- TEST fixture cleanup - zero residue after real-database suites.

## Known Stubs

None. Empty defaults and null checks in the modified files are input defaults or strict parser branches, not UI placeholders.

## Threat Flags

| Flag | File | Description |
|---|---|---|
| threat_flag: authenticated_action_extension | `supabase/functions/send-participation-claim/index.ts` | Existing authenticated endpoint gained a current-owner reminder-cancel action with server-derived authority and generic output. |
| threat_flag: restricted_action_handle | `supabase/migrations/20260920000001_phase39_verified_email_discovery.sql` | Restricted projection gained a non-rendered action handle only when the server marks request access available. |

## User Setup Required

None.

## Self-Check: PASSED

All created files exist, all five implementation commits are present, the Supabase CLI rests on production ref `vltmrnjsubfzrgrtdqey`, and `git diff --check` is clean.
