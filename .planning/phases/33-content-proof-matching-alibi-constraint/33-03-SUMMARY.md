---
phase: 33-content-proof-matching-alibi-constraint
plan: 03
subsystem: database
tags: [supabase-cli, production-deploy, edge-functions, typescript, event-resolution, matching]

# Dependency graph
requires:
  - phase: 33-content-proof-matching-alibi-constraint
    plan: 01
    provides: p_tier migration (20260905130000), pure content-proof scorer + alibi predicate
  - phase: 33-content-proof-matching-alibi-constraint
    plan: 02
    provides: content-proof tier + alibi veto wired into runShadowSweep, TEST-applied migration
provides:
  - Migration 20260905130000 (apply_event_match_atomic p_tier param) LIVE in production
  - resolve-events edge function redeployed to production with content-proof + alibi logic (v6, ACTIVE)
  - src/types/supabase.ts re-synced from production
  - Empirically corrected inertness proof: transcript_chunks is NOT globally empty (61,253 real rows), but the one flagged org has zero linkage to it
affects: [34-identity-consolidation, any future phase enabling event_resolution for a new organization]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Prod-ref guard via two independent Supabase CLI signals (supabase/.temp/project-ref file + `supabase projects list` LINKED marker), confirmed before AND after every mutating step -- same discipline as Phase 30/31/32 (no .env file exists in this checkout, same gap Phase 31 P04 flagged)"
    - "Types regen written to a scratchpad temp file first, verified (line count, tail terminator, banner-contamination grep, targeted diff against the committed file), THEN swapped over the committed path"
    - "Inertness claims verified by querying the ACTUAL code path's join key (canonical_recording_id), not just a bare table-wide COUNT(*) -- a global count can be misleading when only one flagged org's candidate pool matters"

key-files:
  created: []
  modified:
    - src/types/supabase.ts

key-decisions:
  - "Task 2 (checkpoint:human-verify, prod-apply authorization) recorded as resolved: approved by Andrew outside this executor invocation per the orchestrator's explicit checkpoint_already_resolved directive -- not re-presented."
  - "Corrected a load-bearing assumption from 33-RESEARCH.md (Assumption A1) and this plan's own must_haves/critical_context via live prod introspection: transcript_chunks has 61,253 real rows (54,373 linked to 1,397 distinct recordings, spanning 2025-11-27 to 2026-07-04), NOT '~0 rows' as assumed. This is real historical data, almost certainly leftover from the dormant RAG/hybrid-search feature 33-RESEARCH.md's code-path grep correctly found has zero LIVE writers today -- the grep-verified code-path dormancy was right, but data ingested before that feature was pulled remains in the table. Went beyond the plan's literal 3-check list to verify the CONCLUSION (inert today) still holds for the ACTUAL reason the code cares about: joined transcript_chunks to recordings and confirmed the one flagged org (Clickable Impact, 3def74de-495f-411b-b5dd-b3852429b14d) has 249 recordings, all unresolved, and ZERO of them have any transcript_chunks linkage (ci_recordings_with_chunks=0). The 61K rows belong to 7 other orgs, none of which have the event_resolution flag enabled. Tier is genuinely, verifiably inert today -- but for a more precise and different reason than assumed, and this reasoning will NOT hold automatically if event_resolution is ever enabled for one of those other 7 orgs. Flagged forward in STATE.md Blockers/Concerns."
  - "Reverted incidental supabase/.temp/{gotrue,rest,storage}-version and storage-migration file drift (CLI-recorded linked-project service versions, touched as a side effect of `supabase link`/`db push`/`gen types`, unrelated to this task) via `git checkout --` before committing, keeping the task commit scoped to exactly src/types/supabase.ts."

requirements-completed: [MATCH-02, MATCH-07]

# Metrics
duration: ~17min
completed: 2026-09-05
---

# Phase 33 Plan 03: Guarded Production Apply Summary

**Migration 20260905130000 (`apply_event_match_atomic` p_tier param) and the content-proof/alibi `resolve-events` redeploy are live in production, proven inert by introspection -- but the inertness reason required correcting a wrong research assumption: `transcript_chunks` has 61,253 real rows (not ~0), yet the one flagged organization has zero linkage to any of them.**

