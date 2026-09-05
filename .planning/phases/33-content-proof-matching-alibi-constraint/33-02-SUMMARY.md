---
phase: 33-content-proof-matching-alibi-constraint
plan: 02
subsystem: event-resolution matching engine (content-proof tier wired into sweep + alibi veto)
tags: [event-resolution, matching, runShadowSweep, integration-testing, postgres-rpc]

# Dependency graph
requires:
  - phase: 33-01
    provides: extractShingles/scoreContentProofOverlap/findContentProofMatches (pure content-proof scorer), isSpeakerAlibiViolation (pure alibi veto predicate), apply_event_match_atomic's additive p_tier parameter
provides:
  - Content-proof (tier 2) propose-only pass live inside runShadowSweep, positioned between the tier-1 loop and the metadata block, in its own fail-closed try/catch
  - Speaker-alibi veto threaded across all three tier write paths (deterministic, content-proof, metadata) via a single hoisted call_participants lookup
  - ShadowSweepSummary extended with contentProofProposed + alibiRejected counters
  - src/test/event-resolution-content-proof.integration.test.ts -- end-to-end TEST proof of attach, dominant zero-transcript fallback, alibi rejection, and the auto-attach capability
  - Live-schema correction to the transcript_chunks seeding contract (recording_id left NULL, not a synthetic bigint)
affects: [33-03, event-resolver.ts callers, any future phase reading ShadowSweepSummary]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Third tier-pass inserted between two existing passes, reusing the exact fail-closed try/catch + idempotent-insert idiom from tier-1/metadata (Pattern 1/3, 33-RESEARCH.md)
    - Alibi veto implemented as a single hoisted lookup + closure (isAlibiVetoed) checked immediately before every tier's write, not as a fourth tier
    - Fail-closed-toward-not-vetoing: an alibi fetch error or missing lookup entry can only ever ADD a rejection on positive evidence, never suppress a genuine merge

key-files:
  created:
    - src/test/event-resolution-content-proof.integration.test.ts
    - .planning/phases/33-content-proof-matching-alibi-constraint/deferred-items.md
  modified:
    - supabase/functions/_shared/event-resolver.ts

key-decisions:
  - "Split the combined content-proof+alibi edit into two atomic per-task commits by temporarily rolling back the alibi pieces, committing Task 1 alone, then re-applying and committing Task 2 -- keeps task_commit_protocol's per-task atomicity even though both tasks touch the same function in the same file."
  - "Corrected 33-01-SUMMARY.md/33-02-PLAN.md's transcript_chunks seeding-contract claim via live schema introspection (both TEST and prod, this session): recording_id is NULLABLE with a still-LIVE composite FK (transcript_chunks_recording_user_fkey on (recording_id, user_id) -> fathom_raw_calls), NOT dropped as previously stated. Seeded chunks leave recording_id NULL (Postgres never enforces a multi-column FK when any column is NULL) instead of fabricating a bigint that would violate it."
  - "Fixed a real regression (Rule 1) discovered during Task 3 verification: three doc comments in event-resolver.ts (one pre-existing from 33-01, two added by this plan's Task 1/2) spelled out the literal string 'apply_event_match_atomic', breaking event-match-apply-reverse.integration.test.ts's SAFE-02 substring-check test. Reworded all three; no behavior change."

requirements-completed: [MATCH-02, MATCH-07]

# Metrics
duration: ~40min
completed: 2026-09-05
---

# Phase 33 Plan 02: Content-Proof Sweep Wiring + Alibi Veto Summary

Content-proof (tier 2) propose-only pass and the speaker-alibi veto are now live inside `runShadowSweep`, proven end-to-end on TEST with seeded synthetic `transcript_chunks` (a 48-token verbatim passage producing 42 unique 7-gram shingles, Jaccard score 1.0) — plus the auto-attach capability proven separately by a direct `apply_event_match_atomic(p_tier='content_proof')` RPC call that the sweep itself never invokes (SAFE-02 intact).

## Performance

- **Duration:** ~40 min
- **Started:** 2026-09-05T17:18:25Z (Plan 01 handoff)
- **Completed:** 2026-09-05T17:51:32Z
- **Tasks:** 3 (plus 1 auto-fixed regression, per deviation rules)
- **Files modified:** 3 (1 modified, 2 created)

## Accomplishments

