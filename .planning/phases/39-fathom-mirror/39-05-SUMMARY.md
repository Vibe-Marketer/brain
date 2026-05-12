# Plan 39-05 Summary — p95 Benchmark + Fathom-API Audit

**Status:** COMPLETE (code, audit, benchmark run)
**Date:** 2026-05-12

## Deliverables

- `src/hooks/__tests__/useGlobalSearch.p95.integration.test.ts`
  - Real-DB benchmark: seeds 5000 fathom-source `recordings`, runs 100
    keyword searches matching `useGlobalSearch.ts` query shape exactly,
    measures p50/p95/p99, asserts `p95 < 200ms`.
- `.planning/phases/39-fathom-mirror/39-BENCHMARK.md`
  - Full benchmark result + Fathom-API search-path audit + manual
    verification checklist + Phase 39 acceptance matrix.

## Benchmark result (live prod DB over WAN, 2026-05-12)

```
n=100  p50=197.1ms  p95=273.4ms  p99=843.7ms
```

**GAP:** p95 is 273ms vs 200ms target (+73ms over). ~25x faster than the
baseline 1-7s Fathom-API range, but misses the literal success criterion.
Operator decision in 39-BENCHMARK.md (Options A/B/C).

## Audit result

Frontend (`src/`): ZERO Fathom-API references — `useGlobalSearch.ts` reads
the `recordings` mirror table.

Backend (`supabase/functions/`): ZERO Fathom-API references outside the 9
legitimate edge functions (OAuth, sync, fetch, webhook, reconcile). NONE are
search-path functions.

**Phase 39 mirror cutover for search: CONFIRMED COMPLETE.**
