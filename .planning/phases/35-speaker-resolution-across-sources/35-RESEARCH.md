# Phase 35: Speaker Resolution Across Sources - Research

**Researched:** 2026-09-07
**Domain:** Cross-recording speaker-label reconciliation over `transcript_chunks`, backend-only (Supabase Postgres + Deno Edge Function), no new packages
**Confidence:** MEDIUM — schema and prior-phase patterns are HIGH confidence (live prod introspection); the "timeline alignment" and "consensus" mechanics are MEDIUM/LOW because zero real cross-source events exist in prod to validate against, and part of the phase's design space depends on an unresolved architectural question (see Open Questions).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (Phase Boundary / domain)
Named speakers from one recording of a resolved event propagate onto another recording's anonymous diarization labels by timeline alignment; over-segmented diarization (one real speaker split into two labels by one source) collapses to the labeled source's truth by consensus. Speakers with zero evidence (no calendar data, no attendee list, only anonymous diarization) stay unresolved — never guessed.

In scope: timeline-alignment logic reading `transcript_chunks` (start/end offsets) across an event's linked recordings; a consensus mechanism for collapsing phantom over-segmented speakers; writing resolved names back to the identity/speaker layer built in Phase 34 (`identity_id`, evidence).

Out of scope: transcript reconciliation itself (the merged transcript text — Phase 37); new UI beyond what Phase 34's evidence badge already shows (unless a plan finds a real gap); enabling this for orgs beyond the existing SAFE-01-flagged test org unless research says otherwise.

