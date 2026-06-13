---
phase: 17-activation-per-run-observability-go-live-hardening
plan: 04
subsystem: daemon
tags: [autopilot, approval-merge, repro-replay, watchdog, launchd]

requires:
  - phase: 17-01
    provides: runner run ledger rows
  - phase: 17-03
    provides: push-gate test-integrity failure stages
provides:
  - Approval rebase conflicts requeue before retry cap and escalate only at cap.
  - Repro replay runs on the rebased approval branch before push-gate and merge.
  - Worktree reaper, disk fail-closed guard, low Phase 17 run cap, and caffeinate launch handling.
affects: [phase-17, phase-19, autopilot-approval, autopilot-watchdog]

tech-stack:
  added: []
  patterns: [argv-only replay contracts, awaiting-approval guarded requeue, watchdog injectable guards]

key-files:
  created:
    - .planning/phases/17-activation-per-run-observability-go-live-hardening/17-04-SUMMARY.md
  modified:
    - ~/dev/autopilot/src/lib/approval.ts
    - ~/dev/autopilot/src/lib/approval.test.ts
    - ~/dev/autopilot/src/lib/claim.ts
    - ~/dev/autopilot/src/lib/evidence.ts
    - ~/dev/autopilot/src/lib/evidence.test.ts
    - ~/dev/autopilot/src/runner.ts
    - ~/dev/autopilot/src/watchdog.ts
    - ~/dev/autopilot/src/watchdog.test.ts
    - ~/dev/autopilot/autopilot.config.ts
    - ~/dev/autopilot/launchd/com.callvault.autopilot.plist

key-decisions:
  - "Reused tickets.attempts as the approval rebase retry counter to avoid schema churn."
  - "Set Phase 17 maxRunsPerWindow.maxRuns to 4/day and preserved concurrency: 1."
  - "Used the existing local kill-switch file for disk fail-closed behavior."

patterns-established:
  - "Approval replay is an explicit argv array with an allowlisted binary; untrusted prose is never passed to a shell."
  - "Approval conflict requeue guards status='awaiting_approval' so stale approval passes cannot clobber operator changes."
  - "Watchdog operational guards are injectable and tested separately from launchd/runtime wiring."

requirements-completed: [ACT-03, ACT-06, ACT-07]

duration: 8min
completed: 2026-06-13T16:47:44Z
---

# Phase 17 Plan 04 Summary

**Approval merge now rebases, replays, gates, and fails closed under low-volume sustained-operation guards**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-13T16:40:07Z
- **Completed:** 2026-06-13T16:47:44Z
- **Tasks:** 3/3
- **Files modified:** 10 in `~/dev/autopilot`, 1 summary in `~/dev/brain`

## Accomplishments

- Rebase conflicts no longer page on the first failure: held branch state is destroyed, the ticket is requeued behind an `awaiting_approval` guard, and only the configured cap escalates/pages.
- Approval merge now runs any replayable repro argv contract on the rebased branch before push-gate and ff-only merge; replay failures block merge and write evidence/run-ledger detail.
- Watchdog now has stale `autopilot-fix-*` cleanup, active-worktree preservation, low-disk fail-closed paging through the existing kill switch, Phase 17 cap of 4/day, and launchd `caffeinate` wrapping.

## Task Commits

1. **Task 1: Rebase conflict becomes retryable defer with capped escalation** - `4660ebb` (`fix(17-04): requeue approval rebase conflicts`)
2. **Task 2: Re-run repro replay on the rebased state before gate and merge** - `10b60e5` (`feat(17-04): replay repros before approval gate`)
3. **Task 3: Add worktree reaper, disk guard, low cap, and caffeinate handling** - `ddb1780` (`feat(17-04): add watchdog operational guards`)

## Verification

- `cd ~/dev/autopilot && bun test src/lib/approval.test.ts src/lib/claim.test.ts src/lib/evidence.test.ts src/watchdog.test.ts` → 55 pass, 0 fail.
- `cd ~/dev/autopilot && bun run typecheck` → `tsc --noEmit` passed.
- `cd ~/dev/autopilot && ! rg -n -e "force-push" -e "--force" -e "skip.*rebase" src/lib/approval.ts` → passed.
- `cd ~/dev/autopilot && node -e '...'` static config invariant → passed for `concurrency: 1` and `maxRunsPerWindow.maxRuns: 4`.
- `cd ~/dev/autopilot && plutil -lint launchd/com.callvault.autopilot.plist` → OK.

## Deviations from Plan

None - plan executed within the specified files and constraints. The only implementation choice was to reuse the existing `tickets.attempts` retry counter instead of adding schema.

## Issues Encountered

- Typecheck rejected additional `node:fs` APIs because this repo has `types: []`. The real watchdog filesystem wiring was adjusted to use Bun-spawned `find`, `stat`, and `rm` commands while keeping the tested logic injectable.
- Pre-existing dirty runtime files in `~/dev/autopilot` remain untouched and uncommitted: `qa/known-fingerprints.json`, `qa/runs.log`.
- Pre-existing untracked files in `~/dev/brain` remain untouched and uncommitted: `.mcp.json`, `.planning/debug/signup-email-confirmation-setup.md`, `.planning/phases/18-source-attribution/18-RESEARCH.md`.

## User Setup Required

None - no new packages, secrets, or manual service configuration.

## Next Phase Readiness

Plan 17-04 is ready for the controlled activation drill. `~/dev/autopilot` has no remote by design, so the daemon code is committed locally and was not pushed.

---
*Phase: 17-activation-per-run-observability-go-live-hardening*
*Completed: 2026-06-13T16:47:44Z*
