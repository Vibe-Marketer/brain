---
phase: 23-reporter-comms-in-app
plan: 05
subsystem: ui
tags: [react, notifications, reporter-comms, shadcn, remix-icons]

requires:
  - phase: 23-01
    provides: in_app_user source attribution and typed ticket-source surface
  - phase: 23-02
    provides: reporter lifecycle notifications in user_notifications
  - phase: 23-04
    provides: verified-stable reporter resolution notifications
provides:
  - NotificationBell popover consumer for user_notifications
  - SidebarNav bottom-utility mount next to SupportPopover
  - Source-gated reporter ticket action visibility
affects: [reporter-comms, sidebar-nav, notification-ui]

tech-stack:
  added: []
  patterns: [shadcn Popover, shadcn ScrollArea, Remix Icons, TanStack notification hook consumption]

key-files:
  created:
    - src/components/notifications/NotificationBell.tsx
    - src/components/notifications/__tests__/NotificationBell.test.tsx
    - .planning/phases/23-reporter-comms-in-app/23-05-SUMMARY.md
  modified:
    - src/components/ui/sidebar-nav.tsx
    - .planning/phases/23-reporter-comms-in-app/23-UI-SPEC.md

key-decisions:
  - "NotificationBell mounts in SidebarNav's bottom utility area next to SupportPopover, not a nonexistent universal top bar."
  - "View report visibility is client-side fail-closed: source must be in_app_user, kind must be received/in_progress/resolved/escalated, and ticket_id must be a string."
  - "No reporter-safe ticket route/dialog was introduced; the guarded View report shell is rendered without reusing admin ticket detail surfaces."

patterns-established:
  - "Reporter notification UI consumes useNotifications directly and never queries raw ticket_messages or runner evidence."
  - "Unread badge reserves fixed trigger space and caps visible count at 9+."

requirements-completed: [RSP-01]

duration: 4min
completed: 2026-06-15
---

# Phase 23 Plan 05: Reporter Notification UI Summary

**Reporter comms now have an in-app notification bell in the existing sidebar utility area, with unread counts, read mutations, and fail-closed reporter ticket metadata gating.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-06-15T05:04:05Z
- **Completed:** 2026-06-15T05:08:21Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added `NotificationBell`, a shadcn/Radix popover consumer for `useNotifications` with a fixed-size unread badge, 9+ cap, internal scroll panel, empty/loading states, row read mutation, and mark-all-read control.
- Added `isReporterTicketMetadata()` and tests for the locked D-00 fail-closed source matrix: manual, sentry, nightly_qa, internal, unknown, null source, and null metadata all reject.
- Mounted the bell in `SidebarNav` beside `SupportPopover`, so it reaches the desktop rail and mobile sidebar overlay without adding routes or new packages.
- Reconciled `23-UI-SPEC.md` W4 language from stale "top bar utility area" wording to the actual SidebarNav bottom-utility mount.

## Task Commits

1. **Task 1: Build NotificationBell component** - `bfa07251` (`feat(23): add reporter notification bell`)
2. **Task 2: Mount NotificationBell in SidebarNav** - `2c661c9d` (`feat(23): mount notification bell in sidebar utility area`)

## Files Created/Modified

- `src/components/notifications/NotificationBell.tsx` - Notification trigger, unread badge, popover panel, safe metadata guard, and row read behavior.
- `src/components/notifications/__tests__/NotificationBell.test.tsx` - Unit coverage for unread badge thresholds, row read mutation, valid reporter action visibility, and locked source rejection matrix.
- `src/components/ui/sidebar-nav.tsx` - Mounts `NotificationBell` in the bottom utility section next to `SupportPopover`.
- `.planning/phases/23-reporter-comms-in-app/23-UI-SPEC.md` - Updates surface, interaction, and responsive language to the real SidebarNav mount.

## Decisions Made

- The notification entry point uses SidebarNav's bottom utility area as the global utility surface because the app shell has no universal top bar.
- The panel renders `View report` only after the explicit metadata guard passes; ambiguous metadata remains a generic notification.
- No new reporter ticket detail surface was created. Existing ticket detail surfaces are admin-oriented, so this plan avoids leaking admin/operator sections.

## Deviations from Plan

### Auto-fixed Issues

None.

### W4 Fold-In

- Updated `23-UI-SPEC.md` to replace the stale top-bar contract with the actual SidebarNav bottom-utility surface, including `side="right"` popover behavior and responsive reach through the mobile sidebar overlay.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** The requested W4 doc reconciliation was completed without changing the implementation scope.

## Issues Encountered

- `npm run type-check:raw` fails on pre-existing repo-wide type debt outside this plan, including connector registry tests, panel store tests, Supabase row typing, and unrelated service typings. The focused notification test and `npm run build` both pass.

## Verification

- `npm test -- src/components/notifications/__tests__/NotificationBell.test.tsx` - PASS, 14 tests.
- `npm test -- src/components/notifications/__tests__/NotificationBell.test.tsx && grep -q "NotificationBell" src/components/ui/sidebar-nav.tsx && echo OK` - PASS.
- Static guard: `RiNotification3Line` is present; no Lucide/FontAwesome import, no banned reporter-facing internals in `NotificationBell.tsx`.
- `npm run build` - PASS. Existing Vite warnings only: deprecated CJS Node API, old Browserslist data, and pre-existing large/dynamic chunk warnings.
- `npm run type-check:raw` - FAIL, pre-existing unrelated errors; not used as the plan completion gate.

## Human Visual Checkpoint

The plan's human visual checkpoint was reached after the automated gates. `workflow.auto_advance` is true, so the checkpoint was treated as non-blocking per executor protocol. I started the dev server at `http://127.0.0.1:3001/`, but could not capture an authenticated sidebar screenshot because `CALLVAULTAI_LOGIN` and `CALLVAULTAI_LOGIN_PASSWORD` were not exported and were not present in `.env.local`.

## Known Stubs

None blocking. The guarded `View report` text action is intentionally a shell in this plan because no reporter-safe ticket route/dialog was found; no admin ticket dialog was reused.

## Threat Flags

None. This plan added no network endpoints, auth paths, schema changes, file access paths, or new trust boundaries beyond the planned `user_notifications` UI rendering boundary.

## User Setup Required

None.

## Next Phase Readiness

RSP-01's visible in-app surface is complete. The remaining verification risk is visual confirmation in an authenticated app session once local test credentials are available or production can be checked with an existing session.

## Self-Check: PASSED

- Found `src/components/notifications/NotificationBell.tsx`.
- Found `src/components/notifications/__tests__/NotificationBell.test.tsx`.
- Found task commits `bfa07251` and `2c661c9d` in git history.

---
*Phase: 23-reporter-comms-in-app*
*Completed: 2026-06-15*
