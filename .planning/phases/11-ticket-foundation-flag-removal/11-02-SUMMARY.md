---
phase: 11-ticket-foundation-flag-removal
plan: 02
subsystem: backend
tags: [tickets, supabase, migration, rls, audit-trigger, edge-function, tdd]

# Dependency graph
requires:
  - phase: 11-ticket-foundation-flag-removal
    plan: 01
    provides: "feature_flags dropped; types baseline without feature_flags"
provides:
  - tickets/ticket_messages/ticket_events tables live with RLS + 4 enums (8-value status lifecycle)
  - log_ticket_status_change SECURITY DEFINER trigger — every status UPDATE writes a ticket_events row (TKT-04)
  - send-support-ticket pivoted DB-first; Resend email demoted to side-effect; response includes ticketId (TKT-01)
  - src/types/supabase.ts regenerated with ticket tables
  - RLS regression coverage for the three ticket tables; tickets-audit integration test
  - Morning-session parallel ticket stack fully displaced; salvage in legacy-salvage/
affects: [11-03, 11-04, 12-sentry, 14-approvals, 15-attachments]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Management API SQL apply + `supabase migration repair --status applied` when db push is blocked by foreign history rows"
    - "SECURITY DEFINER SET search_path = public audit trigger writing into an RLS table with no authenticated INSERT policy"

key-files:
  created:
    - supabase/migrations/20260611000002_create_ticket_tables.sql
    - src/test/tickets-audit.integration.test.ts
    - .planning/phases/11-ticket-foundation-flag-removal/legacy-salvage/ (manifest + exports + function sources)
  modified:
    - src/types/supabase.ts
    - src/test/rls-regression.test.ts
    - supabase/functions/send-support-ticket/index.ts

key-decisions:
  - "Full displacement of the morning session's parallel ticket stack (support_tickets/ticket_events legacy schema, 5 remote-only functions, 1 cron job) — Andrew approved at checkpoint; everything salvaged first"
  - "Migration applied via Management API + history repair instead of db push (5 remote-only history rows from the morning session left untouched)"
  - "Body-supplied userId kept only as legacyBodyUserId inside context JSONB — reporter_id exclusively from the JWT (T-11-04)"

# Metrics
duration: ~35min (resumed agent; Task 1 in prior session)
completed: 2026-06-11
---

# Phase 11 Plan 02: Ticket Foundation (DB-backed tickets + audit trail) Summary

**One-liner:** Tickets are now first-class DB records — three RLS-protected tables with an 8-state lifecycle enum and a SECURITY DEFINER status-audit trigger, with the support form's Edge Function pivoted to insert-first/email-second — after salvaging and displacing a conflicting parallel ticket stack a morning session had deployed straight to prod.

## What was built

### Displacement of the morning-session stack (pre-Task-2, Andrew-approved)

A parallel session on 2026-06-10 (~11:01 EDT) had deployed a conflicting "admin center" stack directly to prod, bypassing the repo. Before Task 2 could apply the planned schema, that stack was salvaged and removed:

**Salvage** (committed first, `chore(11-02)` 5c39bb4c) — everything lives in
`.planning/phases/11-ticket-foundation-flag-removal/legacy-salvage/`:
- `support_tickets.json` / `ticket_events.json` — full exports (2 rows each, all synthetic verify-bot data)
- `legacy_schema.json` — 27-column information_schema dump of both legacy tables
- `cron.json` — full cron.job export (5 jobs at salvage time)
- `functions/{autonomous-resolver,update-ticket-status,write-audit-log,admin-manage-user,daily-digest}/` — full source of the 5 remote-only functions (verified absent from the repo AND created 2026-06-10 11:01 EDT before deletion)
- `functions/send-support-ticket/` — the remote body as redeployed by the morning session (function pre-existed from 2026-06-01; NOT deleted — Task 3 redeployed from repo source)
- `functions/_shared-remote/` — the _shared modules bundled in those deployments

**Displacement** (verified):
- `cron.unschedule('support-ticket-stale-claim-sweep')` → 4 jobs remain, none reference support_tickets
- DELETE via Management API: all 5 slugs → HTTP 200; functions list 80 → 75, deleted slugs absent
- `DROP TABLE ... CASCADE` on support_tickets + legacy ticket_events → `to_regclass` null for both

### Task 2 — Schema (GREEN)

`20260611000002_create_ticket_tables.sql` applied to prod via Management API (HTTP 201), history repaired with `supabase migration repair --status applied 20260611000002 --linked`. The 5 remote-only history rows from the morning session were left untouched per instruction.

- 4 enums: ticket_status (8 locked values), ticket_type, ticket_severity (default medium), ticket_source (manual|sentry)
- tickets / ticket_messages / ticket_events with the locked column shapes, fingerprint partial-unique index (Phase 12), attachments JSONB (Phase 15)
- RLS enabled on all three; policy counts verified live: tickets 3, ticket_messages 2, ticket_events 1 (SELECT only — no authenticated INSERT, append-only)
- `log_ticket_status_change` verified live: `prosecdef=true`, `proconfig=[search_path=public]`
- Live smoke: invalid enum INSERT rejected with 22P02 (ISC-7); status new→triaged wrote exactly one `status_change` event with old/new values and null actor under service context (ISC-8); smoke rows deleted after
- Types regenerated via `supabase gen types typescript --linked`: ticket tables present, feature_flags absent; build exit 0

