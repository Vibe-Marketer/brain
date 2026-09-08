---
phase: 35-speaker-resolution-across-sources
plan: 02
subsystem: backend
tags: [typescript, deno, speaker-resolution, identity, tdd]

# Dependency graph
requires:
  - phase: 35-01
    provides: locked Decision A1 (recording_start_time + parsed offset anchor), locked ±15-30s clock-drift tolerance refinement, speaker-resolver.ts contract types
  - phase: 32-event-resolver
    provides: interval-overlap primitive precedent (isSpeakerAlibiViolation's disjoint-check shape) reused for intervalGapMs/intervalsOverlapWithTolerance
  - phase: 34-identity-spine
    provides: literal-null non-linking type pattern (DisplayNameCandidate) mirrored by UnresolvedSpeaker/ConsensusRefusal
provides:
  - "alignChunksAcrossRecordings, propagateNamedLabel, collapsePhantomSpeaker: pure, DB-free, fail-closed speaker-resolution scoring functions"
  - "deriveAbsoluteInterval implemented against Decision A1"
  - "±20s clock-drift tolerance buffer implementation binding all interval-overlap checks in this module"
affects: [35-03-resolve-speakers-edge-function, 35-04-prod-apply]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Clock-drift tolerance buffer as a gap-magnitude check (intervalGapMs <= toleranceMs), not a boolean overlap test — allows confidence scoring to decay smoothly with gap size instead of a hard cutoff"
    - "Subsumption-based collapse rule: candidateSplit intervals must fall entirely within the labeled span (tolerance-expanded); any spillover fails closed to 'disagreement' rather than forcing a merge"

key-files:
  created:
    - supabase/functions/_shared/__tests__/speaker-resolver.test.ts
  modified:
    - supabase/functions/_shared/speaker-resolver.ts

key-decisions:
  - "Tolerance value: 20_000ms (20s), the midpoint of Plan 01's locked ±15-30s range. Rationale: comfortably absorbs typical consumer-device/cross-tool clock drift (Zoom server clock vs. Plaud local clock) while remaining tight enough that genuinely separate speaker turns (this suite's overlap-adversarial fixture uses a 60s gap, 3x the tolerance) are never falsely merged."
  - "PropagationInput extended with a required recordingStartTimes: Record<string, string | null> field (Rule 2 — auto-add missing critical functionality). Plan 01's PropagationInput carried only raw SpeakerChunk[] targets with capture-relative offsets and no way to derive their AbsoluteInterval; without this map the locked propagation behavior (compare donor interval to target interval) was structurally impossible to implement. Additive only — no existing field removed or retyped."
  - "alignChunksAcrossRecordings' input/output types (AlignmentInput, AlignedChunk) were not specified in Plan 01 (only propagateNamedLabel/collapsePhantomSpeaker had locked shapes) — designed fresh in this plan since Plan 01 explicitly deferred all scoring-function design to Plan 02. Same-org bucketing (SAFE-04, T-35-05) is enforced structurally: every input type (PropagationInput, ConsensusInput, AlignmentInput) is scoped to one organization_id already, so cross-org pairing is never reachable from these pure functions — the caller (Plan 03's edge function) is responsible for bucketing by org before invoking them, and that boundary is asserted end-to-end in Plan 03's rls-regression harness per the threat model."
  - "collapsePhantomSpeaker's disagreement rule is subsumption-based: every candidateSplit interval must fall inside the labeled span expanded by the tolerance buffer. The first candidate chunk falling outside that window immediately returns a 'disagreement' refusal — never partial-collapses a subset."

patterns-established:
  - "Gap-magnitude overlap check (not boolean) feeding a confidence score: confidenceForGap decays from 1.0 to 0.75 as gap approaches the tolerance ceiling, giving Plan 03's ledger writes a real signal instead of a flat constant."

requirements-completed: [IDENT-04, IDENT-05]

# Metrics
duration: ~20min
completed: 2026-09-08
---

# Phase 35 Plan 02: Speaker-Resolver Pure Functions (TDD) Summary

**Implemented the entire IDENT-04/05 correctness surface as three pure, DB-free, fail-closed TypeScript functions — timeline-alignment propagation and over-segmentation consensus collapse — proven by an 11-case adversarial unit suite with a ±20s cross-tool clock-drift tolerance buffer built into every interval comparison.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 (Task 1 RED, Task 2 GREEN)
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- RED: wrote an 11-test adversarial suite (`speaker-resolver.test.ts`) covering all six required behaviors (propagate, never-display-name, overlap-adversarial, collapse, disagree, unresolved) plus a tolerance-buffer positive case and `deriveAbsoluteInterval`/`alignChunksAcrossRecordings` plumbing tests. Confirmed the suite fails against Plan 01's `not implemented` stubs before writing any implementation.
- GREEN: implemented `deriveAbsoluteInterval` (Decision A1 anchor), `alignChunksAcrossRecordings`, `propagateNamedLabel`, and `collapsePhantomSpeaker` — all pure, DB-free, reusing `event-resolver.ts`'s `isSpeakerAlibiViolation` disjoint-check shape (extended to a gap-magnitude helper so the tolerance buffer and confidence scoring both derive from one primitive).
- Built in the ±20s clock-drift tolerance buffer Andrew requested in Plan 01's checkpoint discussion — applied uniformly to both propagation-overlap and collapse-subsumption checks.
- All 11 tests green; full `_shared/__tests__/` suite (301 tests) green, zero regressions; `tsc -p tsconfig.app.json --noEmit` error count unchanged vs `type-baseline.json` (320, no new errors, no `speaker-resolver.ts` errors).

## Task Commits

1. **Task 1: RED — adversarial unit suite** - `7e20c172` (test)
2. **Task 2: GREEN — implement the pure scoring functions** - `98ccffac` (feat)

## TDD Gate Compliance

- RED gate: `test(35-02): add failing adversarial speaker-resolver suite` (`7e20c172`) — confirmed failing against stubs before commit.
- GREEN gate: `feat(35-02): implement speaker-resolver pure functions` (`98ccffac`) — confirmed all 11 tests passing after commit.
- REFACTOR gate: not needed — implementation was clean on first pass, no follow-up cleanup commit required.

## Files Created/Modified

- `supabase/functions/_shared/__tests__/speaker-resolver.test.ts` (created) — 11-case adversarial suite: `deriveAbsoluteInterval` (2), `alignChunksAcrossRecordings` (2), `propagateNamedLabel` (5: propagate, tolerance-buffer near-miss, never-display-name, overlap-adversarial, unresolved), `collapsePhantomSpeaker` (2: collapse, disagree).
- `supabase/functions/_shared/speaker-resolver.ts` (modified) — added `CLOCK_DRIFT_TOLERANCE_MS`, `parseOffsetToMs`, `parseIsoToMs`, `intervalGapMs`, `intervalsOverlapWithTolerance`, `confidenceForGap`, `AlignmentInput`/`AlignedChunk` types, and implemented `deriveAbsoluteInterval`, `alignChunksAcrossRecordings`, `propagateNamedLabel`, `collapsePhantomSpeaker`. Extended `PropagationInput` with `recordingStartTimes` (documented as a Rule 2 addition above).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - missing critical functionality] Extended `PropagationInput` with `recordingStartTimes`**
- **Found during:** Task 2 (implementing `propagateNamedLabel`)
- **Issue:** Plan 01's `PropagationInput.targets` is `SpeakerChunk[]` (capture-relative `HH:MM:SS` offsets), but nothing in the input carried the `recording_start_time` anchor needed to derive each target's `AbsoluteInterval` via `deriveAbsoluteInterval`. Without it, the locked propagation behavior (compare donor interval to target interval) was structurally impossible.
- **Fix:** Added a required `recordingStartTimes: Record<string, string | null>` field (canonical_recording_id -> recording_start_time), additive only — no existing field changed.
- **Files modified:** `supabase/functions/_shared/speaker-resolver.ts`
- **Commit:** `98ccffac`

