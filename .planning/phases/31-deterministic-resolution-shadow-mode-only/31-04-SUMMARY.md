---
phase: 31-deterministic-resolution-shadow-mode-only
plan: 04
subsystem: database
tags: [postgres, supabase-cli, supabase-edge-functions, production-deploy, typescript]

# Dependency graph
requires:
  - phase: 31-deterministic-resolution-shadow-mode-only
    plan: 01
    provides: organization_feature_flags + event_match_decisions migrations, _shared/event-resolver.ts, resolve-events edge function -- proven GREEN on TEST
  - phase: 31-deterministic-resolution-shadow-mode-only
    plan: 02
    provides: apply_event_match_atomic / reverse_event_match_atomic RPC pair + event-resolution-sweep cron migration -- proven GREEN on TEST
  - phase: 31-deterministic-resolution-shadow-mode-only
    plan: 03
    provides: CLIENT_DENY_TABLES registration for both new tables -- proven GREEN on TEST (53/53)
provides:
  - organization_feature_flags + event_match_decisions tables live in production (vltmrnjsubfzrgrtdqey), FORCE RLS, zero rows
  - apply_event_match_atomic / reverse_event_match_atomic RPCs live in production, EXECUTE revoked from anon/authenticated
  - event-resolution-sweep pg_cron job live in production, registered and active (every 15 min)
  - resolve-events edge function deployed to production
  - src/types/supabase.ts re-synced from production, now includes both new tables + both RPCs
affects: [phase-32-metadata-tier]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Prod-ref guard via Supabase CLI linked-project state (supabase/.temp/project-ref + `supabase projects list` LINKED marker), not a .env DATABASE_URL parse -- used because no .env file exists in this checkout (flagged by Plan 01), matches this invocation's own explicit critical_context procedure"
    - "Type regen written to a scratchpad temp file first, verified (exit code, clean stderr, valid TS structure, both new tables/RPCs present), THEN swapped over the committed file -- avoids the stderr-contamination mistake documented in Phase 30 Plan 04's SUMMARY"

key-files:
  created: []
  modified:
    - src/types/supabase.ts

key-decisions:
  - "Task 1 checkpoint resolved outside this executor invocation: Andrew approved applying exactly the 4 Phase-31 migrations + deploying resolve-events to production, no expanded scope this time (contrast with Phase 30 Plan 04, where the checkpoint was expanded to include an unrelated bug fix) -- pre-resolved per the orchestrator's explicit instruction, not re-presented"
  - "Prod-ref guard performed via the Supabase CLI's own linked-project state (supabase/.temp/project-ref + the `supabase projects list` ● LINKED marker), confirmed vltmrnjsubfzrgrtdqey both BEFORE and AFTER the push -- no .env file exists in this checkout (same gap Plan 01 flagged), so this invocation's own critical_context specified this exact alternative guard mechanism"
  - "type-baseline.json intentionally left untouched -- npm run type-check reported 0 new errors with the baseline unchanged at 320/320 after the types regen, so no update-baseline run was needed (unlike a scenario where the new tables shift the baseline)"
  - "Confirmed worktree HEAD was on the project's deliberate long-lived v2.2-event-resolution branch (not `main`/`master`/`develop`/`trunk`/`release/*`) before staging or committing -- `.git` is a file here because /Users/admin/dev/brain/main is a linked git worktree of /Users/admin/dev/brain, distinct from the ephemeral `worktree-agent-*` per-task worktrees also present in this environment; committed normally per this invocation's explicit sequential_execution instruction"

patterns-established: []

requirements-completed: [MATCH-01, MATCH-09, MATCH-10, SAFE-01, SAFE-02]

