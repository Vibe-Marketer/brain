---
phase: 39-discovery-and-claim
plan: "07"
subsystem: api
tags: [supabase-edge, resend, authentication, bearer-token, privacy, atomic-claim]

requires:
  - phase: 39-05
    provides: Private invitation ledger plus owner, inspect, consume, and reminder lifecycle RPCs
  - phase: 39-06
    provides: Exact-once discovery notification and verified-email authorization lifecycle
provides:
  - Owner-authenticated invitation send and seven-day resend boundary
  - Privacy-safe initial and one-time reminder email rendering
  - Authenticated non-consuming claim inspection
  - Atomic single-use claim consumption with reminder cancellation audit
affects: [39-10, 39-11, 39-12, invitation-ui, claim-ui, authentication-return]

tech-stack:
  added: []
  patterns: [ephemeral raw token with SHA-256 digest storage, strict Zod Edge boundary, Resend idempotency keys, generic public denial]

key-files:
  created:
    - supabase/functions/_shared/participation-claim-email.ts
    - supabase/functions/send-participation-claim/index.ts
    - supabase/functions/participation-claim/index.ts
  modified:
    - supabase/config.toml
    - supabase/functions/send-participation-claim/__tests__/send-participation-claim.integration.test.ts
    - supabase/functions/participation-claim/__tests__/participation-claim.integration.test.ts

key-decisions:
  - "The raw 32-byte claim token exists only in the send request while composing provider payloads; durable state contains only its SHA-256 digest."
  - "Concurrent duplicate sends serialize to one invitation and one provider delivery; the duplicate receives the committed current state or a safe resend conflict."
  - "Claim inspection is authenticated and read-only, while consumption crosses exactly one atomic database RPC before any reminder cancellation is attempted."
  - "Reminder cancellation outcome is audited after consume and can never reopen or roll back a committed claim."

patterns-established:
  - "Privacy-safe Edge response: valid inspect returns only masked email and confirmation requirement; all terminal claim states share one unavailable response."
  - "Provider lifecycle: per-invitation idempotency keys, one scheduled day-six reminder, and cancellation outcome persisted independently of claim state."

requirements-completed: [DISCO-02, DISCO-03]

duration: 17min
completed: 2026-09-20
---

# Phase 39 Plan 07: Participation Claim Edge Boundaries Summary

**Authenticated owner-only invitation delivery now issues digest-only seven-day claim links, while authenticated inspection and atomic consumption preserve privacy, single use, and reminder cancellation safety.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-09-20T07:13:14Z
- **Completed:** 2026-09-20T07:30:20Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added an owner-authenticated send boundary that accepts only a canonical participant ID and optional reminder flag, deriving owner, recording, recipient, eligibility, and lifecycle state server-side.
- Added a privacy-safe email renderer with the approved subject, heading, body, CTA, and expiry note; no event, recording, owner, provider, roster, transcript, summary, URL, or count metadata is disclosed.
- Added 32-byte Web Crypto tokens, SHA-256 digest-only persistence, Resend idempotency keys, exactly one optional reminder scheduled before expiry, and audited cancellation on resend.
- Added authenticated read-only inspection and explicit atomic consumption with intended-account and confirmed different-primary paths, generic terminal failures, one-winner concurrency, and no recording-content grant.
- Deployed both functions only to dedicated TEST project `swjzxiddcrtaqixsfaac`; production, `main`, and the frontend were not changed.

## Task Commits

1. **Task 1 RED: activate invitation Edge contracts** - `726634af`
2. **Task 1 GREEN: secure send, resend, and reminder delivery** - `f67e990b`
3. **Task 2 RED: activate inspect and consume Edge contracts** - `a330f1ea`
4. **Task 2 GREEN: authenticated inspect, atomic consume, and cancellation** - `cf048867`
5. **Task 1 test correction: concurrent reminder result** - `1765618c`
6. **Task 1 race correction: wait for winning transaction** - `18fb806f`

## Files Created/Modified

- `supabase/functions/_shared/participation-claim-email.ts` - Escaped privacy-safe initial and reminder email rendering.
- `supabase/functions/send-participation-claim/index.ts` - Authenticated owner send/resend, token generation, provider delivery, and optional reminder scheduling.
- `supabase/functions/participation-claim/index.ts` - Authenticated inspect/consume boundary and post-commit reminder cancellation.
- `supabase/functions/send-participation-claim/__tests__/send-participation-claim.integration.test.ts` - Active real-TEST authorization, lifecycle, race, reminder, resend, and ledger-denial coverage.
- `supabase/functions/participation-claim/__tests__/participation-claim.integration.test.ts` - Active real-TEST inspect, confirmation, consume, replay, privacy, cancellation, and content-denial coverage.
- `supabase/config.toml` - Function-level JWT verification declarations for both new authenticated functions.

## Decisions Made

