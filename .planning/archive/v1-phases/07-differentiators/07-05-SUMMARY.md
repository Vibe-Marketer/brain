---
phase: 07-differentiators
plan: 05
subsystem: backend, ui
tags: [health-alerts, notifications, email, contacts, ai-generation]

# Dependency graph
requires:
  - phase: 07-differentiators
    provides: Contacts database with track_health toggle (07-04)
provides:
  - user_notifications table for in-app alerts
  - check-client-health Edge Function (scheduled)
  - NotificationBell and NotificationPanel components
  - useNotifications hook for CRUD operations
  - useHealthAlerts hook for email generation
  - HealthAlertBanner and ReengagementEmailModal components
  - 7-day cooldown prevents alert spam
affects: [future-email-notifications, crm-features]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Scheduled Edge Function pattern for daily health checks
    - In-app notification popover with bell icon
    - AI-generated email with customizable prompt
    - Copy to clipboard / Open in email client actions
    - 7-day cooldown on per-contact alerts

key-files:
  created:
    - supabase/migrations/20260131000004_create_notifications_table.sql
    - supabase/functions/check-client-health/index.ts
    - src/hooks/useNotifications.ts
    - src/hooks/useHealthAlerts.ts
    - src/components/notifications/NotificationBell.tsx
    - src/components/notifications/NotificationPanel.tsx
    - src/components/contacts/HealthAlertBanner.tsx
    - src/components/contacts/ReengagementEmailModal.tsx
  modified:
    - src/lib/query-config.ts
    - src/components/contacts/ContactCard.tsx

key-decisions:
  - "7-day cooldown prevents repeated alerts for same contact"
  - "Per-contact threshold overrides user default"
  - "Service role used for scheduled function (bypasses RLS)"
  - "AI email generation via generate-content function"

patterns-established:
  - "Scheduled health check function pattern"
  - "In-app notification popover pattern"
  - "AI-generated email with editable prompt"

# Metrics
duration: 5min
completed: 2026-01-31
---

# Phase 7 Plan 5: Client Health Alerts Summary

**Engagement tracking with in-app and email notifications for overdue contacts, plus AI-generated re-engagement emails**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-31T16:01:58Z
- **Completed:** 2026-01-31T16:06:34Z
- **Tasks:** 3
- **Files created:** 8
- **Files modified:** 2

## Accomplishments

- Created user_notifications table with RLS for in-app alerts
- Built check-client-health Edge Function for scheduled daily health checks
- Implemented NotificationBell with unread count badge in header
- Created NotificationPanel popover with mark-as-read and delete actions
- Built useHealthAlerts hook with AI-powered email generation
- Created HealthAlertBanner showing in ContactCard when contact is overdue
- Implemented ReengagementEmailModal with customizable prompt and email preview
- Integrated health alerts into ContactCard component

## Task Commits

Each task was committed atomically:

1. **Task 1: Create notifications table and health check function** - `e2d8db6` (feat)
2. **Task 2: Create notifications UI components** - `da6437c` (feat)
3. **Task 3: Create re-engagement email generation** - `28cb979` (feat)

## Files Created/Modified

- `supabase/migrations/20260131000004_create_notifications_table.sql` - Notifications table with RLS
- `supabase/functions/check-client-health/index.ts` - Scheduled health check function
- `src/lib/query-config.ts` - Added notifications query keys
- `src/hooks/useNotifications.ts` - CRUD hook for notifications
- `src/hooks/useHealthAlerts.ts` - Email generation hook
- `src/components/notifications/NotificationBell.tsx` - Bell icon with badge
- `src/components/notifications/NotificationPanel.tsx` - Notification list popover
- `src/components/contacts/HealthAlertBanner.tsx` - Alert banner for overdue contacts
- `src/components/contacts/ReengagementEmailModal.tsx` - AI email generation modal
- `src/components/contacts/ContactCard.tsx` - Integrated banner and modal

## Decisions Made

1. **7-day cooldown** - Prevents repeated alerts for the same contact, stored in `last_alerted_at`
2. **Per-contact thresholds** - Individual contacts can override user's default threshold
3. **Service role for scheduled function** - Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS
4. **AI email via generate-content** - Reuses existing Edge Function for AI generation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed successfully.

## Scheduling Setup Required

To enable daily health checks, set up pg_cron or Supabase scheduled function:

```sql
SELECT cron.schedule('check-client-health', '0 9 * * *', $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/check-client-health',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
$$);
```

## Phase 7 Complete

All 5 plans in Phase 7 (High-Value Differentiators) have been executed:
- 07-01: PROFITS Framework v2
- 07-02: Folder-Level Chat
- 07-03: Real Analytics Data (verified existing)
- 07-04: Contacts Database
- 07-05: Client Health Alerts

---
*Phase: 07-differentiators*
*Completed: 2026-01-31*
