---
phase: 32-match-rule-hardening-provider-agnostic-matcher
plan: 02
subsystem: backend
tags: [dedup, matcher, event-resolution, metadata-tier, entity-resolution, vitest, deno]

# Dependency graph
requires:
  - phase: 32-match-rule-hardening-provider-agnostic-matcher (Plan 01)
    provides: shouldSuppressTitleSignal + RECURRING_TITLE_OCCURRENCE_THRESHOLD primitive in event-resolver.ts, hardened checkMatch
provides:
  - findMetadataCandidates pure scorer (same-org, time/participant/suppressed-title weighted score, asymmetric propose-only threshold)
  - writeMetadataProposals propose-only write path (tier='metadata', decision='merge_proposed', applied=false, insert+unique_violation idempotency)
  - runShadowSweep extended to run the metadata tier per flagged org, reading recordings+call_participants+recurring_call_titles (provider-agnostic, never zoom_raw_calls)
  - MATCH-11 preservation guard (corrected to reality -- see Deviations)
  - Locked scoring contract (weights, threshold) for Phase 33 to build on
affects: [32-04-guarded-prod-apply, 32-05-precision-measurement, 33-content-proof-alibi]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Weighted multi-signal scoring with an explicit, redundant-but-provable 'independently strong' gate (participant/time each vs. their own MATCH_THRESHOLDS bar), reusing dedup-fingerprint.ts's existing thresholds instead of inventing new magic numbers"
    - "Same-org pairing via Map<organization_id, candidates[]> bucketing before the O(n^2) inner loop -- mirrors findDeterministicMatches exactly, cross-org pairs are structurally never even compared"
    - "Paren-depth (not naive first-brace) parameter-list-end detection when a source-scan test needs to extract a function body whose first parameter is an inline object type annotation"

key-files:
  created:
    - src/test/event-resolution-metadata-tier.integration.test.ts
  modified:
    - supabase/functions/_shared/event-resolver.ts
    - supabase/functions/_shared/__tests__/event-resolver.test.ts
    - type-baseline.json
    - .planning/phases/32-match-rule-hardening-provider-agnostic-matcher/deferred-items.md

key-decisions:
  - "Task 1 checkpoint pre-resolved outside this executor invocation: option-a (3-signal weighted score: participant 0.45/time 0.35/title 0.20, MERGE_PROPOSE_THRESHOLD=0.80, nonzero-time-required, title-suppressed via Plan 01's shouldSuppressTitleSignal), approved as-is, no threshold overrides -- recorded verbatim per instruction, not re-presented"
  - "The asymmetric propose bar's 'independently strong' gate (participantOverlap >= MATCH_THRESHOLDS.participant_overlap OR timeOverlap >= MATCH_THRESHOLDS.time_overlap) is mathematically implied by the weights+threshold already (title's max 0.20 contribution alone can never carry a pair to 0.80) -- implemented explicitly anyway so the invariant is provable by reading the code, not by algebra"
  - "Rule 3 (blocking): registered dedup-fingerprint.ts's pre-existing esm.sh fastest-levenshtein import in type-baseline.json -- my new event-resolver.ts -> dedup-fingerprint.ts runtime import (required by the plan: 'import them; do NOT duplicate') makes this already-existing, already-Deno-safe import newly reachable under tsconfig.app.json's project graph for the first time; zero production impact, same precedent as Plan 01's own baseline update"
  - "MATCH-11 preservation guard corrected to reality (Rule 1-adjacent, see Deviations): 32-RESEARCH.md's claim that zoom-webhook/index.ts actively reads dedup_priority_mode/dedup_platform_order does not hold under an exhaustive grep of this session -- the entire consuming pipeline (findPotentialDuplicates/handleDuplicateMerge/updateMergedFrom) is defined but never called from the live Deno.serve handler. The guard now asserts what's actually true and load-bearing: the selection algorithm and the schema-level type contract are byte-identical to before this plan, not a false literal-string claim"

requirements-completed: [MATCH-03, MATCH-06, MATCH-08, MATCH-11]