coverage:
  - id: D1
    description: "Task 1 approval gate: apply 4 Phase-31 migrations + deploy resolve-events to production, approved by Andrew"
    verification:
      - kind: manual_procedural
        ref: "Pre-resolved by the human operator outside this executor invocation (see orchestrator's checkpoint_already_resolved directive); no expanded scope"
        status: pass
    human_judgment: true
    rationale: "Production DDL + deploy approval is inherently a human decision; already made and recorded, but the coverage schema requires human_judgment:true for any approval-gate deliverable regardless of when the decision occurred."
  - id: D2
    description: "Prod-ref guard confirmed vltmrnjsubfzrgrtdqey (not swjzxiddcrtaqixsfaac/callvault-test) both before and after the push"
    requirement: "SAFE-01"
    verification:
      - kind: other
        ref: "cat supabase/.temp/project-ref && supabase projects list (● marker check), run before push and re-run after push"
        status: pass
    human_judgment: false
  - id: D3
    description: "All 4 Phase-31 migrations applied cleanly to production, confirmed via migration list (Local==Remote for all 4, no other migrations touched)"
    requirement: "MATCH-01"
    verification:
      - kind: other
        ref: "supabase db push --linked --dry-run (confirmed exactly 4 pending, no surprises) then supabase db push --linked; supabase migration list --linked (4/4 Local==Remote)"
        status: pass
    human_judgment: false
  - id: D4
    description: "organization_feature_flags + event_match_decisions tables, both RPCs, and the event-resolution-sweep cron job all exist live in production with FORCE RLS and correct EXECUTE grants"
    requirement: "MATCH-09"
    verification:
      - kind: other
        ref: "Direct SQL introspection via `supabase db query --linked`: off_table=1, emd_table=1, apply_fn=1, reverse_fn=1, cron_job=1, cron_active=true, off_force_rls=true, emd_force_rls=true, anon_can_apply=false, auth_can_apply=false, service_can_apply=true"
        status: pass
    human_judgment: false
  - id: D5
    description: "resolve-events edge function deployed to production"
    verification:
      - kind: other
        ref: "supabase functions deploy resolve-events --use-api -- output confirms 'Deployed Functions on project vltmrnjsubfzrgrtdqey: resolve-events'"
        status: pass
    human_judgment: false
  - id: D6
    description: "src/types/supabase.ts regenerated from prod, contains event_match_decisions + organization_feature_flags + both RPCs; npm run type-check passes with baseline unchanged"
    requirement: "MATCH-10"
    verification:
      - kind: other
        ref: "grep -q event_match_decisions && grep -q organization_feature_flags src/types/supabase.ts && npm run type-check -- literal plan acceptance command, printed PROD_TYPES_OK"
        status: pass
    human_judgment: false
  - id: D7
    description: "Zero organization_feature_flags rows with enabled=true exist in production -- mechanism confirmed inert, no behavior change"
    requirement: "SAFE-02"
    verification:
      - kind: other
        ref: "Direct SQL introspection via `supabase db query --linked`: total_flag_rows=0, enabled_flags=0"
        status: pass
    human_judgment: false

# Metrics
duration: ~15min
completed: 2026-09-02
status: complete
---

# Phase 31 Plan 04: Production Apply + Type Re-sync Summary

**The deterministic shadow-resolution mechanism (organization_feature_flags, event_match_decisions, apply/reverse RPCs, event-resolution-sweep cron, resolve-events edge function) is now live in production (vltmrnjsubfzrgrtdqey) -- proven-then-applied, confirmed inert (zero flag rows, zero behavior change), with src/types/supabase.ts re-synced and type-check green.**

## Performance

- **Duration:** ~15 min (approximate -- explicit start-time capture was skipped this session; estimated from the tool-call sequence)
- **Completed:** 2026-09-02
- **Tasks:** 2 (1 pre-resolved checkpoint, 1 executed)
- **Files modified:** 1 (`src/types/supabase.ts`)

## Accomplishments

- Confirmed the prod-ref guard TWICE (before and after the push) via the Supabase CLI's linked-project state: `supabase/.temp/project-ref` = `vltmrnjsubfzrgrtdqey` and the `supabase projects list` ● LINKED marker on `callvault-ai` (`vltmrnjsubfzrgrtdqey`), never `swjzxiddcrtaqixsfaac` (callvault-test)
- Ran `supabase db push --linked --dry-run` first and confirmed it showed exactly the 4 expected Phase-31 migrations pending, nothing else -- then applied for real with `supabase db push --linked`. All 4 applied cleanly (only idempotent skip-notices: `DROP POLICY/TRIGGER IF EXISTS` no-ops, `pg_net`/`pg_cron` already-installed notices, and the cron-scheduled confirmation notice)
- Verified via `supabase migration list --linked` that all 4 migrations now show `Local == Remote`
- Ran direct SQL introspection against prod (`supabase db query --linked`) proving: both new tables exist with `FORCE ROW LEVEL SECURITY` true, both RPCs exist with `EXECUTE` denied to `anon`/`authenticated` and granted to `service_role`, the `event-resolution-sweep` cron job is registered and `active=true`, and `organization_feature_flags` has zero rows total (so necessarily zero with `enabled=true`) -- the mechanism is confirmed inert, not just assumed inert
- Deployed `resolve-events` via `supabase functions deploy resolve-events --use-api`; the CLI's own output named the correct prod ref (`Deployed Functions on project vltmrnjsubfzrgrtdqey: resolve-events`)
- Regenerated `src/types/supabase.ts` from prod: wrote to a scratchpad temp file first, verified exit code 0, clean stderr, well-formed TypeScript (`export type Json =` header, `} as const` footer), and the presence of both new tables + both RPCs -- only then swapped it over the committed file (avoiding the stderr-contamination mistake documented in Phase 30 Plan 04's SUMMARY)
- Ran `npm run type-check`: 0 new errors, baseline unchanged at 320/320 -- no `type-baseline.json` update was needed
- Ran the plan's own literal automated acceptance command verbatim; it printed `PROD_TYPES_OK`

## Task Commits

1. **Task 1: Approve applying the Phase-31 migrations + resolve-events to production** - pre-resolved outside this executor invocation (approved by Andrew, exactly the 4 migrations + the one edge function deploy, no expanded scope) -- no commit, decision recorded here per the plan's Task 1 acceptance criteria
2. **Task 2: Apply to prod (guarded), deploy resolve-events, regenerate types from prod** - `6bc1c4e1` (feat)

**Plan metadata:** (this commit, immediately following)

## Files Created/Modified

- `src/types/supabase.ts` - Regenerated from production via `supabase gen types typescript --linked`; gained `event_match_decisions`, `organization_feature_flags` Row/Insert/Update/Relationships types and `apply_event_match_atomic`/`reverse_event_match_atomic` Function types (128 lines added, 6274 total)

## Decisions Made

- **Task 1 (pre-resolved):** approved by Andrew outside this executor invocation. Scope: exactly the 4 migrations + the `resolve-events` deploy, as originally scoped in the plan -- no expansion this time (contrast with Phase 30 Plan 04, where the equivalent checkpoint was expanded to also cover an unrelated bug fix).
- **Prod-ref guard mechanism:** used the Supabase CLI's own linked-project state (`supabase/.temp/project-ref` + the `supabase projects list` ● marker) rather than parsing a `.env` `DATABASE_URL`, because no `.env` file exists in this repo checkout (the exact gap Plan 01's SUMMARY flagged for this plan to handle). This invocation's own `critical_context` specified this precise alternative procedure, so it is not a deviation from instructions -- it is the instructed procedure.
- **type-baseline.json left untouched:** the types regen introduced 0 new type-check errors and the baseline count didn't move (320/320 before and after), so `npm run type-check:update-baseline` was correctly never run.
- **Worktree/branch safety check performed before committing:** confirmed `git symbolic-ref HEAD` resolved to `refs/heads/v2.2-event-resolution` (not any protected branch) and that this worktree (`/Users/admin/dev/brain/main`) is the project's own deliberate, long-lived feature-branch worktree per the PROJECT.md Key Decision ("v2.2 executes on a feature branch, NOT direct-to-main"), distinct from the ephemeral `worktree-agent-*` worktrees also present in this environment for unrelated parallel work. Committed normally per this invocation's explicit `sequential_execution` instruction.

