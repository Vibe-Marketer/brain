---
phase: 09-bank-vault-architecture
plan: 10
subsystem: frontend
tags: [bank-context, vault-context, deprecation, chat, sync]

# Dependency graph
requires:
  - phase: 09-07
    provides: useBankContext hook
  - phase: 09-08
    provides: BankSwitcher UI component
provides:
  - Bank/vault context wired to SyncTab
  - Bank/vault context wired to Chat
  - Deprecated teamContextStore with migration guide
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [bank-context-filtering, session-filters-pattern]

key-files:
  created: []
  modified:
    - src/stores/teamContextStore.ts
    - src/components/transcripts/SyncTab.tsx
    - src/pages/Chat.tsx

key-decisions:
  - "Add @deprecated JSDoc to teamContextStore for IDE visibility"
  - "Pass bank_id/vault_id via sessionFilters object to chat-stream"
  - "SyncTab checks recordings table for migration status, falls back to fathom_calls"

patterns-established:
  - "sessionFilters: { bank_id, vault_id } pattern for API calls"
  - "Type assertion for recordings table until types regenerated"

# Metrics
duration: 4min
completed: 2026-01-31
---

# Phase 09 Plan 10: Wire Pages to Bank/Vault Context Summary

**Deprecated teamContextStore, wired SyncTab and Chat to use bank/vault context for data filtering**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-31T20:09:59Z
- **Completed:** 2026-01-31T20:13:50Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Marked teamContextStore as deprecated with comprehensive migration guide
- Added useBankContext to SyncTab with recordings table migration fallback
- Added bank_id/vault_id to Chat sessionFilters for scoped searches
- All major pages now use bank/vault context system

## Task Commits

Each task was committed atomically:

1. **Task 1: Deprecate teamContextStore and update SyncTab** - `f75f5b3` (feat)
2. **Task 2: Update Chat for vault context** - `a0797fe` (feat)

## Files Created/Modified

- `src/stores/teamContextStore.ts` - Added @deprecated JSDoc with migration guide
- `src/components/transcripts/SyncTab.tsx` - Import useBankContext, add bank filtering with migration fallback
- `src/pages/Chat.tsx` - Import useBankContext, pass bank_id/vault_id in sessionFilters

## Decisions Made

- **@deprecated JSDoc format:** Used JSDoc format for IDE visibility and documentation
- **sessionFilters pattern:** Pass bank_id and vault_id as separate object to chat-stream API
- **Migration fallback:** SyncTab checks recordings table for data, falls back to fathom_calls during migration
- **Type assertions:** Use eslint-disable for recordings table queries until TypeScript types are regenerated

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] DashboardPage.tsx does not exist**
- **Found during:** Task 2 (Update Dashboard)
- **Issue:** Plan referenced `src/pages/DashboardPage.tsx` which doesn't exist in this codebase
- **Fix:** Skipped Dashboard updates as component doesn't exist; no dashboard page in CallVault
- **Impact:** None - plan was based on assumption of existing Dashboard component

## Issues Encountered

- TypeScript types for `recordings` table not yet generated - used type assertions with eslint-disable
- This is expected during migration and will be resolved when types are regenerated

## Next Phase Readiness

Phase 9 complete. All 10 plans executed:
- 09-01 through 09-05: Database schema and migration setup
- 09-06: Migration function for fathom_calls to recordings
- 09-07: Bank context store and hook
- 09-08: Bank switcher UI
- 09-09: Banks & Vaults settings tab
- 09-10: Wire pages to new context

**Ready for verification:**
- Bank/vault architecture fully implemented
- Migration path from fathom_calls to recordings in place
- UI supports bank switching and vault management
- All pages use new context system

---
*Phase: 09-bank-vault-architecture*
*Completed: 2026-01-31*
