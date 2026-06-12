# Legacy Salvage — Morning-Session Admin-Center Stack (2026-06-10)

Salvaged before displacement, per Andrew's approval on the plan 11-02 checkpoint
decision (full displacement of the morning session's parallel ticket stack).

The morning session of 2026-06-10 (~11:01 EDT) deployed a parallel ticket/admin
stack directly to prod (project `vltmrnjsubfzrgrtdqey`) that conflicts with the
Phase 11 planned schema (`tickets` / `ticket_messages` / `ticket_events`).
Everything below was exported BEFORE deletion.

## Contents

| File | What it is |
|------|------------|
| `support_tickets.json` | Full export of `public.support_tickets` (2 rows, both synthetic verify-bot rows) |
| `ticket_events.json` | Full export of legacy `public.ticket_events` (2 rows — morning schema, differs from Phase 11 schema) |
| `legacy_schema.json` | `information_schema.columns` dump for both legacy tables (27 columns) |
| `cron.json` | Full `cron.job` export at salvage time (5 jobs; only jobid 6 `support-ticket-stale-claim-sweep` referenced support_tickets) |
| `functions/autonomous-resolver/` | Remote-only Edge Function source (created 2026-06-10 11:01 EDT) — DELETED |
| `functions/update-ticket-status/` | Remote-only Edge Function source (created 2026-06-10 11:01 EDT) — DELETED |
| `functions/write-audit-log/` | Remote-only Edge Function source (created 2026-06-10 11:01 EDT) — DELETED |
| `functions/admin-manage-user/` | Remote-only Edge Function source (created 2026-06-10 11:01 EDT) — DELETED |
| `functions/daily-digest/` | Remote-only Edge Function source (created 2026-06-10 11:01 EDT) — DELETED |
| `functions/send-support-ticket/` | Remote body as deployed by the morning session (function itself pre-existed, created 2026-06-01; updated 2026-06-10 11:01) — NOT deleted; redeployed from repo source in Task 3 |
| `functions/_shared-remote/` | `_shared` modules bundled into the remote deployments (auth.ts, cors.ts, html-escape.ts) |

## Displacement record

- `cron.unschedule('support-ticket-stale-claim-sweep')` — jobid 6, the only cron row referencing support_tickets
- DELETE via Management API: autonomous-resolver, update-ticket-status, write-audit-log, admin-manage-user, daily-digest
- `DROP TABLE IF EXISTS public.support_tickets CASCADE; DROP TABLE IF EXISTS public.ticket_events CASCADE;`

Verification of each function as morning-only before deletion:
absent from `supabase/functions/` in the repo AND `created_at` == 2026-06-10 11:01 EDT
(epoch ms 1781103714139–1781103719297).