## Performance

- **Duration:** ~17 min
- **Started:** 2026-09-05T17:56:13Z (approx., inherited from STATE.md's last session timestamp immediately preceding this plan)
- **Completed:** 2026-09-05T18:13:27Z
- **Tasks:** 3 (Task 1 verification-only/no-op, Task 2 pre-resolved checkpoint, Task 3 executed)
- **Files modified:** 1 (`src/types/supabase.ts`)

## Accomplishments

- Task 1 gate re-proven (not assumed): re-linked TEST, confirmed migration `20260905130000` already `Local==Remote` (applied during Plan 02, exactly as that plan's own SUMMARY predicted), introspection confirmed exactly one `apply_event_match_atomic` overload with trailing `p_tier text DEFAULT 'deterministic'::text`, and the content-proof integration test ran green against TEST (`PASS (4) FAIL (0)`). Prod untouched during this task.
- Task 2 (checkpoint:human-verify, prod-apply authorization) recorded as resolved: approved by Andrew outside this executor invocation, per this invocation's explicit pre-resolved instruction. Not re-presented.
- Task 3: relinked to production, confirmed the prod ref via two independent signals both BEFORE and AFTER every mutation, dry-ran the pending migration set (exactly one: `20260905130000_content_proof_apply_tier_param.sql`), applied it for real, redeployed `resolve-events` via `--use-api` (now bundling `_shared/event-resolver.ts`'s content-proof + alibi logic, live at version 6), regenerated `src/types/supabase.ts` via the scratchpad-first discipline (clean regen this run -- no CLI banner contamination), and proved inertness by direct SQL introspection.
- **Went beyond the plan's literal 3-item inertness checklist** when the first check (`transcript_chunks` COUNT) came back 61,253 instead of the expected ~0. Rather than recording a number that contradicted the plan's own safety claim without investigating further, joined `transcript_chunks` to `recordings` on the actual column the code queries (`canonical_recording_id`) and confirmed the ONE flagged organization (Clickable Impact) has zero linkage to any of those rows -- the tier is still genuinely inert today, verified for the real reason the code cares about, not the assumed one.
- `npx tsc -p tsconfig.app.json` / `node scripts/type-check.mjs`: 0 new errors, baseline unchanged at 321/321 -- no `--update-baseline` needed.

## Task Commits

1. **Task 1: Apply to TEST and gate on green** -- no commit (no `files_modified` declared; verification-only, confirmed no-op since Plan 02 already applied the migration to TEST).
2. **Task 2: Approve production apply** -- checkpoint, resolved outside this executor invocation (Andrew approved), no commit; decision recorded here per the plan's Task 2 acceptance criteria.
3. **Task 3: Guarded prod apply + resolve-events redeploy + type re-sync + inertness proof** -- `d2d3cb0a` (feat)

**Plan metadata:** (this commit, following SUMMARY.md write)

## Files Created/Modified

- `src/types/supabase.ts` -- Regenerated from production; gained `apply_event_match_atomic`'s `p_tier?: string` argument. Diff against the prior committed version is exactly that one functional line plus CLI-generator-version blank-line formatting noise (confirmed via `diff`, 20 total changed lines) -- no unexpected schema drift snuck in from unrelated concurrent prod changes.

## Live prod verification (verbatim, per plan `<output>` requirement)

**Prod-ref guard, BEFORE (via `supabase/.temp/project-ref` + `supabase projects list`):**
```
vltmrnjsubfzrgrtdqey
● | diusatnehodatlojcmjc | vltmrnjsubfzrgrtdqey | callvault-ai
```
(No `.env` file exists in this checkout -- same gap Phase 31 P04 recorded. The CLI's linked-project-state via two independent signals is the guard actually used, consistent with every prior guarded-apply plan in this milestone.)

**Migration dry-run (confirms exact scope, nothing else pending):**
```
Would push these migrations:
 • 20260905130000_content_proof_apply_tier_param.sql
```
(`20260905120000_kill_switch_revert_idempotency_fix.sql` was already `Local==Remote` on prod before this plan ran -- pre-existing, out of this plan's scope, unaffected.)

**Migration list after apply (Local == Remote):**
```
20260905130000 | 20260905130000 | 2026-09-05 13:00:00
```

**Edge function post-deploy (`supabase functions list --project-ref vltmrnjsubfzrgrtdqey`):**
```
resolve-events | ACTIVE | v6 | 2026-09-05 18:02:56
```
Deploy output confirmed assets uploaded: `index.ts`, `_shared/event-resolver.ts`, `_shared/dedup-fingerprint.ts`, `_shared/cors.ts`.

**Inertness introspection (direct SQL via `supabase db query --linked`):**

| Check | Result |
|---|---|
| `apply_event_match_atomic` signature | Exactly one overload: `p_tier text DEFAULT 'deterministic'::text` trailing arg (TEST, re-confirmed) |
| `SELECT COUNT(*) FROM transcript_chunks` | **61,253** -- NOT ~0 as `33-RESEARCH.md` assumed (see Decisions Made / Corrected Assumption below) |
| `transcript_chunks` linkage | 54,373 of 61,253 rows have a `canonical_recording_id`, spanning 1,397 distinct recordings, `created_at` 2025-11-27 to 2026-07-04 |
| Clickable Impact (the one flagged org) recordings vs. `transcript_chunks` | 249 recordings, all `event_id IS NULL` (unresolved), **0** have any `transcript_chunks` linkage |
| Distinct orgs with any chunked recording | 7 -- none of which is Clickable Impact |
| `event_match_decisions` WHERE `tier='content_proof'` | **0** |
| `apply_event_match_atomic` EXECUTE grants | `anon`: false, `authenticated`: false, `service_role`: true |
| `organization_feature_flags` WHERE `flag_key='event_resolution'` | Exactly 1 row: `organization_id=3def74de-495f-411b-b5dd-b3852429b14d` (Clickable Impact), `enabled=true` -- unchanged, untouched by this plan |

**Prod-ref guard, AFTER (re-run after the last deploy and the types regen):**
```
vltmrnjsubfzrgrtdqey
● | diusatnehodatlojcmjc | vltmrnjsubfzrgrtdqey | callvault-ai
```

**Type-check:**
```
TYPE CHECK PASSED: 0 new errors.
Baseline errors remaining: 321/321 (projects: tsconfig.app.json, tsconfig.node.json).
```

## Decisions Made

- **Task 2 pre-resolved:** approved by Andrew outside this executor invocation, per the orchestrator's explicit `checkpoint_already_resolved` directive. Scope: exactly the migration apply + `resolve-events` redeploy, as originally scoped in the plan -- no expansion.
- **Corrected assumption (transcript_chunks is NOT near-empty):** `33-RESEARCH.md`'s Assumption A1 and this plan's own `must_haves`/`critical_context` stated `transcript_chunks` has "zero real production rows." Direct prod introspection shows 61,253 real rows. The research's underlying CODE-path claim was correct (exhaustive grep found zero live INSERT/SELECT call sites anywhere in the current codebase) -- but that only proves no CURRENT code writes to it, not that the table has always been empty. The data almost certainly predates the removal of the "earlier RAG/hybrid-search feature" the research doc itself names as the table's original purpose (dates span 2025-11-27 through 2026-07-04, consistent with a feature that operated for a while before being pulled per the AI-02 hard constraint). Rather than stopping at the raw count, I traced the code's actual join key (`canonical_recording_id`, confirmed by reading `event-resolver.ts`'s fetch) and confirmed the ONE organization the sweep actually processes today (Clickable Impact, gated by `organization_feature_flags`) has zero recordings linked to any `transcript_chunks` row. The 61K rows belong to 7 other, unflagged organizations. **The deploy is genuinely inert today, verified for the real mechanism (zero candidate-pool chunk coverage for the flagged org), not the assumed one (global table emptiness).** This distinction matters going forward -- see Next Phase Readiness / STATE.md Blockers.
- **Reverted incidental `supabase/.temp/*` file drift before committing.** `supabase link` / `db push` / `gen types` touched `gotrue-version`, `rest-version`, `storage-migration`, `storage-version` (tracked-in-git CLI cache files recording the linked project's component versions) as a side effect. These carry no information relevant to this task and would have been confusing, unexplained noise in the commit. Reverted via `git checkout --` (sanctioned, file-scoped, not a blanket reset) before staging.
- **Worktree HEAD assertion:** `.git` is a file here (linked worktree), HEAD is on `v2.2-event-resolution` -- the project's deliberate long-lived milestone branch (not `main`/`master`/a protected ref, and not the ephemeral `worktree-agent-*` parallel-execution namespace the generic protocol template's positive allow-list targets). This exact scenario was already reasoned through and committed-through in Phase 31 P04's SUMMARY; combined with this invocation's explicit `sequential_execution` directive ("worktree isolation disabled... normal git commits with hooks"), committed normally, consistent with every prior Phase 30-33 plan on this branch.

## Deviations from Plan

None requiring a code fix -- plan executed exactly as written for all mutating steps. The one substantive finding (transcript_chunks row count) was an assumption correction discovered via the plan's own mandated verification step, not a bug requiring a fix; see Decisions Made above for the full investigation and why it does not change the plan's outcome.

## Issues Encountered

- **`organization_feature_flags` column name assumption was wrong on first query.** Guessed `flag_name` (matching the informal language used across STATE.md decision entries); actual column is `flag_key`. Corrected by querying `information_schema.columns` and re-running with the right name. No impact -- read-only introspection, caught immediately.

## User Setup Required

None -- no external service configuration required for this plan's own scope. Carried forward from Phase 32 (unrelated to this plan, still open): the `event-resolution-sweep` pg_cron job has failed every 15-minute tick since creation because `app.supabase_url`/`app.reconcile_secret` DB GUCs are unset, and the pooler connection returns permission denied on `ALTER DATABASE`. Requires Andrew via Supabase Dashboard (Settings -> Database -> Custom postgres settings). Not blocking -- zero orgs beyond Clickable Impact are flagged, and Clickable Impact's own sweep evidence was already captured manually in Phase 32 P05.

## Next Phase Readiness

- MATCH-02 (content-proof tier) and MATCH-07 (speaker-alibi constraint) are fully shipped: code live in production, migration live, proven inert by direct introspection.
- **Forward-looking flag for whoever next enables `event_resolution` for a second organization:** do not assume `transcript_chunks` is globally empty the way this phase's research did. Check that specific organization's own recording-to-`transcript_chunks` linkage (the exact query used in this SUMMARY's Live prod verification table) before flipping its flag -- if that org happens to be one of the 7 with historical chunked recordings, the content-proof tier would no longer be a no-op for it, and its shingle-overlap behavior would be exercised on real data for the first time. This is not a bug or a regression risk (the tier is correctly implemented and fail-closed either way) -- it is simply the first time "inert" would stop being true, and whoever flips that flag should know it going in rather than discover it from an unexpected proposal.
- `has_confirmed_speech` remains unpopulated by any live writer (unchanged from Phase 33 Plan 01/02's finding) -- the alibi veto remains correct-but-currently-unreachable on organic data, same as before.
- The still-broken `event-resolution-sweep` pg_cron GUCs (Phase 32, Andrew via Supabase Dashboard) remain open and non-blocking.
- No blockers for Phase 34.

---
*Phase: 33-content-proof-matching-alibi-constraint*
*Completed: 2026-09-05*

## Self-Check: PASSED

- FOUND: `src/types/supabase.ts`
- FOUND: `p_tier` present in `src/types/supabase.ts`
- FOUND: `.planning/phases/33-content-proof-matching-alibi-constraint/33-03-SUMMARY.md`
- FOUND: commit `d2d3cb0a` (feat: Task 3, guarded prod apply + redeploy + type re-sync)
- FOUND: commit `739e937a` (33-02 plan metadata) -- prior plan history intact
