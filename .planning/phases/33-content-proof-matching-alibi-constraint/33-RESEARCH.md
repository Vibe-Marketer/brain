# Phase 33: Content-Proof Matching + Alibi Constraint - Research

**Researched:** 2026-09-05
**Domain:** Text-similarity matching (rare n-gram shingles) over a dormant table + a pure constraint-satisfaction rejection rule, extending an existing Deno/Postgres event-resolution pipeline
**Confidence:** MEDIUM — schema and code-path claims are HIGH (exhaustively grep-verified), but the phase's real-world testability is gated on a table with zero live writers (see Summary)

## Summary

Phase 33 adds two independent things to the existing `event-resolver.ts` matcher built in Phases 31-32: a content-proof tier (tier 2, MATCH-02) that can auto-attach two captures on rare n-gram shingle overlap over `transcript_chunks`, and a speaker-alibi constraint (MATCH-07) that rejects — never confirms — a candidate merge when an identity has confirmed speech in one event during an interval that is time-disjoint from another event in the same interval. Both are pure extensions of Phase 31/32's established pattern: a DB-free pure scoring function, a DB-touching fetch/write step in `runShadowSweep`, fail-closed error isolation per tier.

The single most important finding of this research: **`transcript_chunks` has zero live code paths anywhere in this repository.** No edge function inserts into it, no edge function selects from it, and the only non-generated-type reference in the entire codebase is a comment. `chunk_index` and `timestamp_start` are referenced nowhere outside an archived test script and the generated types file. The table's schema is real (verified against the actual `CREATE TABLE` migration), `pg_trgm` and the `vector` extension are genuinely enabled, and the FTS `tsvector` column genuinely exists — but this is dormant infrastructure from an earlier RAG/hybrid-search feature, not a live ingestion target. This means Success Criterion #3 ("zero-transcript captures fall back... never error") is very likely the *dominant* real-world code path today, not an edge case, and Success Criterion #1 (real shingle-overlap auto-attach) can almost certainly only be proven in this phase against **synthetic/seeded test fixtures**, not real TEST-project data, unless Andrew confirms an active ingestion path exists that this research missed.

Two other load-bearing findings shape the plan: (1) `event_match_decisions.tier` CHECK constraint **already accepts `'content_proof'`** — no migration needed there — but `apply_event_match_atomic` **hardcodes `tier = 'deterministic'`** in its ledger insert, so tier-2's auto-attach requirement needs a small additive migration (`p_tier TEXT DEFAULT 'deterministic'`) before it can legally write a `content_proof`-tiered `merge_applied` row. (2) `call_participants.has_confirmed_speech` is declared but **set by zero code paths anywhere in the repo** — the alibi constraint as scoped (read-only, reject-only) will be logically correct but operationally inert on real data until something populates this column, and no phase in the v2.2 roadmap (30-39) explicitly claims that responsibility. This is a genuine scope gap the planner must resolve, not an oversight in this research.

**Primary recommendation:** Build tier-2 as a third pure-function-plus-fetch pass inserted into `runShadowSweep` between the existing tier-1 and tier-3 passes (same fail-closed isolation pattern as the metadata tier), implement shingle extraction and overlap scoring in application code (TypeScript, not SQL/pg_trgm — pg_trgm's character-trigram similarity is the wrong tool for phrase-level rare-shingle proof), extend `apply_event_match_atomic` with an additive `p_tier` parameter so tier-2 can legally auto-attach, and treat the has_confirmed_speech-population question as an explicit Task-1 checkpoint decision rather than an assumption.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MATCH-02 | Content-proof tier: rare n-gram shingle overlap over `transcript_chunks`, aligned on relative offsets. High overlap is conclusive; CAN auto-attach. | `transcript_chunks` schema confirmed (Architecture Patterns); dormancy finding (Summary, Pitfall 1) shapes test strategy; shingle-implementation options evaluated (Architecture Patterns, Don't Hand-Roll); `apply_event_match_atomic` migration gap identified (Pitfall 2) as the concrete blocker to auto-attach. |
| MATCH-07 | Speaker-alibi constraint rejects candidates only. Attendance is never an alibi — only `has_confirmed_speech`. | `has_confirmed_speech` exact semantics confirmed (Architecture Patterns); zero-population finding (Pitfall 3) is the central open question the plan must resolve; reject-only design pattern documented (Architecture Patterns, Code Examples). |
</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

None under a `## Decisions` heading — this is an infrastructure phase where smart-discuss was skipped ("no UI; matcher tier work; spec locks the design"). The binding constraints instead live under "Claude's Discretion" below, sourced from the source spec + REQUIREMENTS.md and treated as locked:

- MATCH-02: content-proof tier via rare n-gram shingle overlap over `transcript_chunks`, aligned on relative offsets (not wall-clock — device clocks drift, per the original spec's edge cases). High overlap is conclusive — CAN auto-attach (this is tier 2, near-certain per the original spec's confidence table).
- MATCH-07: speaker-alibi constraint REJECTS candidates only — never confirms one. An identity with confirmed speech in event A during interval T cannot be a speaker in a time-disjoint event B during T. Attendance is never an alibi — only `has_confirmed_speech` (already exists on `call_participants` from Phase 30).
- Zero-transcript captures fall back gracefully (deterministic tier or review queue), never error.
- This tier operates on `transcript_chunks`, which already exists (per Phase 30/31 research) with `chunk_text`, `speaker_name`, `speaker_email`, `timestamp_start/end`, embeddings — confirm exact current shape via research, don't assume.

### Claude's Discretion

Everything about HOW the shingle algorithm is implemented (SQL vs. application-level, exact k-gram size, exact rarity threshold, exact overlap threshold for "conclusive") is discretionary — the spec locks the substrate (`transcript_chunks`, relative-offset alignment, auto-attach permission) but not the algorithm's internals. Same for how the alibi constraint is wired into the existing candidate pipeline (as a filter/veto step vs. a separate pass).

