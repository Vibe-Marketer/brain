---
phase: 39-discovery-and-claim
plan: "05"
subsystem: database
tags: [postgres, supabase, rls, security-definer, invitations, atomic-claims]

requires:
  - phase: 39-02
    provides: guarded real-TEST Phase 39 fixture and deployment seam
  - phase: 39-04
    provides: verified-email discovery and current-caller authorization helpers
provides:
  - service-only forced-RLS participation invitation ledger
  - owner-derived create, resend, status, and reminder cancellation RPCs
  - authenticated non-consuming claim inspection
  - atomic single-use email attachment and email-wide participant claim
affects: [39-06, 39-07, 39-10, 39-11, discovery, claim, invitation-email]

tech-stack:
  added: []
  patterns: [digest-only bearer tokens, row-locked consume, advisory email ownership lock, generic denial]

key-files:
  created:
    - supabase/migrations/20260920000002_phase39_participation_claims.sql
  modified:
    - supabase/functions/send-participation-claim/__tests__/send-participation-claim.integration.test.ts
    - supabase/functions/participation-claim/__tests__/participation-claim.integration.test.ts
    - src/test/migrations/phase39-discovery-claim-migrations.test.ts

key-decisions:
  - "Invitation rows store only a fixed-format SHA-256 digest and remain inaccessible to browser roles."
  - "Inspection is authenticated and read-only; every unavailable, terminal, expired, conflict, and replay path has one generic database result."
  - "Consume locks the invitation plus advisory-locks the email and caller before attaching verified evidence, so parallel or cross-account claims have one winner."
  - "Participant identity enrichment updates only confirmed null-linked rows; a conflicting nonnull identity is never overwritten and never becomes an authorization dependency."

patterns-established:
  - "Private claim ledger: FORCE RLS, no anon/authenticated table grants, explicit service policy and grants."
  - "Caller-derived claim RPC: auth.uid(), canonical participant evidence, empty search path, qualified objects, minimized return projection."

requirements-completed: [DISCO-02, DISCO-03]

duration: 19min
completed: 2026-09-20
---

# Phase 39 Plan 05: Participation Claim Database Lifecycle Summary

**Service-only seven-day invitation digests with non-consuming inspection and a row-locked, single-use claim transaction that attaches verified email evidence without granting recording content**

## Performance

- **Duration:** 19 min
- **Started:** 2026-09-20T06:29:18Z
- **Completed:** 2026-09-20T06:48:12Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added a forced-RLS invitation ledger with canonical participant, recording owner, normalized recipient, digest, expiry, terminal, delivery, and reminder audit state.
- Added owner-only create/rotate/status RPCs that serialize concurrent sends, reject weak or claimed participants, and permit a fresh digest only after the seven-day threshold.
- Added authenticated inspection that returns only availability, a masked email, and whether explicit confirmation is required, without changing invitation, identity, alias, participant, notification, or reminder state.
- Added atomic consume that prevents primary/alias conflicts, requires explicit confirmation for a different primary, creates or reuses the caller identity, verifies the invited email, links every current null-linked confirmed match, and supersedes live siblings.
- Preserved Phase 38 content denial after a successful claim and proved one winner under parallel consume.
- Applied migration `20260920000002` only to dedicated TEST project `swjzxiddcrtaqixsfaac`; production remained pending and no Edge or frontend deployment occurred.

## Task Commits

1. **Task 1 RED: invitation lifecycle contracts** - `0650fd30`, `a15c7a70`
2. **Task 1 GREEN: service-only invitation state and owner RPCs** - `7073c0a4`
3. **Task 2 RED: inspect, confirmation, race, replay, and privacy contracts** - `8be318fc`
4. **Task 2 GREEN: non-consuming inspect and atomic consume** - `dd2fbb5b`

_TDD tasks use separate test and feature commits. The first Task 1 test commit was immediately corrected by `a15c7a70` to preserve the already-planned Edge RED contracts while adding the database tests._

## Files Created/Modified

- `supabase/migrations/20260920000002_phase39_participation_claims.sql` - Private invitation table and five hardened lifecycle RPCs.
- `supabase/functions/send-participation-claim/__tests__/send-participation-claim.integration.test.ts` - Preserved future Edge contracts plus real-TEST database owner, race, RLS, reminder, and resend checks.
- `supabase/functions/participation-claim/__tests__/participation-claim.integration.test.ts` - Preserved future Edge contracts plus direct real-TEST inspect, confirmation, consume, replay, and content-neutrality checks.
- `src/test/migrations/phase39-discovery-claim-migrations.test.ts` - Activated the satisfied digest-only and row-lock migration contract and allowed replay-safe `CREATE TABLE IF NOT EXISTS`.

## Decisions Made

