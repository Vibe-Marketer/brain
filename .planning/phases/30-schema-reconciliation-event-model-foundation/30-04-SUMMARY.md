---
phase: 30-schema-reconciliation-event-model-foundation
plan: 04
subsystem: database
tags: [supabase, postgres, migrations, prod-apply, typescript, rls, event-model]

# Dependency graph
requires:
  - phase: 30-03
    provides: "EVT-03 byte-identical proof (5/5) + EVT-04/SAFE-05 events isolation proof (49/49), both green on TEST; plus a TEST-only global_search() regression fix awaiting prod authorization"
provides:
  - "events table + recordings.event_id + call_participants.event_id/role/has_confirmed_speech LIVE IN PRODUCTION (vltmrnjsubfzrgrtdqey) -- the event-model foundation Phases 31-39 build on"
  - "global_search() 5.5-month-old production regression (SQLSTATE 42703) FIXED IN PRODUCTION -- search was throwing on every invocation since 2026-06-10; expanded scope, approved by Andrew alongside the events migration"
  - "src/types/supabase.ts regenerated from prod post-migration -- events Row type, recordings.event_id, call_participants.event_id/role/has_confirmed_speech, and both new FK relationships"
  - "type-baseline.json updated to reflect the expected, non-regressive message-text shift on the pre-existing recordings.service.ts TS2740 baseline entry (event_id is now one more enumerated missing property in an unrelated pre-existing Pick/full-Row mismatch)"
affects: [31-deterministic-resolution-shadow-mode-only]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Never redirect `supabase gen types typescript --linked` with `2>&1` into the target file -- the CLI writes an 'Initialising login role...' diagnostic to stderr that gets merged into stdout and corrupts the generated TypeScript as a non-code first line. Redirect stdout only (`> file`), let stderr print to the console."
    - "Generate CLI-produced files (like `supabase gen types`) to a `.new` temp file first, grep/Read-verify the expected new content is present and nothing unexpected changed, THEN `mv` it over the committed file -- catches contamination or a bad/stale CLI session before it ever touches the tracked file."
    - "A baseline-gated type-check (type-baseline.json, keyed by file|TScode|message-hash) will show a schema-additive migration as a 'new error' when a pre-existing structural-mismatch error's message text enumerates the new column -- diff the message text and the physical call-site count against the OLD baseline entry (same file, same code, same count) before concluding it's a real regression; if the count and sites are unchanged, it's the same bug, not a new one."

key-files:
  created: []
  modified:
    - src/types/supabase.ts
    - type-baseline.json

key-decisions:
  - "Task 1's checkpoint:human-verify gate was resolved OUTSIDE this executor invocation, in the orchestrating conversation: Andrew approved applying BOTH the events migration (20260831000001, the plan's original scope) AND the global_search regression fix (20260831010000, discovered as a byproduct of Plan 30-03 and left TEST-only pending explicit authorization) to production together -- an expanded scope beyond the plan's original single-migration text. Recorded here per the pre-resolved checkpoint context; not re-presented or re-paused on."
  - "Verified the prod-ref guard (vltmrnjsubfzrgrtdqey) via both `supabase/.temp/project-ref` and the `●` LINKED marker in `supabase projects list`, BEFORE the dry-run, BEFORE the real push, and AFTER the real push -- three checkpoints, not one, given this is the single highest-stakes DDL action in the phase."
  - "Ran `supabase db push --linked --dry-run` before the real push and confirmed it listed exactly the two expected migrations (no surprises, no unexpected pending files) before proceeding."
  - "Regenerated types to a `.new` temp file first, verified `events`/`event_id`/`has_confirmed_speech`/`role` were present and the diff was purely additive (53 lines, 0 removed) before swapping it over the committed `src/types/supabase.ts`, after discovering (and discarding, before it was ever committed) a first attempt that had stderr-contaminated the file via an incautious `2>&1` redirect."
  - "Deliberately ran `npm run type-check:update-baseline` after confirming the one 'new' error was the exact same pre-existing `recordings.service.ts|TS2740` baseline entry (same file, same code, same 2 call sites) with only its message text shifted by the new `event_id` column being enumerated -- total baseline count unchanged (319 before, 319 after), confirming no new distinct error was introduced."

requirements-completed: [EVT-01, EVT-02, EVT-05, SAFE-07]