### Deferred Ideas (OUT OF SCOPE)

None — infrastructure-only, spec locked. Also explicitly out of scope per the phase boundary: identity resolution itself (Phase 34's `identities` spine) and audio fingerprinting (deferred to v2.3 per the source spec's Out of Scope table — "most connectors deliver transcripts without retrievable media").
</user_constraints>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Rare n-gram shingle extraction + overlap scoring | API / Backend (Deno edge function, `_shared/event-resolver.ts`) | Database (optional pg_trgm pre-filter) | Tier-1 and tier-3 are both pure TS functions with a DB-touching fetch step in the same file; consistency with established pattern outweighs any marginal performance case for pushing scoring into SQL. `transcript_chunks` is fetched into the function the same way `call_participants`/`recurring_call_titles` already are. |
| Speaker-alibi rejection check | API / Backend (same `event-resolver.ts` module) | Database (RLS is irrelevant here — service-role reads) | A pure predicate over already-fetched `call_participants` rows (interval overlap + `has_confirmed_speech`), same shape as `shouldSuppressTitleSignal`. No new table, no new service boundary. |
| Auto-attach write path (tier-2 merge) | Database (Postgres RPC, `apply_event_match_atomic`) | API / Backend (caller in `runShadowSweep` or a follow-up "apply" step) | MATCH-10's atomic-merge guarantee is an RPC-level transaction, not application code — this phase must call into (and minimally extend) that RPC, not reimplement its logic. |
| `has_confirmed_speech` population (if in scope) | API / Backend (derivation logic reading `transcript_chunks` speaker fields against `call_participants` email/name) | Database (a SQL function is also viable) | Open question — see Pitfall 3. Whichever tier owns it, it is a derivation from already-fetched data, not a new external input. |

## Standard Stack

### Core

No new external packages are required for this phase. Both deliverables extend existing, dependency-free TypeScript in `supabase/functions/_shared/event-resolver.ts`, which already imports only from `dedup-fingerprint.ts` (same repo) and a type-only `@supabase/supabase-js` import.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| *(none)* | — | Rare n-gram shingle extraction and overlap scoring | Tier-1 (`findDeterministicMatches`) and tier-3 (`findMetadataCandidates`) are both hand-written pure TS with zero new dependencies each. A ~40-line tokenize/shingle/hash/Jaccard-overlap function is well within that established precedent and keeps the whole matcher dependency-free and Deno-edge-function-portable. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fastest-levenshtein` (already a devDependency + esm.sh runtime import, from Phase 32) | 1.0.16 | String edit-distance | Already used for title similarity in `dedup-fingerprint.ts`. Not applicable to shingle overlap (which is set-overlap, not edit-distance) — listed here only to confirm it does NOT need touching or duplicating for this phase. |
| `pg_trgm` (Postgres extension, already enabled) | n/a (built-in Postgres contrib module) | Character-trigram similarity, fuzzy string search | Optional SQL-side candidate pre-filter only (see Architecture Patterns) — not a substitute for word-level rare-shingle scoring. `[VERIFIED: migration file 20251125000001_ai_chat_infrastructure.sql, line 17]`. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written TS shingle/overlap scorer | An npm MinHash/SimHash library (e.g. `minhash`) | Adds a new dependency (and a new esm.sh-vs-Deno compatibility question, exactly the kind of friction Phase 32 avoided by reusing `dedup-fingerprint.ts` in place) to solve a problem the existing codebase already solves with plain functions for two other tiers. Not recommended — stay dependency-free. `[ASSUMED — package name from training data, not independently verified against npm; irrelevant since not recommended]` |
| Application-level (TS) shingle scoring | Pure SQL using `pg_trgm`'s `similarity()`/`word_similarity()` | `pg_trgm` operates on **character** trigrams (typo-tolerant fuzzy string matching), which is the right tool for title-similarity-style matching but the wrong statistical model for "rare, near-certain phrase proof" — two unrelated transcripts about the same industry topic could share high character-trigram similarity on jargon alone. Word-level, sufficiently-long shingles (6-10 tokens) give a much lower false-positive rate for "these are literally the same utterance" and that is what "conclusive... CAN auto-attach" requires. Recommend TS for the core algorithm; `pg_trgm` only as an optional, non-load-bearing pre-filter to cheaply narrow candidate pairs before the exact TS-side shingle comparison runs. |

**Installation:**
```bash
# No new packages. If seeded test fixtures need direct transcript_chunks inserts
# (see Pitfall 1), no new tooling is needed there either — plain Supabase client inserts.
```

**Version verification:** N/A — no new package versions to verify. `pg_trgm` is a built-in Postgres contrib extension bundled with every Postgres/Supabase instance; its presence was confirmed by grepping the migration that enables it, not by a registry lookup.

## Package Legitimacy Audit

No external packages are introduced by this phase's recommended design. The Package Legitimacy Gate protocol (slopcheck, registry verification) is not applicable — there is nothing to install.

**Packages removed due to slopcheck [SLOP] verdict:** none (not run — no candidate packages)
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                    runShadowSweep(supabase, opts)
                              |
                              v
          +-------------------------------------------+
          | 1. Fetch unresolved recordings (same-org,  |
          |    flagged orgs) -- ALREADY EXISTS          |
          +-------------------------------------------+
                              |
          +-------------------+-------------------+
          |                   |                   |
          v                   v                   v
   +-------------+   +-----------------+   +----------------+
   | TIER 1       |   | TIER 2 (NEW)    |   | TIER 3          |
   | Deterministic|   | Content-proof   |   | Metadata        |
   | (exact ID)   |   | (shingle        |   | (weighted score,|
   | AUTO-ATTACH  |   | overlap)        |   | propose-only)   |
   | via apply_   |   | AUTO-ATTACH     |   | writes          |
   | event_match_ |   | via apply_      |   | merge_proposed  |
   | atomic       |   | event_match_    |   | only            |
   |              |   | atomic(p_tier=  |   |                 |
   |              |   | 'content_proof')|   |                 |
   +-------------+   +--------+--------+   +----------------+
                               |
                     +---------+---------+
                     | fetch transcript_ |
                     | chunks for the    |
                     | candidate batch   |
                     +---------+---------+
                               |
                  +------------+------------+
                  |                         |
           chunks found              NO chunks found
                  |                  (the common case today --
                  v                   see Summary)
        +------------------+                |
        | extract shingles, |                v
        | score overlap,    |      +--------------------+
        | apply relative-   |      | fall through to     |
        | offset alignment  |      | tier 3 untouched --  |
        | via chunk_index   |      | NEVER an error       |
        +------------------+      | (Success Criterion 3)|
                  |                +--------------------+
                  v
     +-------------------------+
     | SPEAKER-ALIBI CHECK      |
     | (applies to ANY tier's   |
     | candidate pair, before   |
     | auto-attach or propose): |
     | does either candidate's  |
     | participant set contain  |
     | an identity with         |
     | has_confirmed_speech=true|
     | in a time-disjoint OTHER |
     | event during the same    |
     | interval? If so: REJECT, |
     | regardless of tier score.|
     +-------------------------+
```

