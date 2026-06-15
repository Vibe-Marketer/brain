---
phase: 23-reporter-comms-in-app
plan: 04
subsystem: daemon
tags: [autopilot, reporter-comms, user-notifications, verified-deploy, bun, supabase]

requires:
  - phase: 23-reporter-comms-in-app
    provides: Default-deny reporter summary filter mirrored in autopilot
  - phase: 18-source-attribution
    provides: in_app_user ticket source gate
provides:
  - Autopilot helper that posts verified resolution summaries only to in-app reporters
  - Approval-path hook gated on deploy.verified instead of tickets.status
  - Source/null matrix coverage for reporter comm fail-closed behavior
affects: [phase-23, reporter-comms, autopilot-approval, user_notifications]

tech-stack:
  added: []
  patterns: [DbLike service-role writer, default-deny summary sanitizer, verified-deploy side-effect hook]

key-files:
  created:
    - /Users/admin/dev/autopilot/src/lib/reporter-comms.ts
    - /Users/admin/dev/autopilot/src/lib/reporter-comms.test.ts
  modified:
    - /Users/admin/dev/autopilot/src/lib/approval.ts
    - /Users/admin/dev/autopilot/src/lib/approval.test.ts

key-decisions:
  - "Reporter resolution summaries are emitted only after deploy.verified is true; tickets.status alone is never a customer trigger."
  - "Customer body is always sanitizeReporterSummary(rawSummary).text, with FALLBACK_COPY and metadata.summary_redacted=true on rejection."
  - "Autopilot keeps its own reporter-comms helper and imports no Brain code."

patterns-established:
  - "Verified deploy hooks wrap customer notification failures with console.error and do not abort the approval path."
  - "Every reporter comm path tests manual, sentry, nightly_qa, internal, unknown, null source, and null reporter fail-closed cases."

requirements-completed: [RSP-02]

duration: 4min
completed: 2026-06-15
---

# Phase 23 Plan 04 Summary

**Verified-stable deploys now create sanitized in-app reporter resolution summaries, gated on `source='in_app_user'` and never on ticket status alone.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-06-15T04:57:21Z
- **Completed:** 2026-06-15T05:01:17Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added `/Users/admin/dev/autopilot/src/lib/reporter-comms.ts` with `notifyReporterResolvedIfInAppUser` and `buildRawResolutionSummary`.
- Wired `approval.ts` to notify reporters only inside the `if (deploy.verified)` branch.
- Preserved the internal `writeAgentMessage` deploy evidence path unchanged and kept notification failures non-blocking.
- Covered unsafe summary fallback plus the full D-00 source/null fail-closed matrix.

## Task Commits

1. **Task 1 RED: reporter resolution comms tests** - `f279df8` (test)
2. **Task 1 GREEN: reporter comms helper** - `1dfb665` (feat)
3. **Task 2: verified deploy approval hook** - `7d0926b` (feat)
4. **Invariant hardening: source/null matrix** - `d0bf928` (test)
5. **Typecheck cleanup** - `d128bd9` (test)

## Files Created/Modified

- `/Users/admin/dev/autopilot/src/lib/reporter-comms.ts` - Fetches tickets, gates on `in_app_user` + string reporter, sanitizes body, inserts one `user_notifications` row.
- `/Users/admin/dev/autopilot/src/lib/reporter-comms.test.ts` - Tests in-app insert, fallback redaction, source/null fail-closed behavior, and customer-safe raw summary generation.
- `/Users/admin/dev/autopilot/src/lib/approval.ts` - Calls reporter comms only after `verifyDeploySha(...).verified === true`.
- `/Users/admin/dev/autopilot/src/lib/approval.test.ts` - Tests no notify on unverified deploy, verified in-app notification insert, and verified non-in-app silence.

## Decisions Made

- Kept `buildRawResolutionSummary` deliberately generic and customer-safe; it does not include merged SHA, paths, branch names, or tool/agent terms.
- Used the existing autopilot `DbLike` pattern and service-role DB write path; no packages, vendors, tables, migrations, or cross-repo imports were added.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Strengthened D-00 matrix coverage**
- **Found during:** Final invariant review
- **Issue:** The initial tests covered non-in-app sources and null reporter, but did not include null source on both helper and approval paths.
- **Fix:** Added null source coverage and approval-hook non-in-app/null fail-closed coverage.
- **Files modified:** `/Users/admin/dev/autopilot/src/lib/reporter-comms.test.ts`, `/Users/admin/dev/autopilot/src/lib/approval.test.ts`
- **Verification:** `npm test -- src/lib/reporter-comms.test.ts src/lib/approval.test.ts`
- **Committed in:** `d0bf928`

**2. [Rule 3 - Blocking] Fixed Bun matcher typing for typecheck**
- **Found during:** Plan-level `npm run typecheck`
- **Issue:** Bun's matcher type in this repo does not expose `toMatch`.
- **Fix:** Replaced the assertion with `RegExp.test(...).toBe(false)`.
- **Files modified:** `/Users/admin/dev/autopilot/src/lib/reporter-comms.test.ts`
- **Verification:** `npm run typecheck`
- **Committed in:** `d128bd9`

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both changes tightened verification only; runtime scope stayed exactly within the plan.

## Issues Encountered

- `npm run typecheck` initially failed on a test matcher type; fixed in `d128bd9`.
- Autopilot worktree had pre-existing dirty files `qa/known-fingerprints.json` and `qa/runs.log`; they were not staged.

## User Setup Required

None - no external service configuration required.

## Verification

- `cd /Users/admin/dev/autopilot && npm test -- src/lib/reporter-comms.test.ts` - PASS, 4 tests.
- `cd /Users/admin/dev/autopilot && npm test -- src/lib/approval.test.ts` - PASS, 28 tests.
- `cd /Users/admin/dev/autopilot && npm test -- src/lib/reporter-comms.test.ts src/lib/approval.test.ts` - PASS, 33 tests.
- `cd /Users/admin/dev/autopilot && npm run typecheck` - PASS.
- `rg` confirmed the `if (deploy.verified)` guarded call in `approval.ts` and `source === "in_app_user"` gate in `reporter-comms.ts`.

## Next Phase Readiness

Plan 05 can mount the NotificationBell UI knowing reporter resolution summaries now arrive through `user_notifications` only after verified production deployment and only for in-app reporters.

---
*Phase: 23-reporter-comms-in-app*
*Completed: 2026-06-15*