### Task 3 — Edge Function pivot

`send-support-ticket` rewritten DB-first and deployed `--use-api`:
- INSERT tickets → first ticket_messages row (author_type user) → ticket_events 'created' row, all before any Resend call; any insert failure returns 500
- reporter_id sourced exclusively from `authenticateRequest` userId; body userId stored only as `legacyBodyUserId` in context (T-11-04)
- Resend in its own try/catch; missing RESEND_API_KEY or send failure logs and still returns success (email is a side-effect — locked decision)
- Schema extended with type/severity closed enums (defaults bug/medium) for plan 11-04 reuse
- Live authenticated probe returned `{"success":true,"ticketId":"bd0d82df-..."}`; DB showed ticket + 1 message + 1 created event with reporter set; probe ticket deleted afterward (note: the probe likely sent one "[11-02 verification probe]" email to support@callvaultai.com — safe to ignore)

## Deviations from Plan

### Approved at checkpoint

**1. [Checkpoint decision] Full displacement of the morning-session parallel stack**
- **Found during:** Task 2 (prior executor's blocked `db push`)
- **Issue:** Remote prod held a conflicting support_tickets/ticket_events schema, 5 remote-only Edge Functions, a cron sweep job, and 5 foreign migration-history rows
- **Resolution:** Andrew approved full displacement with salvage-first; executed as STEP A/B above
- **Commits:** 5c39bb4c (salvage)

### Auto-fixed Issues

**2. [Rule 3 - Blocking] Migration applied via Management API instead of `supabase db push`**
- **Found during:** Task 2
- **Issue:** db push blocked by the morning session's 5 remote-only history rows (left untouched per instruction)
- **Fix:** SQL applied via Management API `database/query` (HTTP 201) + `migration repair --status applied 20260611000002 --linked`; `migration list` confirms both sides aligned

**3. [Rule 2 - Missing critical] Salvaged the morning session's redeployed send-support-ticket body**
- **Found during:** STEP A
- **Issue:** Remote function metadata showed send-support-ticket was UPDATED at the same instant the 5 morning functions were created — the morning session had overwritten the deployed copy
- **Fix:** Remote body downloaded into legacy-salvage/functions/send-support-ticket/ before Task 3 redeployed from repo source

## Verification

- `to_regclass` null for support_tickets + legacy ticket_events; deleted slugs absent from functions list (80→75); stale-claim-sweep cron gone
- information_schema lists tickets, ticket_messages, ticket_events (ISC-1/2/3)
- ISC-7: enum INSERT rejected (22P02). ISC-8: status UPDATE wrote one status_change event — both verified against the live DB
- `npm test` exit 0; `npm run build` exit 0 (on committed tree)
- `npx vitest run src/test/rls-regression.test.ts` — clean skip (44 skipped, 0 failed; no .env.test on this machine — CI rls-regression job covers with secrets)
- Deployed function probe: `{ success: true, ticketId }` with all three rows written

## Known Stubs

None — no placeholder data paths introduced. Integration assertions (ISC-4/5 cross-user JWT probes) run env-gated in CI; equivalent enum/trigger behaviors were verified live via Management API.

## Heads-up for 11-03

- The AdminTab tickets surface can build on live tables immediately; `tickets` count is currently 0 (all smoke/probe rows cleaned)
- Migration history still contains 5 remote-only rows from the morning session (20260610131220, 20260610150000, 20260610150100, +2) — `supabase db push` will keep complaining until those are repaired/reverted; use Management API + repair, or clean the history rows in a deliberate step
- A "[11-02 verification probe]" email may be sitting in support@callvaultai.com — ignorable

## Self-Check: PASSED

All claimed files exist on disk; commits 8b10f4aa, 5c39bb4c, 686806dd, 7f961422 verified in git log.

## Post-completion: history reconciliation

**Date:** 2026-06-11

The 5 remote-only migration-history rows from the morning session (flagged in "Heads-up for 11-03") were repaired as `reverted`, restoring `supabase db push`:

| Version | Name |
|---------|------|
| 20260610072723 | admin_center_foundation |
| 20260610074308 | support_attachments |
| 20260610131220 | autonomous_resolver_cron |
| 20260610150000 | admin_center_v2 |
| 20260610150100 | repair_resolver_cron |

**Pre-repair verification** (Management API): `to_regclass` null for `support_tickets`, `support_attachments`, `ticket_attachments`, `audit_log`; 0 cron jobs referencing resolver/ticket sweeps; 0 admin-center/resolver/audit-log functions in `pg_proc` — the stack those rows recorded was already fully displaced (see Displacement record above).

**Method:** `supabase migration repair --status reverted <version> --linked` for each of the 5 versions. History-table status rows only — no schema, files, or functions touched. Live rows 20260611000001/20260611000002 left untouched.

**Post-repair verification:** `supabase migration list --linked` shows local and remote fully aligned (last entries 20260610121000, 20260611000001, 20260611000002 on both sides); `supabase db push --dry-run` exits 0 with "Remote database is up to date."
