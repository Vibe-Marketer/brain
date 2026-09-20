---
phase: 39-discovery-and-claim
plan: "06"
subsystem: database
tags: [postgres, supabase, rls, notifications, verified-email, idempotency]

requires:
  - phase: 39-04
    provides: Confirmed primary and active verified-alias discovery authorization
  - phase: 39-05
    provides: Atomic participation claim and verified-email attachment lifecycle
provides:
  - Silent first-activation baseline and exact-once future event notifications
  - Service-only forced-RLS user/event notification ledger retained across reconnect
  - Atomic caller-owned verified-email disconnect with immediate authorization revocation
  - Stale notification action removal without participant evidence mutation
affects: [39-09, 39-10, events, settings, notifications, identity-aliases]

tech-stack:
  added: []
  patterns:
    - Caller-pull notification synchronization backed by a retained user/event uniqueness ledger
    - Empty-search-path SECURITY DEFINER mutations deriving the caller from auth.uid()

key-files:
  created:
    - supabase/migrations/20260920000003_phase39_notification_disconnect.sql
  modified:
    - src/test/discovery-claim.integration.test.ts
    - src/test/migrations/phase39-discovery-claim-migrations.test.ts

key-decisions:
  - "A private null-event ledger marker records silent activation even when the caller has zero historical matches; non-null rows enforce exact-once user/event notification delivery."
  - "Disconnect deactivates only the selected active verified non-primary alias, retains ledger history, and deletes only event-discovery actions no longer authorized through any current confirmed email."
  - "Participant rows and identity ownership remain unchanged on disconnect; current confirmed-email evidence is re-read by every discovery, direct RLS, sync, and Phase 38 access check."

patterns-established:
  - "Silent baseline: first sync inserts the activation marker and all current matches without user_notifications rows."
  - "Reversible authorization: alias verification state controls access while immutable source evidence and exact-once history remain intact."

requirements-completed: [DISCO-01, DISCO-03]

duration: 18min
completed: 2026-09-20
---

# Phase 39 Plan 06: Exact-Once Notifications and Alias Disconnect Summary

**A private retained ledger now silently baselines historical matches, emits one generic in-app notice for each later user/event match, and supports atomic verified-email disconnect with immediate derived-access revocation.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-09-20T06:51:00Z
- **Completed:** 2026-09-20T07:09:03Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added a forced-RLS service-only discovery notification ledger with a silent activation marker and unique retained user/event rows.
- Added an idempotent authenticated caller-pull sync that creates zero historical notifications and exactly one generic notice for each later discoverable event.
- Added an authenticated alias disconnect transaction that rejects wrong-user and primary-email attempts, deactivates the selected verified alias, revokes alias-only direct/RPC access, and removes stale actions.
- Proved reconnect does not replay ledgered history, another active confirmed email preserves access, and participant source evidence remains byte-for-byte unchanged.
- Applied the exact migration only to dedicated TEST project `swjzxiddcrtaqixsfaac`; production lists all three Phase 39 migrations as pending.

## Task Commits

1. **Task 1 RED: notification lifecycle and privacy contracts** - `38f6416a`
2. **Task 1 GREEN: silent baseline and exact-once ledger** - `cfb3251d`
3. **Task 2 RED: atomic alias disconnect contracts** - `a8a65d4f`
4. **Task 2 GREEN: caller-scoped disconnect and revocation** - `075b2661`

## Files Created/Modified

- `supabase/migrations/20260920000003_phase39_notification_disconnect.sql` - Private notification ledger, caller-pull sync, and verified-email disconnect RPC.
- `src/test/discovery-claim.integration.test.ts` - Real TEST lifecycle coverage for baseline, exact-once notices, privacy, RLS, disconnect, primary guard, retained evidence, and reconnect.
- `src/test/migrations/phase39-discovery-claim-migrations.test.ts` - Activated the now-satisfied migration, ledger, legacy-RPC, and disconnect static contracts.

## Decisions Made

- A nullable `event_id` marker in the same private ledger records first activation. A partial unique user index makes an empty baseline concurrency-safe; `UNIQUE (user_id,event_id)` protects actual events.
- Notification metadata is exactly `kind`, `event_id`, and `action`; title and body are generic and include no email, event title, owner, provider, roster, recording, content, or count.
- Ledger entries survive disconnect and reconnect. Authorization derives from the active confirmed-email seam on every request, so replay protection never becomes an access grant.
- Disconnect returns a generic boolean and accepts only an alias row ID. Caller, ownership, verification state, and the confirmed primary email are derived and locked inside the transaction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - SQL type inference] Cast silent-baseline timestamps explicitly**
- **Found during:** Task 1 real TEST verification
- **Issue:** PostgreSQL inferred the baseline `NULL` projection as text and rejected insertion into `notified_at TIMESTAMPTZ`.
- **Fix:** Cast the projection to `NULL::TIMESTAMPTZ` and replaced the TEST function before rerunning the lifecycle proof.
- **Files modified:** `supabase/migrations/20260920000003_phase39_notification_disconnect.sql`
- **Verification:** Discovery suite passed 14/14 and exact final source was subsequently reapplied.
- **Committed in:** `cfb3251d`

