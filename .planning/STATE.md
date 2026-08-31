---
gsd_state_version: 1.0
milestone: v2.2
milestone_name: Event Resolution & Provenance
status: "Blocked -- Plan 30-02 Task 2: TEST project (callvault-test) is 9 migrations behind local. Migration authored+committed, not yet applied. See 30-02-SUMMARY.md."
last_updated: "2026-08-31T22:06:47.445Z"
last_activity: 2026-08-31 — Plan 30-01 (schema truth reconciliation) complete
progress:
  total_phases: 10
  completed_phases: 0
  total_plans: 4
  completed_plans: 2
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
Plan: 2 of 4
Status: Blocked -- Plan 30-02 Task 2: TEST project (callvault-test) is 9 migrations behind local. Migration authored+committed, not yet applied. See 30-02-SUMMARY.md.
Last activity: 2026-08-31 — Plan 30-01 (schema truth reconciliation) complete

Progress: [█████░░░░░] 50%

## Performance Metrics

(Will populate as phases run.)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

## Accumulated Context

| Phase 30 P01 | ~30min | 2 tasks | 5 files |
| Phase 30 P02 | ~20min | 2 tasks | 1 files |

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
- [Phase 30]: Migration 20260831000001 authored to spec and committed, but TEST apply stopped after confirming callvault-test is 9 migrations behind local -- did not catch up TEST's backlog or fall back to prod, per explicit plan instruction to surface the blocker instead of working around it

### Pending Todos

None yet.

### Blockers/Concerns

- **F5 live false-merge risk** — the current Zoom-only `checkMatch` can false-merge recurring-meeting instances; open until MATCH-04/05 close it in Phase 32. Shadow mode (Phase 31) must ship with no auto-merge before hardening.
- 11 pre-existing npm run type-check errors (missing PaneHeader/RiFolderOpenLine imports, 2 service/hook type mismatches) found on origin/main during 30-01, absorbed into type-baseline.json rather than fixed (out of plan scope) — see .planning/phases/30-schema-reconciliation-event-model-foundation/deferred-items.md
- Plan 30-02 Task 2 partially blocked: TEST project (callvault-test, ref swjzxiddcrtaqixsfaac) is 9 migrations behind local (missing 20260703120000 through 20260829231202, confirmed via supabase migration list --linked). Migration supabase/migrations/20260831000001_create_events_and_extend_participants.sql is authored and committed but NOT applied to TEST. Did not catch up TEST's backlog (out of this plan's scope, ~2 months of unreviewed drift) and did not fall back to prod. Blocks Plan 30-03's isolation/byte-identical tests and Plan 30-04's prod apply until resolved. Needs an Andrew decision: catch up TEST first, or provide a different verification target.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2.1 ops | Resume-heartbeat cron GUC `app.supabase_url` (Supabase dashboard SQL, Andrew) | Open | v2.1 close |
| v2.1 ops | Live provider-backed sync-all proof (needs prod credentials) | Open | v2.1 close |

## Session Continuity

Last session: 2026-08-31T22:06:44.724Z
Stopped at: Blocked at 30-02 Task 2: TEST project (callvault-test) is 9 migrations behind local -- migration authored+committed, not yet applied. See 30-02-SUMMARY.md.
Resume file: .planning/phases/30-schema-reconciliation-event-model-foundation/30-02-SUMMARY.md
