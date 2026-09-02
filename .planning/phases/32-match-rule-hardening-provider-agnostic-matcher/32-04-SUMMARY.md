---
phase: 32-match-rule-hardening-provider-agnostic-matcher
plan: 04
subsystem: database
tags: [supabase-cli, production-deploy, edge-functions, typescript, security-invoker, kill-switch]

# Dependency graph
requires:
  - phase: 32-match-rule-hardening-provider-agnostic-matcher
    plan: 01
    provides: hardened checkMatch (F5 fix), shouldSuppressTitleSignal primitive, recurring_call_titles security_invoker corrective migration (TEST-applied)
  - phase: 32-match-rule-hardening-provider-agnostic-matcher
    plan: 02
    provides: findMetadataCandidates/writeMetadataProposals provider-agnostic metadata tier wired into runShadowSweep
  - phase: 32-match-rule-hardening-provider-agnostic-matcher
    plan: 03
    provides: kill_switch_revert_event_merges SECURITY DEFINER RPC migration (TEST-applied)
provides:
  - The hardened checkMatch (F5 fix) LIVE in production via zoom-webhook + zoom-sync-meetings
  - The provider-agnostic metadata tier LIVE in production via resolve-events (inert -- zero orgs flagged)
  - kill_switch_revert_event_merges RPC LIVE in production, service-role-only
  - recurring_call_titles security_invoker regression repaired in production
  - src/types/supabase.ts re-synced from production
affects: [32-05-precision-measurement]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Prod-ref guard via two independent Supabase CLI signals (supabase/.temp/project-ref file + `supabase projects list` LINKED marker), confirmed before AND after every mutating step -- same discipline as Phase 30/31"
    - "Types regen written to a scratchpad temp file first, verified, THEN swapped over the committed file -- this run actually caught a real contamination case (see Deviations), proving the discipline's value rather than just following precedent"

key-files:
  created: []
  modified:
    - src/types/supabase.ts

key-decisions:
  - "Task 1 checkpoint recorded as resolved: approved by Andrew outside this executor invocation, exact scope (kill-switch RPC migration + recurring_call_titles security_invoker fix migration + 3 edge-function redeploys, zero flag enablement) -- not re-presented, per this invocation's explicit checkpoint_already_resolved directive"
  - "Both pending migrations applied in one `supabase db push --linked` batch after a `--dry-run` confirmed exactly the 2 expected files and nothing else pending -- matches Phase 31 Plan 04's dry-run-first discipline"
  - "Edge functions deployed one at a time (not batched) for clear per-function error isolation and to individually confirm the prod ref named in each deploy's own CLI output"
  - "Ran the plan's optional read-only historical F5 blast-radius audit (zoom_raw_calls rows with non-null fuzzy_match_score AND is_primary=false) -- result is 0, consistent with Plan 02's finding that the consuming Zoom dedup-merge pipeline was dead code, never wired to the live handler"

requirements-completed: [MATCH-03, MATCH-04, MATCH-05, MATCH-06, MATCH-08, SAFE-03]

