---
phase: 12-sentry-ingestion
plan: 01
subsystem: database
tags: [supabase, migration, sentry, dedup, security-definer, rpc]
requires: []
provides:
  - "tickets.reporter_id nullable (NULL = system/telemetry reporter)"
  - "tickets.occurrence_count + tickets.last_seen_at dedup columns"
  - "public.ingest_sentry_ticket atomic SECURITY DEFINER RPC (service-role only)"
  - "regenerated src/types/supabase.ts with new columns + RPC"
affects: [12-02, 12-03, tickets-schema]
tech-stack:
  added: []
  patterns:
    - "ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL against partial unique index for race-safe dedup"
    - "SECURITY DEFINER SET search_path = public + REVOKE from PUBLIC/anon/authenticated for service-role-only RPCs"
key-files:
  created:
    - supabase/migrations/20260612130000_sentry_ticket_ingestion.sql
  modified:
    - src/types/supabase.ts
decisions:
  - "Migration timestamp bumped from planned 20260612000001 to 20260612130000 — planned timestamp already taken by create_ticket_attachments_bucket.sql (and 20260612120000_create_admin_audit_log.sql also existed); plan explicitly authorized the bump"
  - "Added explicit GRANT EXECUTE TO service_role after the REVOKE — default PUBLIC grant is revoked, so the service-role path needs its own grant"
  - "Dedup-hit 'occurrence' ticket_events row implemented (CONTEXT.md lean-yes discretion)"
  - "Live probe used severity 'low' to avoid spamming real ADMIN users with notifications in prod"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-11"
---

# Phase 12 Plan 01: Sentry Ticket Ingestion Schema Summary

Race-safe Sentry ticket dedup shipped to the live DB: nullable reporter_id + occurrence columns + atomic `ingest_sentry_ticket` SECURITY DEFINER RPC (ON CONFLICT on the fingerprint partial unique index, 'created'/'occurrence' audit events, per-ADMIN notification fan-out on new critical/high tickets, EXECUTE revoked from anon/authenticated).

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write sentry_ticket_ingestion migration | f7f9a0e7 | supabase/migrations/20260612130000_sentry_ticket_ingestion.sql |
| 2 | [BLOCKING] Push schema to live DB + regen types | 71e52f74 | src/types/supabase.ts |

## Verification Evidence

**Push:** `supabase migration list --linked` showed remote fully in sync before push (no sibling push mid-flight); `supabase db push --linked` applied `20260612130000_sentry_ticket_ingestion.sql`, exit 0.

**Live RPC dedup probe (SEN-02, against prod via service role):**
- Call 1: `{"ticket_id":"eb4a37c9-...","occurrence_count":1,"created":true}`
- Call 2 (same fingerprint): `{"ticket_id":"eb4a37c9-...","occurrence_count":2,"created":false}` — same ticket_id, one row
- Ticket row: `reporter_id: null`, `source: "sentry"`, `occurrence_count: 2`, `last_seen_at` advanced
- ticket_events: exactly one `created` event + one `occurrence` event (actor_id null)
- user_notifications referencing probe ticket: `[]` (severity 'low' — fan-out correctly gated)
- Anon-key RPC attempt: `42501 permission denied for function ingest_sentry_ticket` (REVOKE verified, T-12-03)
- Cleanup: probe ticket deleted; tickets and ticket_events both return `[]` for the probe id

**Types:** `src/types/supabase.ts` carries `reporter_id: string | null`, `occurrence_count: number`, `last_seen_at`, and `ingest_sentry_ticket` under Functions.

**Build/tests:**
- `npm run build` exit 0
- `npx vitest run`: 1781 passed / 3 failed — all 3 failures are sibling plan 15-03's intentional RED-phase TDD tests for `getAttachmentSignedUrl` (commit 473e6d16, pre-existing, not this plan's scope)
- RLS regression (`npx vitest run src/test/rls-regression.test.ts`): clean skip (44 skipped) — no `.env.test` test project configured on this machine; acceptance criteria allowed clean skip, recorded here as required

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migration timestamp collision**
- **Found during:** Task 1
- **Issue:** Planned filename `20260612000001_sentry_ticket_ingestion.sql` already taken by `20260612000001_create_ticket_attachments_bucket.sql`
- **Fix:** Bumped to next free timestamp `20260612130000` (plan explicitly pre-authorized this)
- **Files modified:** supabase/migrations/20260612130000_sentry_ticket_ingestion.sql
- **Commit:** f7f9a0e7

**2. [Rule 2 - Missing critical functionality] Explicit service_role GRANT**
- **Found during:** Task 1
- **Issue:** Plan specified only the REVOKE; revoking from PUBLIC removes the default EXECUTE grant for all roles, which could leave the service-role path dependent on implicit superuser-ish behavior
- **Fix:** Added `GRANT EXECUTE ... TO service_role` after the REVOKE
- **Files modified:** same migration
- **Commit:** f7f9a0e7

## Known Stubs

None — migration and generated types only; no UI/data wiring in this plan.

## Threat Flags

None — all surfaces (SECURITY DEFINER RPC, NULL-reporter RLS, dedup overwrite scope) were already in the plan's threat model and their mitigations are implemented and probed (T-12-03 REVOKE probe, T-12-05 dedup updates only occurrence_count/last_seen_at).

## Notes for Next Plans

- 12-02 (Edge Function) calls `ingest_sentry_ticket` via the service-role client; fingerprint format `sentry:<issue_id>`.
- Working tree carries concurrent sibling executors' uncommitted changes (15-03 RED tests, deleted YouTube components, etc.) — this plan staged only its own files.

## Self-Check: PASSED

- Migration file exists, SUMMARY exists
- Commits f7f9a0e7 and 71e52f74 found in git log
- No file deletions in either commit
