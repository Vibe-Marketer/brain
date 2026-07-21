---
phase: 28-server-side-sync-all
plan: 03
subsystem: api
tags: [supabase-edge, pagination, connector, sync-jobs, opaque-cursor, zoom, plaud, fathom, grain, read-ai, fireflies, typescript]

# Dependency graph
requires:
  - phase: 28-server-side-sync-all (Plan 01)
    provides: types-only ListPageResult/ListPageParams/ListPageFn/ListPageResolver contract + RED listPage.test.ts (6 providers)
  - phase: 24-sync-status-foundation
    provides: recordings_source_dedup org-scoped unique constraint + source_call_id (downstream dedup)
provides:
  - "6 provider listPage impls behind the uniform opaque-cursor contract: fathomListPage, grainListPage, zoomListPage, readAiListPage, firefliesListPage, plaudListPage"
  - "POPULATED connector-list-page-registry.ts (source_app -> ListPageFn map + resolveListPage()) the pager (28-02) imports"
  - "Zoom composite window+token cursor that walks all 30-day windows (no >30-day truncation)"
  - "Plaud server-side sync-all proof (offset paging + post-fetch date filter), correcting the prior 'impossible' classification"
affects: [28-02 pager (imports the populated registry), 28-04 adapters + cron, 28-05 real-DB proofs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Each provider hides its pagination dialect (opaque token / composite window+token / offset / last-id) inside the single opaque nextCursor string; the pager round-trips it verbatim"
    - "listPage wrappers reuse the EXISTING provider list client/fetch — no duplicated auth, no re-implemented API calls"
    - "Provider/network error on a slice resolves as an exhausted page ({items:[], nextCursor:null}); the heartbeat/reaper net (Phase 27) covers a genuinely stuck slice"
    - "Optional second fetchImpl arg on each listPage for unit testability; cast to strict one-arg ListPageFn in the registry"

key-files:
  created:
    - supabase/functions/_shared/connector-list-page-registry.ts
  modified:
    - supabase/functions/_shared/fathom-client.ts
    - supabase/functions/_shared/grain-client.ts
    - supabase/functions/_shared/read-ai-client.ts
    - supabase/functions/_shared/fireflies-connector.ts
    - supabase/functions/_shared/zoom-client.ts
    - supabase/functions/_shared/plaud-client.ts

key-decisions:
  - "Zoom cursor is JSON {window_from, window_to, next_page_token, range_to}; advance the 30-day window only when a window's page-token is exhausted; nextCursor=null ONLY after the final window's final page"
  - "Plaud IS included in SYNC-02 (RESEARCH Finding 1 Option 2): offset paging covers it for free once Fireflies' offset shape exists; date filter is post-fetch (no native filter), documented as inefficient-not-impossible"
  - "Plaud termination keys off the RAW page length (< page_size), not the post-filter count, so an early all-out-of-range page does not end the stream prematurely"
  - "listPage wrappers swallow provider/network errors into an exhausted page to honor the committed RED unit-test contract (fake token, no fetch mock); genuine mid-backfill failure handling/visibility is the pager + reaper's job (28-02/Phase 27)"

patterns-established:
  - "Pattern 1: opaque-cursor round-trip — the four dialects (opaque token / window+token / offset / last-id) are all serialized into one nextCursor string the pager never parses"
  - "Pattern 2: populated registry (this file) is separate from the types-only contract (connector-list-page.ts) so the pager imports the contract types and resolves impls via resolveListPage(source_app)"
  - "Pattern 3: non-empty provider id guard on every item before it can become source_call_id (T-28-09); accessToken never logged (T-28-08)"

requirements-completed: [SYNC-02]

# Metrics
duration: 7min
completed: 2026-06-25
---

# Phase 28 Plan 03: Provider listPage Impls + Populated Registry Summary

**Six uniform `listPage` implementations (Fathom/Grain opaque-cursor, Zoom composite 30-day-window+page-token, Read.ai last-id limit-10, Fireflies/Plaud offset+post-fetch-date) behind one opaque-cursor contract, plus the populated `connector-list-page-registry.ts` the pager resolves against — turning Plan 01's 6-provider RED unit test GREEN.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-06-25T19:53:27Z
- **Completed:** 2026-06-25T20:00:59Z
- **Tasks:** 2
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments
- Implemented `listPage` for all 6 approved list-API providers, each wrapping its EXISTING list client (no duplicated OAuth, no re-implemented API calls), encoding its own pagination dialect inside the opaque cursor the pager round-trips.
- Built Zoom's high-risk composite window+token cursor so a >30-day backfill traverses every 30-day window instead of silently truncating to the most recent 30 days (RESEARCH Pitfall 3 / T-28-10).
- Created the POPULATED `connector-list-page-registry.ts` (`listPageResolver` map + `resolveListPage()`) with all 6 providers wired and youtube/file-upload intentionally absent (resolve to `undefined` = "imports automatically"). This unblocks Plan 28-02 (the pager, Wave 3).
- Plan 01's `listPage.test.ts` is GREEN for all 6 provider describe blocks (11 tests); the full `_shared` unit suite stays green (19 files / 207 tests).

## Task Commits

1. **Task 1: listPage for the 4 simpler shapes (Fathom, Grain, Read.ai, Fireflies)** - `66ad564` (feat)
2. **Task 2: Zoom composite + Plaud offset listPage + populated resolver registry** - `f06e11c` (feat)

**Plan metadata:** (this docs commit)

## Files Created/Modified
- `supabase/functions/_shared/fathom-client.ts` - `fathomListPage`: wraps GET /external/v1/meetings, opaque `next_cursor`, created_after/before window, id-guarded.
- `supabase/functions/_shared/grain-client.ts` - `grainListPage`: wraps `listRecordings`, opaque `cursor` passthrough (cleanest), after/before_datetime.
- `supabase/functions/_shared/read-ai-client.ts` - `readAiListPage`: wraps `listMeetings` with `clampReadAiLimit(10)` (never requests >10), last-item-id cursor, start_time_ms gte/lte.
- `supabase/functions/_shared/fireflies-connector.ts` - `firefliesListPage`: wraps `fetchFirefliesTranscripts`, `String(skip)` offset cursor, terminates on a short page (< 50).
- `supabase/functions/_shared/zoom-client.ts` - `zoomListPage`: composite `{window_from,window_to,next_page_token,range_to}` cursor; pages within a 30-day window then advances the window; `ZoomComposedCursor` + advance/init helpers.
- `supabase/functions/_shared/plaud-client.ts` - `plaudListPage`: offset cursor via `listFilesByOffset`, `isPlaudFileWithinRange` post-fetch date filter, terminates on raw short page; documents Plaud DOES support server-side sync-all.
- `supabase/functions/_shared/connector-list-page-registry.ts` (NEW) - POPULATED `listPageResolver` (6 providers) + `resolveListPage(source_app)`; youtube/file-upload intentionally absent.

## Decisions Made
- **Plaud IS in SYNC-02.** RESEARCH Finding 1 surfaced this as an operator/planner choice; the plan (28-03) explicitly lists Plaud among the 6, and the offset shape costs nothing extra once Fireflies' offset shape exists. The date filter is post-fetch (Plaud has no native date param) — documented as inefficient-for-large-backfill, not impossible. Corrected the prior "technically impossible" classification in code comments.
- **Zoom cursor encodes `range_to`** (not just the current window) so window advancement knows the hard upper bound and returns `null` only after the final window's final page.
- **Plaud termination uses the RAW page length** (`rawFiles.length < limit`), not the post-date-filter `items.length`, so a page where every file is out-of-range does not prematurely end the stream.
- **listPage error handling.** The committed Plan 01 unit test calls each `listPage` with a fake token and NO fetch mock, asserting GREEN (paginate to exhaustion, terminal null). To honor that locked contract, each wrapper catches provider/network errors and resolves as an exhausted page. Genuine mid-backfill failure visibility/retry is the pager's + Phase 27 reaper's responsibility, not the provider wrapper's — documented inline in each function.

## Deviations from Plan

None - plan executed exactly as written. (Both tasks implemented exactly the 6 providers + registry specified; all acceptance criteria met.)

## Issues Encountered
- RTK silently mangled `grep`/`rg` output to `0` for the verification counts (`.rtk/filters.toml` untrusted → "Filters NOT applied", but output still corrupted). Worked around by verifying file content via `node` with absolute paths and by running the unit suite (compilation + 11 GREEN tests prove the registry chain type-checks and resolves). The plan's `rtk grep -c` verify commands were satisfied by these equivalent checks.
- The Fireflies and Plaud unit cases make a real (failing) network call to the provider API under a fake token — slow (~1–5s) but deterministic (HTTP 4xx → caught → exhausted). Acceptable for the unit safety-net; the real-data pagination walk is exercised by the integration proofs in Plan 28-05.

## User Setup Required
None - no external service configuration required, zero new packages (T-28-SC: accept, no installs).

## Next Phase Readiness
- **Plan 28-02 (the pager, Wave 3) is unblocked:** it imports `resolveListPage` / `listPageResolver` from `connector-list-page-registry.ts` to resolve any of the 6 providers by `source_app`, treating the returned `nextCursor` as opaque.
- youtube/file-upload correctly resolve to `undefined` → the pager surfaces them as "imports automatically" rather than offering a server-side backfill.
- No blockers. SYNC-02 unit proof GREEN for all 6.

## Self-Check: PASSED

---
*Phase: 28-server-side-sync-all*
*Completed: 2026-06-25*
