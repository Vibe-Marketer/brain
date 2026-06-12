---
phase: 13-dispatcher-mechanical-safety
plan: 01
subsystem: database
tags: [supabase, migration, rls, autopilot, kill-switch, queue]

# Dependency graph
requires:
  - phase: 11-ticketing
    provides: live tickets/ticket_messages/ticket_events schema, has_role(), 11-05 author_type hardening
provides:
  - "LIVE tickets.priority/urgent (queue control) + attempts/next_attempt_at (claim backoff) columns"
  - "LIVE runner_state single-row table (status/current_ticket_id/heartbeat/last_result/kill_switch) with admin-only SELECT and kill_switch-only admin UPDATE"
  - "idx_tickets_claim_queue partial index serving the dispatcher claim query"
  - "scripts/qa/verify-autopilot-rls.ts — repeatable service-role RLS probe (5 checks)"
affects: [13-03, 13-04, 13-05, 13-06, 13-07, 14-approval-ops-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: ["BEFORE UPDATE SECURITY DEFINER guard trigger for column-level RLS (auth.uid() NULL = service-role passes)", "CHECK (id = 1) + seeded row for singleton tables", "verified-absence documented in-migration instead of redundant restrictive policy"]

key-files:
  created:
    - supabase/migrations/20260611200000_autopilot_queue_runner_state.sql
    - scripts/qa/verify-autopilot-rls.ts
  modified: []

key-decisions:
  - "Part B: no new tickets policy — verified live policy set has zero non-admin UPDATE paths; finding documented in the migration SQL"
  - "runner_state.current_ticket_id gets ON DELETE SET NULL so reporter-account cascades (tickets ON DELETE CASCADE from auth.users) are never blocked"
  - "kill_switch-only enforcement via guard trigger comparing OLD/NEW per column; updated_at exempt (owned by touch trigger)"
  - "Pushed with --include-all: filename 20260611200000 is plan-locked but sorts before three already-applied migrations"

patterns-established:
  - "Live schema probes via Supabase Management API query endpoint (no psql on machine)"
  - "RLS probe scripts live in scripts/qa/, follow verify-connectors-live.ts CheckResult shape, clean up every mutation"

requirements-completed: [AUTO-04]

# Metrics
duration: 14min
completed: 2026-06-11
---

# Phase 13 Plan 01: Autopilot Queue Schema + runner_state Summary

**Live-pushed migration adding tickets queue-control/backoff columns and the kill-switch runner_state singleton, with RLS proven by a 5-check service-role probe against the production database**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-06-11T16:00:12Z
- **Completed:** 2026-06-11T16:14:00Z
- **Tasks:** 3
- **Files modified:** 2 (+1 deferred-items log)

## Accomplishments

- `tickets` now carries `priority` (int, default 0), `urgent` (bool, default false), `attempts` (int, default 0), `next_attempt_at` (timestamptz) on the LIVE database — verified via information_schema read-back
- `idx_tickets_claim_queue` partial index (`urgent DESC, priority DESC, created_at ASC WHERE status='new'`) serves the dispatcher claim query
- `runner_state` exists live: singleton (`CHECK (id=1)` + seed), status state machine CHECK, FK to tickets with SET NULL, `kill_switch`, touch trigger, COMMENT ON every object
- RLS: admin-only SELECT/UPDATE policies on runner_state; `runner_state_kill_switch_guard` BEFORE UPDATE trigger rejects any authenticated change to columns other than kill_switch (service-role `auth.uid() IS NULL` passes — daemon heartbeat path)
- Part B verification (live policy read-back via pg_policies): tickets has exactly 3 policies, the only UPDATE path is `Admins can update tickets` — priority/urgent are already admin+service-role-only; documented in-migration instead of adding a redundant policy
- `scripts/qa/verify-autopilot-rls.ts`: 5/5 PASS against live — service-role heartbeat write, anon runner_state lockout (0 rows SELECT, 0-row UPDATE), anon priority/urgent UPDATE blocked, agent-message spoof still blocked post-migration (11-05 re-proof), singleton check

## Live Probe Results (one-liners)

- `supabase migration list --linked` → `20260611200000 | 20260611200000` (applied both sides)
- information_schema.columns → all 4 new tickets columns present with correct types/defaults/nullability
- runner_state → table_exists=1, row_count=1, row_id=1, kill_switch=false
- pg_policies → 2 runner_state policies (SELECT/UPDATE admin) + 3 tickets policies (no non-admin UPDATE)
- pg_trigger/pg_indexes → runner_state_kill_switch_guard, runner_state_updated_at, idx_tickets_claim_queue all live
- `npx tsx scripts/qa/verify-autopilot-rls.ts` → "5 passed, 0 failed, 0 skipped", exit 0

## Task Commits

1. **Task 1: Migration** — `4eb5f428` feat(13-01): add autopilot queue columns + runner_state table migration
2. **Task 2: Push** — no repo diff (live-DB operation; applied + verified above)
3. **Task 3: RLS probe** — `347c9655` feat(13-01): add service-role RLS probe for autopilot surface

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan-locked migration filename sorts before already-applied versions**
- **Found during:** Task 2
- **Issue:** Remote history already contained 20260612000001/020000/120000 (parallel phases); plain `supabase db push` refuses out-of-order files
- **Fix:** Pushed with `--include-all` (standard remedy; no history repair, no foreign versions touched). Pre/post `migration list` confirmed sync
- **Commit:** n/a (CLI invocation)

**2. [Rule 2 - Missing critical] current_ticket_id FK action**
- **Found during:** Task 1
- **Issue:** Plan specified bare `REFERENCES public.tickets(id)`; default NO ACTION would block ticket cascades (tickets cascade-delete when a reporter's auth.users row is deleted)
- **Fix:** `ON DELETE SET NULL`, documented in COMMENT ON
- **Commit:** `4eb5f428`

### Noted (not code deviations)

- **Env file:** plan said the probe "reads .env.local like its analog" — the analog uses `dotenv/config`, which reads `.env` (the file that actually exists here, holding the keys). Script matches the analog exactly.
- **Types regen:** orchestrator scope included types regen; parallel executor 12-01 (`71e52f74`) committed a live regen mid-flight that already contains runner_state + all 4 new columns (verified by grep on HEAD). My own regen differed only by a CLI-version artifact, so it was discarded to avoid churn.
- **Push coordination:** parallel migration `20260612130000` appeared remotely mid-flight; left untouched per coordination rules.

## Gates

- **Vitest:** 1784 pass / 0 fail (93 skipped) on my tree; re-run on committed tree: 1790 pass / **1 fail** — the single failure is `rpc-type-smoke`, un-skipped by a mid-flight `.env.test` created by a parallel actor (mtime 12:09:16, between my runs) pointing at a test project missing the 20260524 helper migration. Not caused by 13-01 files; logged in `deferred-items.md` with full diagnosis (incl. 28 pre-existing offender rows on prod's checker spanning phases 06–12).
- **Build:** `npm run build` exit 0 on the committed tree.

## Threat Flags

None — all new surface (priority/urgent UPDATE path, runner_state read/write, agent-message spoof) is covered by the plan's threat register T-13-01/02/03/04 and proven by the probe.

## Known Stubs

None — no UI code in this plan; all schema is wired and live.

## Next Phase Readiness

- 13-02's daemon libs (claim.ts/db.ts) now have their live schema contract: claims, backoff, heartbeat, kill_switch all exist and are RLS-proven
- Phase 14 can read runner_state and priority/urgent via the existing admin session (SELECT policy live)
- One-shot live claim (13-06/13-07) is unblocked

## Self-Check: PASSED

Both created files on disk; both task commits (4eb5f428, 347c9655) in history; migration applied remotely (migration list read-back); probe 5/5 exit 0.
