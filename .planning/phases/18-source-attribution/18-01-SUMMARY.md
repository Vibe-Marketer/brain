---
phase: 18-source-attribution
plan: 01
subsystem: database
tags: [supabase, postgres, ticket_source, rpc, generated-types]

requires:
  - phase: 12-sentry-ticket-ingestion
    provides: tickets table, ticket_source enum, ticket_events lifecycle audit, sentry source stamping
provides:
  - append-only ticket_source enum values unknown, nightly_qa, and internal
  - conservative live backfill for explicit nightly QA and watchdog markers
  - admin-guarded ticket_source_metrics RPC for source volume, fix rate, and cycle time
  - regenerated Supabase TypeScript contract from the linked database
affects: [phase-18, phase-20, phase-23, admin-dashboard, tickets]

tech-stack:
  added: []
  patterns:
    - isolated Postgres enum extension migration before value usage
    - SECURITY DEFINER RPC with pinned search_path and internal ADMIN guard
    - linked Supabase type generation after live schema push

key-files:
  created:
    - supabase/migrations/20260613180000_extend_ticket_source_enum.sql
    - supabase/migrations/20260613180500_source_attribution_backfill_metrics.sql
  modified:
    - src/types/supabase.ts

key-decisions:
  - "Legacy person-reported manual rows remain manual; only explicit qa-nightly-crawler and autopilot-watchdog markers were reclassified."
  - "Unattributed null-reporter manual rows are the only fallback rows rewritten to unknown."
  - "ticket_source_metrics is callable by authenticated clients but rejects non-admin callers inside the SECURITY DEFINER function."

patterns-established:
  - "Add enum values in a standalone committed migration before later migrations use them."
  - "Compute source cycle time from first resolved status-change event, not tickets.updated_at."

requirements-completed: [SRC-01, SRC-03]

duration: 39min
completed: 2026-06-13
---

# Phase 18 Plan 01: Source Attribution Schema Summary

**Live source attribution schema with append-only enum values, conservative operational backfill, guarded source metrics RPC, and generated TypeScript types.**

## Performance

- **Duration:** 39 min
- **Started:** 2026-06-13T17:39:37Z
- **Completed:** 2026-06-13T18:18:00Z
- **Tasks:** 4 completed
- **Files modified:** 3

## Accomplishments

- Added `unknown`, `nightly_qa`, and `internal` to `public.ticket_source` in an isolated committed migration before any later migration referenced those values.
- Sampled the linked database before backfill and used only confirmed markers: `context->>'userAgent' = 'qa-nightly-crawler'` and `context->>'origin' = 'autopilot-watchdog'`.
- Added `public.ticket_source_metrics()` with `SECURITY DEFINER`, `SET search_path = public, pg_temp`, an internal `public.has_role(auth.uid(), 'ADMIN')` guard, PUBLIC/anon revoke, and authenticated execute grant.
- Pushed both migrations to the linked Supabase project and regenerated `src/types/supabase.ts` from the live schema.

## Task Commits

1. **Task 1: Add ticket_source enum values in an isolated migration** - `d2f4207c` (`feat(18): extend ticket source enum`)
2. **Task 2: Sample legacy manual tickets before backfill** - no file commit; live read-only evidence gathered before Task 3
3. **Task 3: Add targeted backfill and admin-guarded source metrics RPC** - `0348175b` (`feat(18): add ticket source metrics migration`)
4. **Task 4: Push schema, regenerate types, and prove live enum values** - `d19a3d74` (`chore(18): regenerate source attribution types`)

## Files Created/Modified

- `supabase/migrations/20260613180000_extend_ticket_source_enum.sql` - Append-only enum extension for `unknown`, `nightly_qa`, and `internal`.
- `supabase/migrations/20260613180500_source_attribution_backfill_metrics.sql` - Conservative source backfill, `(source, created_at DESC)` index, and admin-only source metrics RPC.
- `src/types/supabase.ts` - Generated type contract including the new enum values and `ticket_source_metrics` RPC return shape.

## Verification

- `grep -v '^--' supabase/migrations/20260613180000_extend_ticket_source_enum.sql | grep -E "ADD VALUE IF NOT EXISTS '(unknown|nightly_qa|internal)'"` passed.
- `test "$(grep -v '^--' supabase/migrations/20260613180000_extend_ticket_source_enum.sql | grep -Eci '\b(UPDATE|INSERT|CREATE FUNCTION|DEFAULT|INDEX)\b')" = "0"` passed.
- Linked DB sample confirmed 42 `qa-nightly-crawler` manual rows, 7 `autopilot-watchdog` manual rows, and no sampled null-reporter manual rows.
- All Task 3 static SQL checks passed for RPC name, cycle-time column, explicit predicates, `SECURITY DEFINER`, pinned search path, admin guard, revoke/grant, no service-role-only grant, no `in_app_user`, and manual-source predicates.
- `supabase db push --linked --include-all --yes` exited zero and applied both migrations.
- `supabase gen types typescript --linked --schema public > src/types/supabase.ts` exited zero.
- Live enum query returned `manual`, `sentry`, `unknown`, `nightly_qa`, and `internal` in order.
- Generated type grep found both the enum union and constants array with all five values.
- `npm run type-check` passed with 0 new errors; existing baseline remains 347/776.
- Live source distribution after backfill: 42 `nightly_qa`, 7 `internal`, 24 `manual`.
- Live RPC metadata check confirmed `ticket_source_metrics` is `SECURITY DEFINER` with `search_path=public, pg_temp`.

## Decisions Made

- Kept `manual` as the person-reported source for reporter-owned tickets unless an explicit operational marker proves otherwise.
- Used only `qa-nightly-crawler` for nightly QA reclassification in this plan; broader `don-*` operational labels remain unchanged for later intentional taxonomy decisions.
- Used a PL/pgSQL RPC so the internal admin guard can run before returning aggregate data to authenticated browser callers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected the live sampling query for actual schema columns**
- **Found during:** Task 2
- **Issue:** The plan's first read-only sample query selected `title`, but live `public.tickets` has no `title` column.
- **Fix:** Queried `information_schema.columns`, then sampled `tickets` plus the first `ticket_messages.body` through a lateral join to inspect message text without mutating data.
- **Files modified:** None
- **Verification:** Corrected linked DB sample query exited zero and returned recent manual rows with context and message bodies.
- **Committed in:** Not applicable; read-only query correction.

**Total deviations:** 1 auto-fixed (1 blocking query correction)
**Impact on plan:** No behavior or schema scope changed. The correction preserved the required live preflight before backfill.

## Issues Encountered

- Supabase CLI emitted an update notice for v2.106.0 while v2.101.0 is installed. This did not block schema push, query, or type generation.

## Known Stubs

None in files created or intentionally modified by this plan. The generated `src/types/supabase.ts` contains an existing `placeholder_for_type` RPC type emitted from the live schema, unrelated to this plan.

## Threat Flags

None beyond the plan threat model. The new browser-callable RPC was planned and is protected with an internal admin guard plus revoked PUBLIC/anon execute.

## User Setup Required

None.

## Next Phase Readiness

Phase 18 intake and UI plans can now import/use `unknown`, `nightly_qa`, and `internal` from generated types. The live database already accepts the new values, has the source metrics RPC contract, and preserves person-reported manual history.

## Self-Check: PASSED

- Found created migrations and modified generated type file.
- Found task commits: `d2f4207c`, `0348175b`, and `d19a3d74`.
- Confirmed no tracked file deletions in the latest task commit.

---
*Phase: 18-source-attribution*
*Completed: 2026-06-13*
