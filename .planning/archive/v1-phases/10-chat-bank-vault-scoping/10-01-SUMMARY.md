---
phase: 10-chat-bank-vault-scoping
plan: 01
subsystem: api
tags: [chat-stream-v2, bank-vault, multi-tenant, scoping, typescript]

# Dependency graph
requires:
  - phase: 09-bank-vault-architecture
    provides: "Bank/vault tables, useBankContext hook, bank switcher UI"
provides:
  - "chat-stream-v2 parses bank_id/vault_id from request body"
  - "BankVaultContext type for multi-tenant scoping"
  - "createTools receives bank/vault params (ready for plan 02 filtering)"
  - "SessionFilters includes bank_id field"
affects: ["10-02 (chat search filtering)", "10-03 (end-to-end verification)"]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Bank/vault context passed through HTTP body as sessionFilters"]

key-files:
  created: []
  modified:
    - "supabase/functions/chat-stream-v2/index.ts"

key-decisions:
  - "Added bank_id to SessionFilters rather than separate param threading - existing tools already reference sessionFilters.bank_id"
  - "Set bank_id on sessionFilters object after parsing body to maintain backward compatibility with existing tool queries"
  - "vault_id kept separate (passed to createTools) since it's not used in searches yet (plan 02)"

patterns-established:
  - "Bank/vault context flow: Frontend useBankContext → transport body sessionFilters → backend parse → createTools params"

# Metrics
duration: 2min
completed: 2026-02-09
---

# Phase 10 Plan 01: Pass bank_id/vault_id to chat-stream-v2 Summary

**Backend parses bank/vault context from request body, adds BankVaultContext type, threads bankId/vaultId to createTools for plan 02 filtering**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-09T14:08:41Z
- **Completed:** 2026-02-09T14:11:01Z
- **Tasks:** 3 (2 with commits, 1 verification-only)
- **Files modified:** 1

## Accomplishments
- Added BankVaultContext interface and bank_id to SessionFilters type
- Backend handler now extracts bankId/vaultId from body.sessionFilters
- createTools function signature updated to accept bankId and vaultId parameters
- Bank/vault context logged in handler and tools initialization
- Langfuse trace metadata now includes bank/vault context
- Verified frontend already sends correct sessionFilters with bank_id/vault_id

## Task Commits

Each task was committed atomically:

1. **Task 1: Update RequestBody type** - `e623299` (feat)
2. **Task 2: Parse bank/vault from body** - `9c00433` (feat)
3. **Task 3: Verify frontend** - No commit (verification only, no changes needed)

## Files Created/Modified
- `supabase/functions/chat-stream-v2/index.ts` - Added BankVaultContext type, bank_id to SessionFilters, body parsing, createTools signature update, logging

## Decisions Made
- Added `bank_id` to `SessionFilters` interface rather than creating a completely separate parameter threading approach, because existing tools (searchByEntity, getCallsList, compareCalls) already reference `sessionFilters?.bank_id`
- Set `bank_id` on the `sessionFilters` object in the handler after body parsing, ensuring backward compatibility with tools that already access `sessionFilters.bank_id`
- Kept `vaultId` as a separate parameter to `createTools` since vault-level filtering isn't implemented yet (that's plan 02)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Bank/vault context now flows from frontend to backend and into createTools
- Ready for 10-02-PLAN.md which will add actual search filtering by bank/vault
- All existing tool queries that reference `sessionFilters?.bank_id` will now receive the actual value

## Self-Check: PASSED

---
*Phase: 10-chat-bank-vault-scoping*
*Completed: 2026-02-09*
