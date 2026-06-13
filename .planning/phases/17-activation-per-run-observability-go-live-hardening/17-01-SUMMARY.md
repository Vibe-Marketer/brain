---
phase: 17-activation-per-run-observability-go-live-hardening
plan: 01
subsystem: database, infra
tags: [supabase, postgres, rls, autopilot, runner_runs, bun]

requires:
  - phase: 13-16-autopilot-foundation
    provides: DB-backed tickets, runner_state, approval path, daemon evidence bundle
provides:
  - Live public.runner_runs table with ACT-04 columns, admin-only RLS, ticket FK, and run lookup indexes
  - Regenerated Supabase types proving the live schema shape after db push
  - Autopilot daemon emission into runner_runs on start and terminal/update paths
  - Shared JSONL and DB run-ledger field serialization
affects: [phase-17-admin-run-observability, phase-19-throughput-trust, AdminTab, autopilot]

tech-stack:
  added: []
  patterns:
    - Additive Supabase migration that creates or extends existing live table without dropping old columns
    - Best-effort service-role run-ledger writes that log failures without bypassing gates
    - Shared JSONL/DB run-ledger field builder with derived duration_sec

key-files:
  created:
    - supabase/migrations/20260613090000_create_or_extend_runner_runs.sql
    - .planning/phases/17-activation-per-run-observability-go-live-hardening/17-01-SUMMARY.md
  modified:
    - src/types/supabase.ts
    - ~/dev/autopilot/src/runner.ts
    - ~/dev/autopilot/src/lib/db.ts
    - ~/dev/autopilot/src/lib/evidence.ts
    - ~/dev/autopilot/src/lib/evidence.test.ts

key-decisions:
  - "Used an additive create-or-extend migration because the live project already had a narrow runner_runs table but no matching repo migration."
  - "Used service-role-only writes by defining no authenticated runner_runs INSERT/UPDATE/DELETE policies; admin browser reads use the single ADMIN SELECT policy."
  - "Kept ledger writes best-effort: failures are logged and reflected in runner_state last_result, but never alter gate, requeue, escalation, or awaiting_approval behavior."

patterns-established:
  - "runner_runs rows mirror JSONL run fields: status, outcome, gate verdict/stage, tests, diff, duration, branch, fix SHA, and detail JSON."
  - "The daemon inserts runner_runs at run start and updates the same row as each known outcome is reached."

requirements-completed: []

duration: 6min
completed: 2026-06-13
---

# Phase 17 Plan 01: Run Ledger Schema and Emission Summary

**DB-backed autopilot run ledger with live Supabase schema proof and daemon emission into `runner_runs`.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-06-13T14:00:31Z
- **Completed:** 2026-06-13T14:06:43Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Created and pushed an additive `runner_runs` migration that preserves the existing live table while adding ACT-04 fields.
- Regenerated `src/types/supabase.ts` after the live push and confirmed live `information_schema` contains `ticket_id`, `duration_sec`, `est_cost`, and `gate_verdict`.
- Added daemon run-ledger emission with shared JSONL/DB fields and tests for pass, gate-failed, requeued, and failed outcomes.
- Supports ACT-01 and ACT-04, but does not mark either requirement complete because ACT-01 live activation is planned later and ACT-04 AdminTab visibility lands in 17-02.

## Task Commits

1. **Task 1: Create runner_runs migration** - `f1f7acc6` (`feat(17-01): add runner runs ledger migration`)
2. **Task 2: Push schema and regenerate types** - `8f512d3d` (`chore(17-01): regenerate runner run schema types`)
3. **Task 3 RED: Ledger serialization coverage** - `edcc445` in `~/dev/autopilot` (`test(17-01): add runner ledger serialization coverage`)
4. **Task 3 GREEN: Daemon ledger emission** - `2daf6c7` in `~/dev/autopilot` (`feat(17-01): emit runner run ledger rows`)

## Files Created/Modified

