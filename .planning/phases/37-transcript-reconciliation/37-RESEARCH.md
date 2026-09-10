# Phase 37: Transcript Reconciliation - Research

**Researched:** 2026-09-10
**Domain:** Cross-recording transcript reconciliation (content-derived timeline alignment + token-level weighted-vote text resolution) over `transcript_chunks`, backend-only (Supabase Postgres + Deno Edge Function) plus one read-only UI tab
**Confidence:** MEDIUM-HIGH — schema, prior-phase patterns, and the token-diff library choice are HIGH confidence (live repo introspection); the specific weighted-vote scoring constants and the UI attachment point are MEDIUM (UI-SPEC already locks the attachment point; scoring constants are explicitly hardcoded-this-phase per CONTEXT.md, not derived from data).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Timeline Alignment & Trigger Condition**
- Reconciliation is sweep-triggered (new cron/edge function), firing once an event has 2+ recordings that have already passed speaker resolution (Phase 35's output) — not on-demand/first-view triggered.
- Alignment is chunk-level first: reuse `recording_start_time` + `timestamp_start` as the anchor, with the same ±20s clock-drift tolerance established in Phase 35's speaker-resolution interval-overlap scorer. Token-level diffing only happens within already-aligned overlapping chunks, not as the primary anchor mechanism.
- Captures do not need full overlap to align — partial overlap is expected and fine; only the overlapping interval is aligned, non-overlapping portions are single-source by construction.
- Reconciliation is gated on the event's recordings having passed at least metadata-tier event resolution (`event_match_decisions`) — it does not run on recordings that merely share a raw `event_id` without having gone through the resolution pipeline.

**Disagreement Resolution & Entity Lexicon**
- Source-accuracy priors are hardcoded initial per-provider constants this phase (no historical accuracy data exists yet to learn from) — mirrors the MATCH-* tiers' hardcoded weight precedent (e.g. 0.45/0.35/0.20 style constants).
- A true 3-way tie (weighted vote + confidence + entity lexicon all inconclusive) resolves via a deterministic fixed provider-priority fallback order — never randomly — since regeneration must be idempotent and reproducible.
- The entity lexicon is per-workspace, auto-seeded and refreshed from the aggregate of that workspace's own `transcript_chunks.entities` column. It is read-only derived data this phase — no manual curation UI.
- Token-level diffing (not just chunk-level majority selection) is a hard requirement per RECON-02's literal wording. Research/planning must identify a concrete lightweight sequence-alignment approach rather than substituting chunk-level selection.

**Regeneration & Non-Destructive Layering**
- The reconciled transcript lives in a new table (naming at Claude's discretion, e.g. `reconciled_transcript_segments`), mirroring the `event_match_decisions`/`speaker_resolution_decisions` provenance-ledger precedent from Phases 31/35 — not a materialized view, since per-segment provenance metadata needs to be cheaply attachable.
- "Regenerable" means full delete+rebuild per event on each sweep run, not incremental upsert — matches this milestone's established idempotent full-recompute pattern at this data scale.
- Reconciliation for a given event can re-run whenever new source data appears for it (e.g. a new recording later resolves to the same event) — it is not a compute-once, lock-forever operation.
- Reconciliation runs in a new, separate edge function/cron (distinct from `resolve-events`/`resolve-speakers`) because it has a distinct trigger condition (depends on speaker resolution already being done) and a distinct data shape — chaining it into an existing sweep would blur three separate resolution concerns.

**UI Surface**
- The reconciled transcript gets a new event-level view. Existing per-recording transcript views are untouched — non-destructiveness extends to the UI, not just the data layer.
- Per-segment provenance is shown as an inline, small source-attribution mark per segment (mirrors PROJECT.md's "one call, several source badges" framing). Single-source segments carry no special badge (they simply are the source); multi-source/consensus segments get a subtle indicator.
- No manual "regenerate now" UI action this phase — display is read-only, regeneration is entirely automatic/sweep-driven, mirroring Phase 36's precedent of no self-serve trigger for backend-heavy operations.

### Claude's Discretion
- Exact schema/column naming, RLS pattern, and SECURITY DEFINER helper structure — follow the established additive-migration, non-org-scoped-where-appropriate pattern from Phases 30/31/34/35.
- Where in the existing AppShell/navigation the new event-level reconciled-transcript view attaches — **RESOLVED by 37-UI-SPEC.md** (already approved): a new "Reconciled" tab inside the existing `CallDetailDialog` modal, alongside `CallOverviewTab`/`CallTranscriptTab`/`CallParticipantsTab`/`CallInviteesTab`, not a new route.
- The concrete lightweight token-level diff/alignment algorithm choice (left for research to identify and justify) — **RESOLVED below**: `fastest-levenshtein` (already a project dependency, already proven importable in a Deno edge function via esm.sh).

### Deferred Ideas (OUT OF SCOPE)
- Manual entity-lexicon curation UI — deferred; auto-seeded/read-only this phase.
- Manual "regenerate now" UI trigger — deferred; automatic sweep-driven only.
- Learned/historical source-accuracy priors — deferred; hardcoded constants this phase, revisit once real accuracy data accumulates.

**Standing test-quality directive (Andrew, 2026-09-06, carried in STATE.md):** tests must prove real behavior, not ceremony. Prefer negative/adversarial assertions. Don't manufacture test scaffolding around something that's really just "read the code and confirm X."
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RECON-01 | Chunks from the recordings of one event align on a shared relative timeline, derived from content rather than wall-clock. | Direct reuse of Phase 35's `deriveAbsoluteInterval`/`intervalsOverlapWithTolerance` (`recording_start_time` + parsed `timestamp_start`/`timestamp_end`, ±20s `CLOCK_DRIFT_TOLERANCE_MS`) — see Architecture Patterns. |
| RECON-02 | Token-level disagreements resolve by weighted vote across source-accuracy priors, per-token confidence where exposed, and majority. | See "Token-Level Diff Algorithm" below — `fastest-levenshtein`'s `distance`/diff-adjacent output over word-tokenized aligned-chunk text, weighted-vote scoring function, new pure module `_shared/transcript-reconciler.ts`. |
| RECON-03 | A per-workspace entity lexicon, seeded from `transcript_chunks.entities`, breaks ties. | `entities: JSONB` column confirmed live (`{companies: [], people: [], products: []}` shape) — aggregate read, no new table needed; see Architecture Patterns "Entity Lexicon". |
| RECON-04 | The reconciled transcript is a derived layer. Source transcripts and chunks are never overwritten; the reconciled view is regenerable. | New `reconciled_transcript_segments` table (name at discretion), full delete+rebuild per event, mirroring `event_match_decisions`/`speaker_resolution_decisions` ledger shape — see Standard Stack / Don't Hand-Roll. |
| RECON-05 | Each reconciled segment stores which recordings supplied and agreed on it. | `source_recording_ids UUID[]` + `agreeing_recording_ids UUID[]` columns on the new table; provenance surfaced via `ReconciledSegmentProvenanceBadge` per UI-SPEC. |
| RECON-06 | Coverage gaps are explicit — single-recording intervals shown as single-source, not consensus. | `agreeing_recording_ids` length 1 vs 2+ drives badge rendering (UI-SPEC: no badge for single-source, badge for 2+). |
| RECON-07 | Embedding/search behavior is unchanged for unresolved events; reconciliation never silently re-embeds. | `transcript_chunks.embedded_at`/`embedding` columns are never touched by this phase's writes (new table only, `transcript_chunks` read-only) — verified no writer of `embedded_at` exists in scope for this phase; see Common Pitfalls. |

</phase_requirements>

## Summary

Phase 37 is the third and most algorithmically novel resolution phase in this milestone, but its infrastructure is 90% composition of what Phases 31/33/35 already built. The event-gating, org-bucketing, pure-module/edge-function split, shared-secret gate, and append-only-ledger persistence pattern are locked precedents proven three times already (`event-resolver.ts`, `identity-resolver.ts`, `speaker-resolver.ts`). This phase adds exactly one genuinely new capability: token-level text reconciliation across two or more chunk-level transcript variants of the same time interval, which none of the three prior phases needed (they resolved matches/identities/speaker-labels, never merged actual transcript prose).

The single biggest open question CONTEXT.md flagged — whether a diff library is needed or a simpler per-token indexed comparison suffices — is answered by direct evidence in this repo: `fastest-levenshtein@1.0.16` is already a project dependency (added Phase 32 for `dedup-fingerprint.ts`), and it is already proven importable inside a Deno edge function via `esm.sh` (`dedup-fingerprint.ts` does exactly this: `import { distance } from 'https://esm.sh/fastest-levenshtein@1.0.16'`). No new package is needed. Given the recordings are already time-aligned to ±20s and the underlying speech is the *same* utterance transcribed by 2+ ASR engines, the realistic disagreement shape is punctuation/casing/spelling variants and occasional whole-word substitutions on otherwise-identical word sequences — not reordered or restructured text. This is exactly the shape `fastest-levenshtein`'s edit-distance primitive handles well at the token (word) level: tokenize each aligned chunk's `chunk_text` on whitespace, then do an LCS-style/edit-distance alignment of the two token arrays (a small, hand-written O(n·m) DP over word tokens — practical because chunk-level text is short, tens of words, never full-transcript length) to identify which token positions agree vs. disagree, then apply RECON-02's weighted vote per disagreeing position.

**Primary recommendation:** Build `_shared/transcript-reconciler.ts` as a fourth pure module mirroring the exact shape of `speaker-resolver.ts`: (1) `alignChunksToTimeline()` — reuses Phase 35's `deriveAbsoluteInterval`/interval-overlap-with-tolerance primitives verbatim (do not reimplement); (2) `tokenizeAndAlignText()` — word-tokenizes two or more overlapping chunks' text and produces a token-level alignment via a small edit-distance DP (using `fastest-levenshtein`'s `distance` as the cost primitive, or a hand-rolled Wagner-Fischer variant if `distance()` alone doesn't expose the alignment path — confirm at Task 1 design gate); (3) `resolveTokenDisagreement()` — weighted vote combining hardcoded per-provider accuracy priors + per-token confidence (if exposed by the source provider; likely absent for most, fail-closed to majority-only) + the per-workspace entity lexicon tie-break + the deterministic provider-priority fallback for true 3-way ties; (4) a new forward-only `reconcile-transcripts` edge function that gates on speaker-resolution completion, buckets by (event_id, organization_id) exactly like `resolve-speakers`, and writes to a new `reconciled_transcript_segments` table via full delete+rebuild per event.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Content-derived timeline alignment across an event's chunks | Database / Storage (Postgres reads) + API/Backend (pure TS scoring) | — | Identical substrate/shape to Phase 35's alignment; all inputs (`recording_start_time`, `timestamp_start/end`, `canonical_recording_id`) already live in Postgres. |
| Token-level disagreement resolution (weighted vote) | API/Backend (pure TS, DB-free) | Database / Storage (entity lexicon read) | Scoring is pure and testable in isolation; only the entity-lexicon tie-break needs a DB read (aggregate `entities` column), fetched once per workspace before scoring, not per-token. |
| Entity lexicon (per-workspace, auto-seeded) | Database / Storage (derived aggregate query) | API/Backend (consumed as a lookup set) | Read-only derived data over `transcript_chunks.entities` — no new persisted lexicon table needed this phase per CONTEXT.md ("read-only derived data... no manual curation UI"); computed fresh per sweep run or cached in-memory per invocation. |
| Non-destructive derived storage layer | Database / Storage | API/Backend (writer) | New `reconciled_transcript_segments` table, full delete+rebuild per event; `transcript_chunks` remains read-only from this phase's perspective (RECON-04). |
| Regeneration trigger (sweep) | API/Backend (Edge Function + cron) | — | New, separate `reconcile-transcripts` function + cron, distinct trigger condition from `resolve-events`/`resolve-speakers` per CONTEXT.md's explicit "not chained" decision. |
| Reconciled transcript display (read-only) | Browser/Client | — | New "Reconciled" tab in `CallDetailDialog`, read-only render of `reconciled_transcript_segments`, per 37-UI-SPEC.md (already approved). |
| Embedding/search non-interference guarantee | Database / Storage (verify no writer touches `embedded_at`/`embedding`) | — | RECON-07 is a negative-proof requirement: this phase's code must never call the embedding pipeline or write `transcript_chunks.embedded_at`. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fastest-levenshtein` | `1.0.16` (already installed, `devDependencies`) | Token-level edit-distance primitive for RECON-02's diff/alignment | Already a proven project dependency (Phase 32, `dedup-fingerprint.ts`), already proven importable in both the frontend/vitest environment (via `resolve.alias` shim) AND a live Deno edge function (via `esm.sh` import) — zero new package risk. `[VERIFIED: npm registry — 1.0.16 confirmed via npm view, matches package.json]` |

No other new runtime dependency is needed. All persistence/RLS/edge-function scaffolding reuses the repo's existing Zod + Supabase-js + Deno patterns.

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|--------------|
| (none new) | — | — | Zod (already used in every edge function per `supabase/CLAUDE.md`), Vitest (already configured with the Phase 32 `resolve.alias` shim for `esm.sh` imports in unit tests) cover everything else needed. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `fastest-levenshtein` word-level DP | A full sequence-alignment/diff library (e.g. `diff`, `fast-diff`, `diff-match-patch`) | Heavier dependency surface for a problem that, given ±20s-pre-aligned chunks of the same short utterance, does not need general-purpose diffing (no reordering/restructuring expected) — adds a new package with its own slopcheck/legitimacy audit burden for no proven benefit over the already-installed primitive. |
| Hand-rolled Wagner-Fischer edit-distance-with-backtrace | `fastest-levenshtein`'s bare `distance()` (cost only, no alignment path) | `fastest-levenshtein`'s public API returns only a distance number, not the alignment/edit-script itself (confirmed via its README — see Open Questions). If Task 1's design gate confirms the alignment *path* (which tokens matched vs. substituted) is required — which RECON-02 needs to know *which* token disagreed — a small custom DP (using edit-distance principles, not a new library) will be needed regardless of which distance library backs the cost function. This is flagged as an Open Question, not a blocker: the DP itself is ~30 lines, mirrors the interval-overlap style of `speaker-resolver.ts`'s existing pure functions, and needs no new dependency either way. |
| Chunk-level majority selection (pick one source chunk's full text) | Token-level diffing | CONTEXT.md explicitly rejects this as insufficient — RECON-02's literal wording requires token-level resolution, not substituting a coarser selection strategy. |

**Installation:** none required — `fastest-levenshtein` is already in `package.json` `devDependencies`. Confirm during Task 1 whether it should move to `dependencies` (currently a devDependency because `dedup-fingerprint.ts`'s Deno import bypasses npm entirely, and the frontend has no current runtime use of it) — this phase's new pure module `transcript-reconciler.ts` will be Deno-imported the same way if it also uses the esm.sh import, so a devDependency (for the Vitest test harness only) may remain sufficient. Verify at plan time.

## Package Legitimacy Audit

No new packages are introduced this phase — `fastest-levenshtein` is already installed, already audited in Phase 32's research/planning, and already proven safe in production use (`dedup-fingerprint.ts`, live in `zoom-sync-meetings`/`zoom-webhook`). Skipping the slopcheck/registry gate per the protocol's own scope condition ("whenever this phase installs external packages") — this phase installs none.

`[VERIFIED: npm registry]` `fastest-levenshtein` — version `1.0.16` confirmed live via `npm view fastest-levenshtein version` during this research session; matches the pinned `package.json` version exactly (no drift).

## Architecture Patterns

### System Architecture Diagram

```
recordings A, B, ... (all event_id = <same event>, all already
  passed speaker resolution per speaker_resolution_decisions)
        │
        ▼
event_match_decisions (tier='metadata'|'deterministic'|'content_proof',
  decision='merge_applied') -- GATING CHECK: this event's recordings must
  have gone through the resolution pipeline, not just share a raw event_id
        │
        ▼
transcript_chunks (canonical_recording_id → recordings.id)
  chunk_text, chunk_index, entities, timestamp_start/end,
  speaker_name/email, source_platform, embedded_at (NEVER written by
  this phase -- RECON-07)
        │
        ▼
transcript-reconciler.ts (pure, DB-free)
  ├─ alignChunksToTimeline()        -- reuses Phase 35's deriveAbsoluteInterval
  │                                    + intervalsOverlapWithTolerance verbatim
  ├─ tokenizeAndAlignText()         -- word-tokenize + edit-distance alignment
  │                                    of 2+ overlapping chunks' chunk_text
  ├─ resolveTokenDisagreement()     -- weighted vote: provider-accuracy prior
  │                                    (hardcoded) + per-token confidence
  │                                    (if exposed, else majority-only) +
  │                                    entity-lexicon tie-break + deterministic
  │                                    provider-priority fallback (3-way tie)
  └─ buildReconciledSegment()       -- assembles final segment text +
                                        source_recording_ids + agreeing_
                                        recording_ids + coverage marker
        │
        ▼
reconcile-transcripts/index.ts (Deno edge fn, forward-only,
  X-Reconcile-Secret gated, mirrors resolve-speakers exactly)
  reads: transcript_chunks (by event_id via recordings),
         event_match_decisions (gating check),
         speaker_resolution_decisions (gating check -- must exist for
         this event before reconciliation runs),
         transcript_chunks.entities aggregated per workspace (lexicon)
  writes: reconciled_transcript_segments -- FULL DELETE+REBUILD per event
          on every sweep run (not incremental upsert). NEVER writes to
          transcript_chunks (RECON-04) or transcript_chunks.embedded_at/
          embedding (RECON-07).
        │
        ▼
"Reconciled" tab in CallDetailDialog (existing modal, new TabsContent)
  read-only render of reconciled_transcript_segments for the open call's
  event_id; ReconciledSegmentProvenanceBadge per multi-source segment
  (per 37-UI-SPEC.md, already approved)
```

### Recommended Project Structure
```
supabase/functions/
├── _shared/
│   ├── event-resolver.ts            # existing — event matching (Phase 31-33)
│   ├── speaker-resolver.ts          # existing — speaker resolution (Phase 35)
│   ├── transcript-reconciler.ts     # NEW — this phase's pure module
│   └── __tests__/
│       └── transcript-reconciler.test.ts
├── reconcile-transcripts/            # NEW — forward-only edge function
│   └── index.ts
supabase/migrations/
└── <timestamp>_create_reconciled_transcript_segments.sql   # NEW
src/
├── components/call-detail/
│   ├── CallReconciledTranscriptTab.tsx   # NEW (naming at executor discretion, per UI-SPEC)
│   └── CallDetailHeader.tsx              # MODIFIED — add "N recordings" badge
├── components/shared/   (or call-detail/)
│   └── ReconciledSegmentProvenanceBadge.tsx  # NEW, mirrors IdentityEvidenceBadge/RoutingTraceBadge
├── hooks/
│   └── useReconciledTranscript.ts        # NEW — TanStack Query wrapper
└── services/
    └── reconciledTranscript.service.ts   # NEW — pure async fetch function
```

### Pattern 1: Pure module + thin forward-only edge function (established 3x already — Phases 31, 34, 35; this phase makes it 4-for-4)
**What:** All matching/scoring logic lives in DB-free, unit-tested pure functions in `_shared/`. The edge function does exactly: shared-secret gate → fetch candidate rows → call pure functions → write decisions/segments → return summary. No reconciliation logic in the edge function body itself.
**When to use:** Locked precedent for this milestone, not optional.
**Example:**
```typescript
// Source: supabase/functions/_shared/speaker-resolver.ts (live in repo, Phase 35)
export function collapsePhantomSpeaker(input: ConsensusInput): ConsensusResult {
  // pure, DB-free, fails closed to a structural refusal on ambiguity
}
```

### Pattern 2: Reuse Phase 35's exact interval-alignment primitives — do not reimplement
**What:** `deriveAbsoluteInterval()` and the ±20s `CLOCK_DRIFT_TOLERANCE_MS`-tolerant overlap check are already built, unit-tested, and locked (35-01-SUMMARY.md's Decision A1, reconfirmed by CONTEXT.md's explicit instruction to "reuse `recording_start_time` + `timestamp_start` as the anchor, with the same ±20s clock-drift tolerance"). RECON-01 is not a new alignment problem — it is the same alignment problem Phase 35 solved, applied to full chunk text instead of speaker identity.
**When to use:** Import or re-export these functions from `speaker-resolver.ts` rather than copy-pasting; if `speaker-resolver.ts`'s functions are not exported in an importable shape, add exports there (small additive change) rather than duplicating the DP logic in a new file. This is a Task 1 design-gate decision (import vs. duplicate) — flagged as an Open Question below.
**Example:**
```typescript
// Source: supabase/functions/_shared/speaker-resolver.ts (live in repo, Phase 35)
export function deriveAbsoluteInterval(
  chunk: SpeakerChunk,
  recordingStartTime: string | null,
): AbsoluteInterval {
  // recording_start_time + parsed timestamp_start/timestamp_end,
  // fails closed to null on any missing/malformed input
}
const CLOCK_DRIFT_TOLERANCE_MS = 20_000; // locked, Andrew's requested 15-30s range midpoint
```

### Pattern 3: Token-level alignment via word-tokenized edit distance (NEW this phase — the one genuinely novel algorithm)
**What:** Given 2+ overlapping chunks' `chunk_text` (already time-aligned within ±20s per Pattern 2), word-tokenize each on whitespace, then compute a token-level alignment. Given the pre-aligned, same-utterance nature of the inputs (confirmed by this milestone's data shape: ASR transcripts of the same speech, not independently-authored text), the realistic disagreement shape is punctuation/casing/spelling variants on an otherwise near-identical word sequence — a small Wagner-Fischer-style edit-distance DP over word tokens (using `fastest-levenshtein`'s character-level `distance()` as the per-token substitution-cost metric, i.e. two tokens are "the same" if `distance(tokenA, tokenB)` is below a small threshold, not just exact string equality — this absorbs "ChatGPT" vs "ChatGBT"-style single-provider misspellings) correctly identifies agreeing vs. disagreeing token positions without needing a general-purpose diff library.
**When to use:** Inside `tokenizeAndAlignText()`, called once per aligned chunk-group (2+ chunks from different recordings whose intervals overlap within tolerance).
**Caveat:** `fastest-levenshtein`'s public API (confirmed via its README/source) exposes only `distance(a, b): number` and `closest(str, arr): string` — it does NOT return an alignment path (which characters/tokens matched vs. substituted). For RECON-02's "which token disagreed and what are the candidates" need, the alignment path itself must be computed via a small hand-written DP (the classic edit-distance backtrace), using `fastest-levenshtein`'s `distance()` only as the cost oracle for near-miss token equality (spelling variants), not as the full alignment mechanism. This DP is small (tens of lines), bounded by chunk length (never more than a few dozen words per `transcript_chunks` row), and follows the same "pure function, exhaustively unit-tested" style as every other scoring function in this milestone.
**Example (illustrative, not yet written):**
```typescript
// NEW this phase — supabase/functions/_shared/transcript-reconciler.ts
import { distance } from 'https://esm.sh/fastest-levenshtein@1.0.16';

const TOKEN_FUZZY_MATCH_THRESHOLD = 2; // chars — "ChatGPT" vs "ChatGBT" = distance 1, matches

function tokensMatch(a: string, b: string): boolean {
  if (a.toLowerCase() === b.toLowerCase()) return true;
  return distance(a.toLowerCase(), b.toLowerCase()) <= TOKEN_FUZZY_MATCH_THRESHOLD;
}
// ... small Wagner-Fischer DP over word arrays, using tokensMatch() as the
// equality predicate, producing an array of { position, tokens: string[] per
// source } disagreement records for resolveTokenDisagreement() to consume.
```

### Pattern 4: Entity lexicon as a derived, per-workspace aggregate read (not a new persisted table)
**What:** CONTEXT.md is explicit: "auto-seeded and refreshed from the aggregate of that workspace's own `transcript_chunks.entities` column... read-only derived data this phase — no manual curation UI." The simplest correct implementation is a query-time aggregate (e.g. `SELECT DISTINCT jsonb_array_elements_text(entities->'people') FROM transcript_chunks WHERE ...workspace scope...`), computed once per sweep invocation (or per-workspace, cached in memory for the duration of one edge-function call) and passed into `resolveTokenDisagreement()` as a plain `Set<string>`/lookup structure — not persisted as a new table, since "auto-seeded and refreshed" implies it should never go stale.
**When to use:** Fetched once per organization/workspace bucket in `reconcile-transcripts/index.ts`, before the per-event reconciliation loop, mirroring how `resolve-speakers` fetches `call_participants` once up front rather than per-chunk.
**Caveat:** `entities` is `JSONB DEFAULT '{}'` with shape `{companies: [], people: [], products: []}` (confirmed live, `20251125000001_ai_chat_infrastructure.sql`) — but this column has no enforced schema or guaranteed non-null nested arrays; the aggregate query must handle `NULL`/missing keys defensively (fail closed to an empty lexicon, never error the whole sweep on one malformed row).

### Anti-Patterns to Avoid
- **Reimplementing interval-overlap math instead of importing Phase 35's `deriveAbsoluteInterval`/`intervalsOverlapWithTolerance`.** This is the exact anti-pattern Phase 35 itself avoided by reusing Phase 33's primitives — do not break the chain.
- **Writing resolved/reconciled text back into `transcript_chunks.chunk_text`.** RECON-04 and this milestone's entire non-destructive posture (Phases 31/35 both wrote to a new ledger table, never overwrote source data) require the reconciled output to live exclusively in the new `reconciled_transcript_segments` table.
- **Triggering `embedded_at`/embedding writes anywhere in this phase's code path.** RECON-07 is a negative-proof requirement — grep the final diff for any call into the embedding pipeline (`process-embeddings`, `embed-chunks`) before considering this phase done; there should be zero such calls.
- **Using string-equality-only token comparison instead of a fuzzy/edit-distance-aware comparison.** CONTEXT.md's own worked example ("ChatGPT" over "ChatGBT") requires near-miss token matching, not exact equality — a naive token-equality diff would treat every spelling variant as a full disagreement requiring full weighted-vote resolution rather than recognizing them as the same underlying token with one bad transcription.
- **Persisting the entity lexicon as a new mutable table with its own staleness/refresh logic.** CONTEXT.md explicitly scopes this to a read-only, always-fresh aggregate — introducing a cached/persisted lexicon table adds staleness-management complexity this phase does not need and CONTEXT.md did not ask for.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Character/token edit-distance calculation | A new Levenshtein/edit-distance implementation | `fastest-levenshtein`'s `distance()` (already installed, already Deno-import-proven) | Already solved, already audited, already in this repo's dependency tree — reimplementing it duplicates a well-tested primitive for no benefit. |
| Cross-recording interval-overlap-with-tolerance math | A new interval comparison function | `speaker-resolver.ts`'s `deriveAbsoluteInterval`/`intervalsOverlapWithTolerance`/`CLOCK_DRIFT_TOLERANCE_MS` | Identical problem (do these two [start,end] ranges from different recordings' clocks overlap, allowing for drift) already solved and unit-tested in Phase 35 for this exact table. |
| Determining if two recordings' chunks belong to the same event/org bucket | A new bucketing pass | `resolve-speakers/index.ts`'s `recordingsByEvent`/`recordingsByOrg` grouping pattern (SAFE-04 same-org bucketing before any pairing) | Same safety-critical bucketing requirement (never pair cross-org data) already implemented and battle-tested 3x this milestone. |
| Append-only decision/provenance ledger shape | A new ad-hoc table schema | `event_match_decisions`/`speaker_resolution_decisions`-style shape (id, event_id, tier/type, score, signals JSONB, decision, decided_by, applied, created_at, FORCE RLS, service-role-only policy) | Locked provenance-ledger shape for this milestone; RECON-05's "which recordings supplied/agreed" requirement maps naturally onto a `source_recording_ids`/`agreeing_recording_ids` array pair on a table styled this way. |

**Key insight:** The infrastructure risk in this phase is near-zero — everything except the token-level diff algorithm is direct reuse of Phases 30-35's already-proven patterns. The actual risk surface is entirely in getting RECON-02's weighted-vote scoring constants and RECON-07's "never touch embedding" guarantee right, both of which are logic/testing concerns, not architecture concerns.

## Common Pitfalls

### Pitfall 1: Assuming real cross-source events with real ASR disagreements exist to test against
**What goes wrong:** A plan or executor assumes prod has real multi-recording events with genuinely disagreeing transcript text somewhere to sample for test fixtures.
**Why it happens:** Every prior phase in this milestone that needed cross-source examples found zero real data (Phase 35's research: `recordings.event_id` is NULL on all rows, `events` has zero rows in prod as of Phase 35's research date). This phase depends on Phase 35 (speaker resolution) having already run on real data, which itself depends on Phase 31-33's event resolution having real multi-recording events — a chain of dependencies that, per the milestone's own history, has not yet produced real overlapping-transcript data in prod.
**How to avoid:** Re-verify live prod row counts for `events`, `recordings.event_id IS NOT NULL`, and `speaker_resolution_decisions` at Task 1 design-gate time (state may have changed since Phase 35's research on 2026-09-07/08 — Clickable Impact is the one flagged org). Plan for entirely synthetic fixtures seeding `transcript_chunks` rows with deliberately near-miss text (e.g. "ChatGPT" vs "ChatGBT", punctuation variants, one dropped word) across 2+ synthetic recordings on one synthetic event, mirroring Phase 33/35's `canonical_recording_id`-keyed seeding approach.
**Warning signs:** A plan task says "sample real disagreeing transcript text" — there is likely none yet; redirect to synthetic/adversarial fixtures per the standing test-quality directive.

### Pitfall 2: Gating on `recordings.event_id IS NOT NULL` alone instead of `event_match_decisions`
**What goes wrong:** The sweep queries recordings by `event_id IS NOT NULL` only (mirroring `resolve-speakers`'s own query shape), which CONTEXT.md explicitly says is NOT sufficient for this phase — "gated on the event's recordings having passed at least metadata-tier event resolution (`event_match_decisions`) — it does not run on recordings that merely share a raw `event_id`."
**Why it happens:** `resolve-speakers/index.ts` itself queries only `event_id IS NOT NULL` (confirmed by direct read of its live source) — copying that exact query shape for `reconcile-transcripts` would silently violate CONTEXT.md's explicit, stricter gating requirement for this phase.
**How to avoid:** The `reconcile-transcripts` sweep query must additionally join/filter on `event_match_decisions` rows for the recording pairs in question with `decision = 'merge_applied'` (or whatever the live decision-state vocabulary proves to be at Task 1 — confirm exact values via `event_match_decisions_decision_check` constraint, already known: `'merge_proposed', 'merge_applied', 'reversed', 'rejected'`). This is a genuinely different gating condition from every prior sweep in this milestone and must not be copy-pasted without this extra join.
**Warning signs:** A plan or PR that queries only `recordings.event_id IS NOT NULL` for the reconciliation sweep, with no `event_match_decisions` join at all.

### Pitfall 3: Gating on speaker resolution incorrectly (or not at all)
**What goes wrong:** CONTEXT.md requires firing "once an event has 2+ recordings that have already passed speaker resolution (Phase 35's output)" — but `speaker_resolution_decisions` rows only exist when propagation/collapse actually *found something to resolve* (e.g. a named source + an anonymous source). An event where both recordings already carry fully-named speakers (the common case per Phase 35's own finding that 100% of sampled real `speaker_name` values are already real human names, not anonymous labels) would produce ZERO `speaker_resolution_decisions` rows even though speaker resolution has, in the meaningful sense, "already run and found nothing to do."
**Why it happens:** Literally reading "passed speaker resolution" as "has rows in `speaker_resolution_decisions`" would incorrectly gate out the majority-case event (both sources already named) forever, since that event will never produce a propagation/collapse row.
**How to avoid:** This needs an explicit Task 1 design-gate decision: does "passed speaker resolution" mean (a) the `resolve-speakers` sweep has run at all for this event's recordings (regardless of whether it found anything to resolve — requires some marker of "sweep has considered this event", which does not currently exist as a queryable fact since `speaker_resolution_decisions` only records positive resolutions), or (b) a simpler proxy like "recordings' `created_at` is after the speaker-resolution cutover AND the event has 2+ recordings" (borrowing `resolve-speakers`'s own forward-only cutover pattern)? Flag this explicitly for the planner — it is NOT resolved by direct precedent, since no prior phase in this milestone gates on "has another sweep already run over this," only on "has this sweep itself already produced a decision for this."
**Warning signs:** A plan that queries `speaker_resolution_decisions` for `event_id` presence as the sole gate, with no fallback for the all-already-named case.

### Pitfall 4: Naive exact-string token comparison instead of fuzzy matching
**What goes wrong:** Comparing tokens with `===` only treats "ChatGPT" and "ChatGBT" as a full disagreement requiring the entire weighted-vote/entity-lexicon machinery, when the intent (per CONTEXT.md's own worked example) is for the entity lexicon to recognize "ChatGPT" as the correct form and prefer it — but if tokens are pre-filtered as "different" at the tokenization/alignment stage using only exact equality, the alignment DP may misalign the surrounding tokens too (treating a 1-character-different word as a full insertion+deletion pair rather than a substitution), corrupting the segment's reconstructed text even in the "obviously same word" case.
**Why it happens:** Exact-string comparison is the naive default for a first-pass tokenizer/aligner.
**How to avoid:** Use `fastest-levenshtein`'s `distance()` as a fuzzy-equality predicate (small threshold, e.g. ≤2 chars) inside the alignment DP's equality check, not just at the final entity-lexicon tie-break step (see Pattern 3).
**Warning signs:** A `tokensMatch()`-equivalent function that only does `a === b` or `a.toLowerCase() === b.toLowerCase()`.

### Pitfall 5: Incremental upsert instead of full delete+rebuild
**What goes wrong:** Implementing `reconcile-transcripts` with an `.upsert(..., { onConflict: ... })` pattern (the pattern every prior sweep in this milestone uses, since they're proposing NEW decisions, not replacing old ones) instead of CONTEXT.md's explicit "full delete+rebuild per event on each sweep run, not incremental upsert" requirement for `reconciled_transcript_segments`.
**Why it happens:** Every single prior edge function in this milestone (`resolve-events`, `resolve-speakers`) uses `.upsert()` with a unique-constraint `onConflict` — it is the dominant pattern in this codebase, and copying it here would be the natural (but wrong) move, since RECON-04's "regenerable" wording is unusual among this milestone's requirements in demanding full recompute rather than incremental accretion.
**How to avoid:** `reconcile-transcripts/index.ts` must `DELETE FROM reconciled_transcript_segments WHERE event_id = $1` (within the same transaction/request as the subsequent inserts, ideally via a single RPC to keep it atomic) before inserting the freshly computed segments for that event — every sweep run, every time, not conditionally.
**Warning signs:** A migration or edge function using `.upsert()`/`onConflict` for `reconciled_transcript_segments` instead of an explicit delete-then-insert (or a single transactional RPC that does both).

## Code Examples

### Interval alignment (direct reuse target — Phase 35, live in repo)
```typescript
// Source: supabase/functions/_shared/speaker-resolver.ts (live, Phase 35)
export function deriveAbsoluteInterval(
  chunk: SpeakerChunk,
  recordingStartTime: string | null,
): AbsoluteInterval {
  const anchorMs = parseIsoToMs(recordingStartTime);
  const startOffsetMs = parseOffsetToMs(chunk.timestamp_start);
  const endOffsetMs = parseOffsetToMs(chunk.timestamp_end);
  const start = anchorMs !== null && startOffsetMs !== null ? new Date(anchorMs + startOffsetMs).toISOString() : null;
  const end = anchorMs !== null && endOffsetMs !== null ? new Date(anchorMs + endOffsetMs).toISOString() : null;
  return { canonical_recording_id: chunk.canonical_recording_id, chunk_index: chunk.chunk_index, start, end };
}
const CLOCK_DRIFT_TOLERANCE_MS = 20_000; // locked, reuse verbatim
```

### fastest-levenshtein Deno import (proven pattern — Phase 32, live in repo)
```typescript
// Source: supabase/functions/_shared/dedup-fingerprint.ts (live, Phase 32)
import { distance } from 'https://esm.sh/fastest-levenshtein@1.0.16';
// Proven to work inside a Deno edge function without Docker/bundling issues
// (deployed live via --use-api, per supabase/CLAUDE.md's deploy convention).
```

### Forward-only sweep, org-bucketing, upsert pattern to MIRROR for gating/bucketing but NOT for the final write (see Pitfall 5)
```typescript
// Source: supabase/functions/resolve-speakers/index.ts (live, Phase 35)
const recordingsByEvent = new Map<string, RecordingRow[]>();
for (const r of recordings) {
  const list = recordingsByEvent.get(r.event_id) ?? [];
  list.push(r);
  recordingsByEvent.set(r.event_id, list);
}
// SAFE-04: bucket by organization_id BEFORE any pairing.
```

### Entity JSONB shape (live schema, confirmed)
```sql
-- Source: supabase/migrations/20251125000001_ai_chat_infrastructure.sql (live)
entities JSONB DEFAULT '{}', -- Named entities {companies: [], people: [], products: []}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| No cross-source transcript merging existed anywhere in the codebase | Reconciliation is the first phase to produce a merged, multi-source view of transcript *text* (Phases 30-36 resolved events/identities/speaker-labels, never prose) | This phase (37), 2026-09 | This is genuinely new surface area — treat the token-diff algorithm as the phase's real risk, not the surrounding infrastructure (which is fully precedented). |
| `event_match_decisions`/`speaker_resolution_decisions` propose-only, never overwrite source | Same posture extends to `reconciled_transcript_segments` — propose/derive-only, `transcript_chunks` untouched | Established Phase 31, reconfirmed Phase 35, required again here (RECON-04) | Consistent non-destructive posture across all three resolution layers of this milestone. |

**Deprecated/outdated:** None specific to this phase's domain — every dependency (interval alignment, org-bucketing, ledger-table pattern, `fastest-levenshtein`) was built or added within the last ~10 days of this same milestone and remains current.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `fastest-levenshtein`'s public API exposes only a scalar `distance()`, not an alignment path/edit-script — confirmed via its README description ("fastest-levenshtein" — distance calculation library), not independently re-verified against its actual TypeScript type declarations in this session. | Standard Stack / Architecture Patterns Pattern 3 | If it does expose more (e.g. a diff/alignment method this research missed), the hand-rolled DP in Pattern 3 becomes unnecessary — lower risk than being wrong the other way, but worth a 2-minute `node_modules`/type-declaration check at Task 1 before committing to the hand-rolled DP design. `[ASSUMED]` |
| A2 | The realistic ASR-disagreement shape (punctuation/spelling variants, occasional word substitutions on an otherwise-identical word sequence, no reordering/restructuring) is correct for this milestone's actual data. | Summary, Pattern 3 | This is inferred from domain knowledge (multiple ASR engines transcribing the same audio) and from CONTEXT.md's own worked example ("ChatGPT" vs "ChatGBT"), not from inspecting real disagreeing transcript pairs in this repo (none exist yet per Pitfall 1). If real data eventually shows more drastic disagreement (e.g. one source drops entire phrases, or segments are chunked at very different word boundaries), the word-tokenized DP's complexity bound and matching heuristics may need revisiting. Flagged, not blocking — the DP design degrades gracefully (worst case: more tokens flagged as full insertions/deletions, more weighted-vote resolutions, but no crash). `[ASSUMED]` |
| A3 | "Passed speaker resolution" (the sweep's trigger condition) needs a Task 1 design decision beyond "has a `speaker_resolution_decisions` row" — see Pitfall 3. | Common Pitfalls Pitfall 3 | If the planner locks the wrong gating proxy, the sweep could either (a) never fire for the common all-already-named case, or (b) fire prematurely before speaker resolution has genuinely been considered for an event. Explicitly flagged as unresolved by precedent — not an `[ASSUMED]` claim being stated as fact, but a genuine open design question carried forward from research. |
| A4 | `event_match_decisions.decision` values usable for the gating check are exactly `'merge_proposed', 'merge_applied', 'reversed', 'rejected'` (from the live CHECK constraint) and reconciliation should gate on `decision = 'merge_applied'` specifically. | Common Pitfalls Pitfall 2 | Confirmed via direct migration-file read of the live CHECK constraint (`[VERIFIED: supabase/migrations/20260901000002_create_event_match_decisions.sql]`) — the constraint values are HIGH confidence; the choice of exactly `'merge_applied'` as the gating value (vs. also accepting `'merge_proposed'`) is `[ASSUMED]` and should be confirmed at Task 1 against CONTEXT.md's intent ("gone through the resolution pipeline" likely means applied, not merely proposed-and-unreviewed). |

## Open Questions

1. **Does `fastest-levenshtein` (or any lightweight library already available via esm.sh) expose an alignment path, or is a hand-rolled DP definitely required?**
   - What we know: The README/usage in this repo (`dedup-fingerprint.ts`) only calls `distance()`. The package's stated purpose is fast edit-distance calculation, not diffing.
   - What's unclear: Whether its TypeScript declarations expose any additional export this research didn't check.
   - Recommendation: 2-minute check of the package's type declarations at Task 1; if nothing more is exposed, proceed with the hand-rolled DP as designed in Pattern 3 — it's small and low-risk either way.

2. **What exactly does "passed speaker resolution" mean as a queryable gate, given `speaker_resolution_decisions` only records positive resolutions?**
   - What we know: `speaker_resolution_decisions` has zero rows for an event where both sources already carry named speakers (the dominant real-data case per Phase 35's research).
   - What's unclear: Whether the gate should be "resolve-speakers has been invoked for this event's recordings at least once" (requires some new tracking mechanism) or a simpler time-based/cutover proxy.
   - Recommendation: Task 1 design-gate decision, likely resolved as "recordings created at/after both the event-resolution AND speaker-resolution cutover timestamps, with 2+ recordings on the event" (a proxy, not a strict "already swept" check) — mirrors the forward-only philosophy already used twice in this milestone. Needs explicit sign-off, not silent assumption.

3. **Should the token-fuzzy-match threshold (for `tokensMatch()`) be a fixed constant or scaled by token length?**
   - What we know: A fixed ≤2-character threshold works for short misspellings like "ChatGBT" vs "ChatGPT" (distance 1).
   - What's unclear: Whether a fixed threshold over- or under-matches for very short tokens (e.g. "a" vs "I", distance 1, would incorrectly "fuzzy match" as the same token) or very long tokens (e.g. two genuinely different 15-character words within distance 2 by coincidence).
   - Recommendation: Scale the threshold by token length (e.g. `Math.min(2, Math.floor(token.length * 0.25))`) rather than a flat constant — a Task 1/Task 2 implementation detail, not an architectural blocker, but should be explicit in the plan rather than left to guess-and-check during implementation.

## Environment Availability

Skipped — this phase has no new external dependencies beyond the already-live Supabase project (prod `vltmrnjsubfzrgrtdqey`, TEST `callvault-test`), which every prior phase in this milestone has already used successfully, and `fastest-levenshtein` which is already installed and already proven in both the Vitest and Deno runtime environments.

**One live operational fact worth flagging for planning, not a new dependency:** per STATE.md, `event-resolution-sweep`'s `pg_cron` job has failed every tick since creation because `app.supabase_url`/`app.reconcile_secret` DB GUCs are unset (requires Andrew via Supabase Dashboard; not blocking, since SAFE-06 evidence was captured via manual sweep trigger instead). If this phase's plan adds a new `reconcile-transcripts-sweep` cron mirroring `event_resolution_sweep_cron.sql`'s pattern, it will hit the identical unset-GUC failure mode unless Andrew has since fixed it — verify live cron status at Task 1/plan time rather than assuming a fresh cron will actually fire. Manual/direct-invocation testing (mirroring how SAFE-06 was proven) remains the reliable fallback regardless of cron health.

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`. Section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (project-wide), Deno-esm-import edge functions collected via the `resolve.alias` shim proven in Phase 32 |
| Config file | `vitest.config.ts` (repo root) |
| Quick run command | `npx vitest run supabase/functions/_shared/__tests__/transcript-reconciler.test.ts` |
| Full suite command | `rtk vitest run` (unit) — integration tests require `npm run test:integration` per `supabase/CLAUDE.md`'s triple-layered TEST-project guard |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RECON-01 | Two recordings' overlapping chunks align on a shared derived timeline within ±20s tolerance; non-overlapping chunks remain unaligned | unit (pure function) | `npx vitest run supabase/functions/_shared/__tests__/transcript-reconciler.test.ts -t align` | ❌ Wave 0 |
| RECON-02 | Token-level disagreement resolves by weighted vote (provider prior + confidence + majority) | unit (pure function) | same file, `-t "weighted.vote"` | ❌ Wave 0 |
| RECON-02 (adversarial) | A true 3-way tie resolves deterministically via fixed provider-priority order, never randomly (run twice, assert identical output) | unit (pure function, negative/determinism) | same file, `-t "deterministic.*tie"` | ❌ Wave 0 |
| RECON-03 | Entity lexicon tie-break prefers the workspace-seeded correct spelling ("ChatGPT" over "ChatGBT") | unit (pure function) | same file, `-t "entity.*lexicon"` | ❌ Wave 0 |
| RECON-04 | `transcript_chunks` rows are never mutated by the reconciliation write path (adversarial — assert row unchanged after sweep) | integration (negative) | `npm run test:integration -- reconcile-transcripts` | ❌ Wave 0 |
| RECON-05 | Reconciled segment records `source_recording_ids`/`agreeing_recording_ids` accurately | unit (pure function) + integration | same files as above | ❌ Wave 0 |
| RECON-06 | A single-source interval is marked as single-source, not consensus (adversarial — assert no false "agreement" claim) | unit (pure function, negative) | same file, `-t "single.source"` | ❌ Wave 0 |
| RECON-07 | Reconciliation sweep never writes `transcript_chunks.embedded_at`/`embedding` for any row (adversarial — assert column unchanged, no embedding-pipeline call) | integration (negative) | `npm run test:integration -- reconcile-transcripts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** unit suite (`npx vitest run supabase/functions/_shared/__tests__/transcript-reconciler.test.ts`)
- **Per wave merge:** `rtk vitest run` full unit suite + relevant integration tests on TEST
- **Phase gate:** Full suite green before `/gsd:verify-work`, plus a live TEST-project introspection proof (mirroring every prior phase's SUMMARY pattern) before any prod apply

### Wave 0 Gaps
- [ ] `supabase/functions/_shared/__tests__/transcript-reconciler.test.ts` — covers RECON-01 through RECON-06 (pure-function layer)
- [ ] `supabase/functions/_shared/transcript-reconciler.ts` — the pure module itself (test-first / RED-then-GREEN per this milestone's established TDD-by-convention pattern)
- [ ] `supabase/functions/reconcile-transcripts/index.ts` — forward-only edge function wrapper
- [ ] `supabase/migrations/<timestamp>_create_reconciled_transcript_segments.sql` — new table, styled on `speaker_resolution_decisions`
- [ ] Synthetic integration fixtures seeding `transcript_chunks` rows across 2+ synthetic recordings + one synthetic event with deliberately near-miss text (adversarial disagreement fixtures, not just happy-path identical text)
- [ ] `src/test/rls-regression.test.ts` — register `reconciled_transcript_segments` in `BESPOKE_CLIENT_DENY_TABLES` (or `CROSS_ORG_TABLES` if a client-read policy is added for the UI tab) mirroring the `event_match_decisions`/`speaker_resolution_decisions` precedent
- [ ] `src/components/call-detail/CallReconciledTranscriptTab.tsx` + `ReconciledSegmentProvenanceBadge.tsx` + `useReconciledTranscript.ts` hook + service — frontend layer, per 37-UI-SPEC.md
- [ ] Framework install: none — Vitest and the Deno-alias shim are already configured repo-wide

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1` in `.planning/config.json`. Section included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Partial | `reconcile-transcripts` edge function gates on `X-Reconcile-Secret` shared-secret header (mirrors `resolve-events`/`resolve-speakers`), not end-user JWT — service-to-service/cron-triggered sweep. The NEW "Reconciled" tab's read path IS user-JWT-authenticated (it's a client-facing dialog view), using the repo's standard `authenticateRequest` helper if it reads via an edge function, or standard Supabase client + RLS if it reads directly. |
| V3 Session Management | No | No new session state introduced. |
| V4 Access Control | Yes | RLS on `reconciled_transcript_segments` must enforce the same access boundary as the underlying `transcript_chunks`/`recordings` a user could already see (mirrors ACCESS-03's future principle, applied by extension now: "nothing becomes readable through a derived layer that wasn't readable through the source"). Must be proven by `rls-regression.test.ts`'s cross-org isolation harness, following the `event_match_decisions`/`speaker_resolution_decisions` `BESPOKE_CLIENT_DENY_TABLES` registration pattern if no client read policy exists, OR a proper `CROSS_ORG_TABLES` registration with a real SELECT policy if the UI tab reads this table directly (client-facing, unlike the two prior ledgers which are service-role-only). |
| V5 Input Validation | Yes | Zod validation on the edge function's request body (`{ mode: 'forward', since? }`), matching `resolve-speakers`'s existing contract exactly. |
| V6 Cryptography | No | No new crypto surface. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-org transcript reconciliation widening readable audience (a workspace's entity lexicon or a segment's provenance leaking another org's participant/recording data) | Elevation of Privilege / Information Disclosure | SAFE-04's principle applies by extension: same-org bucketing before any chunk pairing (mirrors `resolve-speakers`'s `recordingsByOrg` pattern exactly), AND the entity lexicon read must be scoped per-workspace, never a global aggregate across all orgs. Must be proven by `rls-regression.test.ts`. |
| A new client-facing read surface (the "Reconciled" tab) exposing `reconciled_transcript_segments` rows a user shouldn't see for a recording they don't have access to | Elevation of Privilege / Information Disclosure | This is genuinely NEW risk surface relative to Phases 31/35 (whose ledgers were service-role-only, no client read policy at all) — RLS on `reconciled_transcript_segments` must be scoped at least as tightly as the underlying `transcript_chunks`/`recordings` access the requesting user already has, likely via a SECURITY DEFINER helper mirroring `user_participates_in_event`/`user_can_view_identity`. This needs explicit design attention at Task 1, not a copy-paste of the prior two ledgers' "no client policy at all" posture, since this phase's UI-SPEC requires an actual client read path. |
| Service-role edge function invoked without the shared secret | Spoofing | `X-Reconcile-Secret` gate before any DB work, checked before parsing the body — mirror `resolve-events`/`resolve-speakers`'s exact ordering. |
| Token-level reconciliation logic accidentally leaking one org's `entities` lexicon into another org's tie-break decision | Information Disclosure | Fetch the entity lexicon scoped to `organization_id`/workspace exactly like `bucketParticipants` is scoped per-bucket in `resolve-speakers` — never a single global lexicon query. |

## Sources

### Primary (HIGH confidence — live repo/prod introspection this session)
- Direct file read: `supabase/functions/_shared/speaker-resolver.ts` (live, Phase 35) — `deriveAbsoluteInterval`, `intervalsOverlapWithTolerance`, `CLOCK_DRIFT_TOLERANCE_MS = 20_000`, `propagateNamedLabel`, `collapsePhantomSpeaker` full implementation.
- Direct file read: `supabase/functions/resolve-speakers/index.ts` (live, Phase 35) — forward-only sweep shape, `recordingsByEvent`/`recordingsByOrg` bucketing, `.upsert(..., onConflict)` write pattern, shared-secret gate ordering.
- Direct file read: `supabase/migrations/20260908120000_create_speaker_resolution_decisions.sql` — provenance-ledger table shape to mirror for `reconciled_transcript_segments`.
- Direct file read: `supabase/migrations/20260901000002_create_event_match_decisions.sql` — `decision` CHECK constraint values (`'merge_proposed', 'merge_applied', 'reversed', 'rejected'`), FORCE RLS pattern.
- Direct file read: `supabase/migrations/20251125000001_ai_chat_infrastructure.sql` — live `transcript_chunks` schema (`chunk_text`, `chunk_index`, `entities JSONB`, `timestamp_start/end TEXT`, `speaker_name/email`, `embedded_at`, `embedding_model`, `fts`), confirming `entities` shape `{companies: [], people: [], products: []}`.
- Direct file read: `supabase/functions/_shared/dedup-fingerprint.ts` (live, Phase 32) — `import { distance } from 'https://esm.sh/fastest-levenshtein@1.0.16'`, proving the exact import pattern needed for this phase's Deno edge function.
- `npm view fastest-levenshtein version` — confirmed `1.0.16`, matches pinned `package.json` devDependency exactly, zero version drift.
- Direct file read: `package.json` — confirmed `fastest-levenshtein` is the only diff/levenshtein/fuzzy/align-adjacent dependency in the project; no `diff`/`fast-diff`/`diff-match-patch` present.
- Direct file read: `src/components/CallDetailDialog.tsx`, `src/components/shared/IdentityEvidenceBadge.tsx` — confirmed existing `Tabs`/`TabsContent` structure, Popover-based badge pattern to mirror for `ReconciledSegmentProvenanceBadge`.
- `.planning/phases/37-transcript-reconciliation/37-UI-SPEC.md` (already approved) — attachment point, component naming guidance, copy contract, icon choice (`RiGitMergeLine`), all locked.
- `.planning/config.json` — `nyquist_validation: true`, `security_enforcement: true`, `security_asvs_level: 1` confirmed live.

### Secondary (MEDIUM confidence — prior-phase RESEARCH/SUMMARY.md documents, cross-checked against this session's live introspection where checked)
- `.planning/phases/35-speaker-resolution-across-sources/35-RESEARCH.md` — full precedent for the pure-module/edge-function pattern, interval-alignment design rationale, and the exact clock-drift-tolerance decision history (Andrew's 15-30s range, midpoint 20s locked).
- `.planning/STATE.md` — `event-resolution-sweep` cron failure (unset GUCs) flagged as a live operational fact relevant to planning a new cron for this phase.

### Tertiary (LOW confidence — not independently re-verified this session)
- `fastest-levenshtein`'s exact TypeScript export surface (whether it exposes anything beyond `distance()`/`closest()`) — inferred from its known public API and this repo's only existing usage (`dedup-fingerprint.ts`, which only calls `distance()`), not independently re-checked against its `.d.ts` file in `node_modules` this session. Flagged as Open Question 1.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `fastest-levenshtein` is confirmed installed, version-verified, and proven working in both target runtimes (Vitest + Deno edge function) by direct evidence in this exact repo; zero new dependency risk.
- Architecture: HIGH for the reused portions (interval alignment, bucketing, ledger-table shape — all 3x-proven precedent); MEDIUM for the token-level diff algorithm specifics (Pattern 3's DP design is sound but unverified against real disagreeing-transcript data, since none exists yet — Pitfall 1) and the RLS/client-read-access design (Open Question 2/Security Domain — this is the first ledger-style table in this milestone that needs an actual client-facing read policy, not just service-role writes).
- Pitfalls: HIGH — all five pitfalls are grounded in direct comparison against this exact repo's live code (resolve-speakers' actual gating query, actual upsert pattern, actual event_match_decisions constraint values) or CONTEXT.md's own explicit locked-decision text, not speculation.

**Research date:** 2026-09-10
**Valid until:** ~10 days (fast-moving milestone; re-verify `events`/`recordings.event_id`/`speaker_resolution_decisions` live row counts and the `event-resolution-sweep` cron's fixed/broken status if planning is delayed past this window).