coverage:
  - id: D1
    description: "Task 1 prod-apply gate: exact migration + edge-function-deploy set approved by Andrew before any production mutation"
    verification:
      - kind: manual_procedural
        ref: "Pre-resolved by the human operator outside this executor invocation (see orchestrator's checkpoint_already_resolved directive); no expanded scope"
        status: pass
    human_judgment: true
    rationale: "Production DDL + deploy approval is inherently a human decision; already made and recorded, but the coverage schema requires human_judgment:true for any approval-gate deliverable regardless of when the decision occurred."
  - id: D2
    description: "Prod-ref guard confirmed vltmrnjsubfzrgrtdqey (not swjzxiddcrtaqixsfaac/callvault-test) both before and after every mutating step, via two independent signals"
    verification:
      - kind: other
        ref: "Read supabase/.temp/project-ref (= vltmrnjsubfzrgrtdqey) + `supabase projects list` ● LINKED marker on callvault-ai/vltmrnjsubfzrgrtdqey, run before the migration push and re-run after the last edge-function deploy"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both Phase-32 migrations (20260902000001 recurring_call_titles security_invoker fix, 20260902000002 kill_switch_revert_event_merges) applied to production, Local==Remote"
    requirement: "SAFE-03"
    verification:
      - kind: other
        ref: "supabase db push --linked --dry-run (confirmed exactly 2 pending, nothing else) then supabase db push --linked; supabase migration list --linked (both 20260902000001/20260902000002 Local==Remote)"
        status: pass
    human_judgment: false
  - id: D4
    description: "kill_switch_revert_event_merges RPC live in production, EXECUTE denied to anon/authenticated, granted to service_role"
    requirement: "SAFE-03"
    verification:
      - kind: other
        ref: "Direct SQL introspection via `supabase db query --linked`: ks_fn_exists=1, anon_can_execute_ks=false, auth_can_execute_ks=false, service_can_execute_ks=true"
        status: pass
    human_judgment: false
  - id: D5
    description: "recurring_call_titles security_invoker regression (found live in Plan 01) repaired in production -- reloptions now [security_invoker=true], was null before"
    requirement: "MATCH-05"
    verification:
      - kind: other
        ref: "Direct SQL introspection via `supabase db query --linked`: recurring_view_reloptions=[\"security_invoker=true\"] (was null per 32-01-SUMMARY.md's verbatim before-state record)"
        status: pass
    human_judgment: false
  - id: D6
    description: "zoom-webhook and zoom-sync-meetings redeployed via --use-api, now bundling the hardened checkMatch (F5 fix) -- the live F5 bug is closed in production"
    requirement: "MATCH-04"
    verification:
      - kind: other
        ref: "supabase functions deploy zoom-webhook --use-api / zoom-sync-meetings --use-api output both named project vltmrnjsubfzrgrtdqey and uploaded _shared/dedup-fingerprint.ts as an asset; supabase functions list --project-ref vltmrnjsubfzrgrtdqey confirms zoom-webhook v221 and zoom-sync-meetings v229, both UPDATED_AT 2026-09-02 10:36:1x/2x"
        status: pass
    human_judgment: false
  - id: D7
    description: "resolve-events redeployed via --use-api, now bundling the provider-agnostic metadata tier (findMetadataCandidates/writeMetadataProposals, asymmetric MERGE_PROPOSE_THRESHOLD=0.80) -- live but inert"
    requirement: "MATCH-03"
    verification:
      - kind: other
        ref: "supabase functions deploy resolve-events --use-api output named project vltmrnjsubfzrgrtdqey and uploaded _shared/event-resolver.ts + _shared/dedup-fingerprint.ts as assets; functions list confirms resolve-events v3, UPDATED_AT 2026-09-02 10:36:26"
        status: pass
      - kind: other
        ref: "Post-deploy SQL introspection: total_flag_rows=0, enabled_flag_rows=0 -- mechanism confirmed inert by introspection, not assumption (MATCH-06/MATCH-08's scoring logic and provider-agnostic reads are live but structurally cannot fire for any org)"
        status: pass
    human_judgment: false
  - id: D8
    description: "src/types/supabase.ts regenerated from prod and type-checked clean"
    verification:
      - kind: other
        ref: "node scripts/type-check.mjs -- TYPE CHECK PASSED: 0 new errors. Baseline errors remaining: 321/321 (unchanged, no update-baseline needed)"
        status: pass
    human_judgment: false

# Metrics
duration: ~8min
completed: 2026-09-02
status: complete
---

# Phase 32 Plan 04: Guarded Production Apply Summary

