---
phase: 35-speaker-resolution-across-sources
plan: 01
subsystem: database
tags: [supabase, postgres, typescript, deno, rls, speaker-resolution, identity]

# Dependency graph
requires:
  - phase: 34-identity-spine
    provides: identity_aliases evidence shape, DisplayNameCandidate literal-type non-linking pattern (identity-resolver.ts)
  - phase: 31-event-match-decisions
    provides: event_match_decisions provenance-ledger shape to mirror for the new B2 ledger
  - phase: 32-event-resolver
    provides: interval-overlap primitive precedent (scoreContentProofOverlap, isSpeakerAlibiViolation) and recording_start_time as the proven MATCH-04 time anchor
provides:
  - Live-verified recordings timing schema (recording_start_time is the only real "capture start" column; timestamptz, second precision, prod fill-rate not independently reconfirmed this session)
  - canonical-recording.ts startSeconds ruled out as a transcript_chunks-reachable anchor (Finding 3)
  - Locked Decision A: time-origin anchor = A1 (derived absolute instant from recording_start_time + parsed timestamp_start)
  - Locked Decision B: write-target = B2 (new speaker_resolution_decisions provenance ledger, mirroring event_match_decisions)
  - Locked refinement: ±15-30s overlap-tolerance buffer on interval comparisons (absorbs cross-tool clock drift), binding on Plan 02's scorer
  - speaker-resolver.ts interface-first contract types (SpeakerChunk, AbsoluteInterval, PropagationDonor/Input/Result, UnresolvedSpeaker, ConsensusCandidate/Input/Collapse/Refusal/Result)
affects: [35-02-speaker-resolver-implementation, 35-03-resolve-speakers-edge-function, 35-04-prod-apply]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Interface-first contract module (types + not-implemented function signatures) authored before scoring logic, so a later plan implements against a type-locked shape"
    - "Literal-typed non-linking outcome (identity_id: null, resolved: false as LITERAL types) mirroring identity-resolver.ts's DisplayNameCandidate pattern"
    - "Propagation donor corroboration requires identity_id/verified alias, never a bare speaker_name string (Pitfall 3 precedent)"

key-files:
  created:
    - supabase/functions/_shared/speaker-resolver.ts
    - .planning/phases/35-speaker-resolution-across-sources/35-DESIGN-NOTES.md
  modified: []

key-decisions:
  - "Decision A: A1 (derived absolute instant) — recording_start_time (timestamptz, real column, second-precision) + parsed transcript_chunks.timestamp_start is the cross-recording time-origin anchor, matching event-resolver.ts's proven MATCH-04 anchor."
  - "Decision B: B2 (new speaker_resolution_decisions ledger) — mirrors event_match_decisions' provenance shape (donor recording, target recording, interval, confidence, decided_by, timestamp); must be registered in rls-regression.test.ts cross-org isolation with FORCE RLS, service-role only (T-35-02)."
  - "Refinement (Andrew, explicit): interval-overlap comparisons in Plan 02's scorer must accept a ±15-30s tolerance buffer, not require exact-instant overlap, to absorb clock drift between different recording tools' own system clocks (e.g. Zoom server clock vs. a Plaud device's local clock)."
  - "canonical-recording.ts's numeric startSeconds anchor is ruled out this phase — it does not survive to persisted transcript_chunks (lives only in recordings.transcript_segments JSON, a different table/read-path, out of this phase's locked scope)."

patterns-established:
  - "Reversibility-gate plans: live-introspect before locking a one-way-door decision (timing column, write-target), record findings in a DESIGN-NOTES.md before the checkpoint, not after."

requirements-completed: [IDENT-04, IDENT-05]

# Metrics
duration: ~25min
completed: 2026-09-08
---

# Phase 35 Plan 01: Reversibility Gate — Time-Origin Anchor + Write-Target Lock Summary

**Live-verified `recording_start_time` as the real (only) capture-start column, ruled out `canonical-recording.ts`'s in-memory `startSeconds` as a viable anchor, and locked both one-way-door decisions (A1 derived-absolute-instant anchor + B2 new provenance ledger) with an added ±15-30s clock-drift tolerance buffer for Plan 02's scorer.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 (Task 1: auto; Task 2: checkpoint:decision, resolved outside this invocation)
- **Files modified:** 2 (both created)

## Accomplishments

- Live TEST-project introspection (REST + generated schema cross-check) proved `recording_start_time`/`recording_end_time` are the only real "capture started at" columns on `recordings` — RESEARCH.md's other candidates (`started_at`, `start_time`, `call_date`, `recorded_at`, `meeting_start`) do not exist.
- Definitively ruled out `canonical-recording.ts`'s numeric `startSeconds` as a `transcript_chunks`-reachable anchor: it lives only transiently in `recordings.transcript_segments` JSON during/after ingest, not in the persisted table this phase reads.
- Both Phase-35 one-way-door decisions locked: time-origin anchor (A1) and resolved-name write-target (B2), plus an operator-requested clock-drift tolerance refinement binding on Plan 02.
- `speaker-resolver.ts` created with interface-first contract types only (zero scoring implementation) — compiles clean, ready for Plan 02 to implement against.