- A failed initial provider delivery remains retryable without storing the raw token: the owner retry revokes the failed active row and creates a fresh digest/token pair.
- A day-seven resend rotates the digest and cancels any prior scheduled reminder. The old invitation remains auditable as superseded.
- Provider cancellation runs only after the database claim commits. Provider failure records `PROVIDER_CANCEL_FAILED`; it never changes the claimed terminal state.
- TEST uses an explicit project secret to simulate provider success/failure while exercising real deployed Edge code and real TEST Postgres RPCs without sending fixture emails.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test isolation] Reset invitation rows before every send lifecycle case**
- **Found during:** Task 1 GREEN
- **Issue:** The prewritten Edge cases shared invitation rows, so successful earlier cases contaminated later resend and reminder assertions.
- **Fix:** Added per-case invitation cleanup using only the fixture participant IDs.
- **Files modified:** `supabase/functions/send-participation-claim/__tests__/send-participation-claim.integration.test.ts`
- **Verification:** Exact send suite passes 18/18 with zero fixture residue.
- **Committed in:** `f67e990b`

**2. [Rule 1 - Client-deny assertion] Matched forced-RLS table denial behavior**
- **Found during:** Tasks 1 and 2 GREEN
- **Issue:** Tests expected an empty successful SELECT, but the table intentionally revokes authenticated SELECT and returns permission denied.
- **Fix:** Asserted the stronger permission error and null data contract.
- **Files modified:** Both plan integration test files.
- **Verification:** Both browser table-denial cases pass against TEST.
- **Committed in:** `f67e990b`, `a330f1ea`

**3. [Rule 1 - Fixture field mapping] Mapped snake-case database fields into the typed detached-participant fixture**
- **Found during:** Task 2 GREEN
- **Issue:** A direct cast left `recordingId` and `eventId` undefined even though the database returned `recording_id` and `event_id`.
- **Fix:** Added an explicit row mapping before discovery assertions.
- **Files modified:** `supabase/functions/participation-claim/__tests__/participation-claim.integration.test.ts`
- **Verification:** Different-primary claim discovers both eligible events and preserves the conflicting identity link.
- **Committed in:** `cf048867`

**4. [Rule 1 - Concurrent response timing] Allowed both valid serialized duplicate outcomes**
- **Found during:** Task 1 overall verification
- **Issue:** Depending on transaction timing, the duplicate observes either the winner's committed response or the resend conflict; the original assertion required only one timing.
- **Fix:** Required one success, only safe duplicate statuses, one active invitation, and one reminder provider ID.
- **Files modified:** `supabase/functions/send-participation-claim/__tests__/send-participation-claim.integration.test.ts`
- **Verification:** Focused race/reminder cases and exact 18-test suite pass.
- **Committed in:** `1765618c`

**5. [Rule 1 - Transaction visibility race] Waited briefly for the winning invitation transaction**
- **Found during:** Task 1 final exact suite
- **Issue:** A losing concurrent RPC could query before the winning transaction became visible and return a spurious denial.
- **Fix:** Added a bounded five-attempt lookup before shaping the duplicate response.
- **Files modified:** `supabase/functions/send-participation-claim/index.ts`
- **Verification:** Exact send suite passes 18/18 including concurrent duplicate delivery.
- **Committed in:** `18fb806f`

---

**Total deviations:** 5 auto-fixed (5 Rule 1 correctness fixes).
**Impact on plan:** All fixes make the planned security and concurrency contracts deterministic without widening product scope.

## Issues Encountered

- Deno check refreshed unrelated package-workspace entries in `deno.lock`; the generated drift was removed after each check because this plan adds no dependency.
- Supabase JS reports its known multiple-GoTrueClient warning while creating multi-user TEST fixtures. Assertions and cleanup are unaffected.

## Verification

- Send Edge integration suite: **18/18 passed** against real TEST.
- Claim Edge integration suite: **17/17 passed** against real TEST.
- Forced provider-cancellation failure: focused claim test passed; invitation remained `claimed` and recorded cancellation failure.
- `deno check` passed for both new function entrypoints.
- TEST functions are ACTIVE with gateway JWT verification disabled and `authenticateRequest` enforced in code: send v6, claim v3 at final verification.
- Static scans passed: package and lockfiles unchanged; no token persistence patterns; no sensitive log calls; email copy contains no private metadata terms.
- Fixture cleanup assertions passed with zero Phase 39 users, organizations, events, recordings, participants, identities, aliases, requests, grants, or notifications; invitation rows were removed explicitly.
- No production migration, production Edge deployment, frontend deployment, `main` change, package install, or push occurred.

## Known Stubs

None.

## User Setup Required

None.

## Next Phase Readiness

- Plans 10–12 can wire participant invitation controls and claim UI to the now-proven Edge contracts.
- Production deployment remains intentionally deferred to its approved rollout plan.
- No blocker remains.

## Self-Check: PASSED

- All six plan-owned implementation/config artifacts exist.
- All six task/test/fix commits resolve in Git history.
- Both exact real-TEST suites pass and their cleanup assertions leave no fixture residue.

---
*Phase: 39-discovery-and-claim*
*Completed: 2026-09-20*
