---
phase: 38-access-policy-share-link-key-migration-request-flow
plan: "11"
subsystem: access-lifecycle
tags: [supabase-edge-functions, resend, tanstack-query, privacy, notifications, integration-tests]

requires:
  - phase: 38-access-policy-share-link-key-migration-request-flow
    plan: "06"
    provides: Proven access lifecycle schema, RLS, RPCs, and generated types
  - phase: 38-access-policy-share-link-key-migration-request-flow
    plan: "09"
    provides: Stable access-policy query keys and optimistic cache conventions
provides:
  - Authenticated request-ID-only recording-access email boundary
  - Durable idempotent outbox delivery with retry-safe provider failure handling
  - Privacy-minimized discovery and owner-only management contracts
  - Pure lifecycle service and optimistic request, approve, deny, and revoke hooks
  - Dedicated-test deployment and complete real-database verification evidence
affects: [38-12, 38-13, recording-access-panel, other-recording-copies, notification-deep-links]

tech-stack:
  added: []
  patterns:
    - Persist lifecycle state before best-effort email dispatch
    - Separate requester-safe discovery types from owner-authorized management types
    - Use database outbox claims plus provider idempotency keys for retry safety

key-files:
  created:
    - supabase/functions/recording-access/index.ts
    - src/types/recording-access.ts
    - src/services/recording-access.service.ts
    - src/hooks/useRecordingAccess.ts
    - .planning/phases/38-access-policy-share-link-key-migration-request-flow/38-TEST-RECORDING-ACCESS-EVIDENCE.md
  modified:
    - supabase/config.toml
    - supabase/functions/recording-access/__tests__/recording-access.integration.test.ts

key-decisions:
  - "Email dispatch accepts only request_id; owner, recipient, meeting, requester, and evidence fields always come from trusted database state."
  - "A saved access request remains a UI success when email is pending or the provider is unavailable."
  - "Dedicated-test email modes are hostname-gated and never contact external recipients."

patterns-established:
  - "Outbox delivery atomically changes pending/failed work to processing and passes the durable key to Resend as Idempotency-Key."
  - "Lifecycle mutations optimistically change only the affected row, restore on failure, and invalidate management, discovery, notification, and required call-list caches."

requirements-completed: [ACCESS-02, ACCESS-03, ACCESS-04, ACCESS-05, ACCESS-09]

duration: 22min
completed: 2026-09-19
---

# Phase 38 Plan 11: Recording Access Boundary and Lifecycle Summary

**Request-ID-only email delivery with atomic outbox claims, role-minimized client contracts, and optimistic access lifecycle hooks proven against the dedicated test Supabase project**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-19T19:30:00Z
- **Completed:** 2026-09-19T19:52:01Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Added an authenticated Edge Function that rejects forged trusted fields, authorizes only the requester or recording owner, escapes dynamic email content, and sends one provider-idempotent owner review email.
- Kept request, notification, audit, and outbox rows durable when the provider fails, returning a non-rollback delivery-pending result to the browser.
- Added anonymous discovery contracts that cannot contain owner, provider, content, email, or evidence fields, alongside separate owner-only management contracts.
- Added pure RPC/function services and TanStack Query hooks for discovery, request, approve, deny, revoke, optimistic rollback, conflict refresh, notification refresh, and call-list invalidation.
- Deployed only to the dedicated test project and passed the complete serial integration suite with 236 tests passed and 15 existing live-deployment skips.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement authenticated idempotent access-request email delivery**
   - `69cd5cab` (test: activate failing live boundary contracts)
   - `1df021e9` (feat: implement trusted delivery and outbox claim)
2. **Task 2: Add privacy-minimized recording-access service and hooks**
   - `3a5ae173` (test: add failing client contracts)
   - `222f558c` (feat: implement types, service, hooks, and behavioral tests)
3. **Task 3: Deploy recording-access to dedicated test and prove email boundary**
   - `86bbd502` (test: dedicated deployment, safety config, and evidence)

## Files Created/Modified

- `supabase/functions/recording-access/index.ts` - Authenticated trusted-data load, atomic outbox claim, escaped review email, provider idempotency, and retryable failure persistence.
- `supabase/functions/recording-access/__tests__/recording-access.integration.test.ts` - Active real-function auth, forgery, escaping, one-send, and provider-failure contracts.
- `supabase/config.toml` - Function-level authentication configuration for current ES256 Supabase tokens.
- `src/types/recording-access.ts` - Separate anonymous discovery, owner request/evidence, grant, and mutation-result contracts.
- `src/services/recording-access.service.ts` - Pure event discovery, request, management, decision, revoke, and email-dispatch data boundary.
- `src/hooks/useRecordingAccess.ts` - Queries and optimistic lifecycle mutations with rollback and complete invalidation.
- `src/types/__tests__/recording-access.test.ts` - Privacy-minimized type and stable-key checks.
- `src/services/__tests__/recording-access.service.test.ts` - Safe mapping, persist-first delivery, and UUID guard tests.
- `src/hooks/__tests__/useRecordingAccess.test.ts` - Saved-request success, optimistic decision, rollback, conflict, and invalidation tests.
- `.planning/phases/38-access-policy-share-link-key-migration-request-flow/38-TEST-RECORDING-ACCESS-EVIDENCE.md` - Target, deployment, provider-mode, real-function, complete-suite, and production-isolation proof.

