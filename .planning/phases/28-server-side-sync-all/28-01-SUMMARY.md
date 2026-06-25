---
phase: 28-server-side-sync-all
plan: 01
subsystem: api
tags: [supabase-edge, pagination, connector, sync-jobs, vitest, typescript]

# Dependency graph
requires:
  - phase: 27-sync-status-foundation
    provides: durable sync_jobs row (provider_cursor, mode, failed_ids, skipped_count, last_heartbeat_at) + reaper
  - phase: 24-sync-status-foundation
    provides: recordings_source_dedup org-scoped unique constraint + source_call_id
provides:
  - "Uniform listPage contract (types-only): ListPageResult/ListPageParams/ListPageFn + ListPageResolver signature"
  - "Optional syncAll? + SyncAllJob entry on ConnectorAdapter (opt-out-by-undefined)"
  - "Three RED requirement-proof scaffolds: resume (SYNC-01), idempotency (SYNC-03), listPage covering all 6 providers (SYNC-02)"
affects: [28-02 pager, 28-03 provider listPage impls + registry, 28-04 adapters + cron, 28-05 real-DB proofs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Opaque-cursor round-trip: pager stores nextCursor verbatim in provider_cursor, never parses provider dialect"
    - "Contract-only shared file (types + resolver signature) split from populated registry built in a later plan"
    - "RED scaffold via dynamic import of a not-yet-built registry module (import error = correct RED reason)"

key-files:
  created:
    - supabase/functions/_shared/connector-list-page.ts
    - supabase/functions/_shared/__tests__/listPage.test.ts
    - supabase/functions/connector-sync-all/__tests__/resume.integration.test.ts
    - supabase/functions/connector-sync-all/__tests__/idempotency.integration.test.ts
  modified:
    - src/components/connectors/registry/types.ts

key-decisions:
  - "connector-list-page.ts is types-only with ZERO populated entries; the populated source_app→ListPageFn map is deferred to connector-list-page-registry.ts (Plan 28-03)"
  - "ListPageResolver typed as Partial<Record<ConnectorSourceApp, ListPageFn>> — only list-API providers get an entry; webhook/manual sources have none"
  - "syncAll? signature returns SyncAllJob (jobId-returning, total optional) mirroring ImportJob/importSelected? opt-out-by-undefined shape"
  - "listPage unit test imports the not-yet-built registry to be RED; integration tests use the donor org_id/user_id pattern + try/catch afterAll, zero mocks"

patterns-established:
  - "Pattern 1: nextCursor is OPAQUE — the provider-agnostic pager round-trips it verbatim and never interprets the four provider dialects (opaque token / window+token / offset / last-id)"
  - "Pattern 2: contract types and the populated resolver live in separate files so the pager (28-02) imports only the contract while the registry (28-03) holds impls"

requirements-completed: [SYNC-01, SYNC-02, SYNC-03]

# Metrics
duration: 7min
completed: 2026-06-25
---

# Phase 28 Plan 01: listPage/syncAll Contracts + RED Scaffolds Summary

**Interface-first uniform listPage contract (opaque-cursor, types-only) + optional syncAll? adapter entry, plus three RED requirement-proof test scaffolds (SYNC-01/02/03) covering all 6 list-API providers — fixing the contract before any pager or provider impl exists.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-06-25T19:43:09Z
- **Completed:** 2026-06-25T19:50:00Z
- **Tasks:** 2
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- Defined the uniform pagination contract (`ListPageResult` / `ListPageParams` / `ListPageFn` / `ListPageResolver`) as a types-only shared file with a documented OPAQUE-cursor invariant and zero populated entries.
- Added optional `syncAll?` + `SyncAllJob` to `ConnectorAdapter`, mirroring the existing `importSelected?` opt-out-by-undefined shape; doc lists all 6 implementing providers and the 2 excluded.
- Authored three RED requirement-proofs: a 6-provider listPage unit test (one describe block each, all 4 pagination shapes asserted) and two real-DB integration scaffolds (resume + idempotency) with the mandatory TEST-ref guard and try/catch afterAll cleanup, zero mocks.

## Task Commits

1. **Task 1: Define the uniform listPage contract + syncAll adapter entry** - `d3b8624` (feat)
2. **Task 2: Author three RED test scaffolds (one per requirement)** - `18dd5cc` (test)

**Plan metadata:** (this docs commit)

## Files Created/Modified
- `supabase/functions/_shared/connector-list-page.ts` - Types-only contract: 4 contract types + resolver signature; documents opaque-cursor invariant + that the populated map is built in 28-03.
- `src/components/connectors/registry/types.ts` - Added `SyncAllJob` interface + optional `syncAll?` method on `ConnectorAdapter`.
- `supabase/functions/_shared/__tests__/listPage.test.ts` - SYNC-02 RED unit test, 6 describe blocks (Fathom/Grain/Zoom/Read.ai/Fireflies/Plaud), 4 pagination shapes; RED via import of not-yet-built registry.
- `supabase/functions/connector-sync-all/__tests__/resume.integration.test.ts` - SYNC-01 RED real-DB scaffold: cursor persist/resume + terminal status + failed_ids/skipped_count.
- `supabase/functions/connector-sync-all/__tests__/idempotency.integration.test.ts` - SYNC-03 RED real-DB scaffold: concurrent import single-row + 23505→skipped + crash-retry no-dup.

## Decisions Made
- Kept `connector-list-page.ts` strictly contract-only (no populated resolver) per the plan's interface seam — the populated `connector-list-page-registry.ts` is Plan 28-03's deliverable, imported by the pager (28-02) for runtime resolution.
- Typed `ListPageResolver` as `Partial<Record<ConnectorSourceApp, ListPageFn>>` so the type itself encodes "only list-API providers have an entry."
- listPage unit test deliberately imports the not-yet-built registry so the RED reason is unambiguous ("no impl exists yet"), exactly as the plan specifies (import error is an accepted RED form).

## Deviations from Plan

None - plan executed exactly as written.

(Note: a pre-existing tsc error at `src/components/connectors/registry/types.ts(42,13)` — `readonly` on a non-array type in the unrelated `ConnectorCredentialField.options` field — exists on `main` independent of this plan's changes. Confirmed via stash-compare that it is NOT introduced here; out of scope per the SCOPE BOUNDARY rule. Logged here for visibility, not fixed.)

## Issues Encountered
- The two integration scaffolds throw in `beforeAll` on a TEST DB that has no seeded `fathom` donor recording (the donor-pattern precedent from `auto-tag-calls.integration.test.ts` throws identically). This is the intended RED state — the 6 tests report `skipped` under `describe.skipIf` and the suite is correctly RED until the pager ships (28-02) and the TEST DB is seeded (28-05). Left as-is to match the established donor template.

## User Setup Required
None - no external service configuration required. (Integration tests require a separate Supabase TEST project per `supabase/CLAUDE.md`, but that is existing setup, not introduced here.)

## Next Phase Readiness
- The contract is fixed: Plan 28-03 can implement the 6 provider `listPage` fns + populated `connector-list-page-registry.ts` against `ListPageFn`/`ListPageResolver`; Plan 28-02 can build the pager importing only the contract types.
- The three RED proofs are in place and will turn GREEN as 28-02 (pager) and 28-03 (registry) land.
- No blockers.

## Self-Check: PASSED

All 5 created files verified present on disk; both task commits (`d3b8624`, `18dd5cc`) verified in git log.

---
*Phase: 28-server-side-sync-all*
*Completed: 2026-06-25*
