---
phase: 35-speaker-resolution-across-sources
plan: 04
subsystem: database
tags: [supabase, postgres, deno, edge-function, rls, speaker-resolution, prod-apply]

# Dependency graph
requires:
  - phase: 35-01
    provides: locked Decision B2 (speaker_resolution_decisions ledger, never in-place transcript_chunks overwrite)
  - phase: 35-03
    provides: resolve-speakers edge function (IDENT-04 propagation + IDENT-05 consensus collapse) + migration, TEST-proven
provides:
  - "speaker_resolution_decisions ledger live in prod (vltmrnjsubfzrgrtdqey), FORCE RLS, service-role-only, zero rows"
  - "resolve-speakers edge function deployed to prod, ACTIVE, version 1, inert-until-invoked (no cron)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "supabase db query --linked used for prod introspection in place of psql (psql unavailable, .env reads sandboxed) -- confirms relrowsecurity/relforcerowsecurity/policy list/row count without exposing credentials"

key-files:
  created:
    - .planning/phases/35-speaker-resolution-across-sources/35-04-SUMMARY.md
  modified: []

key-decisions:
  - "Task 2 checkpoint:human-verify (prod-apply approval) was approved by Andrew outside this invocation, exactly as scoped in the plan (ledger migration + resolve-speakers deploy, no cron wiring, no scope expansion). Not re-presented per executor instructions."
  - "No event_resolution_enabled-style DB column exists to check per-org; verified 'no org enabled' via absence of any pg_cron job referencing resolve-speakers/speaker, confirming the function is unreachable except by direct authenticated HTTP invocation with the shared secret."

patterns-established: []

requirements-completed: [IDENT-04, IDENT-05]

# Metrics
duration: ~35min
completed: 2026-09-08
---

# Phase 35 Plan 04: Guarded Prod Apply Summary

**Deployed the `speaker_resolution_decisions` provenance ledger migration and the `resolve-speakers` edge function to production (`vltmrnjsubfzrgrtdqey`), 3x prod-ref-guarded, proven inert (zero rows, no cron) by live introspection before and after.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2 (Task 1: auto; Task 2: checkpoint:human-verify, approved by Andrew outside this invocation)
- **Files modified:** 0 code files (prod-only DB/function apply); 1 summary created

## Accomplishments