coverage:
  - id: D1
    description: "findMetadataCandidates pure scorer: same-org pairing, nonzero-time gate, participant/time/suppressed-title weighted score, asymmetric MERGE_PROPOSE_THRESHOLD=0.80"
    requirement: "MATCH-06"
    verification:
      - kind: unit
        ref: "supabase/functions/_shared/__tests__/event-resolver.test.ts#event-resolver: findMetadataCandidates (MATCH-03/MATCH-06/MATCH-08) (7 new tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Asymmetric high-bar-to-propose thresholds locked (option-a design) and proven via both the recurring-title-suppression contrast case and the raw score/independently-strong gate"
    requirement: "MATCH-08"
    verification:
      - kind: unit
        ref: "supabase/functions/_shared/__tests__/event-resolver.test.ts#recurring-title trap closed test"
        status: pass
    human_judgment: false
  - id: D3
    description: "Metadata tier is provider-agnostic (reads recordings+call_participants, never zoom_raw_calls) and proposes for non-Zoom providers with zero tier-1 signal involved; old Zoom path preserved byte-unchanged"
    requirement: "MATCH-06"
    verification:
      - kind: integration
        ref: "src/test/event-resolution-metadata-tier.integration.test.ts#runShadowSweep proposes the provider-agnostic genuine pair (fathom+grain, NO tier-1 signal)..."
        status: pass
      - kind: other
        ref: "git diff --stat -- supabase/functions/zoom-webhook/index.ts supabase/functions/zoom-sync-meetings/index.ts (empty output, confirmed after every task)"
        status: pass
    human_judgment: false
  - id: D4
    description: "MATCH-03 propose-only enforcement: metadata tier only ever writes decision='merge_proposed'/tier='metadata'/applied=false, never calls the apply RPC, never writes recordings.event_id"
    requirement: "MATCH-03"
    verification:
      - kind: unit
        ref: "supabase/functions/_shared/__tests__/event-resolver.test.ts#every emitted match carries tier:metadata and a 0..1 score; none carries a decision/applied/apply intent"
        status: pass
      - kind: integration
        ref: "src/test/event-resolution-metadata-tier.integration.test.ts (zero merge_applied rows, event_id stays NULL assertions)"
        status: pass
      - kind: other
        ref: "grep -nE \"\\.upsert\\(|\\.update\\(\" supabase/functions/_shared/event-resolver.ts (empty) + grep -c apply_event_match_atomic (0)"
        status: pass
    human_judgment: false
  - id: D5
    description: "MATCH-11: dedup_priority_mode/dedup_platform_order preserved -- BUT the guard test surfaced that the consuming pipeline in zoom-webhook/index.ts is pre-existing dead code (never called from the live handler), a materially different finding than the plan text assumed"
    requirement: "MATCH-11"
    verification:
      - kind: integration
        ref: "src/test/event-resolution-metadata-tier.integration.test.ts#MATCH-11 preservation guard (3 tests: mechanism declarations, four branches intact, schema columns declared)"
        status: pass
    human_judgment: true
    rationale: "The guard proves the algorithm+schema are byte-unchanged (a true, narrow claim), but the underlying discovery -- that dedup_priority_mode/dedup_platform_order are read nowhere in the live codebase and their consuming functions are dead code -- is a product/architecture question (revive, delete, or leave as-is?) that only Andrew can resolve. Full writeup in deferred-items.md. Flagging for human review rather than silently auto-passing this as 'nothing to see here.'"

duration: 24min
completed: 2026-09-02
status: complete
---

# Phase 32 Plan 02: Provider-Agnostic Metadata Tier Summary

**findMetadataCandidates weighted scorer (participant 0.45/time 0.35/title 0.20, propose-only at score>=0.80) wired into runShadowSweep, reading recordings+call_participants+recurring_call_titles instead of zoom_raw_calls -- proven end-to-end on TEST with zero tier-1 signal involved, plus a MATCH-11 guard that caught the old Zoom dedup pipeline is dead code**

## Performance

