# Phase 37: Transcript Reconciliation - Context

**Gathered:** 2026-09-10
**Status:** Ready for planning

<domain>
## Phase Boundary

A derived, regenerable canonical transcript across an event's captures, provenance-carrying, with source data never overwritten. Delivers: content-derived timeline alignment across an event's recordings, token-level disagreement resolution (weighted vote + confidence + per-workspace entity lexicon tie-break), a non-destructive derived storage layer with per-segment provenance, explicit single-source-vs-consensus coverage marking, and a guarantee that embedding/search behavior is unchanged for unresolved events (RECON-01..07).

</domain>

<decisions>
## Implementation Decisions

### Timeline Alignment & Trigger Condition
- Reconciliation is sweep-triggered (new cron/edge function), firing once an event has 2+ recordings that have already passed speaker resolution (Phase 35's output) — not on-demand/first-view triggered.
- Alignment is chunk-level first: reuse `recording_start_time` + `timestamp_start` as the anchor, with the same ±20s clock-drift tolerance established in Phase 35's speaker-resolution interval-overlap scorer. Token-level diffing only happens within already-aligned overlapping chunks, not as the primary anchor mechanism.
- Captures do not need full overlap to align — partial overlap is expected and fine; only the overlapping interval is aligned, non-overlapping portions are single-source by construction.
- Reconciliation is gated on the event's recordings having passed at least metadata-tier event resolution (`event_match_decisions`) — it does not run on recordings that merely share a raw `event_id` without having gone through the resolution pipeline.

### Disagreement Resolution & Entity Lexicon
- Source-accuracy priors are hardcoded initial per-provider constants this phase (no historical accuracy data exists yet to learn from) — mirrors the MATCH-* tiers' hardcoded weight precedent (e.g. 0.45/0.35/0.20 style constants).
- A true 3-way tie (weighted vote + confidence + entity lexicon all inconclusive) resolves via a deterministic fixed provider-priority fallback order — never randomly — since regeneration must be idempotent and reproducible.
- The entity lexicon is per-workspace, auto-seeded and refreshed from the aggregate of that workspace's own `transcript_chunks.entities` column. It is read-only derived data this phase — no manual curation UI.
- Token-level diffing (not just chunk-level majority selection) is a hard requirement per RECON-02's literal wording. Research/planning must identify a concrete lightweight sequence-alignment approach rather than substituting chunk-level selection.

### Regeneration & Non-Destructive Layering
- The reconciled transcript lives in a new table (naming at Claude's discretion, e.g. `reconciled_transcript_segments`), mirroring the `event_match_decisions`/`speaker_resolution_decisions` provenance-ledger precedent from Phases 31/35 — not a materialized view, since per-segment provenance metadata needs to be cheaply attachable.
- "Regenerable" means full delete+rebuild per event on each sweep run, not incremental upsert — matches this milestone's established idempotent full-recompute pattern at this data scale.
- Reconciliation for a given event can re-run whenever new source data appears for it (e.g. a new recording later resolves to the same event) — it is not a compute-once, lock-forever operation.
- Reconciliation runs in a new, separate edge function/cron (distinct from `resolve-events`/`resolve-speakers`) because it has a distinct trigger condition (depends on speaker resolution already being done) and a distinct data shape — chaining it into an existing sweep would blur three separate resolution concerns.

### UI Surface
- The reconciled transcript gets a new event-level view. Existing per-recording transcript views are untouched — non-destructiveness extends to the UI, not just the data layer.
- Per-segment provenance is shown as an inline, small source-attribution mark per segment (mirrors PROJECT.md's "one call, several source badges" framing). Single-source segments carry no special badge (they simply are the source); multi-source/consensus segments get a subtle indicator.
- No manual "regenerate now" UI action this phase — display is read-only, regeneration is entirely automatic/sweep-driven, mirroring Phase 36's precedent of no self-serve trigger for backend-heavy operations.

### Claude's Discretion
- Exact schema/column naming, RLS pattern, and SECURITY DEFINER helper structure — follow the established additive-migration, non-org-scoped-where-appropriate pattern from Phases 30/31/34/35.
- Where in the existing AppShell/navigation the new event-level reconciled-transcript view attaches — there is no existing "event" nav surface yet to hook into, so this needs direct scoping against the current app structure at plan/UI-research time.
- The concrete lightweight token-level diff/alignment algorithm choice (left for research to identify and justify).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `event_match_decisions` (Phase 31) and `speaker_resolution_decisions` (Phase 35) are the direct structural precedent for the new reconciled-segment provenance ledger.
- `transcript_chunks` table (existing, pre-milestone) already has `chunk_text`, `entities`, `timestamp_start`/`timestamp_end`, `canonical_recording_id`, `speaker_name`/`speaker_email`, `source_platform`, `embedded_at` — the entity lexicon (RECON-03) reads `entities` directly from here.
- Phase 35's `recording_start_time` + parsed `timestamp_start` anchor and its ±20s clock-drift tolerance interval-overlap scorer is the direct precedent for RECON-01's content-derived timeline alignment.
- The `resolve-events`/`resolve-speakers` deploy-deferred edge-function integration-testing pattern (spawn the real `index.ts` under `deno run` against TEST, no Cloud deploy) is reusable for the new `reconcile-transcripts` function.

### Established Patterns
- All prior v2.2 schema/RLS work follows: additive migration → TEST apply/introspect → prod apply only after explicit Andrew approval, guarded by the prod-ref check (`vltmrnjsubfzrgrtdqey`).
- `rls-regression.test.ts`'s `CROSS_ORG_TABLES`/`BESPOKE_CLIENT_DENY_TABLES` registries are the required proof mechanism for any new table's cross-org isolation.

### Integration Points
- `transcript_chunks.embedded_at` / existing embedding pipeline — RECON-07 requires confirming reconciliation never triggers new embedding calls for unresolved events; read-path only for the entity lexicon.
- Event-level UI surface — needs to identify or create the attachment point in the current AppShell.

</code_context>

<specifics>
## Specific Ideas

No specific mockups or exact copy were requested — standard approach per the accepted grey-area answers above.

</specifics>

<deferred>
## Deferred Ideas

- Manual entity-lexicon curation UI — deferred; auto-seeded/read-only this phase.
- Manual "regenerate now" UI trigger — deferred; automatic sweep-driven only.
- Learned/historical source-accuracy priors — deferred; hardcoded constants this phase, revisit once real accuracy data accumulates.

</deferred>