A reader can trace: recordings fetched once -> tried against tier 1 (existing) -> tried against tier 2 (new, this phase) reading `transcript_chunks` -> falls through cleanly to tier 3 (existing) if no chunks exist -> every candidate pair, regardless of which tier produced it, passes through the alibi veto before anything is written.

### Recommended Project Structure

No new files. Everything lives in the existing two-file matcher module, exactly like Phase 32:

```
supabase/functions/_shared/
├── event-resolver.ts       # ADD: findContentProofMatches (pure), extractShingles/scoreShingleOverlap
│                            #      helpers, isSpeakerAlibiViolation (pure), wire both into runShadowSweep
├── dedup-fingerprint.ts     # UNCHANGED — no new shared primitives needed here this phase
└── __tests__/
    └── event-resolver.test.ts   # ADD: unit tests for the two new pure functions

supabase/migrations/
└── YYYYMMDDHHMMSS_content_proof_apply_tier_param.sql   # NEW — additive p_tier param on
                                                          # apply_event_match_atomic (see Pitfall 2)

src/test/
└── event-resolution-content-proof.integration.test.ts   # NEW — mirrors Phase 32's
                                                            # event-resolution-metadata-tier
                                                            # integration test shape, but must
                                                            # SEED synthetic transcript_chunks
                                                            # rows directly (see Pitfall 1) since
                                                            # no ingestion path produces them
```

### Pattern 1: Fail-closed tier isolation (established, Phase 31/32 — reuse exactly)

**What:** Each tier's fetch/score/write logic is wrapped in its own `try/catch`. A failure in one tier is logged, counted in `summary.errors`, and does not prevent already-attempted tiers from having written their proposals, nor does it block later tiers from running.
**When to use:** Tier 2's new `transcript_chunks` fetch and shingle-scoring block MUST follow this exact isolation shape — a `transcript_chunks` query failure must not silently swallow tier-1's already-written deterministic proposals, and must not prevent tier-3 from still running afterward.
**Example:**
```typescript
// Source: supabase/functions/_shared/event-resolver.ts, lines 324-437 (existing tier-3 block)
// ---- Metadata tier (Phase 32 Plan 02, MATCH-06) ----
// Provider-agnostic same-org pass over the SAME candidate batch fetched
// above. Isolated in its own try/catch: a failure here fails closed
// (skip metadata proposing for this tick, log, count an error) without
// touching tier-1's proposals already written above.
try {
  const recordingIds = candidates.map((c) => c.id);
  if (recordingIds.length > 0) {
    const participantsResult = await supabase
      .from('call_participants')
      .select('recording_id, email, name')
      .in('recording_id', recordingIds);
    if (participantsResult.error) {
      console.error('[event-resolver] ... fetch failed closed:', participantsResult.error.message);
      summary.errors++;
    } else {
      // ... build candidates, score, write proposals
    }
  }
} catch (err) {
  console.error('[event-resolver] runShadowSweep metadata tier failed closed:', err);
  summary.errors++;
}
```
Tier 2 should be inserted as a structurally identical block, positioned between the existing tier-1 block and the existing tier-3 block, fetching `transcript_chunks` keyed by `canonical_recording_id IN (recordingIds)` instead of `call_participants`.

### Pattern 2: Additive RPC parameter, not a new RPC

