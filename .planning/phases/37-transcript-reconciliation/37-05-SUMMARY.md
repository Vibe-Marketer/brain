---
phase: 37-transcript-reconciliation
plan: 05
subsystem: backend
tags: [supabase, prod-apply, rls, edge-function, transcript-reconciliation]

# Dependency graph
requires:
  - phase: 37-transcript-reconciliation
    plan: 01
    provides: "reconciled_transcript_segments schema/RLS (TEST-proven)"
  - phase: 37-transcript-reconciliation
    plan: 02
    provides: "pure transcript-reconciler module"
  - phase: 37-transcript-reconciliation
    plan: 03
    provides: "reconcile-transcripts edge function (TEST-proven)"
  - phase: 37-transcript-reconciliation
    plan: 04
    provides: "Reconciled tab UI (reads the table this plan makes live)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Prod-apply-no-cron: ship the migration + function live but defer the sweep cron when a known dead-GUC failure mode (event-resolution-sweep) would recur identically; prove the mechanism via a direct manual POST instead, secret read from vault.decrypted_secrets in-process, never printed/persisted (SAFE-06 precedent, now reused a second time)."

key-files:
  created: []
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/STATE.md

key-decisions:
  - "Task 1 checkpoint resolved outside this executor invocation: Andrew authorized apply-no-cron — apply migration + deploy function to prod, do NOT add reconcile-transcripts-sweep cron. event-resolution-sweep has failed every 15-min tick since Phase 31 on unset app.supabase_url/app.reconcile_secret DB GUCs (requires Andrew via Supabase Dashboard); a new cron would hit the identical failure mode until that's fixed separately."
  - "Deployed reconcile-transcripts with --no-verify-jwt (not the default JWT-gated deploy) — the function's own header comment documents this as required since it's shared-secret gated (X-Reconcile-Secret), not user-JWT authenticated, mirroring resolve-events' Phase 32 P05 precedent exactly."
  - "Used `supabase db query --linked` for all prod introspection (no psql binary present, no .env file in this checkout) — confirmed as the CLI's sanctioned direct-SQL-against-linked-project path."

requirements-completed: [RECON-01, RECON-02, RECON-03, RECON-04, RECON-05, RECON-06, RECON-07]

# Metrics
duration: ~35min
completed: 2026-09-10
---

# Phase 37 Plan 05: Guarded Production Apply Summary

**Applied the reconciled_transcript_segments migration and deployed reconcile-transcripts to production (vltmrnjsubfzrgrtdqey) under apply-no-cron — Andrew's explicit authorization — then proved the mechanism live AND inert-by-default via direct prod introspection and a real manual sweep invocation (zero eligible events exist in prod today, so the sweep is a genuine no-op, not merely undeployed).**

## Performance

- **Duration:** ~35min
- **Tasks:** 2 (Task 1 checkpoint pre-resolved outside this invocation; Task 2 executed)
- **Files modified:** 3 (all `.planning/` docs; no application code changed — the migration and function were already committed in 37-01/37-03)

## Accomplishments

- **Prod-ref guard verified twice** via `supabase projects list` — `vltmrnjsubfzrgrtdqey` (callvault-ai) confirmed as the `●` linked project BEFORE any connection, and re-confirmed AFTER the push+deploy.
- **Migration applied:** `supabase db push --linked` found exactly one pending migration (`20260910000000_create_reconciled_transcript_segments.sql`) — every earlier migration was already applied (all prior Phase 37 plans + everything through Phase 36 confirmed via `supabase migration list --linked` showing Local==Remote for all but the one new file). Applied cleanly.
- **Edge function deployed:** `supabase functions deploy reconcile-transcripts --use-api --no-verify-jwt` — confirmed `ACTIVE`, version 1, per `supabase functions list`.
- **No cron added.** Per apply-no-cron, `cron.job` was queried directly on prod and shows only the pre-existing, unrelated `fathom-daily-reconcile` job — no `reconcile-transcripts-sweep` job exists.
- **Introspection proof (all via `supabase db query --linked`, no psql/`.env` needed):**
  - `pg_class.relforcerowsecurity = true` and `relrowsecurity = true` for `reconciled_transcript_segments` (FORCE RLS confirmed).
  - `pg_policies` shows exactly two policies: `"Service role full access"` (ALL, role `service_role`) and `"Users can view reconciled segments for accessible events"` (SELECT, role `authenticated`).
  - `pg_proc` confirms `user_can_view_event_reconciliation` exists with `prosecdef = true` (SECURITY DEFINER).
