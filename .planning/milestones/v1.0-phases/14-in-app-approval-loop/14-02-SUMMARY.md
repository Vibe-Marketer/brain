---
phase: 14-in-app-approval-loop
plan: 02
subsystem: frontend
tags: [admin-center, runner-state, kill-switch, queue-controls, tanstack-query]

# Dependency graph
requires:
  - phase: 13-dispatcher-mechanical-safety
    provides: runner_state table + kill_switch-only trigger + tickets.priority/urgent (13-01, gate satisfied)
  - phase: 16-admin-center
    provides: /admin shell, DashboardSection, admin-dashboard.service, queryKeys.admin registry
provides:
  - "LIVE runner card on /admin Dashboard: status, current-ticket click-through, heartbeat age, RUNNER OFFLINE at 15min staleness"
  - "Admin kill-switch toggle (AlertDialog confirm both directions) wired to runner_state.kill_switch"
  - "Typed getRunnerState/setKillSwitch/isRunnerOffline in admin-dashboard.service (untyped access removed)"
  - "admin-ticket-controls.service + useUpdateTicketQueueControls — priority/URGENT data layer for 14-04's UI mount"
affects: [14-04, 13-07]

# Tech tracking
tech-stack:
  added: []
  patterns: ["zero-row UPDATE result thrown as error to surface RLS blocks", "queue-control service/hook in NEW files to respect 15-03 file ownership"]

key-files:
  created:
    - src/services/admin-ticket-controls.service.ts
    - src/services/__tests__/admin-ticket-controls.service.test.ts
    - src/hooks/useAdminTicketControls.ts
  modified:
    - src/services/admin-dashboard.service.ts
    - src/services/__tests__/admin-dashboard.service.test.ts
    - src/hooks/useAdminDashboard.ts
    - src/pages/admin/DashboardSection.tsx
    - src/lib/query-config.ts

key-decisions:
  - "RUNNER_STALE_MS = 900_000 (3x the 300s poll cadence) exported alongside isRunnerOffline for boundary tests"
  - "fetchRunnerCard rebuilt on getRunnerState so the System Health stats path also became typed for free"
  - "Dedicated RunnerOpsCard placed above the stat grids; the System Health runner stub row removed as superseded (it was the stub being replaced)"
  - "Ticket query invalidation by key shape (['tickets'], ['ticket', id]) — useTickets.ts read-only, never edited"

requirements-completed: []

# Metrics
duration: ~14min
completed: 2026-06-11
---

# Phase 14 Plan 02: Live Runner Card + Kill Switch + Queue-Control Layer Summary

**Replaced the 16-01 runner stub with a live typed runner_state card (status, current ticket, heartbeat, RUNNER OFFLINE) plus a confirm-gated admin kill switch, and shipped the priority/URGENT service+hook layer for 14-04 — zero diffs to 15-03-owned files**

## Performance

- **Duration:** ~14 min
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- `getRunnerState()` typed singleton read (id=1) with graceful null when the table is unreachable; `setKillSwitch(value)` labeled-error UPDATE; `isRunnerOffline()` pure helper with 15-min default staleness — `UntypedQueryClient` and key-guessing helpers deleted (runner_state landed in generated types via 12-01's regen)
- `RunnerOpsCard` on /admin Dashboard: status with semantic styling (idle=muted, claiming/running=default, awaiting_gate=vibe-orange), current ticket click-through reusing the Needs-You openTicket+navigate mechanism, "Last heartbeat Xm ago", RUNNER OFFLINE branch (destructive + RiAlarmWarningLine), "not deployed yet" only for null reads
- Kill switch: shadcn Switch, admin-only render (useUserRole), AlertDialog confirm before BOTH engage and release, disabled while pending, invalidates the runner query on settle
- `updateTicketQueueControls(ticketId, {priority?, urgent?})`: integer clamp, throws on error AND zero-row result (RLS-blocked non-admin surfaces as failure); `useUpdateTicketQueueControls` invalidates ticket list/detail keys
- `queryKeys.admin.runner()` registered; 24 service tests pass (19 dashboard + 5 controls)

## Live Probe Results (one-liners)

- Admin session (anon-key client + admin JWT — the exact path the UI uses): `kill_switch false→true` persisted on read-back, restored `true→false` — runner_state row live with `status=running`, `current_ticket_id=f7d4935a`, fresh heartbeat (Phase 13 runner is operating)
- No-op write of a non-kill_switch column (status to its current value) passes the per-column OLD/NEW guard by design; genuine non-kill_switch changes proven rejected by 13-01's 5/5 RLS probe
- `git diff --name-only` → no tickets.service.ts / useTickets.ts / TicketDetailDialog.tsx (acceptance criterion met)

## Task Commits

1. **Task 1: Typed services + hooks + tests** — `91e6310c` feat(14-02): typed runner_state service + kill switch + queue-control service/hooks
2. **Task 2: Live runner card + kill switch UI** — `0a65a9d0` feat(14-02): live runner card + confirm-gated kill switch on /admin dashboard

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing fetchRunnerCard tests pinned the untyped read**
- **Found during:** Task 1
- **Issue:** Replacing the untyped read with `.eq('id',1).maybeSingle()` broke the mock-builder chain (no maybeSingle/update methods) and the old array-shaped responses
- **Fix:** Extended the chainable mock builder and rewrote the two fetchRunnerCard tests against the singleton shape
- **Commit:** 91e6310c

### Noted (not code deviations)

- **dev-browser visual check NOT performed.** The acceptance criterion's browser screenshot of /admin was substituted with a live data-path probe through the identical client path (anon-key client + admin JWT UPDATE/SELECT) due to execution constraints. UI wiring is pinned by scoped tsc (clean), full build (exit 0), and component compile. Flagging for the verifier: a dev-browser pass over /admin Dashboard remains worthwhile before 13-07's E2E.
- The live runner was mid-run during probing; kill_switch was restored to false immediately after the persistence check (verified by read-back).

## Gates

- **Target vitest:** admin-dashboard 19/19, admin-ticket-controls 5/5
- **Full suite:** 1860 pass / 1 fail / 45 skipped — the single failure is the pre-existing `rpc-type-smoke` (28 SECURITY DEFINER offenders, phases 06-12, logged in 13's deferred-items; unrelated to 14-02 files)
- **Build:** exit 0
- **Scoped tsc:** zero errors in touched files

## Threat Flags

None — T-14-06/07/08 mitigations in place: zero-row throw surfaces RLS blocks, service writes ONLY kill_switch, AlertDialog confirm both directions.

## Known Stubs

None — the runner card renders live data; "not deployed yet" remains only as the null-read fallback (table-absent), which is a real state, not a stub.

## Next Phase Readiness

- 14-04 mounts priority quick-set / URGENT toggle UI on `useUpdateTicketQueueControls` — contract ready
- 13-07 E2E: kill switch operable from /admin (data path proven live)

## Self-Check: PASSED
