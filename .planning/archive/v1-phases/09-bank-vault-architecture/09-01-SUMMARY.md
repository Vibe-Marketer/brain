---
phase: 09-bank-vault-architecture
plan: 01
subsystem: cleanup
tags: [coach, deletion, cleanup, migration-prep]

# Dependency graph
requires:
  - phase: none
    provides: "Independent cleanup task - prerequisite for Bank/Vault"
provides:
  - coach-free codebase ready for Bank/Vault implementation
  - dropped coach_relationships, coach_shares, coach_notes tables
  - deleted send-coach-invite Edge Function
affects: [09-02-banks, 09-03-vaults]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - supabase/migrations/20260131190000_drop_coach_tables.sql
  modified:
    - src/types/sharing.ts
    - src/lib/query-config.ts
    - src/pages/CollaborationPage.tsx
    - src/App.tsx
    - src/hooks/useAccessControl.ts
    - src/hooks/useSharing.ts
    - src/pages/SharedWithMe.tsx
    - src/components/billing/PlanCards.tsx
    - src/components/settings/BillingTab.tsx
  deleted:
    - supabase/functions/send-coach-invite/
    - src/hooks/useCoachRelationships.ts
    - src/components/settings/CoachesTab.tsx
    - src/components/sharing/CoachInviteDialog.tsx
    - src/components/sharing/CoacheeInviteDialog.tsx
    - src/components/sharing/RelationshipCard.tsx
    - src/components/sharing/RelationshipList.tsx
    - src/pages/CoachDashboard.tsx
    - src/pages/CoachJoin.tsx
    - src/hooks/__tests__/useCoachRelationships.test.ts
    - src/hooks/__tests__/rlsPolicies.test.ts

key-decisions:
  - "No migration needed for coach data - no production data exists"
  - "CASCADE drop is safe since tables have no data"
  - "'coaching' call_type preserved - only coach feature code removed"

patterns-established: []

# Metrics
duration: 5min
completed: 2026-01-31
---

# Phase 9 Plan 01: Delete Coach Code Summary

**Eliminated all coach-related code from codebase in preparation for Bank/Vault architecture. No production data existed, so this was a clean deletion.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-31 (continuation of prior session)
- **Completed:** 2026-01-31
- **Tasks:** 2/2
- **Files modified:** 25 (10 deleted, 1 created, 14 modified)

## Accomplishments

- Deleted send-coach-invite Edge Function (282 lines)
- Created migration to drop coach_relationships, coach_shares, coach_notes tables
- Deleted 10 frontend files (~3000 lines of coach code)
- Removed coach types from sharing.ts (CoachRelationship, CoachShare, CoachNote, etc.)
- Removed coach query keys from query-config.ts
- Cleaned coach routes from App.tsx and Layout.tsx
- Removed coach access control from useAccessControl.ts
- Removed coach tabs from SharedWithMe.tsx and CollaborationPage.tsx
- Cleaned coach feature mentions from billing components
- Verified build and type-check pass

## Task Commits

1. **Task 1: Database & Edge Function Cleanup** - `f9e4c8b` (feat)
   - Deleted supabase/functions/send-coach-invite/
   - Created migration 20260131190000_drop_coach_tables.sql

2. **Task 2: Frontend Coach Code Removal** - `6e73927` (feat)
   - Deleted all coach components, pages, hooks, and tests
   - Cleaned up coach references from types, routes, queries

3. **Task 2 (cleanup): Remove coach comments** - `563735c` (fix)
   - Updated stale comments referencing coach in analytics hooks

## Files Created/Modified

### Created
- `supabase/migrations/20260131190000_drop_coach_tables.sql` - DROP TABLE CASCADE for coach tables

### Deleted (10 files)
- `supabase/functions/send-coach-invite/` - Edge Function for coach invites
- `src/hooks/useCoachRelationships.ts` - Coach relationship management hook
- `src/components/settings/CoachesTab.tsx` - Coach settings tab
- `src/components/sharing/CoachInviteDialog.tsx` - Coach invite modal
- `src/components/sharing/CoacheeInviteDialog.tsx` - Coachee invite modal
- `src/components/sharing/RelationshipCard.tsx` - Coach relationship display
- `src/components/sharing/RelationshipList.tsx` - Coach relationship list
- `src/pages/CoachDashboard.tsx` - Coach dashboard page
- `src/pages/CoachJoin.tsx` - Coach join page
- `src/hooks/__tests__/rlsPolicies.test.ts` - Coach RLS policy tests

### Modified
- `src/types/sharing.ts` - Removed coach types, cleaned AccessLevel union
- `src/lib/query-config.ts` - Removed coach query keys
- `src/hooks/useAccessControl.ts` - Removed isCoach, checkCoachAccess
- `src/hooks/useSharing.ts` - Removed coach fields from SharingStatus
- `src/pages/SharedWithMe.tsx` - Removed coach tabs
- `src/pages/CollaborationPage.tsx` - Removed coach category
- `src/App.tsx` - Removed coach routes
- `src/components/Layout.tsx` - Removed coach route titles
- `src/components/billing/PlanCards.tsx` - Removed coach feature mentions
- `src/components/settings/BillingTab.tsx` - Removed coach feature mentions

## Decisions Made

1. **No data migration needed** - Per CONTEXT.md, no production data exists for coach tables
2. **CASCADE drop is safe** - Empty tables with no foreign key dependencies
3. **Preserve 'coaching' call_type** - This is a valid call categorization, not the coach feature
4. **Clean deletion approach** - Delete all code rather than deprecate, since feature never launched

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Codebase is clean of coach references
- Ready for Bank/Vault implementation:
  - Plan 09-02: Banks and BankMemberships tables (COMPLETE)
  - Plan 09-03: Vaults and VaultMemberships tables (COMPLETE)
  - Plan 09-04: Recordings and VaultEntries tables (COMPLETE)
  - Plan 09-05: Update signup trigger + drop old team tables

---
*Phase: 09-bank-vault-architecture*
*Completed: 2026-01-31*