- **Duration:** 24 min
- **Started:** 2026-09-02T10:06:00Z
- **Completed:** 2026-09-02T10:30:08Z
- **Tasks:** 3 (Task 1 pre-resolved outside this invocation; Tasks 2-3 executed)
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- Task 1 (checkpoint:decision) recorded as resolved per pre-authorized instruction: **option-a**, the 3-signal weighted design (timeOverlap hard->0 gate mirroring MATCH-04, participantOverlap Jaccard, titleSimilarity zeroed via Plan 01's `shouldSuppressTitleSignal`), weights participant 0.45/time 0.35/title 0.20, `MERGE_PROPOSE_THRESHOLD=0.80`, `decided_by='auto'`, `applied=false`, `tier='metadata'`, `decision='merge_proposed'` -- exactly as written in the plan, no threshold overrides
- Added `findMetadataCandidates` (pure, DB-free scorer) + `writeMetadataProposals` (propose-only insert path) to `event-resolver.ts`, reusing `dedup-fingerprint.ts`'s `calculateTimeOverlap`/`calculateParticipantOverlap`/`calculateTitleSimilarity`/`normalizeParticipant`/`normalizeTitle`/`MATCH_THRESHOLDS` primitives -- zero new distance math
- Extended `runShadowSweep` to run the metadata tier per flagged org from the SAME recordings fetch (extended column set), plus two new queries (`call_participants` keyed by recording_id IN batch; `recurring_call_titles` keyed by owner user_id IN batch) -- never reads the legacy Zoom-only raw-calls table
- Proved end-to-end on TEST: a fathom+grain pair with **zero tier-1 signal** proposes via the metadata tier alone; an identically-shaped recurring-title pair does NOT propose (suppression contrast proof); a cross-org pair with identical time+participants never proposes; zero `merge_applied` rows anywhere; `recordings.event_id` stays NULL; re-run is idempotent
- MATCH-11 preservation guard, corrected mid-task to reality: found the entire Zoom dedup-merge pipeline (`findPotentialDuplicates`/`handleDuplicateMerge`/`updateMergedFrom`) is pre-existing dead code, never called from `zoom-webhook/index.ts`'s live handler -- see Deviations and `deferred-items.md`

## Task Commits

1. **Task 1: Metadata-tier design gate** -- resolved outside this invocation (option-a, as-is); no commit (decision-only, recorded here)
2. **Task 2: findMetadataCandidates pure scorer + propose-only write path** - `d8cda125` (feat)
3. **Task 3: Wire metadata tier into the sweep + MATCH-11 preservation guard** - `2688362d` (feat)

**Plan metadata:** (this commit, following SUMMARY.md write)

## Files Created/Modified
- `supabase/functions/_shared/event-resolver.ts` - `findMetadataCandidates`, `writeMetadataProposals`, `MetadataCandidate`/`MetadataMatch`/`MetadataTierWeights` types, `METADATA_TIER_WEIGHTS`/`MERGE_PROPOSE_THRESHOLD` constants, `runShadowSweep` extended with the metadata-tier pass + `metadataProposed` summary counter
- `supabase/functions/_shared/__tests__/event-resolver.test.ts` - 7 new unit tests (26/26 total) for `findMetadataCandidates`
- `type-baseline.json` - registered `dedup-fingerprint.ts`'s pre-existing esm.sh `fastest-levenshtein` import (321/321, 0 new errors)
- `src/test/event-resolution-metadata-tier.integration.test.ts` - new: 6 tests (3 metadata-tier sweep proofs + 3 MATCH-11 preservation guard tests), all against TEST/source-read
- `.planning/phases/32-match-rule-hardening-provider-agnostic-matcher/deferred-items.md` - logged the dead-code discovery for Andrew

## Decisions Made
- Locked scoring contract (weights + threshold) exported as named constants (`METADATA_TIER_WEIGHTS`, `MERGE_PROPOSE_THRESHOLD`) specifically so Plan 05 (precision measurement) and Phase 33 (content-proof + alibi) can reference/tune them without re-deriving.
- `writeMetadataProposals` kept internal (not exported) -- Task 3 wires it from within the same file, mirroring tier-1's inline write style; no external caller needs it today.
- Recurring-title suppression check applies if EITHER side of a pair has a recurring `(owner,title)` -- since recurring meetings share the same title on both occurrences, this is symmetric in practice but written defensively for either side.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Registered a newly-reachable, pre-existing esm.sh import in the type-check baseline**
- **Found during:** Task 2, `npm run type-check` after adding `event-resolver.ts`'s new runtime import of `dedup-fingerprint.ts`
- **Issue:** `dedup-fingerprint.ts`'s `fastest-levenshtein` esm.sh import (unchanged, already present since before this plan) was previously unreachable under `tsconfig.app.json`'s module graph. My new import (required by the plan: "Reuse dedup-fingerprint.ts's calculate* helpers (import them; do NOT duplicate)") made it reachable for the first time, surfacing 1 new baseline-gate key.
- **Fix:** Ran `node scripts/type-check.mjs --update-baseline` to register the pre-existing, already-Deno-safe error. Zero production impact -- the Deno edge function resolves the identical pinned esm.sh URL at deploy time, unaffected.
- **Files modified:** `type-baseline.json`
- **Verification:** `npm run type-check` -> `TYPE CHECK PASSED: 0 new errors. Baseline errors remaining: 321/321.`
- **Committed in:** `d8cda125` (Task 2 commit)

**2. [Rule 1 - Bug in my own test code, caught before commit] Fixed a brace-matching bug in the MATCH-11 guard's own function-body extraction**
- **Found during:** Task 3, first run of the new integration test file
- **Issue:** My initial bracket-matching started from the first `{` after the function name, which is `shouldNewMeetingBePrimary`'s inline parameter type annotation (`newMeeting: { source_platform: string; ... }`), not the function body -- the extraction terminated at that annotation's own closing brace, never reaching the `switch` statement, producing a false test failure.
- **Fix:** Rewrote the extraction to first find the parameter list's true end via paren-depth counting (ignores nested braces in parameter type annotations), then bracket-matches the function body from the first `{` after that point.
- **Files modified:** `src/test/event-resolution-metadata-tier.integration.test.ts`
- **Verification:** All 3 MATCH-11 guard tests pass; the fix was verified by re-running the isolated file (6/6 green).
- **Committed in:** `2688362d` (Task 3 commit)

### Significant Discovery (not a code deviation -- flagged for human review)

**MATCH-11's "dedup settings read path" does not actually exist as a live read anywhere in the current codebase.** While authoring the MATCH-11 preservation guard, an exhaustive grep across `supabase/functions/` and `src/` found the literal columns `dedup_priority_mode`/`dedup_platform_order` are declared only in `src/types/supabase.ts` (generated types) -- never read by name anywhere else. The entire consuming pipeline in `zoom-webhook/index.ts` (`findPotentialDuplicates` -> `checkMatch`, `handleDuplicateMerge` -> `shouldNewMeetingBePrimary`, `updateMergedFrom`) is defined but **never called** from that file's live `Deno.serve` handler -- confirmed via exhaustive `grep -n` showing each function name appears exactly once (its own declaration) in the 951-line file. `zoom-sync-meetings/index.ts` doesn't reference this pipeline either.

This contradicts 32-RESEARCH.md's HIGH-confidence claim that `checkMatch()` "is called today, on every Zoom webhook delivery." Plan 01's hardening of `checkMatch` was still correct and harmless regardless (a pure function is more correct either way), but the F5 bug it closed may never have been reachable through this specific live path. This is **not a bug introduced by this plan** -- `zoom-webhook/index.ts` is confirmed byte-unchanged throughout (`git diff --stat` empty after every task) -- and fixing it (wire the dead code back in, or formally deprecate it) is a Rule-4-class architectural decision, not an auto-fix. Per CLAUDE.md's "Reality over documentation," the guard test itself was corrected to assert what's actually true (the algorithm + schema contract are untouched) rather than a false literal-string claim. Full writeup: `.planning/phases/32-match-rule-hardening-provider-agnostic-matcher/deferred-items.md`.

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug-in-own-test-code) + 1 significant discovery flagged for human review (not fixed, out of scope, documented).
**Impact on plan:** Both auto-fixes were necessary for correctness (accurate baseline, accurate test) and involved zero production behavior change. The discovery does not block this plan's own deliverable (the metadata tier itself is fully proven and correct) but is materially important context for Andrew and for how MATCH-11 should be understood going forward.