- `runShadowSweep` now runs three tiers in sequence — deterministic (tier 1) → content-proof (tier 2, new) → metadata (tier 3) — each isolated in its own fail-closed try/catch, exactly mirroring the established Phase 31/32 pattern
- Speaker-alibi veto (`isSpeakerAlibiViolation`) checked before every proposal write across all three tiers via one hoisted `call_participants` lookup, fail-closed toward NOT vetoing
- End-to-end integration proof on TEST: conclusive content-proof attach, dominant zero-transcript fallback (first-class assertion, not an afterthought), alibi rejection despite conclusive chunks, idempotent re-run, and direct-call auto-attach — all 4 tests green
- Caught and fixed a live regression in an already-shipped Phase 31 test (SAFE-02 substring check), which my own doc comments would otherwise have silently broken

## Task Commits

Each task was committed atomically:

1. **Task 1: Content-proof fetch/score/propose pass in runShadowSweep** - `9c3c5905` (feat)
2. **Task 2: Thread the speaker-alibi veto across all tier write paths** - `84074b88` (feat)
3. **[Deviation] Fix SAFE-02 doc-comment regression** - `12bd6f1d` (fix)
4. **Task 3: Integration test — attach, fallback, alibi rejection, auto-attach capability** - `bb739f4e` (test)

**Plan metadata:** (this commit, docs: complete plan)

_Note: Task 1 and Task 2 both touch the same function in the same file (`runShadowSweep`). To keep per-task commits atomic, Task 2's alibi-veto edits were temporarily rolled back, Task 1 was committed alone and verified, then Task 2's edits were re-applied, verified, and committed separately._

## Files Created/Modified

- `supabase/functions/_shared/event-resolver.ts` - Content-proof pass + alibi veto wired into `runShadowSweep`; `ShadowSweepSummary` extended with `contentProofProposed`/`alibiRejected`; 3 doc comments reworded to fix the SAFE-02 substring-check regression
- `src/test/event-resolution-content-proof.integration.test.ts` - End-to-end TEST proof (4 tests): attach, dominant zero-transcript fallback, alibi rejection, direct-call auto-attach
- `.planning/phases/33-content-proof-matching-alibi-constraint/deferred-items.md` - Logged two out-of-scope, pre-existing discoveries (cross-file integration-test race; unrelated full-suite unit-test failures)

## Decisions Made