**The live F5 recurring-meeting false-merge bug is closed in production (hardened `checkMatch` now bundled into `zoom-webhook`/`zoom-sync-meetings`); the provider-agnostic metadata tier and `kill_switch_revert_event_merges` RPC are live but inert; `recurring_call_titles`' security_invoker regression is repaired in prod; `src/types/supabase.ts` re-synced, catching and stripping a real CLI-stdout-contamination bug in the regen output before it reached the committed file.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-09-02T10:33:23Z (approx., inherited from STATE.md's last session timestamp immediately preceding this plan)
- **Completed:** 2026-09-02T10:39:35Z
- **Tasks:** 2 (Task 1 pre-resolved as a checkpoint; Task 2 executed)
- **Files modified:** 1 (`src/types/supabase.ts`)

## Accomplishments

- Task 1 (checkpoint:human-verify) recorded as resolved per the pre-authorized instruction: Andrew approved the exact prod-mutation set (2 migrations + 3 edge-function redeploys, zero flag enablement) outside this executor invocation. Not re-presented; proceeded directly to Task 2.
- Confirmed the prod-ref guard via two independent signals (`supabase/.temp/project-ref` file + `supabase projects list` ● LINKED marker on `callvault-ai`/`vltmrnjsubfzrgrtdqey`) both BEFORE the migration push and AFTER the last edge-function deploy -- never drifted to `callvault-test`/`swjzxiddcrtaqixsfaac`.
- Ran `supabase db push --linked --dry-run` first (confirmed exactly the 2 expected Phase-32 migrations pending, nothing else), then applied for real. Both `20260902000001_recurring_call_titles_security_invoker.sql` and `20260902000002_kill_switch_revert_event_merges.sql` are now `Local == Remote` on production.
- Redeployed `zoom-webhook`, `zoom-sync-meetings`, and `resolve-events` to production via `--use-api` (Docker-free). Deploy output for each named `vltmrnjsubfzrgrtdqey` explicitly; the CLI's own asset-upload log confirmed `_shared/dedup-fingerprint.ts` bundled into the first two and `_shared/event-resolver.ts` + `_shared/dedup-fingerprint.ts` bundled into `resolve-events`. `supabase functions list --project-ref vltmrnjsubfzrgrtdqey` confirms all three at fresh `UPDATED_AT` timestamps (`2026-09-02 10:36:17/22/26`) with version bumps (zoom-webhook v221, zoom-sync-meetings v229, resolve-events v3), all `ACTIVE`.
- Direct SQL introspection against prod (not assumption) proved: `kill_switch_revert_event_merges` exists, `EXECUTE` denied to `anon`/`authenticated`, granted to `service_role`; `organization_feature_flags` has zero rows total (so necessarily zero `enabled=true`) -- the metadata tier and kill switch are live but structurally inert; `recurring_call_titles.reloptions` now reads `["security_invoker=true"]`, repairing the regression Plan 01 found and recorded as `null` in its own before-state SUMMARY snapshot.
- Ran the plan's OPTIONAL read-only historical F5 blast-radius audit (`zoom_raw_calls` rows with non-null `fuzzy_match_score` AND `is_primary=false`): **0 rows**. Consistent with Plan 02's finding that the Zoom dedup-merge pipeline consuming these columns was dead code, never wired to the live webhook handler -- there was never any historical blast radius to remediate.
- Regenerated `src/types/supabase.ts` from prod via a scratchpad-temp-file-first discipline. This run's verification step caught a real bug: the Supabase CLI's update-nag banner (3 lines: "Initialising login role...", version notice, upgrade-recommendation URL) leaked onto **stdout**, not stderr, appending itself after the file's true `} as const` terminator. Stripped the 3 contaminated lines, re-verified the clean 6273-line file (valid TS structure, `kill_switch_revert_event_merges` present exactly once, zero stray banner text), and only then swapped it over the committed path. `node scripts/type-check.mjs` passes: 0 new errors, baseline unchanged at 321/321.

## Task Commits

1. **Task 1: Prod-apply gate** -- resolved outside this invocation (approved by Andrew, exact scope, no expansion); no commit, decision recorded here per the plan's Task 1 acceptance criteria.
2. **Task 2: Guarded prod apply + type re-sync** -- `384bc2d` (feat)