- `supabase/migrations/20260613090000_create_or_extend_runner_runs.sql` - creates/extends `runner_runs`, adds FK/indexes/RLS/comments.
- `src/types/supabase.ts` - regenerated after the live schema push.
- `~/dev/autopilot/src/lib/evidence.ts` - adds shared run-ledger field types and duration derivation.
- `~/dev/autopilot/src/lib/db.ts` - adds service-role `runner_runs` insert/update helpers.
- `~/dev/autopilot/src/runner.ts` - inserts at run start and updates the ledger on known outcome and exception paths.
- `~/dev/autopilot/src/lib/evidence.test.ts` - covers pass, gate-failed, requeued, failed, and duration serialization.

## Verification

- `supabase db push --linked --include-all --yes` exited 0; final rerun reported `Remote database is up to date`.
- `supabase gen types typescript --linked --schema public > src/types/supabase.ts` exited 0.
- `supabase db query --linked "select column_name ... runner_runs ..."` confirmed `ticket_id`, `duration_sec`, `est_cost`, and `gate_verdict`.
- `cd ~/dev/autopilot && bun test src/lib/evidence.test.ts && bun run typecheck` exited 0: 10 tests passed, 90 assertions, then `tsc --noEmit`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced local diff proof with live linked schema proof**
- **Found during:** Task 1
- **Issue:** `supabase db diff --local --schema public` failed because the Supabase CLI requires Docker for a local shadow database, while this repo's instructions state Docker is not available.
- **Fix:** Used the authorized live `supabase db push --linked --include-all --yes`, regenerated linked types, and queried linked `information_schema` as the schema proof.
- **Files modified:** none beyond planned files
- **Verification:** Live push exited 0 and linked schema query returned the ACT-04 columns.
- **Committed in:** `f1f7acc6`, `8f512d3d`

**2. [Rule 1 - Bug] Tightened RED test after permissive JSON serialization passed unexpectedly**
- **Found during:** Task 3 RED
- **Issue:** The first RED test only proved `JSON.stringify` preserved extra object keys, so it passed before implementation.
- **Fix:** Required a new `buildRunLedgerFields` helper and reran RED; it failed with missing export before GREEN.
- **Files modified:** `~/dev/autopilot/src/lib/evidence.test.ts`
- **Verification:** RED failed with `Export named 'buildRunLedgerFields' not found`; GREEN then passed focused tests and typecheck.
- **Committed in:** `edcc445`, `2daf6c7`

**3. [Rule 1 - Bug] Avoided false requirement completion**
- **Found during:** Final bookkeeping
- **Issue:** The generic `requirements.mark-complete ACT-01 ACT-04` handler marked both requirements complete from plan frontmatter, but this plan only ships the DB/daemon substrate. ACT-01 live activation and ACT-04 AdminTab visibility are not complete yet.
- **Fix:** Reverted those requirement status changes and recorded this plan as supporting substrate only.
- **Files modified:** `.planning/REQUIREMENTS.md`, this summary
- **Verification:** Requirements traceability remains pending for ACT-01 and ACT-04; ROADMAP still shows Phase 17 at 1/5 plans.
- **Committed in:** final metadata commit

**Total deviations:** 3 auto-fixed.
**Impact on plan:** No scope expansion; both deviations were needed to satisfy repo constraints and TDD correctness.

## Issues Encountered

- `supabase db query` without `--linked` targeted local Postgres and failed; reran with `--linked` and the schema proof passed.
- The live table already existed with the older narrow shape. The migration preserved existing columns, including `tickets_processed`, while adding ACT-04 columns.

## Known Stubs

None.

## Threat Flags

None beyond the plan threat model. The new DB surface is the planned `runner_runs` service-role write/admin-read boundary.

## User Setup Required

None. `SUPABASE_ACCESS_TOKEN` was already exported and the project was linked.

## Next Phase Readiness

Plan 17-02 can build AdminTab visibility against a real `runner_runs` table and regenerated types. The daemon now writes the substrate needed by the UI, while preserving Phase 17's human approval and concurrency-1 invariants.

## Self-Check: PASSED

- Found brain files: migration, regenerated types, and this summary.
- Found autopilot files: `src/runner.ts`, `src/lib/db.ts`, `src/lib/evidence.ts`, and `src/lib/evidence.test.ts`.
- Found task commits: `f1f7acc6`, `8f512d3d`, `edcc445`, and `2daf6c7`.

---
*Phase: 17-activation-per-run-observability-go-live-hardening*
*Completed: 2026-06-13*