- **Alibi lookup is a single hoisted fetch, not reused/widened from the metadata tier's own `call_participants` fetch.** The metadata tier's fetch (recording_id, email, name) runs later in the function and serves a different purpose; a separate purpose-built fetch (recording_id, email, has_confirmed_speech) run immediately after the candidates fetch makes the lookup available to tier-1 and content-proof, which both write before the metadata block ever executes.
- **Metadata-tier alibi filtering happens by pre-filtering `metadataMatches` before calling `writeMetadataProposals`**, rather than threading the veto check inside that helper function — keeps `writeMetadataProposals`'s existing signature and behavior untouched, matching the "additive, don't rearchitect" instinct.
- **transcript_chunks seeding contract corrected via live introspection, not trusted from the plan's carried-over claim.** `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.transcript_chunks'::regclass` (run against prod, schema-only, zero data risk) showed `transcript_chunks_recording_user_fkey: FOREIGN KEY (recording_id, user_id) REFERENCES fathom_raw_calls(recording_id, user_id)` is still live, and `information_schema.columns` showed `recording_id` is nullable. Seeded rows in the new integration test leave `recording_id` NULL, which Postgres treats as automatically satisfying (skipping) the composite FK check.
- **Migration 20260905130000 (Plan 01's `p_tier` addition) applied to TEST during this plan's execution**, not deferred entirely to Plan 03. The critical_context for this plan states "This plan is TEST-only (no prod apply — that's Plan 03)," and Task 3's own acceptance criteria require the direct `apply_event_match_atomic(p_tier='content_proof')` RPC call to actually succeed against TEST — which is only possible once the 7-arg signature is live there. Applied via `supabase db push --linked` against `callvault-test` (swjzxiddcrtaqixsfaac), confirmed via introspection (`pg_get_function_arguments` shows exactly one `apply_event_match_atomic` overload, trailing `p_tier text DEFAULT 'deterministic'::text`), then the CLI was relinked back to production (`vltmrnjsubfzrgrtdqey`) and the link verified. Plan 03's own Task 1 ("Apply to TEST and gate on green") will find this step already done and its own `db push --linked` will be a no-op — its TEST-side work is otherwise unaffected; **prod apply remains entirely Plan 03's job, untouched by this plan.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a live regression: doc comments broke the SAFE-02 substring-check test**
- **Found during:** Task 3 (running the full verification sweep, including the pre-existing `event-match-apply-reverse.integration.test.ts`)
- **Issue:** `event-match-apply-reverse.integration.test.ts`'s SAFE-02 boundary test asserts `event-resolver.ts`'s ENTIRE source does not contain the literal string `apply_event_match_atomic` (proving the automatic sweep never references the apply RPC). One doc comment already committed by Plan 01 (33-01, commit `5c5ae55e`) and two doc comments added by this plan's own Task 1/Task 2 all spelled the identifier out in prose, breaking that test (confirmed failing before the fix: `AssertionError: expected '...' not to contain 'apply_event_match_atomic'`).
- **Fix:** Reworded all three comments to describe the RPC's role without spelling its literal name (e.g., "the tier-aware atomic apply RPC called with p_tier='content_proof'"). Zero behavior change — comments only.
- **Files modified:** `supabase/functions/_shared/event-resolver.ts`
- **Verification:** `VITEST_INTEGRATION_OK=true npx vitest run src/test/event-match-apply-reverse.integration.test.ts` — 6/6 pass (previously 5/6). Unit suite still 49/49. Type-check still 0 new errors vs baseline (321/321).
- **Committed in:** `12bd6f1d`

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug fix, discovered and fixed before it could reach a later plan)
**Impact on plan:** Necessary correctness fix protecting an already-shipped safety invariant (SAFE-02). No scope creep — comment-only change to the exact file this plan already modifies.

## Issues Encountered

- **Cross-file integration-test race (pre-existing, not fixed).** Running `event-resolution-metadata-tier.integration.test.ts` + `event-resolution-shadow.integration.test.ts` together in one `vitest run` invocation (as the plan's `<verification>` block specifies) hit 2 failures. Root-caused as the SAME pre-existing Vitest-file-parallelism + `cleanup_test_fixture_users(p_max_age_minutes: 0)` race already documented in STATE.md from Phase 31 P02 and reproduced again in Phase 32 P02/P03 — NOT a regression from this plan. Confirmed by running each file in isolation: `event-resolution-content-proof.integration.test.ts` (4/4), `event-resolution-metadata-tier.integration.test.ts` (6/6), `event-resolution-shadow.integration.test.ts` (3/3) all pass standalone. Logged to `deferred-items.md`, not fixed (repo-wide vitest/RPC concurrency design, out of this plan's scope).
- **12 pre-existing full-suite unit-test failures, unrelated files.** `npx vitest run` (full suite) shows 12 failures across `sec-jwt-fix.test.ts`, `AuditSection.test.tsx`, `DashboardSection.recurrence.test.tsx`, and `SupportTicketDialog.test.tsx` — the same class of pre-existing failure documented in STATE.md ("13 pre-existing full-suite test failures... Phase 32"), with minor file-composition drift expected from unrelated development between phases. Confirmed via `git log` that none of these 4 files were touched by this plan's commits. Logged to `deferred-items.md`, not fixed (scope boundary).

## User Setup Required

None - no external service configuration required. (The still-broken `event-resolution-sweep` pg_cron GUCs from Phase 32 remain an open, previously-logged item for Andrew via the Supabase Dashboard — unrelated to this plan, tracked in STATE.md's Blockers/Concerns.)

## Next Phase Readiness

- Content-proof tier + alibi veto are code-complete and proven on TEST. Migration `20260905130000` (Plan 01's `p_tier` addition) is now live on TEST (applied during this plan, ahead of Plan 03's own Task 1, which will find it already applied and no-op cleanly).
- **Both `transcript_chunks` and `call_participants.has_confirmed_speech` remain unpopulated by any live writer in production** (33-RESEARCH.md Pitfalls 1 and 3, reconfirmed by this plan's own work — the content-proof pass and alibi veto are correct-but-currently-inert on real prod/TEST data outside this suite's own seeded fixtures, exactly like Phase 32's dormant `checkMatch` finding). This is the phase's explicitly-scoped, spec-acknowledged condition, not a new gap.
- Plan 03 owns: applying `20260905130000` to production (guarded, human-approved checkpoint), redeploying `resolve-events`, regenerating `src/types/supabase.ts`, and proving inertness in prod by introspection (transcript_chunks count, zero content_proof rows, EXECUTE still revoked from anon/authenticated).
- No blockers for Plan 03.

## Self-Check: PASSED

- FOUND: `supabase/functions/_shared/event-resolver.ts`
- FOUND: `src/test/event-resolution-content-proof.integration.test.ts`
- FOUND: `.planning/phases/33-content-proof-matching-alibi-constraint/deferred-items.md`
- FOUND: `.planning/phases/33-content-proof-matching-alibi-constraint/33-02-SUMMARY.md`
- FOUND commits: `9c3c5905`, `84074b88`, `12bd6f1d`, `bb739f4e` (all present in `git log --oneline --all`)

---
*Phase: 33-content-proof-matching-alibi-constraint*
*Completed: 2026-09-05*