**Plan metadata:** (this commit, following SUMMARY.md write)

## Files Created/Modified

- `src/types/supabase.ts` -- Regenerated from production; gained `kill_switch_revert_event_merges` Function type (`Args: { p_start_time, p_end_time, p_organization_id? }`, `Returns: number`); remaining diff is Supabase CLI generator-version formatting noise (blank-line placement, parenthesization of generic type helpers) with zero functional change. No visible diff for the `recurring_call_titles` view itself -- `security_invoker` is an RLS-enforcement option, not a typed-shape change, so a zero-diff result there is the correct, expected outcome per the plan's own acceptance criteria.

## Live prod verification (verbatim, per plan `<output>` requirement)

**Prod-ref guard, BEFORE (via `supabase/.temp/project-ref` + `supabase projects list`):**
```
vltmrnjsubfzrgrtdqey
● | diusatnehodatlojcmjc | vltmrnjsubfzrgrtdqey | callvault-ai
```

**Migration dry-run (confirms exact scope, nothing else pending):**
```
Would push these migrations:
 • 20260902000001_recurring_call_titles_security_invoker.sql
 • 20260902000002_kill_switch_revert_event_merges.sql
```

**Migration list after apply (Local == Remote for both):**
```
20260902000001 | 20260902000001 | 2026-09-02 00:00:01
20260902000002 | 20260902000002 | 2026-09-02 00:00:02
```

**Post-apply SQL introspection:**
```json
{
  "ks_fn_exists": 1,
  "anon_can_execute_ks": false,
  "auth_can_execute_ks": false,
  "service_can_execute_ks": true,
  "total_flag_rows": 0,
  "enabled_flag_rows": 0,
  "recurring_view_reloptions": ["security_invoker=true"]
}
```

**Edge functions post-deploy (`supabase functions list --project-ref vltmrnjsubfzrgrtdqey`):**
```
zoom-sync-meetings | ACTIVE | v229 | 2026-09-02 10:36:22
zoom-webhook        | ACTIVE | v221 | 2026-09-02 10:36:17
resolve-events       | ACTIVE | v3   | 2026-09-02 10:36:26
```

**Prod-ref guard, AFTER (re-run after the last deploy):**
```
vltmrnjsubfzrgrtdqey
● | diusatnehodatlojcmjc | vltmrnjsubfzrgrtdqey | callvault-ai
```

**Optional historical F5 blast-radius audit (read-only, non-remediating):**
```json
{ "f5_historical_candidate_count": 0 }
```

## Decisions Made

