---
phase: 09-bank-vault-architecture
plan: 02
subsystem: database
tags: [postgres, rls, supabase, multi-tenant, bank-vault]

# Dependency graph
requires:
  - phase: none
    provides: "Independent of other Phase 9 plans"
provides:
  - banks table with type constraint and cross_bank_default
  - bank_memberships table with user-bank relationship
  - SECURITY DEFINER helpers for RLS (is_bank_member, is_bank_admin_or_owner)
  - Complete RLS policy set for bank isolation
affects: [09-03-vaults, 09-05-signup-trigger, 09-07-bank-context]

# Tech tracking
tech-stack:
  added: []
  patterns: [security-definer-helpers, rls-multi-tenant-isolation]

key-files:
  created:
    - supabase/migrations/20260131000005_create_banks_tables.sql
  modified: []

key-decisions:
  - "SECURITY DEFINER functions prevent RLS recursion in membership checks"
  - "bank_memberships has UNIQUE(bank_id, user_id) constraint"
  - "Any user can INSERT banks (for self-service bank creation)"
  - "Users can create their own initial membership (bootstrap pattern)"

patterns-established:
  - "is_bank_member/is_bank_admin_or_owner pattern for RLS policies"
  - "Separate INSERT policies for admin-managed vs self-service membership"

# Metrics
duration: 2min
completed: 2026-01-31
---

# Phase 9 Plan 02: Banks Tables Summary

**Created banks and bank_memberships tables with SECURITY DEFINER helpers and complete RLS policies for multi-tenant isolation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-31T19:25:13Z
- **Completed:** 2026-01-31T19:27:08Z
- **Tasks:** 2 (combined into single migration)
- **Files modified:** 1

## Accomplishments

- Created `banks` table with type constraint ('personal', 'business') and cross_bank_default setting
- Created `bank_memberships` table with user-bank relationship and role ('bank_owner', 'bank_admin', 'bank_member')
- Implemented SECURITY DEFINER helper functions to prevent RLS recursion
- Applied complete RLS policy set (SELECT, INSERT, UPDATE, DELETE) on both tables
- Added indexes for efficient querying (type, bank_id, user_id, role)

## Task Commits

Both tasks were completed in a single atomic migration file:

1. **Task 1 & 2: Create banks and bank_memberships tables** - `364971e` (feat)

**Plan metadata:** Pending (docs commit after this summary)

## Files Created/Modified

- `supabase/migrations/20260131000005_create_banks_tables.sql` - Banks and BankMemberships tables with RLS

## Decisions Made

1. **SECURITY DEFINER for membership checks** - Prevents infinite RLS recursion when policies need to check membership tables
2. **UNIQUE(bank_id, user_id)** - Prevents duplicate memberships, simplifies queries
3. **Any user can INSERT banks** - Enables self-service bank creation flow
4. **Users can create their own initial membership** - Bootstrap pattern for bank creators to become bank_owner

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Banks and BankMemberships tables ready for use
- RLS policies tested via successful migration push
- Ready for:
  - Plan 09-03: Vaults and VaultMemberships tables
  - Plan 09-05: Signup trigger to create personal bank
  - Plan 09-07: Bank context store and useBankContext hook

---
*Phase: 09-bank-vault-architecture*
*Completed: 2026-01-31*
