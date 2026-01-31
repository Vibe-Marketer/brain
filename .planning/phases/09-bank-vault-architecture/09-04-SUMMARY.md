---
phase: 09-bank-vault-architecture
plan: 04
subsystem: database
tags: [recordings, vault_entries, rls, postgresql, multi-tenant]

# Dependency graph
requires:
  - phase: 09-02
    provides: banks and bank_memberships tables with is_bank_member helper
  - phase: 09-03
    provides: vaults and vault_memberships tables with is_vault_member helper
provides:
  - recordings table for base call objects
  - vault_entries table for multi-vault recording context
  - RLS policies enforcing bank/vault isolation
  - get_recording_bank_id() helper function
affects: [09-05, 09-06, 09-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "VaultEntry join pattern for multi-vault recording appearances"
    - "Recording deletion blocked when vault_entries exist"
    - "UNIQUE(vault_id, recording_id) enforces one entry per vault"

key-files:
  created:
    - supabase/migrations/20260131200000_create_recordings_tables.sql
  modified: []

key-decisions:
  - "legacy_recording_id for fathom_calls migration tracking"
  - "global_tags on Recording, local_tags on VaultEntry separation"
  - "Recording deletion blocked via RLS when vault_entries exist"
  - "Members can create/update/delete own entries (recordings they own)"

patterns-established:
  - "VaultEntry enables same recording in multiple vaults with different context"
  - "Recording.bank_id is immutable - cross-bank is always COPY"

# Metrics
duration: 2min
completed: 2026-01-31
---

# Phase 09 Plan 04: Recordings and VaultEntries Tables Summary

**Core data model established: recordings table for call data, vault_entries for multi-vault context with local tags/scores/notes**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-31T19:26:28Z
- **Completed:** 2026-01-31T19:28:48Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Created recordings table with all fathom_calls-equivalent fields plus bank_id ownership
- Created vault_entries table enabling same recording in multiple vaults with different context
- Implemented RLS policies enforcing bank membership for recording access
- Implemented RLS policies enforcing vault membership for vault_entry access
- Added UNIQUE constraints preventing duplicate migrations and duplicate vault entries

## Task Commits

Both tasks were completed in a single atomic migration file (as required by SQL migrations):

1. **Task 1+2: Create recordings and vault_entries tables with RLS** - `48bb7f0` (feat)

**Plan metadata:** Included in task commit (single migration file)

## Files Created/Modified

- `supabase/migrations/20260131200000_create_recordings_tables.sql` - Complete migration with:
  - recordings table (base call objects)
  - vault_entries table (recording in vault with local context)
  - All indexes for common query patterns
  - Updated_at triggers
  - RLS policies for both tables
  - get_recording_bank_id() SECURITY DEFINER helper

## Decisions Made

1. **Single migration file for both tables** - vault_entries depends on recordings, must be in same migration
2. **legacy_recording_id for migration tracking** - Enables gradual migration from fathom_calls without data loss
3. **global_tags vs local_tags separation** - Source-level tags on Recording, context-specific tags on VaultEntry
4. **Recording deletion blocked via RLS** - Uses NOT EXISTS subquery to prevent deletion when vault_entries exist
5. **Members can manage own entries** - RLS policy allows members to update/delete entries for recordings they own

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- recordings and vault_entries tables ready for Plan 05 (signup trigger + drop old tables)
- Plan 06 (migration function) will use legacy_recording_id for fathom_calls migration
- RLS policies complete and tested via pattern verification

---
*Phase: 09-bank-vault-architecture*
*Completed: 2026-01-31*