**2. [Rule 2 - missing critical functionality] Designed `AlignmentInput`/`AlignedChunk` types for `alignChunksAcrossRecordings`**
- **Found during:** Task 2
- **Issue:** Plan 01 left `alignChunksAcrossRecordings`'s call shape entirely unspecified (only `propagateNamedLabel`/`collapsePhantomSpeaker` had locked input/output types) — by design, since Plan 01 deferred all scoring-function design to Plan 02.
- **Fix:** Designed `AlignmentInput` (event_id, organization_id, chunks, recordingStartTimes) and `AlignedChunk` (derived interval + event/org tags) to fit the existing contract-type conventions (literal `null` fail-closed fields, single-org/single-event scope per call).
- **Files modified:** `supabase/functions/_shared/speaker-resolver.ts`
- **Commit:** `98ccffac`

## Issues Encountered

None — GREEN passed on first implementation attempt, no fix-attempt iterations needed.

## User Setup Required

None — pure TypeScript, no DB, no deploy, no external service configuration.

## Next Phase Readiness

- `alignChunksAcrossRecordings`, `propagateNamedLabel`, `collapsePhantomSpeaker` are implemented, unit-tested, and exported — Plan 03's `resolve-speakers` edge function can call them directly, supplying only I/O (fetching chunks/recording_start_time/identity_id from the DB, bucketing by `organization_id` before invoking these pure functions, and writing results to the new `speaker_resolution_decisions` ledger per Decision B2).
- Same-org bucketing (SAFE-04, T-35-05) is structurally guaranteed by these functions' single-org input shape, but the actual bucketing-before-pairing step lives in Plan 03's caller code and must be asserted end-to-end in `rls-regression.test.ts` per the threat model — carried forward as Plan 03's responsibility, not re-verified here (no DB access in this plan).
- The ±20s tolerance value is a judgment call within Andrew's locked 15-30s range, not independently re-confirmed against real cross-source production data (none exists yet per 35-VALIDATION.md) — if Plan 04's prod-apply reveals it's too tight/loose against real drift, it's a single named constant (`CLOCK_DRIFT_TOLERANCE_MS`) to tune.

---
*Phase: 35-speaker-resolution-across-sources*
*Completed: 2026-09-08*
## Self-Check: PASSED
