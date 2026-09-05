# Phase 33: Content-Proof Matching + Alibi Constraint - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning
**Mode:** Infrastructure phase — smart discuss skipped (no UI; matcher tier work; spec locks the design)

<domain>
## Phase Boundary

Add the content-proof tier (tier 2): rare n-gram shingle overlap over `transcript_chunks`, aligned on relative offsets, conclusively attaches two captures of the same event — this tier CAN auto-attach (unlike the metadata tier from Phase 32, which only proposes). Add the speaker-alibi constraint: an identity with `has_confirmed_speech` in event A during interval T is rejected as a speaker in a time-disjoint event B during the same interval T — attendance alone is never an alibi, only confirmed speech. Zero-transcript (audio-only) captures fall back to the deterministic tier or the review queue without error.

Out of scope: identity resolution itself (Phase 34 builds the `identities` spine that `has_confirmed_speech` checks will eventually reference more richly — this phase's alibi constraint works off `call_participants.has_confirmed_speech` directly, already live from Phase 30).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
Locked constraints from source spec + REQUIREMENTS.md:
- MATCH-02: content-proof tier via rare n-gram shingle overlap over `transcript_chunks`, aligned on relative offsets (not wall-clock — device clocks drift, per the original spec's edge cases). High overlap is conclusive — CAN auto-attach (this is tier 2, near-certain per the original spec's confidence table).
- MATCH-07: speaker-alibi constraint REJECTS candidates only — never confirms one. An identity with confirmed speech in event A during interval T cannot be a speaker in a time-disjoint event B during T. Attendance is never an alibi — only `has_confirmed_speech` (already exists on `call_participants` from Phase 30).
- Zero-transcript captures fall back gracefully (deterministic tier or review queue), never error.
- This tier operates on `transcript_chunks`, which already exists (per Phase 30/31 research) with `chunk_text`, `speaker_name`, `speaker_email`, `timestamp_start/end`, embeddings — confirm exact current shape via research, don't assume.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 31's `event-resolver.ts` (tier-1 deterministic + tier-3 metadata, both live in prod), `event_match_decisions` ledger (already has `tier` CHECK including 'content_proof' per the original spec — verify exact CHECK values in research).
- Phase 30's `call_participants.has_confirmed_speech` — already exists, this phase's alibi constraint reads it directly.
- `transcript_chunks` — normalized segment layer, confirm current shape via research before building shingle logic.

### Established Patterns
- Same TEST-then-prod guarded discipline. Same RLS/service-role patterns for any new backend logic.
- This is the FIRST tier that can auto-attach without human review (tier 1 deterministic already can too, from Phase 31) — the metadata tier (Phase 32) can only propose. Content-proof joins tier 1 as an auto-attach tier per the original spec's confidence table ("Tier 1/2 — Near-certain — Auto-attach").

</code_context>

<specifics>
## Specific Ideas

None beyond locked constraints. Continues on branch `v2.2-event-resolution`.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure-only, spec locked.

</deferred>