coverage:
  - id: D1
    description: "Task 1 approval gate: a human (Andrew) reviewed Plan 03's TEST-green evidence and approved applying the additive migration to production, with an expanded scope covering both the events migration and the global_search regression fix"
    verification: []
    human_judgment: true
    rationale: "This is inherently a human-judgment gate by design (checkpoint:human-verify, gate=blocking) -- there is no automated check for 'a human approved this.' The approval itself, including its expanded scope, was given in the orchestrating conversation outside this executor invocation and is recorded here per the pre-resolved checkpoint context provided to this agent."
  - id: D2
    description: "Both pending migrations (events/recordings/call_participants schema, and the global_search fix) applied to production (vltmrnjsubfzrgrtdqey), confirmed via migration list and prod-linked type introspection"
    requirement: "EVT-01"
    verification:
      - kind: other
        ref: "supabase db push --linked --dry-run showed exactly 2 pending migrations; supabase db push --linked applied both cleanly; supabase migration list --linked shows 20260831000001 and 20260831010000 in both Local and Remote columns"
        status: pass
    human_judgment: false
  - id: D3
    description: "recordings.event_id is nullable and additive; call_participants gains event_id/role/has_confirmed_speech without touching participant_type or its trigger"
    requirement: "EVT-02"
    verification:
      - kind: other
        ref: "src/types/supabase.ts (regenerated from prod) recordings.Row.event_id: string | null (line 2988); call_participants.Row.event_id/role/has_confirmed_speech (lines 802-809); git diff confirms 0 deletions, only additive changes"
        status: pass
    human_judgment: false
  - id: D4
    description: "call_participants is extended, not replaced -- event_id, role (organizer/invitee/attendee/speaker), and has_confirmed_speech added; existing sources: string[] and participant_type untouched"
    requirement: "EVT-05"
    verification:
      - kind: other
        ref: "src/types/supabase.ts call_participants Row type retains participant_type: string and sources: string[] unchanged, alongside the 3 new nullable columns"
        status: pass
    human_judgment: false
  - id: D5
    description: "src/types/supabase.ts regenerated from prod post-migration and now includes event_id, the events table, and the new call_participants columns; npm run type-check passes"
    requirement: "SAFE-07"
    verification:
      - kind: other
        ref: "grep -q \"event_id\" src/types/supabase.ts && npm run type-check && echo PROD_TYPES_OK -- printed PROD_TYPES_OK; npm run type-check: TYPE CHECK PASSED: 0 new errors, 319/319 baseline"
        status: pass
    human_judgment: false
  - id: D6
    description: "Expanded-scope deviation: global_search()'s 5.5-month-old production regression (SQLSTATE 42703) fixed in production by applying migration 20260831010000 alongside the events migration, per Andrew's explicit 'apply both' decision"
    verification:
      - kind: other
        ref: "supabase migration list --linked shows 20260831010000 applied; the migration's own body is byte-identical to what Plan 30-03 proved passing against TEST via src/test/event-schema-noop.integration.test.ts's global_search assertion"
        status: pass
    human_judgment: true
    rationale: "This migration was NOT in this plan's original files_modified/context scope (the plan text anticipated exactly one pending migration). Applying it to production is a real, acknowledged expansion of scope, authorized by an explicit human decision in the orchestrating conversation (documented in key-decisions above) rather than by this plan's own written acceptance criteria -- flagged for visibility, not auto-passed on written-plan grounds alone."

# Metrics
duration: ~20min
completed: 2026-09-01
status: complete
---

# Phase 30 Plan 04: Production Apply -- Event Model Foundation + global_search Fix Summary

**Both the events-table migration and a 5.5-month-old global_search() production bug fix applied to production (vltmrnjsubfzrgrtdqey) in one guarded push, with the prod-ref guard verified three times and src/types/supabase.ts resynced from the live post-migration schema.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-09-01T01:40:00Z
- **Tasks:** 2 of 2 (Task 1: checkpoint, pre-resolved outside this invocation; Task 2: executed in full)
- **Files modified:** 2 (both modified, 0 created) across 1 commit, plus 2 production schema/function changes (not repo files)

## Accomplishments