- The invitation table uses `sent` as its sole live state and a partial unique index on `participant_id`; a row lock on the canonical participant serializes concurrent initial sends.
- Manual resend keeps the first token unchanged until seven days have elapsed, then supersedes it and inserts a fresh digest with a fresh seven-day expiry.
- A caller whose confirmed primary or owned verified alias already matches the invitation can consume directly. A conflict-free different-primary caller must send explicit confirmation; declining leaves the token active.
- Confirmed email ownership is locked by normalized email before alias creation. Another confirmed primary or another identity owner receives the same generic failure as every unavailable token.
- The database records reminder cancellation intent and returns provider metadata. The subsequent Edge plan performs the external provider cancellation and records its result without reopening claim state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test preservation] Restored the preplanned Edge RED coverage after adding database contracts**
- **Found during:** Task 1 RED commit review
- **Issue:** The first test edit replaced the existing future Edge contract block instead of extending it.
- **Fix:** Restored every original Edge contract and appended the new real-database RPC tests in the same planned file.
- **Files modified:** `supabase/functions/send-participation-claim/__tests__/send-participation-claim.integration.test.ts`
- **Verification:** The file now runs 18/18 checks while retaining expected-failure markers assigned to Plan 07.
- **Committed in:** `a15c7a70`

**2. [Rule 1 - Schema compatibility] Made the denormalized event snapshot optional**
- **Found during:** Task 2 RED
- **Issue:** The initial table required `event_id`, although the approved service-only fixture and plan require only recording/participant/inviter foreign keys and derive events through the canonical participant.
- **Fix:** Relaxed the additive snapshot column to nullable and made the migration replay-safe for TEST source synchronization.
- **Files modified:** `supabase/migrations/20260920000002_phase39_participation_claims.sql`
- **Verification:** Direct service seeds, exact migration replay, and 16/16 claim tests pass.
- **Committed in:** `dd2fbb5b`

**3. [Rule 1 - Confirmation guard] Closed SQL NULL three-valued logic in different-primary confirmation**
- **Found during:** Task 2 GREEN verification
- **Issue:** A missing existing alias left `v_alias_owner = v_caller` as NULL, which bypassed the intended explicit-confirmation branch.
- **Fix:** Coalesced the ownership predicate to FALSE before testing confirmation.
- **Files modified:** `supabase/migrations/20260920000002_phase39_participation_claims.sql`
- **Verification:** A declined different-primary consume remains `sent`; the confirmed retry claims all eligible null-linked matches.
- **Committed in:** `dd2fbb5b`

---

**Total deviations:** 3 auto-fixed (3 Rule 1 bugs).
**Impact on plan:** All fixes preserve the approved architecture and make the schema, tests, and confirmation boundary match the planned contract. No product scope widened.

## Issues Encountered

- The migration was first recorded on TEST after Task 1. Task 2 then added the planned functions to the same migration file, so the final replay-safe source was executed in full through `supabase db query --linked --file`. TEST now matches the final source (`sha256:4a21b67fdee3077c7d77ab95f96232c0f226d5c9491876dfc094e3da6fb58672`), while production still lists both Phase 39 migrations as pending.
- The first combined access run passed 118/119 checks; one established Phase 38 test finished just beyond its 5-second default timeout. The exact test passed on immediate isolated retry, then the full access file passed 89/89 with a 30-second real-database timeout. No code change was made for this timing-only issue.
- Supabase JS emitted its known multiple-GoTrueClient warning while building multi-user fixtures. It did not affect assertions or cleanup.

## Verification

- Static migration security: **8/8 passed**.
- Invitation owner/lifecycle file: **18/18 passed**.
- Claim inspect/consume file: **16/16 passed**.
- Discovery regression: **14/14 passed** in the combined run.
- Phase 38 access regression: **89/89 passed** with a 30-second integration timeout; the lone earlier timeout also passed on isolated retry under its original timeout.
- TEST catalog: table has RLS and FORCE RLS; browser table grants are **0**; all five RPCs are SECURITY DEFINER with `search_path=""`; authenticated/service grants match their intended boundary.
- TEST residue: **0 invitations**, **0 Phase 39 claim fixture auth users**, and **0 orphan participation-claim aliases**.
- TEST migration history records `20260920000002`; final source replay completed successfully on exact TEST ref `swjzxiddcrtaqixsfaac`.
- Local CLI relinked to production ref `vltmrnjsubfzrgrtdqey`; production dry-run still lists `20260920000001` and `20260920000002` as pending.
- `git diff --check` passed. No production migration, Edge deployment, frontend deployment, `main` change, or push occurred.

## Known Stubs

None in the database lifecycle. Expected-failure markers for the two not-yet-created Edge Function HTTP boundaries remain assigned to Plan 07.

## User Setup Required

None.

## Next Phase Readiness

- Plan 06 can add notification/disconnect behavior on the verified alias seam.
- Plan 07 can implement the send and claim Edge Functions against the five live TEST RPCs and activate the preserved HTTP contracts.
- No blocker remains.

## Self-Check: PASSED

- All four plan-owned files exist.
- Task commits `0650fd30`, `a15c7a70`, `7073c0a4`, `8be318fc`, and `dd2fbb5b` resolve in Git history.
- Acceptance criteria for owner derivation, client denial, seven-day rotation, non-consuming inspection, explicit confirmation, generic failure, one-winner consume, email-wide linking, and Phase 38 content denial passed on real TEST.
- The final migration source is present only on TEST; production remains pending and the workspace was clean before summary creation.

---
*Phase: 39-discovery-and-claim*
*Completed: 2026-09-20*
