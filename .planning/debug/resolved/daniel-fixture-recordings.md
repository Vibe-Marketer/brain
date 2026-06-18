---
status: resolved
trigger: "Daniel Marama saw thousands of unrelated benchmark/integration call rows in his call library."
created: 2026-06-02
updated: 2026-06-02
---

## Symptoms

- Screenshot showed `1-100 of 5064` in the call list.
- Visible rows included benchmark-like titles: `retro discussion #...`, `standup notes #...`, `demo recap #...`.
- Visible rows also included `[phase-30-04 ...]` integration fixture titles.

## Current Focus

- hypothesis: Production recordings table contained leftover test/benchmark fixture rows in Daniel's personal organization.
- test: Query explicit fixture signatures in production recordings.
- expecting: Counts match screenshot-scale row inflation and fixture titles.
- next_action: Complete cleanup and prevent broad default view on stale no-workspace context.

## Evidence

- timestamp: 2026-06-02
  observation: Production contained 5000 rows with `source_call_id like 'bench-%-phase39bench-%'`.
- timestamp: 2026-06-02
  observation: Production contained 22 rows with `source_metadata.integration_test = 'phase-30-04'` and matching `[phase-30-04%` titles.
- timestamp: 2026-06-02
  observation: The benchmark rows were in Daniel's personal organization with Daniel as `owner_user_id`; this was contaminated owned data, not a cross-tenant RLS read.
- timestamp: 2026-06-02
  observation: After cleanup, remaining counts for Phase 39 and Phase 30 fixture signatures were zero.
- timestamp: 2026-06-02
  observation: Daniel's personal organization recording count after cleanup was 180.
- timestamp: 2026-06-02
  observation: Follow-up global scan found one remaining `[phase-32 share-call integration] do-not-touch` recording, also in Daniel's personal organization and owned by Daniel's user.
- timestamp: 2026-06-02
  observation: Deleted the remaining Phase 32 fixture recording and workspace entry; remaining `phase`, `bench`, bracketed phase, and `do-not-touch` production recording signatures were zero.
- timestamp: 2026-06-02
  observation: Full production recording distribution scan showed Daniel's personal org at 179 recordings. One other org had 1580 recordings, but sample titles/source ids were normal Fathom, Fireflies, Zoom, and manual imports, not fixture signatures.

## Eliminated

- hypothesis: Regular workspace member was seeing another workspace through broken RLS.
  reason: Daniel was `organization_owner` of the affected personal org and fixture rows were owned by his user id.
- hypothesis: Main table was showing random rows from all organizations.
  reason: Fixture rows were scoped to Daniel's own personal org; explicit cross-org fixture signatures were removed globally.

## Resolution

- root_cause: A Phase 39 p95 benchmark seeded 5000 recordings into a real production donor org/user, and Phase 30 integration fixture rows also remained in production. Daniel's context then displayed the org-wide/Home call list containing those owned fixture rows.
- fix: Deleted 5023 marked fixture recordings and their workspace entries from production. Added context auto-mode so stale or new no-workspace sessions auto-select the default workspace instead of landing in org-wide All Calls; explicit All selection remains available.
- verification: Fixture signature counts are zero; affected personal org count is 179; focused tests, type-check, and build passed.
- files_changed: src/stores/orgContextStore.ts, src/hooks/useOrgContext.ts
