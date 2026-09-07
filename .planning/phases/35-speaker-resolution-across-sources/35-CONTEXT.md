# Phase 35: Speaker Resolution Across Sources - Context

**Gathered:** 2026-09-07
**Status:** Ready for planning
**Mode:** Infrastructure phase — smart discuss skipped (backend consensus/matching logic over `transcript_chunks`; success criteria are technical/test-provable; no new UI surface — existing evidence badges from Phase 34 already display resolved speaker confidence)

<domain>
## Phase Boundary

Named speakers from one recording of a resolved event propagate onto another recording's anonymous diarization labels by timeline alignment; over-segmented diarization (one real speaker split into two labels by one source) collapses to the labeled source's truth by consensus. Speakers with zero evidence (no calendar data, no attendee list, only anonymous diarization) stay unresolved — never guessed.

In scope: timeline-alignment logic reading `transcript_chunks` (start/end offsets) across an event's linked recordings; a consensus mechanism for collapsing phantom over-segmented speakers; writing resolved names back to the identity/speaker layer built in Phase 34 (`identity_id`, evidence).

Out of scope: transcript reconciliation itself (the merged transcript text — Phase 37); new UI beyond what Phase 34's evidence badge already shows (unless a plan finds a real gap); enabling this for orgs beyond the existing SAFE-01-flagged test org unless research says otherwise.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion within locked constraints from REQUIREMENTS.md and the source spec:
- Resolution must be evidence-based only — never guess a speaker identity from diarization alone with no corroborating signal (mirrors IDENT-07/voiceprint exclusion's spirit: no inference without evidence).
- Uses the `identities`/`identity_id` spine and `get_identity_evidence` RPC from Phase 34 — do not build a parallel identity mechanism.
- Reads `transcript_chunks` (already exists, per Phase 33's finding that it has real rows for some orgs — be mindful of that when writing any test fixtures/queries).
- Consensus logic must be conservative: when sources disagree, prefer leaving a speaker unresolved over asserting a wrong resolution (this milestone's asymmetric-threshold philosophy — MATCH-08 — applies here by extension even though this isn't a MATCH requirement).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 34's `identities`, `identity_aliases`, `get_identity_evidence` RPC, and `identity-resolver.ts` pattern (pure module + forward-only edge function, shared-secret gated, mirroring `event-resolver.ts`'s shape from Phase 31).
- Phase 30's `events`/`recordings.event_id` — the linkage this phase's cross-recording alignment operates over.
- `transcript_chunks` schema (from Phase 33's research): has `speaker_name`/`speaker_email`, timestamp offsets, per-recording linkage.

### Established Patterns
- Every prior phase's pure-module + thin-edge-function-wrapper + forward-only + shared-secret-gate shape (event-resolver.ts, identity-resolver.ts) — mirror it again for a speaker-resolver if this phase needs its own module.
- Migration structure, prod-ref guard, TEST-then-prod discipline — identical to every phase so far.

### Integration Points
- Whatever this phase resolves should be readable through the same evidence RPC pattern Phase 34 built, not a new one, if the shape fits.

</code_context>

<specifics>
## Specific Ideas

No specific UI requirements — infrastructure phase. Continues on branch `v2.2-event-resolution`.

**Standing directive from Andrew (2026-09-06):** tests must prove real behavior, not ceremony. Prefer negative/adversarial assertions. Don't manufacture test scaffolding around something that's really just "read the code and confirm X."

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope (skipped; infrastructure-only).
</deferred>