- **Task 1 (checkpoint) resolved:** approved, with an expanded scope beyond the plan's original single-migration assumption. Andrew reviewed Plan 03's TEST-green evidence (EVT-03 byte-identical: 5/5; EVT-04+SAFE-05 isolation: 49/49) and explicitly chose "Apply both" -- the events migration (the plan's original scope) AND the global_search regression fix (discovered mid-Plan-03, proven on TEST, left pending prod authorization) together. This decision was made in the orchestrating conversation, outside this executor invocation; not re-presented or re-paused on here.
- **Prod-ref guard confirmed THREE times** (before dry-run, before real push, after real push): linked project is `vltmrnjsubfzrgrtdqey` (callvault-ai), verified via both `supabase/.temp/project-ref` and the `●` LINKED marker in `supabase projects list` -- never `swjzxiddcrtaqixsfaac` (callvault-test) or any other project.
- **Dry-run confirmed exactly 2 pending migrations**, no surprises: `20260831000001_create_events_and_extend_participants.sql` and `20260831010000_fix_global_search_call_tag_assignments_regression.sql`.
- **Both migrations applied to production** via `supabase db push --linked`. The `events` table, `recordings.event_id`, and `call_participants.event_id/role/has_confirmed_speech` are now live. `global_search()`'s UUID join on `call_tag_assignments.recording_id` is restored, ending a bug that has thrown SQLSTATE 42703 on every single invocation since 2026-06-10.
- **`supabase migration list --linked` confirms both applied**: `20260831000001` and `20260831010000` both show matching Local/Remote timestamps.
- **`src/types/supabase.ts` regenerated from prod**, purely additive 53-line diff: `events` table Row/Insert/Update types, `recordings.event_id` + FK, `call_participants.event_id/role/has_confirmed_speech` + FK. No diff near `global_search`'s function type signature, confirming the fix preserved its output shape exactly (as Plan 03's test already proved on TEST).
- **`npm run type-check` passes** (0 new errors, 319/319 baseline) after deliberately updating `type-baseline.json` for the one expected Pitfall-2 message-text shift on `recordings.service.ts`'s pre-existing `TS2740` entry (same file, same code, same 2 call sites, count unchanged -- `event_id` simply became one more enumerated property in an already-baselined, unrelated Pick/full-Row structural mismatch).
- **No application code changed** -- only `src/types/supabase.ts` and `type-baseline.json`, matching the plan's `files_modified` declaration exactly.

## Task Commits

1. **Task 1: Approve applying the additive migration to production** -- checkpoint, no commit (pre-resolved outside this invocation; approval recorded in key-decisions above)
2. **Task 2: Apply to prod (guarded) and regenerate the committed types from prod** -- `8984c1c9` (feat)

**Plan metadata:** committed in the same pass as this SUMMARY (see final commit below).

## Files Created/Modified

- `src/types/supabase.ts` -- regenerated from prod via `supabase gen types typescript --linked`; now includes `events` table Row/Insert/Update types, `recordings.event_id`, `call_participants.event_id/role/has_confirmed_speech`, and both new FK relationships (+53 lines, 0 removed)
- `type-baseline.json` -- `recordings.service.ts|TS2740` entry's hash and message text updated to reflect `event_id` as a newly-enumerated missing property in a pre-existing, unrelated Pick/full-Row structural mismatch; count (2) and total baseline (319) unchanged

**Production (not repo files):**
- `events` table -- live in prod (`vltmrnjsubfzrgrtdqey`), RLS enabled + forced, participation/ownership SELECT policy, service-role-only writes
- `recordings.event_id` -- live, nullable FK to `events.id`, `ON DELETE SET NULL`
- `call_participants.event_id` / `.role` / `.has_confirmed_speech` -- live, nullable, additive
- `global_search()` function body -- live, UUID join on `call_tag_assignments.recording_id` restored, output signature unchanged

## Decisions Made

See `key-decisions` in frontmatter. In short: (1) Task 1's approval, made outside this invocation, explicitly expanded scope to bundle the global_search fix into this prod apply -- recorded, not re-litigated; (2) the prod-ref guard was checked three times given this is the phase's single highest-stakes action; (3) the dry-run was used as a hard gate before the real push; (4) types were regenerated to a temp file and verified before swapping into the tracked file; (5) the type-check baseline was updated only after confirming the "new" error was the same pre-existing bug with a shifted message, not a real regression.