## Issues Encountered
- `npm run test:integration -- <file>` appends the file path as an additional filter rather than restricting to it (the script hardcodes its own globs) -- same pre-existing behavior Plan 03 already documented in `deferred-items.md`. Worked around by invoking `vitest run` directly with `VITEST_INTEGRATION_OK=true` scoped to this plan's two files; both pass 100% in isolation (event-resolution-metadata-tier: 6/6, event-resolution-shadow regression check: 3/3).
- Full unit suite (`npx vitest run`): 249/255 files pass, 13 pre-existing failures across the exact same 5 files Plan 01 already logged in `deferred-items.md` (SupportTicketDialog, AuditSection, DashboardSection.recurrence, rpc-type-smoke, sec-jwt-fix) -- confirmed identical file/test list, zero new regressions.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `findMetadataCandidates`/`writeMetadataProposals`/the locked weight+threshold constants are ready for Plan 05's precision measurement to reference and for Phase 33 (content-proof + alibi) to extend -- same `event-resolver.ts` module, same shape.
- Everything in this plan is still shadow-mode-only (`organization_feature_flags.event_resolution` remains unset for any org) -- deploy to prod is Plan 04, matching Plan 01/03's pattern.
- Plan 04's guarded prod apply must include this plan's code changes (no new migrations this plan -- `event_match_decisions`' `tier='metadata'`/`decision='merge_proposed'` values were already schema-ready per 32-RESEARCH.md, confirmed no DDL needed).
- Known deferred gap (inherited from 32-RESEARCH.md Pitfall 2, not touched here): `apply_event_match_atomic` hardcodes `tier='deterministic'` -- irrelevant to this plan since MATCH-03 means the metadata tier never calls apply, but will matter the first time a future phase builds an "approve a metadata proposal" action.
- The MATCH-11 dead-code discovery (see Deviations) is open for Andrew's review -- does not block Plan 03/04/05, but is a real product question about the old Zoom dedup pipeline's actual live status.

---
*Phase: 32-match-rule-hardening-provider-agnostic-matcher*
*Completed: 2026-09-02*

## Self-Check: PASSED

- FOUND: `supabase/functions/_shared/event-resolver.ts`
- FOUND: `src/test/event-resolution-metadata-tier.integration.test.ts`
- FOUND: `.planning/phases/32-match-rule-hardening-provider-agnostic-matcher/32-02-SUMMARY.md`
- FOUND: commit `d8cda125` (feat: Task 2, findMetadataCandidates + write path)
- FOUND: commit `2688362d` (feat: Task 3, sweep wiring + MATCH-11 guard)