**What:** `apply_event_match_atomic` hardcodes `tier = 'deterministic'` (migration `20260901000003`, line 137 of the `INSERT INTO event_match_decisions`). Tier-2 auto-attach requires this to be `'content_proof'` for its own writes.
**When to use:** Add `p_tier TEXT DEFAULT 'deterministic'` as a new trailing parameter. Postgres allows adding a parameter with a default to an existing function signature without breaking any existing positional caller (the only current caller is a direct integration test per Phase 31 Plan 02's SUMMARY — confirmed zero production callers exist yet). This preserves `CREATE OR REPLACE FUNCTION public.apply_event_match_atomic(...)`'s existing signature contract for tier-1 while unlocking tier-2.
**Example:**
```sql
-- Source: supabase/migrations/20260901000003_create_event_match_apply_reverse_rpcs.sql (existing, to extend)
CREATE OR REPLACE FUNCTION public.apply_event_match_atomic(
  p_recording_id_a UUID,
  p_recording_id_b UUID,
  p_event_id       UUID,
  p_decided_by     TEXT,
  p_signals        JSONB,
  p_owner_user_id  UUID,
  p_tier           TEXT DEFAULT 'deterministic'  -- NEW, additive, preserves old callers
)
...
  INSERT INTO event_match_decisions (
    recording_id_a, recording_id_b, event_id, tier, score, signals,
    decision, decided_by, applied
  ) VALUES (
    v_pair_a, v_pair_b, v_event_id, p_tier, NULL, COALESCE(p_signals, '{}'::jsonb),
    'merge_applied', p_decided_by, true
  );
```
Should also add a `CHECK`-equivalent guard (`IF p_tier NOT IN ('deterministic', 'content_proof', 'metadata') THEN RAISE EXCEPTION`) inside the function body, since the table's own CHECK constraint already enforces this at the storage layer but a function-level guard gives a clearer error message to a future caller.

### Pattern 3: Alibi as a veto layered across tiers, not a tier itself

**What:** MATCH-07 is explicitly "rejects candidates only... never confirms one" — it is not a fourth scoring tier, it is a filter applied to whatever candidate any tier (1, 2, or 3) produces, before that candidate is written.
**When to use:** Implement as a pure predicate function `isSpeakerAlibiViolation(candidateA, candidateB, allParticipantsByRecording): boolean`, called immediately before each tier's write step (both the tier-1/tier-2 auto-attach call and the tier-3 propose-only write). A `true` result skips the write entirely (not "writes a rejected decision" — re-read MATCH-07/the spec's confidence table: "Vetoes a candidate; never confirms one" describes it silently preventing a merge, not itself producing a ledger entry of type `rejected`. The `event_match_decisions.decision` enum already has a `'rejected'` value from Phase 31's schema, which the planner should decide whether to use here for auditability, or leave unused as today).
**Example (pseudocode based on existing `call_participants` shape already fetched by tier 3):**
```typescript
// Illustrative -- no direct Source URL, this is new code following the existing
// pure-predicate style of shouldSuppressTitleSignal (event-resolver.ts:469-476)
function isSpeakerAlibiViolation(
  candidateAParticipants: { email: string; has_confirmed_speech: boolean | null; event_start: string; event_end: string }[],
  candidateBParticipants: { email: string; has_confirmed_speech: boolean | null; event_start: string; event_end: string }[],
): boolean {
  for (const pA of candidateAParticipants) {
    if (pA.has_confirmed_speech !== true) continue; // attendance alone is never an alibi
    const pB = candidateBParticipants.find((p) => p.email === pA.email);
    if (!pB) continue;
    const disjoint = pA.event_end <= pB.event_start || pB.event_end <= pA.event_start;
    if (disjoint) return true; // same identity, confirmed speech in A, time-disjoint B -> reject
  }
  return false;
}
```

### Anti-Patterns to Avoid

- **Treating tier 2 as strictly more reliable than tier 1 and reordering the pipeline:** the spec's confidence table lists tier 1 and tier 2 as equally "near-certain, auto-attach" — do not make tier 2 gate or override tier 1's already-proven exact-ID matches.
- **Computing shingle overlap with a low k (e.g., single-word or bigram shingles):** short shingles produce far more coincidental collisions ("thank you", "let's go") and cannot be "rare" enough to be conclusive. Use a shingle length long enough (empirically 6+ tokens in near-duplicate-detection literature) that exact collision across two unrelated recordings is implausible by construction, rather than trying to compute a true corpus-wide rarity/IDF score (which would require a reference corpus this codebase doesn't have).
- **Trusting `transcript_chunks.timestamp_start`/`timestamp_end` as populated, reliable relative-offset data:** see Pitfall 4 — use `chunk_index` instead, or derive offsets purely from shingle position within `chunk_text`.
- **Writing new merge-application logic instead of extending `apply_event_match_atomic`:** MATCH-10's atomicity guarantee (event creation + both `event_id` writes + ledger row, one transaction) already exists; re-implementing it in application code for tier 2 would silently reintroduce a non-atomic race Phase 31 specifically closed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic two-recording merge + event creation | A second application-level transaction/RPC for tier-2 merges | Extend `apply_event_match_atomic` with `p_tier` (Pattern 2) | MATCH-10's atomicity is already solved once; a parallel implementation is a correctness and drift risk. |
| String edit-distance / fuzzy title matching | A second Levenshtein implementation | `dedup-fingerprint.ts`'s existing `calculateTitleSimilarity` (fastest-levenshtein) | Not actually needed by this phase (shingle overlap is set-based, not edit-distance-based) — noted only so nobody reaches for it out of habit and duplicates it. |
| Same-org candidate pairing / O(n²) bucketing | A new pairing loop | The `Map<organization_id, candidates[]>` bucketing pattern already used identically in `findDeterministicMatches` and `findMetadataCandidates` | Cross-org pairs must never even be compared (SAFE-04) — the existing bucketing already enforces this structurally; a hand-rolled loop risks accidentally comparing across orgs. |
| Rare-phrase / near-duplicate detection | A full corpus-wide TF-IDF or MinHash library | Long-shingle (6-10 token) set overlap in plain TS, per Architecture Patterns | The problem this phase actually has (compare two specific transcripts, not rank against a large corpus) doesn't need the statistical machinery MinHash/TF-IDF solve; a long-shingle exact-match set overlap is simpler, dependency-free, and sufficient for a binary "conclusive or not" decision. |

**Key insight:** every other piece of Phase 33's plumbing (atomic write, same-org pairing, fail-closed tier isolation, title-similarity primitives) already exists in this codebase from Phases 30-32. The only genuinely new algorithm is shingle extraction + overlap scoring, and even that should stay a plain, dependency-free TS function to match the file's established style.

## Common Pitfalls

### Pitfall 1: `transcript_chunks` has no live ingestion path — the phase's own substrate may be empty on TEST and prod

**What goes wrong:** A plan that assumes real transcript data exists (mirroring how Phase 32 proved the metadata tier against a real fathom+grain pair on TEST) will fail to find any candidate pairs to test against, and may misdiagnose this as a bug in the new shingle logic rather than an absence of data.
**Why it happens:** `transcript_chunks` was built (migration `20251125000001_ai_chat_infrastructure.sql`) for a hybrid-RAG chat feature. Exhaustive repo-wide grep for `transcript_chunks`, `chunk_index`, and `timestamp_start` found **zero** live (non-archived, non-generated-type) references anywhere in `supabase/functions/` or `src/` — no edge function directory named anything like `embed-chunks` or `process-embeddings` exists in the current `supabase/functions/` listing, despite `supabase/CLAUDE.md`'s function-prefix table using those exact names as illustrative examples. This is consistent with the root `CLAUDE.md`'s hard constraint "AI-02: Zero AI/RAG/embedding code in the frontend — ever" extending, in practice, to the backend ingestion side as well.
**How to avoid:** Treat "zero chunks found" as the primary code path to design and test for (Success Criterion 3 already requires this), and plan for **seeded/synthetic** `transcript_chunks` fixtures in the integration test (direct `.insert()` calls in test setup, not through any real ingestion pipeline) to prove Success Criterion 1 (shingle overlap conclusively attaches two captures) at all. Do NOT assume a TEST-project data check will find real rows to test against the way Phase 31 found real recordings — budget time to seed data instead of searching for it.
**Warning signs:** A `SELECT COUNT(*) FROM transcript_chunks` against TEST returning 0 or near-0; an integration test that can't find any recording with populated chunks without first inserting one itself.

### Pitfall 2: `apply_event_match_atomic` hardcodes `tier = 'deterministic'` — tier-2 auto-attach cannot legally write without a migration

**What goes wrong:** A plan that calls the existing `apply_event_match_atomic` RPC for a tier-2 (content-proof) auto-attach, expecting the ledger row to correctly read `tier = 'content_proof'`, will silently get `tier = 'deterministic'` instead — an incorrect audit trail (MATCH-09 requires the ledger to record which tier produced a decision).
**Why it happens:** Migration `20260901000003_create_event_match_apply_reverse_rpcs.sql`, line 137, has the literal string `'deterministic'` hardcoded in the `INSERT INTO event_match_decisions` values list — this was correct when only tier 1 could auto-attach (Phase 31), but Phase 33 is the first phase where a second tier also needs auto-attach.
**How to avoid:** Author an additive migration extending `apply_event_match_atomic` with `p_tier TEXT DEFAULT 'deterministic'` (Pattern 2 above), preserving the existing call signature for any future tier-1 caller. The `event_match_decisions.tier` CHECK constraint already permits `'content_proof'` — confirmed directly in `20260901000002_create_event_match_decisions.sql` line 49 — so no table-level migration is needed, only the RPC's hardcoded literal.
**Warning signs:** An integration test asserting `event_match_decisions.tier = 'content_proof'` after an auto-attach that instead reads `'deterministic'`.

### Pitfall 3: `has_confirmed_speech` is set by zero code paths in the entire repo — the alibi constraint may ship logically correct but permanently inert

**What goes wrong:** MATCH-07 is built exactly to spec (reject a candidate when a participant's `has_confirmed_speech = true` in a time-disjoint other event) but never actually rejects anything in production, because no row anywhere ever has `has_confirmed_speech = true` — it is declared (`BOOLEAN`, nullable, no default, added by Phase 30's migration) and referenced only by tests that assert it stays `NULL` (`src/test/event-schema-noop.integration.test.ts`).
**Why it happens:** Phase 30 added the column as pure schema (its own migration comment: "The matching/resolution engine that populates these columns is Phase 31+ -- out of scope here"). Neither Phase 31 nor Phase 32 populates it. Checking the full v2.2 roadmap (REQUIREMENTS.md traceability table), no later phase (34 identity consolidation, 35 speaker resolution, 36 organizations, 37 reconciliation) explicitly claims responsibility for setting `has_confirmed_speech` either — IDENT-04/IDENT-05 (Phase 35, per REQUIREMENTS.md numbering) are about *name propagation* and *diarization consensus*, not this specific boolean.
**How to avoid:** This is a genuine scope decision the plan must surface explicitly (recommend a Task-1 checkpoint, mirroring Phase 32's Task-1 design-gate pattern), not silently assume away. Two honest options: (a) Phase 33 also derives `has_confirmed_speech` as a byproduct of reading `transcript_chunks` for the shingle tier — e.g., set `true` for any `call_participants` row whose `email`/`name` matches a `transcript_chunks.speaker_email`/`speaker_name` with non-empty `chunk_text` for that recording (cheap, uses data already being fetched) — or (b) ship the alibi constraint's rejection logic as correct-but-currently-unreachable code (same class of finding as Phase 32's dead `dedup_priority_mode` pipeline) and explicitly flag it for a later phase. Given transcript_chunks' own dormancy (Pitfall 1), option (a) is also gated on the same "no real data" caveat — deriving from an empty table derives nothing. Either way, the plan and the SUMMARY must say which option was chosen and why, not leave it implicit.
**Warning signs:** An alibi-constraint integration test that can only prove the rejection logic using manually-seeded `has_confirmed_speech = true` fixture rows, never against organically-produced data.

### Pitfall 4: `transcript_chunks.timestamp_start`/`timestamp_end` are TEXT, and (per Pitfall 1) never populated by any live writer — do not build offset alignment on them

**What goes wrong:** A plan that reads `timestamp_start`/`timestamp_end` expecting parseable wall-clock-relative offsets (e.g., `"00:12:34"` or a numeric-seconds string) to compute "relative offset alignment" may find these columns are `NULL` even in the rare cases where `chunk_text`/`chunk_index` do have data (since the table has no live writer at all right now, but IF a future ingestion path is added, it might not necessarily populate every column identically to how the connector layer's `CanonicalTranscriptTurn.startSeconds`/`endSeconds` — confirmed as clean numeric offsets in `_shared/canonical-recording.ts` — would suggest).
**Why it happens:** `chunk_index` (`INTEGER NOT NULL`, "Order within recording, 0-indexed") is the one offset-adjacent column with a `NOT NULL` constraint and is therefore the only column guaranteed present on any row that exists at all. `timestamp_start`/`timestamp_end` are nullable `TEXT`, format unconfirmed by any live consumer.
**How to avoid:** Prefer `chunk_index`-based relative-sequence alignment (comparing the ordinal position of a matched shingle within each recording's own chunk sequence) over parsing `timestamp_start`/`timestamp_end`. This is also the more spec-faithful interpretation of "aligned on relative offsets... not wall-clock" — content-derived ordinal position is immune to clock skew by construction, whereas a TEXT timestamp field of unconfirmed format is an unnecessary parsing risk for no accuracy gain.
**Warning signs:** A shingle-alignment function that throws or silently no-ops on `timestamp_start`/`timestamp_end` being `NULL` for every real row it encounters.

### Pitfall 5: pg_trgm's similarity model is the wrong statistical tool for "conclusive... near-certain" proof

**What goes wrong:** Reaching for `pg_trgm`'s `similarity()`/`%` operator as the primary content-proof mechanism (since it is genuinely enabled and genuinely a text-similarity tool) produces a *fuzzy* score, not a rare-shingle-overlap proof — two different sales calls discussing the same product in similar language could score deceptively high on character-trigram similarity without being the same conversation.
**Why it happens:** `pg_trgm` was enabled for "fuzzy text search" (the migration's own comment) — a different problem (typo-tolerant search/matching) than near-duplicate/same-utterance detection.
**How to avoid:** Use `pg_trgm` only as an optional, non-load-bearing SQL-side pre-filter to cheaply shortlist candidate pairs (if/when `transcript_chunks` volume ever justifies it) — never as the scoring mechanism that decides auto-attach. The actual "is this the same conversation" decision should rest on long (6-10 token), exact/near-exact word-shingle overlap computed in application code.

## Code Examples

### Existing tier-1/tier-3 sweep structure (to extend, not replace)

```typescript
// Source: supabase/functions/_shared/event-resolver.ts, lines 239-445 (runShadowSweep, existing)
// Tier 1 (deterministic) runs first over the initial recordings fetch, writes
// merge_proposed rows directly (no separate apply step in shadow mode).
// Tier 3 (metadata) runs second, isolated in its own try/catch, over the SAME
// candidates array plus two additional fetches (call_participants,
// recurring_call_titles). Tier 2 (this phase) belongs between these two,
// fetching transcript_chunks keyed by canonical_recording_id IN (recordingIds).
```

### `event_match_decisions.tier` CHECK constraint (already supports this phase — no migration needed here)

```sql
-- Source: supabase/migrations/20260901000002_create_event_match_decisions.sql, line 49
tier TEXT NOT NULL CHECK (tier IN ('deterministic', 'content_proof', 'metadata')),
```

### `has_confirmed_speech` column semantics (verbatim from schema comment)

```sql
-- Source: supabase/migrations/20260831000001_create_events_and_extend_participants.sql, lines 155-157
COMMENT ON COLUMN call_participants.has_confirmed_speech IS
  'Whether this participant is confirmed to have spoken, per transcript/speaker analysis. NULL '
  'means unknown (not yet analyzed) -- distinct from false (analyzed, did not speak).';
```

### Connector-layer relative-offset shape (confirms the "not wall-clock" data model exists upstream, even if not on `transcript_chunks` itself)

```typescript
// Source: supabase/functions/_shared/canonical-recording.ts, lines 9-18
export interface CanonicalTranscriptTurn {
  speakerName?: string | null;
  speakerEmail?: string | null;
  providerSpeakerId?: string | null;
  text: string;
  /** Offset from recording start, in seconds. */
  startSeconds?: number | null;
  /** Offset from recording start, in seconds. */
  endSeconds?: number | null;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Zoom-only, single-tier fuzzy dedup (`dedup-fingerprint.ts checkMatch`, title+time+participant any-two-of-three) | Multi-tier, provider-agnostic resolution (deterministic -> content-proof -> metadata, each with its own confidence semantics) | Phases 31-32 (2026-09-01/02) | Phase 33 is the third tier layered onto an already-provider-agnostic, already-fail-closed pipeline — no architectural migration needed, purely additive. |

**Deprecated/outdated:**
- The single "any two of three signals" `checkMatch` heuristic is no longer the primary matcher for new (non-Zoom-webhook) resolution — it remains live only for the original Zoom webhook path (F5-hardened, MATCH-04), while `event-resolver.ts`'s tiered pipeline is the forward path all new tiers (including this phase's) extend.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `transcript_chunks` has zero or near-zero real rows in the TEST and production databases today | Summary, Pitfall 1 | This is inferred from exhaustive code-path grep (zero writers found), not a direct row-count query — the research sandbox's linked Supabase CLI project resolved to PRODUCTION (`vltmrnjsubfzrgrtdqey`) and a direct `.env.test` read was denied by the permission system, so no live COUNT query was run. If wrong (some out-of-repo process, a manual backfill, or a since-removed function's leftover data populated real rows), the plan should still work — seeded fixtures remain valid either way — but the "expect zero real data" framing that shapes test strategy could be overly conservative, and a quick `SELECT COUNT(*) FROM transcript_chunks` against TEST at plan/execution time is cheap insurance either way. |
| A2 | No phase in the v2.2 roadmap (30-39) is responsible for setting `has_confirmed_speech` to `true` | Pitfall 3 | Based on reading REQUIREMENTS.md's full traceability table and the SPEC's phase-by-phase requirement list; if a later phase's actual implementation ends up covering this incidentally, Phase 33's constraint becomes live sooner than expected — not harmful, just changes the "when does this ever fire" expectation set in this research. |
| A3 | Long (6-10 token) word-level shingles, compared as exact-match sets, satisfy "rare n-gram shingle overlap... conclusive" without needing a formal corpus-wide rarity/IDF computation | Architecture Patterns, Don't Hand-Roll | This is a reasonable engineering judgment call (standard in near-duplicate-detection literature) but not verified against the original spec author's precise intent for "rare" — if a true rarity/IDF weighting was intended, the simpler long-shingle approach could under- or over-fire relative to spec intent. Low risk given the spec's own text never mandates IDF, only "rare." |

## Open Questions

1. **Who derives `has_confirmed_speech`, and when?**
   - What we know: the column exists, is read-only from this phase's perspective per CONTEXT.md's framing, and is currently set by nothing.
   - What's unclear: whether Phase 33 is implicitly expected to also write it (since this phase is the one already reading `transcript_chunks`' speaker fields for the shingle tier), or whether it's a known, accepted gap deferred past v2.2's own roadmap.
   - Recommendation: raise as an explicit Task-1 checkpoint in the plan (mirroring Phase 32's design-gate pattern) rather than silently picking an answer. Given Pitfall 1, either answer is currently inert on real data, which lowers the stakes of getting it "wrong" in this phase but not the importance of making the decision explicit and documented.

2. **Does any out-of-repo or manual process populate `transcript_chunks` that this code-only research could not see?**
   - What we know: zero live code references anywhere in `supabase/functions/` or `src/` (exhaustive grep, confirmed).
   - What's unclear: whether Andrew or a scheduled external job populates this table by some means outside this repository (e.g., a manual script, a since-deleted function whose migration lingers, or a separate service).
   - Recommendation: a single read-only `SELECT COUNT(*), MAX(created_at) FROM transcript_chunks` against the TEST project (not prod) at the start of Phase 33 execution resolves this in seconds and should be the very first verification step, exactly as Phase 31 verified TEST had real recordings before building against it.

3. **Should `has_confirmed_speech = true` participants that survive the alibi check produce a `decision = 'rejected'` ledger row, or just silently skip the write?**
   - What we know: `event_match_decisions.decision` CHECK already includes `'rejected'` as a valid value (migration `20260901000002`), unused by any code path today.
   - What's unclear: the spec's language ("vetoes a candidate; never confirms one") doesn't specify whether a veto should be audit-logged.
   - Recommendation: given MATCH-09's "every decision writes to the ledger" and this milestone's overall provenance-first posture, logging a `rejected` row (with `signals` explaining the alibi conflict) is more consistent with the rest of the spec than silent suppression — but this is a discretionary call for the planner/Task-1 checkpoint, not a locked decision.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `pg_trgm` Postgres extension | Optional SQL-side candidate pre-filter | Yes `[VERIFIED: supabase/migrations/20251125000001_ai_chat_infrastructure.sql, line 17]` | Built-in Postgres contrib module (no separate version) | N/A — not load-bearing for the core algorithm |
| `vector` (pgvector) Postgres extension | Not used by this phase's recommended design (embeddings exist on `transcript_chunks` but shingle overlap does not require them) | Yes `[VERIFIED: same migration, line 14]` | n/a | N/A |
| Live TEST Supabase project credentials (`.env.test`) | Confirming real `transcript_chunks` row counts before planning test strategy | **Not verified in this research session** — file exists (`test -f .env.test` succeeded) but reading its contents and querying TEST were both blocked by this session's tool-permission sandbox | — | Executor must run the count query directly at the start of Phase 33 execution (see Open Question 2); this is a cheap, low-risk step normally available to the executor agent, just not to this research subagent under its current permissions. |

**Missing dependencies with no fallback:** none — everything needed is either already enabled (`pg_trgm`, `vector`) or requires no new dependency (pure TS).

**Missing dependencies with fallback:** live TEST data verification (fallback: seed synthetic fixtures directly, per Pitfall 1, regardless of what the count query finds).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (existing repo-wide config, `vitest.config.ts`) |
| Config file | `vitest.config.ts` (repo root) |
| Quick run command | `npx vitest run supabase/functions/_shared/__tests__/event-resolver.test.ts` |
| Full suite command | `npm run test:integration` (integration tests, requires `VITEST_INTEGRATION_OK=true` + TEST project env vars) and `npx vitest run` (unit tests) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MATCH-02 | Rare shingle overlap conclusively attaches two seeded-fixture captures; zero-chunk candidates fall through to tier 3 without error | unit + integration | `npx vitest run supabase/functions/_shared/__tests__/event-resolver.test.ts` (pure scorer) + a new `src/test/event-resolution-content-proof.integration.test.ts` (end-to-end sweep + apply) | ❌ Wave 0 — both files need new test cases/new file |
| MATCH-07 | An identity with `has_confirmed_speech=true` in time-disjoint event A is rejected as a candidate speaker in event B, regardless of tier score; attendance alone never rejects | unit | `npx vitest run supabase/functions/_shared/__tests__/event-resolver.test.ts` (new `isSpeakerAlibiViolation` test block) | ❌ Wave 0 — new test cases in the existing file |

### Sampling Rate

- **Per task commit:** `npx vitest run supabase/functions/_shared/__tests__/event-resolver.test.ts`
- **Per wave merge:** `npm run test:integration` (scoped to the new content-proof integration file, following Phase 32's documented `VITEST_INTEGRATION_OK=true vitest run <file>` workaround for the test-runner's glob-append quirk) + `npx vitest run` (full unit suite, watch baseline error count against the existing 13 pre-existing failures / 320-321 type-check baseline)
- **Phase gate:** Full suite green (modulo the already-documented pre-existing failures) before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/test/event-resolution-content-proof.integration.test.ts` — covers MATCH-02, including directly-seeded synthetic `transcript_chunks` rows (no ingestion path to rely on, per Pitfall 1)
- [ ] New unit test block in `supabase/functions/_shared/__tests__/event-resolver.test.ts` — covers the pure shingle-scoring function and `isSpeakerAlibiViolation`
- [ ] Migration `YYYYMMDDHHMMSS_content_proof_apply_tier_param.sql` — extends `apply_event_match_atomic` (needed before any auto-attach integration test can assert `tier='content_proof'` in the ledger)
- Framework install: none — Vitest is already fully configured repo-wide.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | This phase adds no new user-facing auth surface — all new logic runs inside the existing service-role edge function sweep. |
| V3 Session Management | No | Same as above. |
| V4 Access Control | Yes | The alibi/shingle logic must never widen readable audience across organizations — reuse the existing same-org bucketing pattern (Don't Hand-Roll) and the existing `apply_event_match_atomic` ownership-by-parameter check, unchanged. |
| V5 Input Validation | Partial | `transcript_chunks.chunk_text` is provider-sourced free text, already stored (not new input this phase introduces) — shingle extraction should tolerate arbitrary Unicode/length without throwing (fail-closed per the file's existing convention), but this is not a new injection surface (no raw string ever reaches a SQL query — Supabase client parameterizes all reads). |
| V6 Cryptography | No | No new cryptographic operation. If a non-cryptographic hash is used to key shingles for a `Set`/`Map` lookup, it must not be presented as security-relevant — it's a plain dedup key, not a security control. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| False merge across organizations widening readable audience (the entire milestone's central risk, restated for tier 2) | Information Disclosure | Same-org-only candidate pairing (already enforced structurally by the existing `Map<organization_id, ...>` bucketing pattern in `findDeterministicMatches`/`findMetadataCandidates` — tier 2 must reuse it verbatim) + the existing SAFE-04 cross-org RLS isolation test, which must continue passing unmodified. |
| Alibi constraint silently never firing due to unset `has_confirmed_speech` (Pitfall 3), giving false confidence that "impossible" merges are actively being blocked | Tampering (of trust, not data) — a documentation/expectation risk more than a code vulnerability | Explicit Task-1 checkpoint decision + Assumptions Log entry (A2) + Open Question 1, so the gap is visible to Andrew and future phases rather than silently assumed solved. |

## Sources

### Primary (HIGH confidence — direct repo reads, this session)

- `supabase/migrations/20251125000001_ai_chat_infrastructure.sql` — `transcript_chunks` CREATE TABLE (verbatim column list), `pg_trgm`/`vector` extension enablement
- `supabase/migrations/20260303000009_update_transcript_chunks_fk.sql` — `canonical_recording_id` UUID FK addition, legacy BIGINT `recording_id` backfill
- `supabase/migrations/20260831000001_create_events_and_extend_participants.sql` — `events` table, `call_participants.has_confirmed_speech`/`role`/`event_id` (exact CHECK constraints and comments)
- `supabase/migrations/20260901000002_create_event_match_decisions.sql` — `event_match_decisions.tier` CHECK constraint (confirms `'content_proof'` already valid)
- `supabase/migrations/20260901000003_create_event_match_apply_reverse_rpcs.sql` — `apply_event_match_atomic`/`reverse_event_match_atomic` full source (confirms hardcoded `'deterministic'` literal)
- `supabase/functions/_shared/event-resolver.ts` — full tier-1/tier-3 `runShadowSweep` implementation, fail-closed isolation pattern, pure-function style
- `supabase/functions/_shared/dedup-fingerprint.ts` — `MATCH_THRESHOLDS`, `calculateTitleSimilarity`/`calculateTimeOverlap`/`calculateParticipantOverlap` signatures
- `supabase/functions/_shared/canonical-recording.ts` — `CanonicalTranscriptTurn.startSeconds`/`endSeconds` (confirms relative-offset data model exists at the connector layer)
- Exhaustive repo-wide `grep` for `transcript_chunks`, `chunk_index`, `timestamp_start` across `supabase/functions/`, `src/`, and the full edge-function directory listing — zero live writers/readers found
- `.planning/phases/32-match-rule-hardening-provider-agnostic-matcher/32-02-SUMMARY.md`, `32-04-SUMMARY.md` — Phase 32's shipped metadata tier, prod deploy state, locked scoring contract

### Secondary (MEDIUM confidence)

- `.orca/drops/SPEC-event-resolution-and-provenance.md` — full milestone spec (tier confidence table, edge cases, legal posture) — treated as locked design intent per CONTEXT.md, not independently re-verified against external sources since it is this project's own authored spec, not third-party documentation
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — traceability and phase-completion state (self-consistent with the SPEC and migration evidence above)

### Tertiary (LOW confidence)

- None — this phase's research relied entirely on direct repo/migration verification rather than external web sources, since the domain (extending an in-house matcher) has no relevant third-party library or framework to look up.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; existing dependency-free pattern is directly reusable and verified by reading the actual source files.
- Architecture: HIGH — the extension pattern (third tier-pass, additive RPC parameter) is derived directly from reading the exact code it extends, not inferred.
- Pitfalls: HIGH for the schema/code-path claims (exhaustive grep, multiple independent searches converging on the same "zero live writer" conclusion); MEDIUM for the "therefore real data is absent" inference (strong circumstantial evidence, not a direct row count — see Assumption A1).

**Research date:** 2026-09-05
**Valid until:** 30 days (stable, in-house codebase; the main risk to staleness is Phase 34/35 work changing `has_confirmed_speech`/`transcript_chunks` population before Phase 33 executes — re-check Pitfalls 1 and 3 if significant time passes before this phase is planned/executed)