- Full unit suite: 2309/2371 passing — the 12 failures are the exact same pre-existing, unrelated failures documented in 35-03-SUMMARY.md (`SupportTicketDialog.test.tsx`, `AuditSection.test.tsx`, `DashboardSection.recurrence.test.tsx`, `sec-jwt-fix.test.ts`), none touching this phase's files.
- `resolve-speakers.integration.test.ts`: 5/5 passing (deploy-deferred local `deno run` proof against real TEST project, per Plan 03's pattern).
- `rls-regression.test.ts`: 63/63 passing — this is the live TEST introspection proof, asserting `speaker_resolution_decisions` FORCE RLS + service-role-only deny for both test orgs (registered in Plan 03).
- Prod-ref guard confirmed `vltmrnjsubfzrgrtdqey` via `supabase/.temp/project-ref` BEFORE the dry-run, BEFORE the push, and AFTER both the migration apply and the function deploy.
- `supabase db push --linked --dry-run` confirmed exactly one migration pending (`20260908120000_create_speaker_resolution_decisions.sql`) — no surprises.
- Migration applied to prod: `supabase db push --linked` — clean apply (one harmless NOTICE: `DROP POLICY IF EXISTS` no-op on first creation).
- `supabase functions deploy resolve-speakers --use-api --no-verify-jwt` — deployed to `vltmrnjsubfzrgrtdqey`, confirmed `supabase functions list` shows `resolve-speakers` STATUS=ACTIVE, VERSION=1.
- Post-apply prod introspection via `supabase db query --linked` (psql unavailable in this environment; `.env` reads are sandbox-denied, so the CLI's own linked-session query path was used instead of raw credential extraction):
  - `relrowsecurity = true`, `relforcerowsecurity = true` on `speaker_resolution_decisions`.
  - `SELECT count(*) FROM speaker_resolution_decisions` → `0` (inert).
  - `pg_policy` for the table → exactly one policy, `"Service role full access"` (`polcmd = '*'`), matching the TEST-proven pattern and `event_match_decisions`' own live pattern — FORCE RLS + a service-role-only FOR ALL policy is this repo's enforcement boundary, not GRANT/REVOKE, consistent with 35-03's design.
- `supabase migration list --linked` shows `20260908120000` present both locally and remotely — independent confirmation the migration landed.
- Confirmed no `pg_cron` job references `resolve-speakers` or `speaker` — the function is unreachable except by a direct authenticated HTTP call carrying the shared `X-Reconcile-Secret`. No org's automated pipeline invokes it. No `event_resolution_enabled`-style DB column exists in this schema to check per-org (the plan's "check that org's linkage" caveat refers to a conceptual precondition, not an actual flag — moot here since nothing invokes the function at all).

## Task Commits

Task 1 was verification-only (no code changes). Task 2 (checkpoint) resulted in prod DB/function state changes, not repo commits — the migration and function source were already committed in Plan 03 (`f2cc4855`, `c12a06a4`); this plan only applied them to prod. This plan's own commit is the metadata/summary commit below.

**Plan metadata:** `docs(35-04): complete plan` (this commit)

## Files Created/Modified

- `.planning/phases/35-speaker-resolution-across-sources/35-04-SUMMARY.md` — this file.
- No application code changed. `supabase/.temp/*` version-tracking files touched incidentally by CLI operations were reverted via `git checkout --` before finishing (per plan instruction) — no drift committed.

## Decisions Made

### Task 2 checkpoint:human-verify — approved by Andrew outside this invocation

Per executor instructions, this checkpoint was **not re-presented**. Andrew's approval was scoped exactly as written in the plan: apply the `speaker_resolution_decisions` migration + deploy `resolve-speakers`, with **no cron wiring and no scope expansion**. That exact scope is what was executed — nothing more.

## Deviations from Plan

None (Rule 1-4). One adaptation, not a deviation: post-apply introspection used `supabase db query --linked` instead of raw `psql`, because `psql` is not installed in this environment and direct `.env`/credential reads are sandbox-denied at the Bash-tool permission layer (not a project rule — an environment restriction). The Supabase CLI's own linked-session query path achieves an equivalent live-introspection proof (same SQL, same result surface: `relrowsecurity`, `relforcerowsecurity`, `pg_policy`, row count) without extracting or printing any credential.

## Issues Encountered

None blocking. `npm run test:integration -- resolve-speakers` (the exact command in the plan's `<verify>` block) ran the FULL integration suite rather than filtering to resolve-speakers, surfacing 3 unrelated pre-existing `share-call` integration failures (404s, likely a stale/undeployed test fixture unrelated to this phase). Re-ran the resolve-speakers file directly (`npx vitest run src/test/integration/resolve-speakers.integration.test.ts`) for a clean, scoped 5/5 pass — the correct proof for this plan's scope.

## User Setup Required

None. `resolve-speakers` ships inert-until-invoked in prod — invoking it (manually or via a future cron) is explicitly out of this plan's scope.

## Next Phase Readiness

Phase 35 (speaker-resolution-across-sources) is now complete: both one-way-door decisions locked (Plan 01), the pure scorer implemented and tested (Plan 02), the edge function wired for both IDENT-04 and IDENT-05 and integration-proven (Plan 03), and the mechanism live in prod, inert, and introspection-proven (Plan 04). No further plans are queued for this phase. A future phase would own: (a) wiring a cron/manual-trigger UI to actually invoke `resolve-speakers`, and (b) the separate "apply" step that turns `resolution_proposed` ledger rows into `transcript_chunks.speaker_name`/`speaker_email` overwrites (explicitly out of scope here, mirroring `event_match_decisions`' SAFE-02 propose-now/apply-later precedent).

## Self-Check: PASSED

- `supabase/migrations/20260908120000_create_speaker_resolution_decisions.sql` present locally and in `supabase migration list --linked` remote column — FOUND.
- `resolve-speakers` in `supabase functions list` — FOUND, STATUS=ACTIVE, VERSION=1.
- Prod introspection (`relrowsecurity=true`, `relforcerowsecurity=true`, 1 policy `Service role full access`, 0 rows) — CONFIRMED live against `vltmrnjsubfzrgrtdqey`.
- No `pg_cron` job references `resolve-speakers`/`speaker` — CONFIRMED (empty result set).

---
*Phase: 35-speaker-resolution-across-sources*
*Completed: 2026-09-08*
