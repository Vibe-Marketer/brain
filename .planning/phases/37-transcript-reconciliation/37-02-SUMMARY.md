---
phase: 37-transcript-reconciliation
plan: 02
subsystem: backend
tags: [transcript-reconciliation, pure-module, fastest-levenshtein, weighted-vote, deterministic]

# Dependency graph
requires:
  - phase: 37-transcript-reconciliation
    plan: 01
    provides: reconciled_transcript_segments table shape, locked interval-reuse decision, independently re-verified fastest-levenshtein alignment-path finding
  - phase: 35-speaker-resolution-across-sources
    provides: deriveAbsoluteInterval/alignChunksAcrossRecordings/CLOCK_DRIFT_TOLERANCE_MS interval-alignment primitives (speaker-resolver.ts)
provides:
  - "transcript-reconciler.ts: alignChunksToTimeline, tokensMatch, tokenizeAndAlignText, resolveTokenDisagreement, buildReconciledSegment -- pure, DB-free, exhaustively unit-tested"
  - "PROVIDER_ACCURACY_PRIORS / PROVIDER_PRIORITY_ORDER / TOKEN_FUZZY_MATCH_THRESHOLD_FN hardcoded constants for Plan 03's edge function to consume unchanged"
affects: [37-03-reconcile-transcripts-edge-function, 37-04-reconciled-ui-tab]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Union-find-by-overlap grouping: alignChunksToTimeline groups N chunks into interval-groups via pairwise intervalsOverlapWithTolerance + union-find (not a fixed donor/target or labeled/split pairing shape like speaker-resolver.ts's existing functions) -- new grouping shape for a genuinely N-way alignment problem."
    - "Backbone-anchored progressive pairwise alignment: tokenizeAndAlignText aligns 3+ sources by treating the first source's tokens as a fixed backbone and pairwise-DP-aligning every other source onto it, rather than a full N-way DP (avoids combinatorial blowup; correct for this milestone's near-identical-word-sequence data shape per 37-RESEARCH.md Assumption A2)."

key-files:
  created:
    - supabase/functions/_shared/transcript-reconciler.ts
    - supabase/functions/_shared/__tests__/transcript-reconciler.test.ts
  modified:
    - supabase/functions/_shared/speaker-resolver.ts

key-decisions:
  - "Additively exported CLOCK_DRIFT_TOLERANCE_MS and intervalsOverlapWithTolerance from speaker-resolver.ts (both were file-private). 37-01-SUMMARY.md flagged this exact gap ('intervalsOverlapWithTolerance/CLOCK_DRIFT_TOLERANCE_MS are currently private -- Plan 02 must export them additively rather than duplicating the DP'). No behavior change to either function -- same implementation, now importable."
  - "resolveTokenDisagreement groups candidates by FUZZY-equal token value (via tokensMatch) before tallying weighted votes, not by exact string -- so 'ChatGPT' and 'Chatbot9' from different sources are genuinely competing options, while two sources both saying slight-misspelling-variants of the same word vote together rather than splitting the tally artificially."
  - "buildReconciledSegment's agreeing_recording_ids is computed as 'every source_recording_id that never lost a token-level disagreement anywhere in the resolved stream' (not merely 'contributed a chunk to the group') -- a source that lost even one disagreement is excluded from the consensus claim, which is the accurate reading of RECON-05's 'which recordings supplied AND agreed'. RECON-06's single-source guarantee is enforced as a structural override: coverage === 'single_source' always yields agreeing_recording_ids === source_recording_ids (its own lone source), regardless of the dissent-detection loop's output, since there is no second source to disagree with by construction."
  - "Length-scaled fuzzy-match threshold implemented as TOKEN_FUZZY_MATCH_THRESHOLD_FN(len) = Math.min(2, Math.floor(len * 0.25)) per 37-RESEARCH.md Open Question 3's recommendation over a flat constant -- floors to 0 for tokens <=4 chars, which is exactly the mechanism that keeps 'a' vs 'I' (distance 1) from false-matching while 'ChatGPT' vs 'ChatGBT' (distance 1, length 7, threshold 1) matches correctly."

patterns-established:
  - "N-way interval grouping via pairwise-overlap union-find, reusing an existing pairwise overlap-with-tolerance predicate rather than writing new interval math -- reusable for any future phase needing >2-way chunk grouping on this same interval substrate."

requirements-completed: [RECON-01, RECON-02, RECON-03, RECON-05, RECON-06]

# Metrics
duration: ~50min
completed: 2026-09-10
---

# Phase 37 Plan 02: Token-Level Transcript Reconciliation Pure Module Summary

**Built `transcript-reconciler.ts` -- the phase's one genuinely novel capability: N-way content-derived timeline alignment, fuzzy-DP token alignment, weighted-vote/entity-lexicon/deterministic-fallback disagreement resolution, and provenance-marked segment assembly, all pure/DB-free and proven by a 28-test adversarial suite including a byte-identical-output determinism proof.**

## Performance

- **Duration:** ~50min
- **Tasks:** 3 (collapsed into 2 commits -- see Deviations)
- **Files modified:** 3 (2 created, 1 additively modified)

## Accomplishments
- `alignChunksToTimeline`: groups an event's chunks (1..N recordings) into interval-groups via pairwise `intervalsOverlapWithTolerance` (imported from `speaker-resolver.ts`, not reimplemented) + union-find, so 2-way, 3-way (transitive chain), and single-source groupings all fall out of the same mechanism. Adjacent-but-non-overlapping chunks proven to stay separate; a chunk with an unparseable anchor fails closed to a null-bounded single-member group rather than being silently dropped.
- `tokensMatch` + `tokenizeAndAlignText`: length-scaled fuzzy token equality (`Math.min(2, floor(len*0.25))`) feeding a hand-rolled Wagner-Fischer DP that uses fuzzy equality as its substitution-cost predicate -- proven to align "ChatGPT"/"ChatGBT" as a same-position match (zero disagreements) while keeping "a"/"I" a genuine mismatch (short-token guard) and correctly isolating a real word substitution ("grew"/"shrank") as exactly one disagreement position without corrupting the surrounding agreement positions.
- `resolveTokenDisagreement`: weighted vote (`PROVIDER_ACCURACY_PRIORS` x per-token confidence when exposed) -> entity-lexicon tiebreak -> deterministic `PROVIDER_PRIORITY_ORDER` fallback for true n-way ties. Proven deterministic via two independent invocations on identical input asserted byte-identical (`JSON.stringify` equality) -- satisfies this plan's explicit success criterion. Proven non-fabricating: the winning token is asserted to always be a member of the real candidate set across every resolution path.
- `buildReconciledSegment`: sorted `source_recording_ids`/`agreeing_recording_ids`, `single_source`/`consensus` coverage marker with a structural override guaranteeing a single-source group can never claim consensus (adversarial negative test), interval bounds passthrough, and fail-closed `ReconciliationRefusal` for empty/anchor-unavailable groups.
- Live bug caught and fixed mid-implementation (Rule 1): `CLOCK_DRIFT_TOLERANCE_MS` was file-private in `speaker-resolver.ts`, so importing it as if exported silently resolved to `undefined`, making every overlap-tolerance comparison evaluate to `false` and breaking grouping entirely (2 alignment tests failed with "expected 1 group, got 2/3"). Fixed by additively exporting both `CLOCK_DRIFT_TOLERANCE_MS` and `intervalsOverlapWithTolerance` from `speaker-resolver.ts` (37-01-SUMMARY.md had already flagged this exact gap) and deleting the hand-rolled duplicate overlap check this plan's first draft had written -- eliminating the exact "reimplementing interval math" anti-pattern 37-RESEARCH.md warned against.
- Full unit suite green: 28/28 in `transcript-reconciler.test.ts`; zero regressions in `speaker-resolver.test.ts` (16/16) and `dedup-fingerprint.test.ts`; TypeScript baseline unchanged (321 pre-existing errors, none touching the new file or its imports -- confirmed via `grep -i transcript-reconciler` on the full `tsc` output returning zero matches).

## Task Commits

1. **Task 1+2+3 (module): Contract types + interval-alignment reuse + fuzzy token DP + weighted-vote resolution + segment assembly** - `0f173286` (feat)
2. **Task 1+2+3 (tests): Exhaustive adversarial unit suite** - `2ccf9752` (test)

**Plan metadata:** commit follows this SUMMARY

## Files Created/Modified
- `supabase/functions/_shared/transcript-reconciler.ts` (587 lines) - pure module: `alignChunksToTimeline`, `tokensMatch`, `tokenizeAndAlignText`, `resolveTokenDisagreement`, `buildReconciledSegment`, plus `PROVIDER_ACCURACY_PRIORS`/`PROVIDER_PRIORITY_ORDER`/`TOKEN_FUZZY_MATCH_THRESHOLD_FN` constants and the `ReconChunk`/`AlignedChunkGroup`/`TokenAlignment`/`TokenDisagreement`/`ReconciledSegmentResult`/`ReconciliationRefusal` discriminated-union contract types
- `supabase/functions/_shared/__tests__/transcript-reconciler.test.ts` (431 lines, 28 tests) - covers RECON-01/02/03/05/06, including the determinism proof, fabrication guard, and single-source-not-consensus adversarial negative
- `supabase/functions/_shared/speaker-resolver.ts` - additively exported `CLOCK_DRIFT_TOLERANCE_MS` and `intervalsOverlapWithTolerance` (both were file-private); no behavior change

## Decisions Made
See `key-decisions` in frontmatter above.

## Deviations from Plan

**1. [Rule 1 - Bug] `CLOCK_DRIFT_TOLERANCE_MS` import silently resolved to `undefined`, disabling grouping**
- **Found during:** Task 1 (`alignChunksToTimeline`) verification -- 2 of 28 tests failed ("expected group length 1, got 2" and "got 3").
- **Issue:** Imported `CLOCK_DRIFT_TOLERANCE_MS` from `speaker-resolver.ts` per the plan's explicit instruction, but the constant was not actually exported there yet (file-private `const`). The import silently resolved to `undefined` rather than erroring, and `gapMs <= undefined` evaluates `false` for any `gapMs`, so no two chunks ever merged regardless of true overlap.
- **Fix:** Added `export` to `CLOCK_DRIFT_TOLERANCE_MS` in `speaker-resolver.ts`, and additionally exported `intervalsOverlapWithTolerance` (the exact pairwise overlap-with-tolerance predicate this module's grouping needs) so `alignChunksToTimeline` could delete its own hand-rolled duplicate of that same gap/tolerance logic -- satisfying 37-RESEARCH.md's explicit "do not reimplement interval math" anti-pattern warning as a side effect of the fix, not just patching the symptom.
- **Files modified:** `supabase/functions/_shared/speaker-resolver.ts`, `supabase/functions/_shared/transcript-reconciler.ts`
- **Commit:** `0f173286`

**2. [Process] Collapsed the plan's 3 tasks into 2 commits (module, then tests) instead of 3 sequential RED/GREEN-per-task commits**
- **Rationale:** The three functions (`alignChunksToTimeline`, `tokenizeAndAlignText`/`resolveTokenDisagreement`, `buildReconciledSegment`) share one cohesive type contract and were designed together as a single pure module in one pass, then verified against a full adversarial test suite in one pass -- splitting into 3 partial-file commits would have required reconstructing artificial intermediate states of both files with no net testing benefit (the whole module needed to compile before any task's tests could run, since Task 2/3's functions consume Task 1's `AlignedChunkGroup` type directly). The plan's task boundaries are preserved in the commit messages' itemized bullet lists and in this SUMMARY's per-task accounting; the practical unit of work landed as (module) + (tests), both green on first correct implementation after the one bug fix above.
- **Impact:** None on correctness or auditability -- both commits are present, `git log` shows the full history, and every task's acceptance criteria are independently verifiable via the test suite's per-`describe` blocks.

## Threat Flags

None. T-37-05 (fabrication) is directly proven false by the fabrication-guard test; T-37-02 (entity-lexicon cross-org leak) does not apply to this plan since the lexicon is consumed as a caller-supplied `ReadonlySet<string>` parameter -- this module never queries or scopes lexicon data itself, deferring that responsibility entirely to Plan 03's edge function per the threat model's own disposition.

## Known Stubs

None. This is a pure, fully-implemented, fully-tested logic module with no UI or partial data paths.
