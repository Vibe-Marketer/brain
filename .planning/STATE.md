---
gsd_state_version: 1.0
milestone: v2.2
milestone_name: Event Resolution & Provenance
status: planning
last_updated: "2026-08-31T05:15:00.000Z"
last_activity: 2026-08-31
progress:
  total_phases: 10
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
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

Phase: 30 of 39 (Schema Reconciliation + Event Model Foundation) — 1st of 10 phases in v2.2
Plan: — (not yet planned)
Status: Ready to plan
Last activity: 2026-08-31 — v2.2 roadmap created; 10 phases (30-39), 54 requirements mapped

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

(Will populate as phases run.)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

## Accumulated Context

### Decisions

Full log in PROJECT.md Key Decisions. Affecting current work:

- **v2.2 executes on a feature branch, NOT direct-to-main (2026-08-31)** — this milestone touches RLS on live prod with real customer data. Cut the branch at the START of Phase 30 planning, before any migration is authored. Merge to main only once proven and Andrew is comfortable. Overrides the repo's normal direct-main workflow.
- **`events` lives in the same Postgres DB** — first non-org-scoped table; RLS grants visibility via participation or an owned capture, never `organization_id`.
- **Forward-only** — resolution from a cutover date, no historical backfill this milestone.
- **`identities` is a new spine** — `speakers`/`contacts`/`call_participants` gain a nullable `identity_id`; none moves or is deleted.
- **Voiceprinting fully out of scope** — cut from the requirement set, not deferred internally (BIPA/CUBI/GDPR Art. 9 posture needed first).

### Pending Todos

None yet.

### Blockers/Concerns

- **Phase 30 must resolve F16/F17 first (SAFE-07)** — neither `supabase/migrations/` nor `src/types/supabase.ts` is authoritative alone. Regenerate types from the live DB and reconcile before authoring any migration. Any plan built on the migration folder alone builds on a fiction.
- **F5 live false-merge risk** — the current Zoom-only `checkMatch` can false-merge recurring-meeting instances; open until MATCH-04/05 close it in Phase 32. Shadow mode (Phase 31) must ship with no auto-merge before hardening.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2.1 ops | Resume-heartbeat cron GUC `app.supabase_url` (Supabase dashboard SQL, Andrew) | Open | v2.1 close |
| v2.1 ops | Live provider-backed sync-all proof (needs prod credentials) | Open | v2.1 close |

## Session Continuity

Last session: 2026-08-31
Stopped at: v2.2 ROADMAP.md created — 10 phases (30-39), 54 requirements mapped 100%, traceability updated.
Resume file: None — next step is `/gsd-plan-phase 30` (cut the feature branch first).