## Deviations from Plan

### Auto-fixed Issues

None -- Task 2 executed as written. The one scope expansion (applying `20260831010000` alongside `20260831000001`) was not an auto-fix under Rules 1-3; it was an explicit human decision made outside this invocation and provided as pre-resolved context (see `checkpoint_already_resolved` in this invocation's prompt and `key-decisions` above). Documented under coverage item D6 with `human_judgment: true` for visibility, since it is a real expansion beyond this plan's originally-written single-migration scope.

## Issues Encountered

- **Self-caught, non-committed mistake during type regeneration:** the first attempt to regenerate `src/types/supabase.ts` used `supabase gen types typescript --linked > file 2>&1`, which merged the CLI's `Initialising login role...` stderr diagnostic into the file as a non-TypeScript first line. Caught immediately via a Read-tool check of the temp file's head before it was ever swapped into the tracked file or committed; discarded and regenerated cleanly with a stdout-only redirect. No effect on the committed result. Logged as a `tech-stack.patterns` entry above so future regenerations avoid the same redirect mistake.

## Known Stubs

None -- this plan touches only generated types and a baseline config file; no UI, no data-flow stubs.

## Threat Flags

None. Both migrations were already fully covered by this plan's own `threat_model` (T-30-04-01 through T-30-04-04) and Plan 30-03's threat assessment of the `global_search` fix (restores a pre-existing access-control pattern's correct operation, does not alter its authorization logic, no new network endpoint/auth path/schema change at a trust boundary). Applying both to production does not change either assessment -- the events RLS policy is exactly what Plan 30-02 authored and Plan 30-03 proved by test; the global_search fix is exactly what Plan 30-03 proved by test on TEST, applied verbatim.

## User Setup Required

None. No dashboard configuration, no environment variables, no manual steps remain for this plan's scope.

## Next Phase Readiness

- The event-model foundation (`events` table, `recordings.event_id`, `call_participants.event_id/role/has_confirmed_speech`) is live in production with zero current behavior change (`event_id` is NULL across the board; Plan 30-03's byte-identical proof covers the four read paths that matter). Phase 31 (Deterministic Resolution, Shadow Mode Only) can now build the matching engine against a real, truthful production schema.
- `global_search()` is no longer broken in production -- the 5.5-month-old regression (SQLSTATE 42703 on every call) is fixed for every user, not just TEST.
- `src/types/supabase.ts` is resynced from prod and committed; any future plan that reads `event_id`, the `events` table, or the new `call_participants` columns has correct types available immediately.
- EVT-01, EVT-02, EVT-05, and SAFE-07 are now satisfied in production, joining EVT-03/EVT-04/EVT-07/SAFE-05 (proven by test in Plan 30-03). Phase 30's full requirement set is now complete pending final phase-level verification.
- No blockers carried forward from this plan. The `v2.2-event-resolution` branch remains unmerged to `main` per the milestone's branch-discipline decision (merge only once the full milestone is proven and Andrew is comfortable) -- this plan's prod DDL apply is explicitly the one exception (schema/RLS applied directly to prod pre-merge, per PROJECT.md's Key Decision and this plan's own design).

---
*Phase: 30-schema-reconciliation-event-model-foundation*
*Completed: 2026-09-01*

## Self-Check: PASSED

- FOUND: `src/types/supabase.ts`
- FOUND: `type-baseline.json`
- FOUND: `.planning/phases/30-schema-reconciliation-event-model-foundation/30-04-SUMMARY.md`
- FOUND commit: `8984c1c9` (feat: apply events migration + global_search fix to prod, resync types)
- Re-verified `src/types/supabase.ts` contains `event_id`: pass
- Re-verified exactly one `events: {` table Row type block present: pass
- Re-verified prod-ref guard: `supabase/.temp/project-ref` = `vltmrnjsubfzrgrtdqey` (unchanged since the push)
- Re-verified `git status --short`: only `src/types/supabase.ts` and `type-baseline.json` in this commit; no unexpected deletions; one pre-existing unrelated modified file (`.planning/debug/autopilot-noise-stuck-tickets.md`) left untouched, matching Plan 30-02/30-03 precedent
- Re-ran `npm run type-check`: `TYPE CHECK PASSED: 0 new errors. Baseline errors remaining: 319/319.`