### Claude's Discretion
All implementation choices are at Claude's discretion within locked constraints from REQUIREMENTS.md and the source spec:
- Resolution must be evidence-based only — never guess a speaker identity from diarization alone with no corroborating signal (mirrors IDENT-07/voiceprint exclusion's spirit: no inference without evidence).
- Uses the `identities`/`identity_id` spine and `get_identity_evidence` RPC from Phase 34 — do not build a parallel identity mechanism.
- Reads `transcript_chunks` (already exists, per Phase 33's finding that it has real rows for some orgs — be mindful of that when writing any test fixtures/queries).
- Consensus logic must be conservative: when sources disagree, prefer leaving a speaker unresolved over asserting a wrong resolution (this milestone's asymmetric-threshold philosophy — MATCH-08 — applies here by extension even though this isn't a MATCH requirement).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope (skipped; infrastructure-only).

**Standing test-quality directive (Andrew, 2026-09-06, carried in STATE.md):** tests must prove real behavior, not ceremony. Prefer negative/adversarial assertions. Don't manufacture test scaffolding around something that's really just "read the code and confirm X."
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IDENT-04 | Where one recording of an event carries named speakers and another carries anonymous labels, names propagate onto the anonymous labels by timeline alignment across `transcript_chunks`. | See Architecture Patterns (chunk-ordinal alignment, not wall-clock) and Runtime/Environment findings below — zero real anonymous-label rows exist in prod today, so this requires synthetic fixtures. |
| IDENT-05 | Diarization over-segmentation is corrected by consensus — labeled source wins, phantom speaker collapses. | See Consensus Mechanism pattern below (interval-overlap voting against `call_participants`/`identity_id`, mirroring the alibi-constraint's interval-overlap primitive from Phase 33). |
</phase_requirements>

## Summary

Phase 35 has no new library, no new package, and touches exactly one already-live substrate: `transcript_chunks`, joined to `recordings.event_id` (added in Phase 30) and to the `identities`/`identity_aliases` spine (added in Phase 34). The correct shape is a third pure module in `supabase/functions/_shared/`, following the identical pattern `event-resolver.ts` (Phase 31-33) and `identity-resolver.ts` (Phase 34) already established: pure, DB-free scoring/matching functions, unit-tested exhaustively, wrapped by a thin forward-only, shared-secret-gated edge function that does the actual reads/writes. Call it `speaker-resolver.ts` / `resolve-speakers` unless a plan finds a reason `event-resolver.ts` itself should absorb it (it already reads `transcript_chunks` for content-proof matching, so there's a real question of file-placement — see Open Questions).

The two hardest facts this research surfaced, both from live prod introspection, reshape how this phase must be planned:

1. **Zero real multi-recording events exist anywhere in prod.** `recordings.event_id` is NULL on all rows; `events` has zero rows. This isn't a "check if it applies" caveat — it's already true and confirmed. Nothing in this phase can be proven against real data. Test fixtures must be entirely synthetic (seeded transcript_chunks rows across two synthetic recordings on one synthetic event), exactly as Phase 33 already did for content-proof matching on the same table.
2. **The "anonymous diarization label" scenario this phase is built to resolve has never occurred in real data.** All 61,253 real `transcript_chunks.speaker_name` values sampled are real human names (e.g., "Andrew Naegele," "Sefy Tofan") — zero rows match a `Speaker N`-style anonymous pattern. This means the two connectors currently feeding `transcript_chunks` (predominantly Fathom, per the `source_platform` sample) apparently always resolve names before writing this table, or CallVault's current provider set doesn't surface un-diarized labels here at all. IDENT-04/05's entire premise (source A has names, source B has "Speaker 1"/"Speaker 2") needs its own synthetic fixture format decision during planning — there is no real example row to copy the shape from.

For "timeline alignment," Phase 33 already answered the clock-drift question definitively for this same table: `timestamp_start`/`timestamp_end` are nullable TEXT (`HH:MM:SS` format, confirmed by live sampling, e.g. `"00:15:10"`), populated for ~89% of real rows, and are **capture-relative offsets** (time since that specific recording started), not wall-clock. Phase 33 deliberately rejected using them for alignment and used `chunk_index` ordinal position instead, specifically because they are "nullable TEXT with no live writer and unconfirmed format" per that phase's own research finding — this was written before the corrective 33-03-SUMMARY finding that the table does have 54K/61K rows with timestamp data. That correction was about row *count*, not about the timestamp *semantics or reliability* — the column remains free-text, unenforced format, and un-typed, so treating it as authoritative absolute alignment data is still risky. Phase 35 needs a design decision on whether it can now lean on `timestamp_start`/`timestamp_end` for cross-recording alignment (two different recordings of one event, each with its own relative-offset clock, need a *derived* common origin — likely the recording's calendar/provider start time from `recordings`, not raw string parsing) or whether it should also stay conservative and align by some other proxy. This is flagged as an Open Question for the planner/discuss-phase, not resolved here.

**Primary recommendation:** Build `_shared/speaker-resolver.ts` as pure functions mirroring `event-resolver.ts`'s `scoreContentProofOverlap`/`isContentProofTemporallyPlausible` shape: (a) a name-propagation function that, given two recordings' chunk lists for one event, proposes a name for an anonymous-labeled chunk when a named chunk from another recording overlaps its interval; (b) a consensus function that, given >2 chunks/speakers on an interval, collapses a source's over-segmented pair when a second source's single chunk spans both; both fail closed to "unresolved" on ambiguity, both write nothing themselves (candidate/evidence rows only, mirroring `identity_aliases.evidence` and `get_identity_evidence`'s shape) — a forward-only edge function wraps and persists. No auto-linking on weak signals: only propagate a name when the source chunk's speaker has a resolved `identity_id` (from Phase 34) or an unambiguous verified alias, never from a bare unverified display-name string alone, consistent with IDENT-02's precedent.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Timeline alignment across an event's `transcript_chunks` | Database / Storage (Postgres query + pure TS scoring) | API/Backend (Edge Function orchestration) | All matching inputs (`chunk_index`, `timestamp_start/end`, `canonical_recording_id`, `event_id`) already live in Postgres; scoring logic is pure and DB-free per the established `event-resolver.ts`/`identity-resolver.ts` pattern — no browser or SSR involvement. |
| Consensus / phantom-speaker collapse | Database / Storage + API/Backend | — | Same substrate; consensus decision is a pure function over chunk+participant data, persisted via a forward-only sweep edge function. |
| Writing resolved names back to identity layer | API/Backend | Database / Storage | Must go through the `identities`/`identity_id` spine and `get_identity_evidence`-shaped evidence, not a parallel write path — Phase 34's RPC/table pattern owns persistence and redaction. |
| Displaying resolved speaker confidence | Browser/Client (existing) | — | Phase 34's `IdentityEvidenceBadge` component already renders confidence/evidence on demand; explicitly out of scope to add new UI per CONTEXT.md unless a plan finds a real gap. |

## Standard Stack

No new libraries. This phase extends existing Deno Edge Functions (Supabase) and Postgres, using the repo's existing toolchain: TypeScript (Deno runtime for edge functions), Vitest for unit tests (via the repo's existing alias/resolve shim proven in Phase 32), Zod for edge-function input validation (already a project convention per `supabase/CLAUDE.md`).

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (none new) | — | — | Phase reuses `_shared/event-resolver.ts` and `_shared/identity-resolver.ts` patterns; zero new runtime dependencies. |

### Package Legitimacy Audit

Not applicable — this phase installs no new packages. Skipping the slopcheck/registry gate per the protocol's own scope condition ("whenever this phase installs external packages").

## Architecture Patterns

### System Architecture Diagram

```
recordings A, B (both event_id = <same event>)
        │
        ▼
transcript_chunks (canonical_recording_id → recordings.id)
  chunk_index, speaker_name, speaker_email,
  timestamp_start/end (capture-relative), entities
        │
        ▼
speaker-resolver.ts (pure, DB-free)
  ├─ alignChunksAcrossRecordings()   -- derive comparable intervals per event
  ├─ propagateNamedLabel()           -- named chunk's identity fills anonymous chunk's interval
  └─ collapsePhantomSpeaker()        -- labeled source's single span wins over split pair
        │
        ▼
resolve-speakers/index.ts (Deno edge fn, forward-only, X-Reconcile-Secret gated)
  reads: transcript_chunks (by event_id via recordings), call_participants, identities/identity_aliases
  writes: identity_aliases evidence row (or a new speaker_resolution_decisions-style ledger,
          mirroring event_match_decisions) — never overwrites transcript_chunks.speaker_name itself
        │
        ▼
get_identity_evidence RPC (Phase 34, existing) — surfaces resolved confidence to IdentityEvidenceBadge (existing UI, Phase 34)
```

### Recommended Project Structure
```
supabase/functions/
├── _shared/
│   ├── event-resolver.ts          # existing — event matching (Phase 31-33)
│   ├── identity-resolver.ts       # existing — identity matching (Phase 34)
│   ├── speaker-resolver.ts        # NEW — this phase's pure module
│   └── __tests__/
│       └── speaker-resolver.test.ts
├── resolve-speakers/               # NEW — forward-only edge function
│   └── index.ts
```

### Pattern 1: Pure module + thin forward-only edge function (established 3x already — Phase 31, 34, and this phase makes it 3-for-3)
**What:** All matching/scoring logic lives in DB-free, unit-tested pure functions in `_shared/`. The edge function does exactly: shared-secret gate → fetch candidate rows → call pure functions → write decisions/evidence → return summary. No matching logic in the edge function body itself.
**When to use:** Any new resolution/matching capability in this milestone. Locked precedent, not optional.
**Example:**
```typescript
// Source: supabase/functions/_shared/event-resolver.ts (live in repo, Phase 33)
export function scoreContentProofOverlap(
  chunksA: ContentProofChunk[],
  chunksB: ContentProofChunk[],
  minSharedShingles: number = CONTENT_PROOF_MIN_SHARED_SHINGLES,
): ContentProofOverlapResult {
  // pure, DB-free, fails closed
}
```

### Pattern 2: Chunk-ordinal alignment over raw timestamp trust (Phase 33 precedent, directly applicable)
**What:** When comparing intervals across two recordings' `transcript_chunks`, do not treat `timestamp_start`/`timestamp_end` as an authoritative absolute clock without deriving a shared origin first. Phase 33 aligned on `chunk_index` ordinal position for its content-proof scorer specifically to sidestep this column's unenforced-format risk.
**When to use:** Any cross-recording interval comparison in this phase (both IDENT-04's alignment and IDENT-05's consensus).
**Caveat for this phase specifically:** unlike Phase 33 (which only needed ordinal position to detect *shingle overlap*, not real-world time), IDENT-04/05 need actual overlapping **time intervals** to decide which anonymous chunk falls under which named chunk's span — ordinal position alone can't do that across two recordings with different chunking. The available derivable signal is: `timestamp_start`/`timestamp_end` (capture-relative offset strings) + the capture's own start time (`recordings.recording_start_time`, confirmed to exist per the SPEC's F1 finding) → convert each chunk's offset into an absolute instant, then compare across recordings. This is a real design decision for the planner (see Open Questions) — it is NOT a solved problem carried over from Phase 33; only the "don't trust raw wall-clock across devices" principle carries over.

### Pattern 3: Non-linking negative-type guarantee (Phase 34 precedent, directly reusable for the "stay unresolved" success criterion)
**What:** `identity-resolver.ts`'s `DisplayNameCandidate` type pins `identity_id: null` and `verified: false` as *literal* types, making "this signal alone can never link" a compile-time property, not a runtime convention. The identical pattern should back Success Criterion 3 ("speakers with no calendar data, no attendee list, and only anonymous diarization stay unresolved rather than guessed") — a weak/no-evidence chunk should produce a type that is structurally incapable of writing a resolved name.
**When to use:** Any code path in `speaker-resolver.ts` that evaluates an anonymous chunk with no corroborating named chunk on an overlapping interval.
**Example:**
```typescript
// Source: supabase/functions/_shared/identity-resolver.ts (live in repo, Phase 34)
export interface DisplayNameCandidate {
  alias_type: 'display_name';
  verified: false;      // literal type, not boolean
  confidence: number;
  identity_id: null;    // literal type, not string | null
  value: string;
}
```

### Anti-Patterns to Avoid
- **Auto-resolving from name-similarity alone:** identical to IDENT-02's rule from Phase 34 — never resolve a speaker purely because a diarization label superficially resembles a known name. Only propagate from a corroborated interval match (a named chunk whose speaker has a resolved `identity_id`) — never a bare string match.
- **Trusting `timestamp_start`/`timestamp_end` as directly comparable across two different recordings without deriving a common origin.** They are per-capture relative offsets, unenforced TEXT format (confirmed live: `"HH:MM:SS"` in the sampled rows, but not a typed/constrained column).
- **Writing over `transcript_chunks.speaker_name`/`speaker_email` in place.** CONTEXT.md's boundary explicitly reserves "the merged transcript text" for Phase 37 (RECON), and the existing evidence/RPC pattern (Phase 34) stores resolution results as evidence rows, not destructive column overwrites. Mirror that: resolved names attach to `identity_id`/evidence, source chunks stay untouched (consistent with RECON-04's "source transcripts and chunks are never overwritten" principle, even though that's a later phase's requirement — the same non-destructive posture applies here).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Determining if a person is a genuine identity match | A new fuzzy name-matching heuristic | `identities`/`identity_aliases` + `identity-resolver.ts`'s `resolveByVerifiedEmail`/`resolveByProviderParticipantId` (Phase 34) | Locked spine; a parallel resolution mechanism would violate the CONTEXT.md constraint directly ("do not build a parallel identity mechanism"). |
| Interval-overlap / alibi-style time reasoning | A bespoke overlap-detection function from scratch | `isContentProofTemporallyPlausible`/interval-overlap primitives already in `event-resolver.ts` (Phase 32/33) | Same overlap-math problem (does interval A intersect interval B) already solved and unit-tested for MATCH-04/MATCH-07; reuse the primitive rather than reimplementing interval math. |
| Merge/reversal ledger pattern | A new ad-hoc decisions table | `event_match_decisions`-style ledger shape (tier, score, signal breakdown, decided_by, timestamp) | MATCH-09's pattern is the established provenance-ledger shape for this milestone; if this phase needs to persist speaker-resolution decisions durably (beyond `identity_aliases` evidence), mirror this shape rather than inventing a new one. |

**Key insight:** Every piece of infrastructure this phase needs (identity spine, evidence RPC, interval-overlap math, pure-module/edge-function split, forward-only sweep, shared-secret gate) was already built in Phases 30-34. This phase is close to pure composition — the risk is not "what library to use," it's making sure the composition doesn't silently reopen a weak-signal auto-link hole that Phase 34 spent real effort closing.

## Common Pitfalls

### Pitfall 1: Building/testing this phase as if real anonymous-label examples exist
**What goes wrong:** A plan or executor assumes `transcript_chunks.speaker_name` contains real `"Speaker 1"`/`"Speaker 2"`-style rows somewhere in prod and tries to sample them for test fixtures.
**Why it happens:** Every other phase in this milestone has been able to lean on real sampled data (Phase 33's transcript_chunks row-count correction, Phase 32's Clickable Impact sample). This phase is the first where the target scenario has zero real examples.
**How to avoid:** Confirmed via live query: 0 of 61,253 real `speaker_name` values match `^Speaker [0-9]+$`; all are genuine human names. Plan for entirely synthetic fixtures (mirroring Phase 33's approach of seeding rows with `recording_id: NULL` to sidestep the legacy bigint FK, using `canonical_recording_id` as the live join key).
**Warning signs:** A plan task says "sample real anonymous-diarization rows" — there are none; redirect to synthetic seeding.

### Pitfall 2: Treating `timestamp_start`/`timestamp_end` as wall-clock-comparable across two different recordings without deriving a shared origin
**What goes wrong:** Directly comparing `"00:15:10"` from recording A's chunks against `"00:15:10"` from recording B's chunks as if they refer to the same instant — they don't unless both captures started recording at exactly the same wall-clock moment (rare: partial captures, late joiners, provider-side start delay all break this).
**Why it happens:** The column names ("timestamp_start/end") read as absolute, and Phase 33's content-proof tier deliberately avoided this exact trap by not using them at all (ordinal `chunk_index` instead) — but that dodge isn't available here since IDENT-04/05 genuinely need real overlapping time-of-day intervals, not just "these two chunks are similar content."
**How to avoid:** Derive each chunk's absolute instant as `recordings.recording_start_time + parse(timestamp_start)` (both recordings' own start times are independently knowable), then compare absolute instants across recordings — never compare the raw offset strings directly. This needs a locked design decision in the plan, not left implicit.
**Warning signs:** Code comparing `timestamp_start` strings across two different `canonical_recording_id` values without ever touching `recording_start_time`.

### Pitfall 3: Silent auto-resolution when the only corroborating source is a display-name match, not an `identity_id`
**What goes wrong:** A chunk's `speaker_name` string matches another chunk's `speaker_name` string exactly, and the resolver treats that as sufficient evidence to propagate — reintroducing exactly the name-similarity-auto-link hole Phase 34's `DisplayNameCandidate` type was built to structurally prevent.
**Why it happens:** It's the "obvious" naive implementation — string equality is the cheapest signal available on this table.
**How to avoid:** Require the named chunk's speaker to already carry a resolved `identity_id` (via `call_participants.identity_id` or a verified `identity_aliases` match on `speaker_email`) before it's eligible to donate a name to an anonymous chunk. A bare `speaker_name` string match with no `identity_id`/verified-alias backing should fall into the same non-linking, type-pinned-null shape Phase 34 established.
**Warning signs:** A propagation function that takes only `speaker_name: string` as input with no `identity_id`/`email` corroboration parameter.

### Pitfall 4: Assuming `has_confirmed_speech` gives an alibi signal for this phase
**What goes wrong:** Reusing MATCH-07's alibi predicate (`isSpeakerAlibiViolation`) as if it applies directly to speaker-label propagation.
**Why it happens:** It's the nearest existing "speaker + time interval" primitive in the codebase and superficially looks reusable.
**How to avoid:** `has_confirmed_speech` remains unpopulated by any live writer per Phase 33's own finding (STATE.md: "remains unpopulated by any live writer... the alibi veto remains correct-but-currently-unreachable on organic data") — so this column cannot be relied on as a real signal for IDENT-04/05 either, for the same reason. The overlap-math *pattern* is reusable; the specific alibi *data* is not populated yet.

## Code Examples

### Interval overlap check (reusable primitive, from the alibi constraint — Phase 33)
```typescript
// Source: supabase/functions/_shared/event-resolver.ts, isSpeakerAlibiViolation (line ~1367)
// Pattern to reuse for chunk-interval comparison: both sides already reduce
// to "do these two [start, end] ranges overlap" once instants are derived.
export function isSpeakerAlibiViolation(a: AlibiCandidate, b: AlibiCandidate): boolean {
  // interval-overlap math — reuse the primitive, not the alibi-specific semantics
}
```

### Shingle-based content match (reference for how a NEW pure scorer in this phase should be shaped/documented)
```typescript
// Source: supabase/functions/_shared/event-resolver.ts, scoreContentProofOverlap (line ~1096)
export function scoreContentProofOverlap(
  chunksA: ContentProofChunk[],
  chunksB: ContentProofChunk[],
  minSharedShingles: number = CONTENT_PROOF_MIN_SHARED_SHINGLES,
): ContentProofOverlapResult {
  // pure, fails closed, exhaustively unit-tested in isolation from any DB read
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Zoom-only dedup fingerprinting (`dedup-fingerprint.ts`) | Provider-agnostic matcher reading `recordings`+`call_participants`+`transcript_chunks` | Phase 32 (2026-09-02/03) | This phase's speaker resolver should follow the same provider-agnostic posture — do not special-case Fathom even though it's currently the only observed `source_platform` in sampled real data. |
| No identity spine | `identities`/`identity_aliases` non-org-scoped spine, redacted `get_identity_evidence` RPC | Phase 34 (2026-09-05/06) | This phase writes through that spine, not a new table. |

**Deprecated/outdated:** None specific to this phase's domain — everything it depends on was built in the last ~2 weeks of this same milestone.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `recordings.recording_start_time` exists and is populated reliably enough to serve as the "shared origin" for converting each recording's relative `timestamp_start` offsets into comparable absolute instants. | Common Pitfalls / Pattern 2, Architecture Patterns | If this column is sparsely populated or unreliable across providers, the whole timeline-alignment mechanism for IDENT-04 has no anchor and needs a different design (e.g., relying only on tier-1/tier-2 event-resolution confidence + a coarser "same event, no fine-grained alignment" fallback that surfaces resolution but not precise interval attach). This is flagged `[ASSUMED]` because it was cited from the SPEC's F1 finding (`recordings.recording_start_time` mentioned generically), not independently re-verified against live prod schema in this research pass. |
| A2 | A new pure module (`speaker-resolver.ts`) is the right file boundary, rather than extending `event-resolver.ts` (which already reads `transcript_chunks` for a related purpose). | Architecture Patterns, Open Questions | If the planner instead extends `event-resolver.ts`, the file grows past 60KB with a second, conceptually distinct resolution concern bolted on — not wrong, but a real design choice this research did not resolve. Flagged as an Open Question rather than a locked recommendation. |
| A3 | Persisting speaker-resolution decisions belongs as `identity_aliases` evidence rows (reusing Phase 34's shape) rather than a new dedicated ledger table (mirroring `event_match_decisions`). | Don't Hand-Roll, Architecture Patterns | If per-decision provenance (which recording donated the name, what interval, what confidence) needs richer structure than `identity_aliases.evidence: text` currently supports, a new table may be needed — this wasn't locked at the schema level in Phase 34 with speaker resolution specifically in mind. |

**If this table is empty:** N/A — see rows above.

## Open Questions

1. **Where does absolute-time alignment get its shared origin, precisely?**
   - What we know: `timestamp_start`/`timestamp_end` are capture-relative TEXT offsets (`HH:MM:SS`), confirmed live. `recordings` almost certainly carries some start-time column (SPEC F1 references `recording_start_time` generically among "timing" columns) but this research did not re-verify that exact column name/nullability against the live `recordings` schema in this pass.
   - What's unclear: whether that column is reliably populated across all providers/orgs, and whether it's precise enough (seconds vs. minutes) to make fine-grained interval overlap meaningful rather than noisy.
   - Recommendation: the planner's Task 1 design-gate should re-verify `recordings`' actual timing columns live before locking the alignment algorithm, exactly as every prior phase in this milestone has done for its own load-bearing schema assumption.

2. **File placement: new `speaker-resolver.ts`, or extend `event-resolver.ts`?**
   - What we know: `event-resolver.ts` already reads `transcript_chunks` (content-proof tier) and is already 1,400+ lines / 60KB.
   - What's unclear: whether this milestone's convention favors one file per resolution *domain* (event vs. identity vs. speaker) — which the existing 2-file precedent (event-resolver.ts, identity-resolver.ts) suggests — or whether speaker resolution is "close enough" to event resolution's existing transcript_chunks read path to share a file.
   - Recommendation: new file (`speaker-resolver.ts`), consistent with the one-pure-module-per-domain pattern established twice already; flag as a Task 1 reversibility-gate choice for the plan, not something this research locks.

3. **Given zero real cross-source events exist, how thorough must synthetic fixtures be to actually prove IDENT-04/05's behavior (not just exercise code paths)?**
   - What we know: Andrew's standing directive is tests must prove real behavior, not ceremony, and prefer negative/adversarial assertions.
   - What's unclear: with no real data to sample, "real behavior" here means synthetic fixtures must themselves be adversarially designed (e.g., a fixture where two sources genuinely disagree and the correct behavior is "stay unresolved," not just a happy-path "one source has names, propagate them" fixture).
   - Recommendation: the plan should explicitly design at least one adversarial fixture per success criterion (3 total: propagation-across-sources, over-segmentation-collapse, and zero-evidence-stays-unresolved) rather than one shared happy-path fixture — this is a testing-architecture decision for the plan, called out here because it directly answers the phase's own "meaningful vs. ceremony" question from the additional_context.

## Environment Availability

Skipped — this phase has no external dependencies beyond the already-live Supabase project (prod `vltmrnjsubfzrgrtdqey`, TEST `callvault-test`/`swjzxiddcrtaqixsfaac`), which every prior phase in this milestone has already used successfully. No new CLI tools, runtimes, or services.

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json` (absent-defaults-to-enabled rule also would have applied). Section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (project-wide), Deno-esm-import edge functions collected via the `resolve.alias` shim proven in Phase 32 |
| Config file | `vitest.config.ts` (repo root) |
| Quick run command | `npx vitest run supabase/functions/_shared/__tests__/speaker-resolver.test.ts` |
| Full suite command | `rtk vitest run` (unit) — integration tests require `npm run test:integration` per `supabase/CLAUDE.md`'s triple-layered TEST-project guard |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IDENT-04 | Named chunk's identity propagates onto an overlapping anonymous chunk from another recording of the same event | unit (pure function) | `npx vitest run supabase/functions/_shared/__tests__/speaker-resolver.test.ts -t propagat` | ❌ Wave 0 |
| IDENT-04 | Propagation NEVER fires when only a display-name string matches with no `identity_id`/verified-alias backing (adversarial) | unit (pure function, negative) | same file, `-t "never.*display.name"` | ❌ Wave 0 |
| IDENT-05 | One labeled source's single interval collapses another source's two split intervals into one resolved speaker | unit (pure function) | same file, `-t collapse` | ❌ Wave 0 |
| IDENT-05 | Consensus does NOT collapse when two sources genuinely disagree (adversarial — stays unresolved, not merged) | unit (pure function, negative) | same file, `-t disagree` | ❌ Wave 0 |
| Success Criterion 3 | Zero-evidence speaker (no calendar, no attendee list, only anonymous diarization) stays unresolved — type-level guarantee mirroring `DisplayNameCandidate` | unit (pure function, type + negative) | same file, `-t unresolved` | ❌ Wave 0 |
| End-to-end wiring | `resolve-speakers` edge function correctly gates on `X-Reconcile-Secret`, forward-only sweep, writes evidence via the identity spine | integration | `npm run test:integration -- resolve-speakers` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** unit suite (`npx vitest run supabase/functions/_shared/__tests__/speaker-resolver.test.ts`)
- **Per wave merge:** `rtk vitest run` full unit suite + relevant integration tests on TEST
- **Phase gate:** Full suite green before `/gsd:verify-work`, plus a live TEST-project introspection proof (mirroring every prior phase's SUMMARY pattern) before any prod apply

### Wave 0 Gaps
- [ ] `supabase/functions/_shared/__tests__/speaker-resolver.test.ts` — covers IDENT-04, IDENT-05, Success Criterion 3
- [ ] `supabase/functions/_shared/speaker-resolver.ts` — the pure module itself (test-first / RED-then-GREEN per this milestone's established TDD-by-convention pattern)
- [ ] `supabase/functions/resolve-speakers/index.ts` — forward-only edge function wrapper
- [ ] Synthetic integration fixtures seeding `transcript_chunks` rows across two synthetic recordings + one synthetic event (mirroring Phase 33's `recording_id: NULL` / `canonical_recording_id`-keyed seeding approach, since there is no real cross-source event to sample)
- [ ] Framework install: none — Vitest and the Deno-alias shim are already configured repo-wide

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1` in `.planning/config.json`. Section included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Partial | Edge function gates on `X-Reconcile-Secret` shared-secret header (mirrors `resolve-events`/`resolve-identities`), not end-user JWT — this is a service-to-service/cron-triggered sweep, not a user-facing auth surface. |
| V3 Session Management | No | No session state introduced. |
| V4 Access Control | Yes | RLS on `identities`/`identity_aliases` (Phase 34's `user_can_view_identity` SECURITY DEFINER helper) governs who can read resolved evidence; this phase must not introduce a new read path that bypasses it. `get_identity_evidence`'s redaction pattern (owner vs non-owner projection) must be preserved for any new evidence this phase writes. |
| V5 Input Validation | Yes | Zod validation on the edge function's request body (`{ mode: 'forward', since? }`), matching `resolve-identities`'s existing contract exactly. |
| V6 Cryptography | No | No new crypto surface. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-org identity/speaker resolution widening readable audience | Elevation of Privilege / Information Disclosure | SAFE-04's principle applies by extension even though this isn't a MATCH requirement: same-org bucketing (the `Map<organization_id, candidate[]>` pattern from `event-resolver.ts`) before any pairing, so cross-org pairs are never even grouped, let alone scored. Must be proven by the same `rls-regression.test.ts` cross-org isolation harness used every prior phase. |
| Weak-signal (display-name-only) auto-link reintroducing a resolved identity | Tampering / Spoofing | Structural (type-level) non-linking guarantee, exactly as Phase 34's `DisplayNameCandidate` — apply the identical pattern here (see Pattern 3). |
| Service-role edge function invoked without the shared secret | Spoofing | `X-Reconcile-Secret` gate before any DB work, checked before parsing the body — mirror `resolve-events`/`resolve-identities`'s exact ordering. |

## Sources

### Primary (HIGH confidence — live prod introspection this session)
- Live prod (`vltmrnjsubfzrgrtdqey`) `information_schema.columns` for `transcript_chunks`, `call_participants`, `identities`, `identity_aliases` — full column lists confirmed.
- Live prod query: `recordings.event_id IS NOT NULL` count = 0, `events` row count = 0, multi-recording events = 0 (confirms zero real multi-recording events exist).
- Live prod query: `transcript_chunks.speaker_name` sample (top 20 by frequency) — all real human names; `^Speaker [0-9]+$` pattern count = 0 of 61,253 rows.
- Live prod query: `timestamp_start`/`timestamp_end` sample — confirmed `HH:MM:SS` TEXT format, `source_platform = 'fathom'` in the sampled rows, 54,373/61,253 rows populated.
- Live prod `pg_proc` signature check: `apply_event_match_atomic`, `get_identity_evidence`, `user_can_view_identity` — confirmed argument signatures.
- `supabase/functions/_shared/event-resolver.ts` (direct file read, live repo) — pure-module pattern, `scoreContentProofOverlap`, `isSpeakerAlibiViolation`, comment block on `chunk_index`-vs-`timestamp_start` alignment decision (lines 985-1030).
- `supabase/functions/_shared/identity-resolver.ts` (direct file read, live repo) — `DisplayNameCandidate` type-pinned non-linking pattern.

### Secondary (MEDIUM confidence — prior-phase SUMMARY.md documents, verified against this session's live introspection where checked)
- `.planning/phases/33-content-proof-matching-alibi-constraint/33-03-SUMMARY.md` — transcript_chunks real-row-count correction (61,253 rows, Clickable Impact zero-linkage finding), cross-checked live this session and reconfirmed.
- `.planning/phases/34-identity-consolidation/34-02-SUMMARY.md`, `34-04-SUMMARY.md` — identities/identity_aliases schema and resolver pattern, cross-checked live this session and reconfirmed.
- `.planning/STATE.md` — `has_confirmed_speech` unpopulated-by-any-live-writer finding (Phase 33), not independently re-verified this session but consistent with `call_participants.has_confirmed_speech` being a recently-added nullable boolean with no cited writer.

### Tertiary (LOW confidence — spec document, unverified-against-code claims)
- `.orca/drops/SPEC-event-resolution-and-provenance.md` — "Hook point... `CanonicalRecording` already carries `transcriptTurns` with `providerSpeakerId`, `speakerName`, `speakerEmail`, and `startSeconds`" (Implementation Notes section) — this describes an in-memory ingest-time shape (`canonical-recording.ts`), not the persisted `transcript_chunks` table this research verified; NOT independently confirmed this session and may be a richer/different data shape than what's queryable post-ingest. Flag for the planner: if `startSeconds` (a numeric, not TEXT, per-provider-turn timestamp) is available at ingest time and could be captured into `transcript_chunks` going forward, that would be a cleaner alignment signal than parsing `timestamp_start` TEXT strings — worth a quick source read of `_shared/canonical-recording.ts` during planning, not done in this research pass due to scope/token budget.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, pattern is a direct extension of two already-shipped precedents in this exact repo.
- Architecture: MEDIUM — the pure-module/edge-function shape is HIGH confidence (proven 2x already); the specific timeline-alignment algorithm is MEDIUM/LOW because the shared-origin question (Open Question 1) isn't locked, and zero real data exists to validate against.
- Pitfalls: HIGH — all four pitfalls are grounded in live-verified schema facts or direct quotes from prior-phase SUMMARY.md findings in this same milestone, not speculation.

**Research date:** 2026-09-07
**Valid until:** ~14 days (fast-moving milestone — schema and prior-phase context both changed materially within the last 48 hours of this research; re-verify `recordings` timing columns and re-check `events`/`recordings.event_id` row counts if planning is delayed past Phase 36+ work landing).