## Decisions Made

- The service treats Edge delivery failure as `emailDelivery: pending` after the request RPC succeeds. Email availability cannot undo committed lifecycle state.
- A stale processing claim may be recovered after five minutes. The provider receives the same durable idempotency key, so recovery does not duplicate a successful send.
- Test-provider success and failure modes are accepted only when the function's own `SUPABASE_URL` exactly matches the dedicated test hostname.
- Test deployment used an explicit `--project-ref swjzxiddcrtaqixsfaac` after the CLI account could list the test project but lacked permission to reveal its API keys during `supabase link`. The local CLI remained linked to production for the final read-only state check.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the trusted-snapshot escaping test**
- **Found during:** Task 3 focused real-function proof
- **Issue:** The test changed the participant row after the request RPC had already snapshotted the requester name, so it could not exercise escaping of the trusted request value.
- **Fix:** Update the service-role-only request snapshot before dispatch and assert the checked update succeeded.
- **Files modified:** `supabase/functions/recording-access/__tests__/recording-access.integration.test.ts`
- **Verification:** Live payload contains `&lt;script&gt;` and `&lt;img` with no raw tags; all six focused tests pass.
- **Committed in:** `86bbd502`

**2. [Rule 2 - Missing Critical] Registered function-level JWT handling**
- **Found during:** Task 3 deployment review
- **Issue:** The new function was not registered in `supabase/config.toml`; a future default deploy could re-enable the gateway check that rejects current ES256 user tokens before in-function authentication.
- **Fix:** Added `[functions.recording-access] verify_jwt = false`; `authenticateRequest` remains mandatory inside the function.
- **Files modified:** `supabase/config.toml`
- **Verification:** Dedicated-test function metadata reports `verify_jwt=false`; no-JWT and bad-JWT requests both return 401 from the function boundary.
- **Committed in:** `86bbd502`

**3. [Rule 3 - Blocking] Used explicit guarded test-ref deployment**
- **Found during:** Task 3 target setup
- **Issue:** `supabase link` could enumerate the dedicated test project but the current CLI authorization could not reveal that project's API keys.
- **Fix:** Used explicit `--project-ref swjzxiddcrtaqixsfaac` on secret and deploy commands, with a separate project-list identity check and a hard rejection of the production ref. The local link stayed on production.
- **Files modified:** Evidence only.
- **Verification:** Test function is active at version 3; production function inventory remained absent before and after; final link is `vltmrnjsubfzrgrtdqey`.
- **Committed in:** `86bbd502`

---

**Total deviations:** 3 auto-fixed (1 Rule 1, 1 Rule 2, 1 Rule 3).
**Impact on plan:** All fixes tightened proof or deployment safety. Production remained untouched and no package or lockfile changed.

## Issues Encountered

- Server-side function bundling temporarily rewrote `deno.lock` and `supabase/.temp/postgres-version`. Both generated changes were restored exactly before commit; the dependency guard is clean.
- The focused suite emits the repository's existing multiple-GoTrueClient warning because the synthetic role graph signs in several isolated users. It does not affect results.

## Verification

- Focused client contracts: 5 files, 20 tests passed.
- Type check: 0 new errors; 299/299 recorded baseline errors remain.
- Focused live recording-access function: 6/6 passed in success mode.
- Forced provider-failure proof: 1/1 passed with 202, retryable outbox, and durable request/notification/audit.
- Complete serial real-database gate: 236 passed, 15 skipped, exit 0.
- ESLint on all new frontend source/tests: 0 warnings and 0 errors.
- Static service scan: no React, TanStack Query, Sonner, or direct component concerns.
- Static hook scan: no direct Supabase table, RPC, or Edge Function calls.
- Dependency guard: `package.json`, `package-lock.json`, and `deno.lock` unchanged.
- Production isolation: `recording-access` absent before and after; CLI final ref is production.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 38-12 can render Settings and recording-owner management surfaces against the stable policy and lifecycle hooks.
- Plan 38-13 can render anonymous recording-copy discovery without receiving protected owner or content fields.
- The dedicated-test function is active in safe success mode. Production remains unchanged until the later approved additive deployment gate.

## Self-Check: PASSED

- All created implementation, test, evidence, and summary files exist.
- Task commits `69cd5cab`, `1df021e9`, `3a5ae173`, `222f558c`, and `86bbd502` exist.
- All task acceptance criteria and plan-level verification gates passed.
- No production function, migration, secret, frontend, or data was changed.

---
*Phase: 38-access-policy-share-link-key-migration-request-flow*
*Completed: 2026-09-19*
