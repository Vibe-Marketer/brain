---
phase: 08-growth-infrastructure
plan: 06
subsystem: admin
tags: [admin, costs, analytics, dashboard, billing]

# Dependency graph
requires:
  - phase: 06-code-health
    provides: embedding_usage_logs table with cost tracking
provides:
  - Admin-only system-wide AI cost aggregation
  - Cost breakdowns by model, feature, and user
  - Time period filtering (this month, last month, all time)
affects: [admin monitoring, billing decisions, cost optimization]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - RPC function with SECURITY DEFINER for admin-only access
    - Period-based aggregation with JSONB return type
    - Hook with manual type definitions for RPC functions not in generated types

key-files:
  created:
    - supabase/migrations/20260131111538_add_admin_cost_function.sql
    - src/hooks/useAdminCosts.ts
    - src/components/settings/AdminCostDashboard.tsx
  modified:
    - src/components/settings/AdminTab.tsx

key-decisions:
  - "SECURITY DEFINER with role check pattern for admin-only RPC"
  - "Return empty results for non-admin callers (not error)"
  - "Manual TypeScript interface for RPC return type (not yet in generated types)"
  - "Top 20 users by cost in user breakdown"

patterns-established:
  - "Admin-only RPC with SECURITY DEFINER + role check in function body"
  - "JSONB aggregation for complex multi-dimensional breakdowns"
  - "Manual type definitions for custom RPC functions"

# Metrics
duration: ~15min
completed: 2026-01-31
---

# Phase 08 Plan 06: Admin Cost Dashboard Summary

**Admin cost tracking dashboard showing aggregated AI costs across all users with breakdowns by model, feature, and user (GROW-05)**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-01-31T11:15:00Z
- **Completed:** 2026-01-31T11:30:00Z
- **Tasks:** 3
- **Files created:** 3
- **Files modified:** 1

## Accomplishments

- Created PostgreSQL RPC function `get_admin_cost_summary` for admin-level cost aggregation
- RPC supports three period filters: 'month', 'last_month', 'all'
- Returns JSONB breakdowns by model, by operation_type (feature), and by user
- Created `useAdminCosts` TanStack Query hook with proper type definitions
- Built `AdminCostDashboard` component with:
  - Period selector dropdown
  - Summary cards: Total Cost, Total Requests, Total Tokens
  - Model breakdown with Tremor BarChart visualization
  - Feature breakdown with progress bars
  - Top 20 users by cost in scrollable list
- Integrated dashboard into Admin tab as "System Costs" section

## Task Commits

1. **Task 1: Create admin cost aggregation RPC function** - `f42dab3` (feat)
2. **Task 2: Create useAdminCosts hook** - `38eabb6` (feat)
3. **Task 3: Create AdminCostDashboard and integrate into AdminTab** - `92d1f8c` (feat)

## Files Created/Modified

- `supabase/migrations/20260131111538_add_admin_cost_function.sql` - RPC function for admin cost aggregation (142 lines)
- `src/hooks/useAdminCosts.ts` - TanStack Query hook for admin costs (118 lines)
- `src/components/settings/AdminCostDashboard.tsx` - Admin cost visualization component (303 lines)
- `src/components/settings/AdminTab.tsx` - Added AdminCostDashboard import and integration

## Decisions Made

1. **SECURITY DEFINER with internal role check** - RPC uses SECURITY DEFINER to bypass RLS for aggregation, but explicitly checks caller has ADMIN role before returning data
2. **Empty results for non-admins** - Non-admin callers get empty arrays/zeros rather than errors, making frontend logic simpler
3. **Manual TypeScript types** - Since RPC functions aren't in generated Supabase types, created manual interface definitions
4. **Top 20 users limit** - User breakdown limited to top 20 by cost to keep dashboard performant
5. **Strip provider prefix in charts** - Model names display without `provider/` prefix for cleaner visualization

## Deviations from Plan

None - plan executed exactly as written.

## Verification

All success criteria met:
- [x] Admin users can see aggregated cost data across all users
- [x] Dashboard shows breakdown by model (which models cost most)
- [x] Dashboard shows breakdown by feature (chat vs embedding vs search)
- [x] Dashboard shows breakdown by user (who is using most)
- [x] Time period filtering works (this month, last month, all time)
- [x] Non-admin users cannot access admin cost data (empty results from RPC)

## User Setup Required

None - AdminTab is already protected by role checks in the Settings page; only ADMIN role users can access it.

## Next Phase Readiness

- Phase 8 (Growth Infrastructure) is now **COMPLETE** with all 6 plans done
- Ready for Phase 9 (Team Content Segregation) when prioritized
- All GROW requirements delivered

---

*Phase: 08-growth-infrastructure*
*Completed: 2026-01-31*
