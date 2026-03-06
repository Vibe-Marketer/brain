---
phase: 07-differentiators
plan: 06
subsystem: backend, ui
tags: [health-alerts, notifications, email, contacts, gap-closure]

# Dependency graph
requires:
  - phase: 07-differentiators
    provides: Health check function and NotificationBell component (07-05)
provides:
  - Email alerts via automation-email in health check function
  - NotificationBell integrated into TopBar header
  - Complete health alerts feature with both channels
affects: [notifications-ui, email-alerts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Service-to-service function invocation via supabase.functions.invoke
    - Opt-out email preference model (enabled by default)

key-files:
  created: []
  modified:
    - supabase/functions/check-client-health/index.ts
    - src/components/ui/top-bar.tsx

key-decisions:
  - "Opt-out model for email alerts - enabled by default if no settings"
  - "Email sending tracked separately in emailsSent counter"
  - "User email fetched via admin.getUserById for service-role context"

patterns-established:
  - "Service role function invoking other functions pattern"

# Metrics
duration: 2min
completed: 2026-01-31
---

# Phase 7 Plan 6: Wire Email Alerts + NotificationBell Summary

**Gap closure: Email alerts enabled in health check function and NotificationBell rendered in app header**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-31T16:22:23Z
- **Completed:** 2026-01-31T16:24:46Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Wired email alerts into check-client-health function via automation-email
- Integrated NotificationBell component into TopBar header
- Added emailsSent counter to track email delivery
- Implemented opt-out email preference model (enabled by default)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add email alerts to check-client-health function** - `5119d81` (feat)
2. **Task 2: Wire NotificationBell into TopBar header** - `0544bcc` (feat)

## Files Created/Modified

- `supabase/functions/check-client-health/index.ts` - Added automation-email invocation and emailsSent tracking
- `src/components/ui/top-bar.tsx` - Replaced static bell with NotificationBell component

## Decisions Made

1. **Opt-out email model** - If user_contact_settings.email_alerts_enabled is null, default to true
2. **Error isolation** - Email send errors logged but don't block alert creation
3. **Admin API for email** - Use supabase.auth.admin.getUserById since health check runs with service role

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed successfully.

## Verification Gaps Closed

This plan closes the verification gaps identified in 07-VERIFICATION.md:

1. **Email Alert Flow:**
   - ✅ check-client-health includes `supabase.functions.invoke('automation-email', ...)`
   - ✅ Email sent only after successful notification insert
   - ✅ User email fetched via admin.getUserById

2. **Notification Bell Integration:**
   - ✅ NotificationBell imported and rendered in TopBar
   - ✅ Static RiBellLine removed
   - ✅ notificationCount prop removed from TopBarProps

## Phase 7 Fully Complete

With this gap closure plan, all 6 plans in Phase 7 (High-Value Differentiators) are now complete:
- 07-01: PROFITS Framework v2
- 07-02: Folder-Level Chat
- 07-03: Real Analytics Data (verified existing)
- 07-04: Contacts Database
- 07-05: Client Health Alerts
- 07-06: Gap Closure (email alerts + NotificationBell wiring)

---
*Phase: 07-differentiators*
*Completed: 2026-01-31*