## Deviations from Plan

None -- plan executed exactly as written. Task 2's action text anticipated both the missing-`.env` gap and the temp-file-first types-regen discipline; both were followed as specified. No bugs, missing functionality, or blocking issues were found in this plan's own scope during execution.

## Issues Encountered

None. The dry-run showed no surprises (exactly the 4 expected migrations, nothing else pending), the real push applied cleanly with only expected idempotent notices, the edge function deployed on the first attempt, and the type regen/type-check passed without needing any baseline adjustment.

## User Setup Required

**Deferred to Phase 32 (non-blocking):** `RECONCILE_SECRET` must be set as an Edge Function secret (`supabase secrets set RECONCILE_SECRET=<random-32-byte-hex>`) and the matching `app.supabase_url` / `app.reconcile_secret` DB GUCs must be set via `ALTER DATABASE postgres SET ...; SELECT pg_reload_conf();` (Supabase Dashboard -> Settings -> Database -> Custom postgres settings, or the SQL editor) before the `event-resolution-sweep` cron can successfully call `resolve-events`. Until then, the cron's `net.http_post` calls 401 harmlessly against the function's shared-secret gate. This is non-blocking this phase: no organization has `organization_feature_flags.enabled=true` (confirmed: 0 rows total), so the sweep has nothing to do regardless of whether the secret is configured. Same deferred item carried forward verbatim from Plans 01 and 02.

## Next Phase Readiness

- The deterministic shadow-resolution mechanism (MATCH-01, MATCH-09, MATCH-10, SAFE-01, SAFE-02) now truthfully exists in production: `organization_feature_flags`, `event_match_decisions`, `apply_event_match_atomic`, `reverse_event_match_atomic`, and the `event-resolution-sweep` cron are all live on `vltmrnjsubfzrgrtdqey`.
- Confirmed inert by direct introspection, not assumption: zero `organization_feature_flags` rows exist at all in prod, so the flag gate (SAFE-01) blocks every organization; SAFE-02 additionally guarantees the sweep would never write `recordings.event_id` even if the flag were somehow set.
- `resolve-events` is deployed but its cron trigger will 401 harmlessly until `RECONCILE_SECRET` + the DB GUCs are configured -- an explicit, non-blocking Phase-32 prerequisite documented in the migration's own operator runbook.
- `src/types/supabase.ts` is re-synced with production and `npm run type-check` is green (0 new errors, 320/320 baseline unchanged).
- Phase 31's success criteria is met: the mechanism exists truthfully in production, inert and safe (flag off for every org, `event_id` NULL across the board), with zero behavior change -- ready for Phase 32 to enable a single organization and measure precision (SAFE-06).
- No blockers for Phase 32.

---
*Phase: 31-deterministic-resolution-shadow-mode-only*
*Completed: 2026-09-02*

## Self-Check: PASSED

All claimed files verified present on disk (`31-04-SUMMARY.md`, `src/types/supabase.ts`). Claimed commit hash `6bc1c4e1` verified present in `git log --oneline --all`. No missing items.