- **Inert-by-default AND live, proven together:** `event_match_decisions` in prod currently has zero `decision='merge_applied'` rows (only 2 `merge_proposed` rows, the SAFE-06 evidence from Phase 32 — never actually applied). This means reconcile-transcripts' own eligibility gate (37-01's locked Task 1 decision, option-a) has structurally nothing to sweep right now — not an assumption, a fact confirmed by direct query.
- **Manual sweep triggered anyway**, mirroring the SAFE-06 precedent: read `RECONCILE_SECRET` in-process from `vault.decrypted_secrets` via `supabase db query --linked` (never printed to a separate command, never persisted to disk), POSTed `{"mode":"forward"}` with `X-Reconcile-Secret` to the live deployed function. Response: `{"success":true,"since":"2026-09-10T00:00:00Z","eventsScanned":0,"bucketsScanned":0,"chunksScanned":0,"eventsReconciled":0,"segmentsWritten":0,"errors":0}` — the function is live, correctly secret-gated (a wrong/missing secret would have returned 401 `{"error":"Unauthorized"}`), and did exactly nothing because nothing is eligible.
- **`reconciled_transcript_segments` row count confirmed 0 before and after** the manual sweep. `transcript_chunks.embedded_at` non-null count (54,373) recorded as an untouched baseline — the sweep short-circuited before ever reading `transcript_chunks` (zero eligible event IDs), so RECON-04/07's "never touch source transcripts/embeddings" guarantee held trivially and verifiably in this run.
- **REQUIREMENTS.md** traceability table: Phase 37 row (RECON-01..07) flipped from `Pending` to `Complete`. The individual `[x]` checkboxes for RECON-01..07 were already checked by prior plans (37-01 through 37-04) — this plan's completion gate is the shared-ID convention used throughout this milestone (e.g. ORG-01/02 held until 36-06): a requirement's traceability status only flips to Complete once the declaring phase's prod-apply plan has run.
- **ROADMAP.md**: Phase 37 checkbox, plan 37-05 checkbox, and the Progress table row all updated to Complete (5/5 plans, completed 2026-09-10).
- **STATE.md**: Current Position moved to Phase 37 COMPLETE; decisions log entries added recording the apply-no-cron authorization, the live-apply+introspection evidence, and the phase-complete note; a new Blockers/Concerns entry documents why the sweep cron was deliberately not added (mirrors the existing event-resolution-sweep GUC entry) so a future session knows the dependency before wiring either cron.

## Task Commits

1. **Task 1: Authorize production apply** — resolved outside this executor invocation (Andrew, apply-no-cron). No commit (decision-only checkpoint).
2. **Task 2: Apply migration + deploy edge function to prod; prove live and inert** — this SUMMARY + `.planning/` doc updates commit follows.

## Files Created/Modified

- `.planning/REQUIREMENTS.md` — Phase 37 traceability row: Pending → Complete
- `.planning/ROADMAP.md` — Phase 37 checkbox, 37-05 plan checkbox, Progress table row: Complete, 2026-09-10
- `.planning/STATE.md` — Current Position, decisions log, Blockers/Concerns (cron-deferral note)

No application code files were modified by this plan — `supabase/migrations/20260910000000_create_reconciled_transcript_segments.sql` and `supabase/functions/reconcile-transcripts/index.ts` were already authored and committed in 37-01 and 37-03 respectively. This plan's job was the guarded prod apply of those already-committed artifacts.

## Decisions Made

See `key-decisions` in frontmatter — apply-no-cron authorization, `--no-verify-jwt` deploy flag, and `supabase db query --linked` as the introspection tool of record for this checkout (no psql, no `.env`).

## Deviations from Plan

None. Task 2 executed exactly as written: prod-ref guarded before/after, migration applied, function deployed with the documented `--no-verify-jwt` flag, introspection performed, inert-by-default proven, manual sweep proof captured, REQUIREMENTS.md/STATE.md updated. No cron was added, per the Task 1 authorization.

## Threat Flags

None. T-37-09 (wrong-project apply) was mitigated by the double prod-ref guard. T-37-01 (client-readable table) was mitigated by the introspection-confirmed FORCE RLS + policies + SECURITY DEFINER helper. T-37-07 (live re-embedding) was mitigated by the confirmed `transcript_chunks`/`embedded_at` non-write during the manual sweep proof. No new surface introduced beyond what 37-01's threat model already registered.

## Known Stubs

None. The deployed mechanism is fully wired and live — it is inert today only because zero events in production currently satisfy the `decision='merge_applied'` eligibility gate, which is the correct, by-design safety posture (SAFE-01/SAFE-06 precedent: nothing auto-merges, nothing sweeps, until an org is explicitly enabled and a merge is explicitly applied).

## Self-Check: PASSED

- FOUND: `.planning/REQUIREMENTS.md` (Phase 37 row now `Complete`)
- FOUND: `.planning/ROADMAP.md` (Phase 37 + 37-05 marked complete)
- FOUND: `.planning/STATE.md` (Current Position + decisions updated)
- FOUND: migration `20260910000000` applied to prod — confirmed via `supabase migration list --linked` (Local==Remote)
- FOUND: `reconcile-transcripts` edge function ACTIVE on prod — confirmed via `supabase functions list`
- FOUND: prod introspection results (FORCE RLS, 2 policies, SECURITY DEFINER helper) — all captured in this SUMMARY's Accomplishments section, generated from live `supabase db query --linked` output in this session
- FOUND: manual sweep response `{"success":true,...}` — captured in this session's tool output
