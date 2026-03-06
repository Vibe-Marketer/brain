---
phase: 10-chat-bank-vault-scoping
plan: 02
subsystem: api
tags: [supabase, rpc, search, vault, bank, multi-tenant, security, edge-functions]

# Dependency graph
requires:
  - phase: 09-bank-vault-architecture
    provides: "vault_entries, vault_memberships, recordings tables with RLS"
  - phase: 10-01
    provides: "BankVaultContext type, bankId/vaultId params in createTools"
provides:
  - "hybrid_search_transcripts_scoped RPC function for vault-filtered search"
  - "SearchFilters extended with bank_id/vault_id"
  - "All 14 chat tools respect vault membership scoping"
  - "Vault attribution (vault_name) in search results"
affects:
  - 10-chat-bank-vault-scoping (plan 03 verification)
  - "Any future search or chat features must use scoped search when vault context present"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "hybrid_search_transcripts_scoped wraps existing search with vault membership pre-filter"
    - "Vault access check pattern: membership lookup → recording IDs → filter"
    - "Conditional RPC selection: scoped vs unscoped based on bank/vault context"

key-files:
  created:
    - "supabase/migrations/20260131300001_chat_vault_search_function.sql"
  modified:
    - "supabase/functions/_shared/search-pipeline.ts"
    - "supabase/functions/chat-stream-v2/index.ts"

key-decisions:
  - "Scoped function wraps existing hybrid_search_transcripts rather than replacing it"
  - "Bridge through legacy_recording_id for transcript compatibility (transcripts not yet migrated)"
  - "Intersect user-provided recording_ids with vault-scoped IDs for compound filtering"
  - "Analytical tools (getCallDetails, getCallsList, compareCalls) independently verify vault membership"
  - "Citation format includes [Vault Name] for cross-vault attribution"

patterns-established:
  - "Vault membership check pattern: resolve accessible vault IDs → get recording IDs → filter"
  - "Conditional RPC: use hybrid_search_transcripts_scoped when bank/vault context present, fall back to unscoped"

# Metrics
duration: 5min
completed: 2026-02-09
---

# Phase 10 Plan 02: Chat Bank/Vault Search Scoping Summary

**Vault-scoped hybrid_search_transcripts_scoped RPC with membership enforcement across all 14 chat tools and vault attribution in results**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-09T14:13:57Z
- **Completed:** 2026-02-09T14:18:55Z
- **Tasks:** 4
- **Files modified:** 3

## Accomplishments
- Created `hybrid_search_transcripts_scoped` RPC that enforces VaultMembership before returning search results
- Extended SearchFilters and FormattedSearchResult with bank_id, vault_id, vault_name fields
- All 14 chat tools now respect vault scoping: search tools (1-9), analytical tools (10-14)
- System prompt includes vault attribution guidance and updated citation format with vault names
- BankMembership alone never exposes recordings — VaultMembership is the access gate

## Task Commits

Each task was committed atomically:

1. **Task 1: Create vault-scoped search RPC function** - `818f8cf` (feat)
2. **Task 2: Update SearchFilters type to include bank_id/vault_id** - `78b1565` (feat)
3. **Task 3: Update chat-stream-v2 to pass bank/vault context to search** - `cc0c157` (feat)
4. **Task 4: Add vault attribution to search results** - `8bdf70c` (feat)

## Files Created/Modified
- `supabase/migrations/20260131300001_chat_vault_search_function.sql` - Vault-scoped search RPC wrapping hybrid_search_transcripts with membership filtering
- `supabase/functions/_shared/search-pipeline.ts` - SearchFilters extended with bank_id/vault_id, conditional scoped search, vault attribution in results
- `supabase/functions/chat-stream-v2/index.ts` - mergeFilters passes bank/vault context, all tools enforce vault scoping, system prompt updated

## Decisions Made
- **Wrapper approach:** hybrid_search_transcripts_scoped wraps existing function rather than replacing it, ensuring zero breaking changes for pre-migration data
- **Legacy bridge:** Uses legacy_recording_id to bridge between vault_entries/recordings and fathom_transcripts (transcripts haven't been migrated to new schema yet)
- **Recording ID intersection:** When user provides recording_ids filter AND vault context, the function intersects both sets rather than picking one
- **Per-tool membership verification:** Analytical tools (getCallDetails, getCallsList, compareCalls) each independently verify vault membership rather than relying solely on the search pipeline

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Chat searches are now vault-scoped with VaultMembership enforcement
- Ready for 10-03 (multi-tenant isolation verification)
- Vault attribution is available for UI rendering (vault_name in search results)

## Self-Check: PASSED

---
*Phase: 10-chat-bank-vault-scoping*
*Completed: 2026-02-09*