**2. [Rule 1 - Expected-failure accuracy] Kept two still-unsatisfied cross-plan static markers**
- **Found during:** Task 1 static verification
- **Issue:** Two broad preexisting checks cover all three Phase 39 migrations and still intentionally detect Plan 05 participant enrichment plus an older SECURITY DEFINER configuration mismatch; promoting them would falsely claim those unrelated contracts were satisfied by Plan 06.
- **Fix:** Promoted only the Plan 06 filename, ledger, exact-once, and legacy-RPC contracts and retained the two accurate expected-failure markers.
- **Files modified:** `src/test/migrations/phase39-discovery-claim-migrations.test.ts`
- **Verification:** Static suite passed 9/9 with only the genuinely satisfied Plan 06 markers active.
- **Committed in:** `cfb3251d`

**3. [Rule 1 - Real-database test timeout] Gave the multi-step disconnect lifecycle a real integration timeout**
- **Found during:** Task 2 real TEST verification
- **Issue:** The complete wrong-user, primary-guard, disconnect, RLS, notification, evidence, and reconnect sequence exceeded Vitest's 5-second unit default despite completing correctly.
- **Fix:** Set a 30-second timeout on that single real-database lifecycle test.
- **Files modified:** `src/test/discovery-claim.integration.test.ts`
- **Verification:** The test passed in 2.6-4.3 seconds on repeat runs; the full discovery file passed 14/14.
- **Committed in:** `075b2661`

---

**Total deviations:** 3 auto-fixed (3 Rule 1 correctness fixes).
**Impact on plan:** The fixes made the planned SQL and evidence reliable without widening product scope or changing production.

## Issues Encountered

- Task 1's TDD verification applied the first half of migration `20260920000003` to TEST before Task 2 completed the same planned file. After both tasks, TEST migration history was marked reverted, the zero-row TEST-only ledger was removed, and the exact final source was applied once through `supabase db push`. Final local/remote migration history matches and source SHA-256 is `3c9913b5baf351f9c4d0e8e9d6b816751f15a19e33667012cc293e6d79457915`.
- The first combined Phase 38 access run used Vitest's 5-second default. Three boundary cases timed out, causing three later fixture collisions in that same run. The isolated access suite then passed 89/89 with the established 30-second real-database timeout; no application or migration change was needed.
- Supabase JS emitted its known multiple-GoTrueClient warning in multi-user fixtures. It did not affect assertions or checked cleanup.

## Verification

- Static Phase 39 migration contract: **9/9 passed**.
- Real TEST discovery, notification, and disconnect lifecycle: **14/14 passed**.
- Phase 38 access policy regression: **89/89 passed** with `--testTimeout=30000`.
- Global RLS regression: **81/81 passed** in the exact-final-source combined run.
- Total final green coverage across required suites: **193/193 checks**.
- TEST catalog: ledger has RLS and FORCE RLS; anon/authenticated table grants are **0**; both RPCs are SECURITY DEFINER with `search_path=""`; grants match their caller roles.
- Checked cleanup: **0** ledger rows and **0** `event_discovered` notifications remained after lifecycle runs; Phase 39 fixture cleanup also reported zero auth, organization, event, recording, participant, identity, alias, request, grant, and notification residue.
- Dedicated TEST ref was verified before every database mutation. CLI was relinked to production ref `vltmrnjsubfzrgrtdqey` afterward.
- Production migration history shows `20260920000001`, `20260920000002`, and `20260920000003` pending. No production database mutation, frontend deployment, `main` change, or push occurred.
- `git diff --check` passed and the implementation tree was clean before summary creation.

## Known Stubs

None.

## User Setup Required

None.

## Next Phase Readiness

- Services and hooks can invoke `sync_my_discovered_event_notifications()` during authenticated discovery and notification refreshes.
- Settings can call `disconnect_my_verified_email_alias(p_alias_id)` and invalidate discovery, alias, access, notification, and call caches after settlement.
- No Plan 06 blocker remains.

## Self-Check: PASSED

- All three changed implementation/test files exist.
- Commits `38f6416a`, `cfb3251d`, `a8a65d4f`, and `075b2661` resolve in Git history.
- Exact migration source is applied only to TEST and its catalog/security contracts were introspected live.
- Required static, discovery, Phase 38 access, and RLS suites passed with checked zero residue.
- Production is relinked, Phase 39 remains pending there, and `origin/main` equals local `main` at `cf63a53e`.

---
*Phase: 39-discovery-and-claim*
*Completed: 2026-09-20*