- Task 1 (pre-resolved): approved by Andrew outside this executor invocation. Scope: exactly the 2 migrations + the 3 edge-function deploys, as originally scoped in the plan -- no expansion, no flag enablement.
- Applied both pending migrations in a single `supabase db push --linked` batch (not one-at-a-time) after the `--dry-run` confirmed the exact expected set -- both are independent, additive, and already proven on TEST individually (Plans 01 and 03), so batching them was safe and matched the plan's own Task 2 action text ("Apply the Phase-32 migration(s) to prod").
- Deployed the three edge functions individually (not via `supabase functions deploy --use-api` with no function name, which would redeploy everything) to keep the blast radius scoped exactly to the plan's named functions and get per-function confirmation of the prod ref in each deploy's own output.
- Ran the optional historical F5 audit since it is read-only, explicitly sanctioned as non-remediating, and adds real evidence to this SUMMARY -- result (0 rows) closes the loop on Plan 02's dead-code discovery with a second, independent confirmation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, caught before commit] Supabase CLI update-nag banner leaked onto stdout, contaminating the types regen output**
- **Found during:** Task 2, verifying the scratchpad temp file before swapping it over `src/types/supabase.ts` (the exact verification step this plan and Phase 31 Plan 04 both call out as mandatory: "verified exit code, clean stderr, valid TS structure... THEN swap")
- **Issue:** `supabase gen types typescript --linked > file.ts 2> stderr.log` produced exit code 0 and an empty stderr log, but the regenerated file's true content (ending `} as const` at line 6273) had 3 extra lines appended after it -- `Initialising login role...`, the CLI-update-available notice, and the upgrade-recommendation URL. These are normally treated as stderr-class CLI noise (and Phase 31 Plan 04's SUMMARY explicitly names this exact contamination class as a mistake it avoided), but this run proved the CLI actually writes them to **stdout** in this environment/version (`v2.101.0`), not stderr -- the `2>` redirect didn't catch them. Had this been swapped over uninspected, the committed `src/types/supabase.ts` would have shipped 3 lines of non-TypeScript garbage appended after its module boundary, breaking the build.
- **Fix:** Located the true end of the valid TS content via direct line inspection (`} as const` at line 6273), truncated the file to exactly those 6273 lines with `head -n 6273`, and re-verified the clean file (correct tail, correct line count, `kill_switch_revert_event_merges` present exactly once, zero stray banner text) before swapping it over the committed path.
- **Files modified:** `src/types/supabase.ts` (the clean version was what got committed; the contaminated version never touched the repo)
- **Verification:** `node scripts/type-check.mjs` passes cleanly (0 new errors, 321/321 baseline unchanged) against the stripped file.
- **Committed in:** `384bc2d` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug, caught pre-commit via the plan's own mandated verify-before-swap step).
**Impact on plan:** Zero production impact -- the contamination was caught in the scratchpad temp file before ever reaching the committed path or a deploy. Validates why the temp-file-first discipline (established in Phase 31 Plan 04, restated in this plan's `read_first`) exists: this is the first time it actually caught something, rather than being a precaution that never fires.

## Issues Encountered

None beyond the auto-fixed types-regen contamination above. The migration dry-run showed no surprises, the real push applied cleanly, all three edge-function deploys succeeded on the first attempt, and the post-apply SQL introspection matched every expected value with no follow-up investigation needed.

## User Setup Required

None -- no external service configuration required. (The `RECONCILE_SECRET` / DB GUC gap for the `event-resolution-sweep` cron, carried forward from Phase 31 Plan 04, remains open and non-blocking -- zero orgs are flagged, so the cron has nothing to do regardless.)

## Next Phase Readiness

- The live F5 bug is closed in production: `checkMatch`'s mandatory `timeOverlap > 0` gate is now bundled into both `zoom-webhook` and `zoom-sync-meetings`. (Per STATE.md's Blockers/Concerns entry, the bug was already confirmed dormant -- the consuming pipeline was dead code -- so this deploy's practical effect is defense-in-depth rather than stopping an active false-merge stream; it is still the correct and required fix per MATCH-04.)
- The provider-agnostic metadata tier (`findMetadataCandidates`, asymmetric `MERGE_PROPOSE_THRESHOLD=0.80`) and the `kill_switch_revert_event_merges` RPC are both live in production, proven inert by direct introspection (zero `organization_feature_flags` rows exist at all) -- ready for Plan 05 to enable a single organization and measure precision (SAFE-06).
- `recurring_call_titles`'s `security_invoker` regression (T-32-05) is fully repaired in production, closing the cross-user-disclosure class Plan 01 found live.
- `src/types/supabase.ts` is re-synced with production and `node scripts/type-check.mjs` is green (0 new errors, 321/321 baseline unchanged).
- No blockers for Plan 05.

---
*Phase: 32-match-rule-hardening-provider-agnostic-matcher*
*Completed: 2026-09-02*

## Self-Check: PASSED

- FOUND: `.planning/phases/32-match-rule-hardening-provider-agnostic-matcher/32-04-SUMMARY.md`
- FOUND: `src/types/supabase.ts`
- FOUND: commit `384bc2d` (feat: Task 2, guarded prod apply + type re-sync)
