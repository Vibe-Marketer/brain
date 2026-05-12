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

## Benchmark result (live prod DB over WAN, 2026-05-12, fresh seed)

```
n=100  p50=75.3ms  p95=154.1ms  p99=522.2ms
```

**PASS:** p95 = 154ms is 46ms under the 200ms target. Roughly 10-45x faster
than the 1-7s baseline (Fathom API). FEAT-01 success criterion #1 MET.

An earlier same-day run captured 273ms due to partial-seed contamination
from an interrupted previous run. After `scripts/cleanup-phase39-bench-seed.ts`
removed the leftover rows, the fresh run produced the 154ms result above.

## Audit result

Frontend (`src/`): ZERO Fathom-API references — `useGlobalSearch.ts` reads
the `recordings` mirror table.

Backend (`supabase/functions/`): ZERO Fathom-API references outside the 9
legitimate edge functions (OAuth, sync, fetch, webhook, reconcile). NONE are
search-path functions.

**Phase 39 mirror cutover for search: CONFIRMED COMPLETE.**