## Task Commits

1. **Task 1: Live-verify the recordings timing schema and pin the contract types** - `0e59f43` (feat)

Task 2 was a `checkpoint:decision` — no code commit; its resolution is recorded below and this plan's metadata commit captures it in STATE.md/ROADMAP.md.

**Plan metadata:** (this commit) `docs: complete plan`

## Files Created/Modified

- `supabase/functions/_shared/speaker-resolver.ts` — Interface-first contract types (`SpeakerChunk`, `AbsoluteInterval`, `PropagationDonor`, `PropagationInput`, `PropagatedResolution`, `UnresolvedSpeaker`, `PropagationResult`, `ConsensusCandidate`, `ConsensusInput`, `ConsensusCollapse`, `ConsensusRefusal`, `ConsensusResult`) plus `not implemented` function signatures (`deriveAbsoluteInterval`, `propagateNamedLabel`, `collapsePhantomSpeaker`). No DB access, no scoring logic — Plan 02's job.
- `.planning/phases/35-speaker-resolution-across-sources/35-DESIGN-NOTES.md` — Live-verified recordings timing schema (Finding 1), `transcript_chunks.timestamp_start`/`timestamp_end` shape reconfirmation (Finding 2), `canonical-recording.ts` startSeconds ruled-out analysis (Finding 3), and the decision-input summary feeding Task 2.

## Decisions Made

### Task 2 checkpoint:decision — resolved by the human operator (Andrew) outside this invocation

**Decision: A1 + B2, with an added refinement Andrew specifically requested.**

- **A1 (derived absolute instant):** confirmed. `recording_start_time` is real wall-clock time (each provider's own "recording started at" timestamp, e.g. Zoom's actual API field — verified via `canonical-recording.ts:144` `new Date(record.recordingStartTime).toISOString()`), already the proven anchor `event-resolver.ts` uses for MATCH-04's time-overlap matching in Phase 32. Confirmed 99.97% populated in prod (3952/3953 recordings) via live query this session.
- **B2 (new ledger):** confirmed. Author a new `speaker_resolution_decisions` table mirroring `event_match_decisions`' provenance shape (Phase 31 precedent) — donor recording, target recording, interval, confidence, decided_by, timestamp. Must be registered in `rls-regression.test.ts` cross-org isolation (FORCE RLS, service-role only) per this plan's own T-35-02 threat mitigation.
- **Refinement Andrew explicitly requested during the decision discussion:** build in a small overlap-TOLERANCE buffer (e.g. ±15-30 seconds) on interval-overlap comparisons, not exact-instant matching — to absorb clock drift between different recording tools' own system clocks (Zoom's server clock vs. a Plaud device's local clock can disagree by seconds). This is a NEW design detail beyond what 35-RESEARCH.md originally specified — recorded here as a locked decision affecting Plan 02's scorer implementation (the interval-overlap check must accept near-miss overlaps within this tolerance window, not require exact overlap).

This decision was NOT re-presented or re-asked by this execution — it arrived pre-resolved per the executor's instructions and is recorded verbatim above, including the tolerance-buffer refinement, as a locked decision binding Plan 02.

Note: the 99.97%/3952-of-3953 prod fill-rate figure for `recording_start_time` cited in the decision above was captured by Andrew during the external decision discussion, independently reconfirming the open gap 35-DESIGN-NOTES.md Finding 1 flagged (this task's own live sample was TEST-only, n=7, and could not independently verify prod fill-rate from inside this worktree since no `.env` prod credentials exist there).

## Deviations from Plan

None - plan executed exactly as written. Task 1 was fully autonomous and live-verified against real schema. Task 2's checkpoint:decision was correctly gated and resolved by the human operator as designed — no auto-approval, no scope expansion beyond the plan's own options plus the explicitly-requested tolerance-buffer refinement (itself a legitimate elaboration of Decision A, not an architectural change requiring a separate gate).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both one-way-door decisions are locked with live evidence; Plan 02 (pure speaker-resolver module, test-first) can implement `deriveAbsoluteInterval`, `propagateNamedLabel`, and `collapsePhantomSpeaker` against `speaker-resolver.ts`'s fixed contract types, using A1's anchor strategy and the ±15-30s tolerance buffer.
- Plan 03's edge function + migration work is unblocked to author the `speaker_resolution_decisions` ledger (B2) with `event_match_decisions`-mirrored provenance columns, and must register it in `rls-regression.test.ts` per T-35-02.
- Open gap carried forward (not blocking): `recording_start_time`'s prod fill-rate was independently reconfirmed by Andrew (99.97%, 3952/3953) during the external decision discussion, not by this task's own live query (TEST-only, n=7, no prod creds in this worktree) — Plan 02/03 should treat this as operator-verified, not re-derive it as an open question.

---
*Phase: 35-speaker-resolution-across-sources*
*Completed: 2026-09-08*
