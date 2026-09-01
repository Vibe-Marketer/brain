# Phase 31: Deterministic Resolution, Shadow Mode Only - Context

**Gathered:** 2026-09-01
**Status:** Ready for planning
**Mode:** Infrastructure phase — smart discuss skipped (zero user-facing surface: shadow mode means nothing auto-merges or displays yet; all success criteria are technical/test-provable; the original spec already locks the design precisely, leaving no open grey areas)

<domain>
## Phase Boundary

Deterministic-tier matches are computed, recorded, and reversible — but nothing auto-merges in production. This is where the visible win (one call, several source badges) becomes *possible* with zero data-corruption risk, but this phase does not build the visible win itself — that's later, once shadow-mode precision is proven (SAFE-06, Phase 32).

In scope: a deterministic matcher reading `source_metadata` for provider meeting ID / calendar UID / meeting URL; an `event_match_decisions` ledger recording every proposed merge (both recording IDs, tier, score, signal breakdown, decided_by, timestamp); a reversible atomic merge operation following the `split_recording_atomic` transactional pattern; a per-organization feature flag (off by default) gating all resolution; shadow mode that computes and records proposed merges WITHOUT applying them.

Out of scope for this phase: the metadata tier (time/participant overlap scoring — Phase 32), content-proof tier (transcript shingles — Phase 33), the F5 false-merge fix (Phase 32), actually enabling the flag for any org (that requires SAFE-06's precision proof, also Phase 32), any UI.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion within these locked constraints from the source spec (`.orca/drops/SPEC-event-resolution-and-provenance.md`) and REQUIREMENTS.md — not open questions:
- Deterministic tier signals: provider meeting ID (Zoom meeting UUID, Meet conference ID), calendar/iCal UID, meeting URL — read from `recordings.source_metadata`. A hit resolves with NO scoring (MATCH-01) — this is categorically different from the metadata tier's weighted scoring (Phase 32).
- Shadow mode: every proposed merge is computed AND recorded to `event_match_decisions`, but never applied — production `recordings.event_id` stays untouched by this phase's matcher (SAFE-02). "Shadow" is the literal behavior, not a metaphor: the ledger exists, the merge does not.
- Every merge decision (even shadow ones) is reversible in one atomic operation, modeled on the existing `split_recording_atomic` transactional shape (MATCH-10).
- All resolution runs behind a feature flag, off by default, enableable per organization (SAFE-01) — this phase should not need to actually enable it for any org; that's gated on Phase 32's precision proof.
- Hook point: resolution runs after `runPipeline` at the `_shared/canonical-recording.ts` seam per the spec's Implementation Notes — do not invent a new ingest hook.
- `event_match_decisions` schema: both recording IDs, tier, score, signal breakdown, decided_by (auto/user/admin), timestamp (MATCH-09).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `events` table, `recordings.event_id`, `call_participants.event_id/role/has_confirmed_speech` — all live in prod as of Phase 30, with corrected RLS (CR-01 fix already applied).
- `split_recording_atomic` — the transactional pattern to mirror for MATCH-10's atomic reversible merge.
- `_shared/canonical-recording.ts` — the ingest seam where resolution hooks in; `CanonicalRecording` already carries `transcriptTurns` with `providerSpeakerId`/`speakerName`/`speakerEmail`/`startSeconds` (relevant for later phases, not this one).
- `dedup-fingerprint.ts` — the existing Zoom-only, user-scoped matcher (F4 finding) — Phase 31 does NOT need to touch or replace this yet; that's Phase 32's provider-agnostic rewrite. Phase 31 can be additive/parallel.

### Established Patterns
- Migration file structure per `supabase/CLAUDE.md`, prod-ref guard convention, forward-only additive discipline — same as Phase 30.
- RLS pattern for a new table: use the SECURITY DEFINER helper pattern proven correct in Phase 30's CR-01 fix (`user_participates_in_event`-style) if `event_match_decisions` needs any non-service-role read access; default to service-role-only writes/reads if no user-facing surface needs it yet (this phase has none).

### Integration Points
- `event_match_decisions` will be read by Phase 32's hardening work and referenced by the eventual merge-review UI (much later phase) — schema should anticipate those readers per MATCH-09's exact field list, but does not need to build for them now.

</code_context>

<specifics>
## Specific Ideas

No specific UI or behavior requirements — infrastructure phase, shadow mode only. Continues on branch `v2.2-event-resolution` (not main) — same branch-discipline decision as Phase 30, still not merged.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope (skipped; infrastructure-only, spec already locked the design).

</deferred>
