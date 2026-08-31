---
gsd_state_version: 1.0
milestone: v2.2
milestone_name: Event Resolution & Provenance
status: executing
last_updated: "2026-08-31T23:51:56.664Z"
last_activity: 2026-08-31
progress:
  total_phases: 10
  completed_phases: 0
  total_plans: 4
  completed_plans: 3
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-31)

**Core value:** A meeting is one event that happened once. CallVault holds the single canonical record of that event, assembled from every recording (capture) of it, with per-capture access control and auditable provenance.
**Current focus:** Phase 30 — Schema Reconciliation + Event Model Foundation

**Repo:** `/Users/admin/dev/brain` (single source; `callvault/` abandoned).
**Production:** https://app.callvaultai.com · Prod Supabase ref `vltmrnjsubfzrgrtdqey` (migrations read `.env`, prod-ref guarded).

## Current Position

Phase: 30 (Schema Reconciliation + Event Model Foundation) — EXECUTING
Plan: 4 of 4
Status: Ready to execute
Last activity: 2026-08-31

Progress: [████████░░] 75%

## Performance Metrics

(Will populate as phases run.)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

## Accumulated Context

| Phase 30 P01 | ~30min | 2 tasks | 5 files |
| Phase 30 P02 | ~20min | 2 tasks | 1 files |
| Phase 30 P03 | ~110min | 2 tasks | 5 files |

### Decisions

Full log in PROJECT.md Key Decisions. Affecting current work:

- **v2.2 executes on a feature branch, NOT direct-to-main (2026-08-31)** — this milestone touches RLS on live prod with real customer data. Cut the branch at the START of Phase 30 planning, before any migration is authored. Merge to main only once proven and Andrew is comfortable. Overrides the repo's normal direct-main workflow.
- **`events` lives in the same Postgres DB** — first non-org-scoped table; RLS grants visibility via participation or an owned capture, never `organization_id`.
- **Forward-only** — resolution from a cutover date, no historical backfill this milestone.
- **`identities` is a new spine** — `speakers`/`contacts`/`call_participants` gain a nullable `identity_id`; none moves or is deleted.
- **Voiceprinting fully out of scope** — cut from the requirement set, not deferred internally (BIPA/CUBI/GDPR Art. 9 posture needed first).
- [Phase 30]: src/types/supabase.ts regenerated via supabase gen types typescript --linked; F17 drift (2 tables, ~18 columns, 3 RPCs) resolved — Committed types were stale by ~7 migrations; the live database via --linked introspection is the source of truth
- [Phase 30]: Corrected the phase research's F16 claim: the banks->organizations rename (including recordings.bank_id) IS captured in 20260301000001_rename_vaults_to_workspaces.sql, verified by direct migration-file reads — Reality over documentation — writing the plan's unverified claim into a permanent SCHEMA_TRUTH.md doc would have been actively harmful; do not author a synthetic rename migration, there is nothing to fix
- [Phase 30]: Task 1 reversibility gate (events schema shape + RLS pattern) resolved as option-a, approved as-is, no knob changes -- pre-resolved by the human operator outside the executor agent invocation
- [Phase 30]: Migration 20260831000001 authored to spec and committed; executor correctly stopped and surfaced the blocker rather than guessing when callvault-test was found 9 migrations behind local. Andrew explicitly authorized catching TEST up; orchestrator applied the 9 backlog migrations + this one via `supabase db push --linked` against callvault-test, introspection confirmed shape, CLI relinked back to prod and verified.
- [Phase 30]: Fetched real TEST project credentials via supabase projects api-keys rather than treating TEST-env-unavailability as a permanent skip (Plan 30-03)
- [Phase 30]: Fixed vitest.config.ts setupFiles resolution (Rule 3, out-of-declared-scope) after it broke the entire test suite -- worktree-specific path bug; one-line path.resolve fix verified via full-suite run (Plan 30-03)
- [Phase 30]: Fixed a 5.5-month-old global_search() production bug (Rule 1, out-of-declared-scope) -- reverted regression from a 2026-06-10 migration, applied to TEST only, production apply deferred to Andrew (Plan 30-03)

### Pending Todos

None yet.

### Blockers/Concerns

- **F5 live false-merge risk** — the current Zoom-only `checkMatch` can false-merge recurring-meeting instances; open until MATCH-04/05 close it in Phase 32. Shadow mode (Phase 31) must ship with no auto-merge before hardening.
- 11 pre-existing npm run type-check errors (missing PaneHeader/RiFolderOpenLine imports, 2 service/hook type mismatches) found on origin/main during 30-01, absorbed into type-baseline.json rather than fixed (out of plan scope) — see .planning/phases/30-schema-reconciliation-event-model-foundation/deferred-items.md
- global_search() production bug (42703, ~5.5 months old) fixed and applied to TEST only in Plan 30-03 -- needs Andrew's explicit authorization to apply to prod (vltmrnjsubfzrgrtdqey), independent of Plan 04's event-migration prod apply

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2.1 ops | Resume-heartbeat cron GUC `app.supabase_url` (Supabase dashboard SQL, Andrew) | Open | v2.1 close |
| v2.1 ops | Live provider-backed sync-all proof (needs prod credentials) | Open | v2.1 close |

## Session Continuity

Last session: 2026-08-31T23:51:56.659Z
Stopped at: Completed 30-03-PLAN.md -- EVT-03/EVT-04/SAFE-05 proven by test (green, 5/5 + 49/49) against TEST. Starting Plan 30-04 (prod apply of events migration) next.
Resume file: .planning/phases/30-schema-reconciliation-event-model-foundation/30-03-SUMMARY.md
