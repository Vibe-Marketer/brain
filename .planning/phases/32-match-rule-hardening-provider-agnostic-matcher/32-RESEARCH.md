# Phase 32: Match-Rule Hardening + Provider-Agnostic Matcher - Research

**Researched:** 2026-09-01
**Domain:** Entity resolution / record linkage hardening on a live production matcher (Postgres + Deno Edge Functions), RLS-enforced multi-tenant isolation, precision measurement infrastructure
**Confidence:** HIGH (matcher code, schema, RLS/kill-switch precedent — all read directly from current repo state) / MEDIUM (SAFE-06 hand-labeled-set design — synthesized from record-linkage methodology + this codebase's constraints, no existing precedent to point to)

<user_constraints>
## User Constraints (from CONTEXT.md)

**Note on this phase's CONTEXT.md structure:** this phase's smart-discuss was skipped ("Infrastructure phase — smart discuss skipped (no new UI; matcher/precision work; spec already locks the design)"). Its own `### Claude's Discretion` heading actually contains *locked* constraints carried forward from the source spec and REQUIREMENTS.md, not an open-discretion area distinct from locked decisions. Reproduced verbatim below, structure preserved as-authored.

### Phase Boundary

Close the live F5 false-merge bug (recurring meetings can false-merge via the current 2-of-3 weak-signal rule with no real time-overlap guard), make the matcher provider-agnostic (replace the Zoom-and-`zoom_raw_calls`-only `dedup-fingerprint.ts` path with one reading `recordings` + `call_participants` + `transcript_chunks`), and prove shadow precision (≤0.1% false-merge rate against a hand-labeled set) before SAFE-01 is enabled for any organization.

**Note on scope escalation:** unlike Phases 30-31 which shipped strictly inert, this phase's own success criterion #5 requires measuring real precision — which may require enabling the flag for at least one org (likely an internal/test org, not a real customer) to generate real shadow data to hand-label. This is a materially different category of action than "ships inert" and should be called out explicitly wherever the plan proposes it, regardless of routine-checkpoint auto-approval posture.

### Locked Decisions (CONTEXT.md's "Claude's Discretion" heading — locked constraints from source spec + REQUIREMENTS.md)

- `checkMatch` gains a mandatory nonzero time-overlap guard — closes F5 inside the function, not at the caller (MATCH-04).
- Title similarity suppressed when the title appears in `recurring_call_titles` above an occurrence threshold (MATCH-05). `recurring_call_titles` already exists (F10 finding from the original spec).
- Metadata tier (time/participant/title) can only propose candidates for review — never auto-merges alone (MATCH-03). Only tier 1 (deterministic, Phase 31) and tier 2 (content-proof, Phase 33) can auto-attach.
- Thresholds asymmetric: high bar to merge, low bar to split (MATCH-08).
- `dedup_priority_mode`/`dedup_platform_order` in `user_settings` continue to work, now selecting display order under an event rather than which row survives — nothing discarded (MATCH-11).
- Kill switch reverts all auto-merges within a time range in one operation (SAFE-03).
- Cross-org false merges blocked at RLS — proven by a live cross-org isolation test against TEST, resolution must never widen either capture's readable audience (SAFE-04).
- Shadow precision measured against a hand-labeled set, false-merge rate ≤0.1% target, BEFORE SAFE-01 is enabled for any org (SAFE-06).
- Existing Zoom behavior preserved through the new path, not deleted (MATCH-06).

### Existing Code Insights (from CONTEXT.md)

**Reusable Assets:**
- Phase 31's `event-resolver.ts` (tier-1 deterministic matcher, now fixed post-CR-01), `event_match_decisions` ledger, `organization_feature_flags` table, apply/reverse RPC pair — all live in prod, inert.
- `dedup-fingerprint.ts` — the current Zoom-only matcher with the F5 bug (2-of-3 weak signals, no real time-overlap guard) — this phase replaces/hardens it, per MATCH-06 without deleting existing Zoom behavior.
- `recurring_call_titles` table — already exists, free fix for F5 per the original spec finding F10. **Research correction: this is a VIEW, not a table — see Common Pitfalls #4 and Code Examples below.**

**Established Patterns:**
- Same TEST-then-prod guarded migration discipline as Phases 30-31.
- Same RLS FORCE + service-role-only pattern for any new backend-control tables (kill switch state, precision measurements) unless a legitimate client read need exists.

### Specific Ideas (from CONTEXT.md)

None beyond the locked constraints. Continues on branch `v2.2-event-resolution`.

### Deferred Ideas (OUT OF SCOPE) (from CONTEXT.md)

None — infrastructure-only, spec locked.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MATCH-03 | The metadata tier may only propose candidates. It can never auto-merge alone. | `event_match_decisions.decision` CHECK already includes `'merge_proposed'` as a valid value distinct from `'merge_applied'` — no schema change needed. Pattern 3 (idempotent insert) and the SAFE-02 runtime source-scan precedent from Phase 31 directly extend to proving this by inspection. See Architecture Patterns, Code Examples. |
| MATCH-04 | `checkMatch` gains a mandatory nonzero time-overlap guard, closing F5 inside the function rather than relying on the caller's window. | Full read of `dedup-fingerprint.ts`'s live `checkMatch` confirms the exact bug mechanism (2-of-3 count never requires time to be one of the two). Caller site (`zoom-webhook/index.ts`) confirmed to call this function directly and auto-apply its verdict live in production today. See Summary, Pattern 1, Pitfall 1. |
| MATCH-05 | Title similarity is suppressed as a match signal when the title appears in `recurring_call_titles` above an occurrence threshold. | `recurring_call_titles` confirmed as a live, provider-agnostic **view** (not table) reading from `recordings`, giving `occurrence_count`/`title`/`user_id` directly usable for the suppression check. All four historical revisions of this view traced and reconciled. See Code Examples, Pitfall 5 (RLS/security_invoker caveat), Assumption A4. |
| MATCH-06 | The matcher is provider-agnostic and reads `recordings` + `call_participants` + `transcript_chunks`, replacing the Zoom-and-`zoom_raw_calls`-only path. Existing Zoom behavior is preserved through the new path, not deleted. | `call_participants`' authoritative live schema confirmed (org-scoped, recording-scoped, `event_id`/`role`/`has_confirmed_speech` already added by Phase 30). `transcript_chunks` confirmed present but scoped to the *next* phase (33/MATCH-02) per the source spec's own phase-priority table — this phase's metadata tier needs only `recordings`+`call_participants`. Old Zoom path confirmed to keep functioning unmodified once `checkMatch` is fixed in place. See Summary, Architectural Responsibility Map, Assumption A3. |
| MATCH-08 | Thresholds are asymmetric — high bar to merge, low bar to split. A false merge is treated as a data-exposure incident. | `event_match_decisions.score` (0..1) and `MATCH_THRESHOLDS` in `dedup-fingerprint.ts` are the existing levers; no new infrastructure needed, a logic/config change on top of the confirmed-live scoring functions. See Don't Hand-Roll. |
| MATCH-11 | `dedup_priority_mode` and `dedup_platform_order` in `user_settings` continue to work, now selecting which recording displays first under an event rather than which row survives. Nothing is discarded. | Both columns confirmed present in `user_settings` (via `src/types/supabase.ts`) and confirmed actively read today by `zoom-webhook/index.ts`'s `shouldNewMeetingBePrimary`. This phase's obligation is preservation, not new UI (CONTEXT.md: "no new UI"). See Architectural Responsibility Map. |
| SAFE-03 | A kill switch reverts all auto-merges within a time range in one operation. | Autopilot's `runner_state.kill_switch` column-restriction-trigger pattern confirmed as a mirror-worthy precedent for the *flag* half only. `organization_feature_flags`' own migration comment explicitly anticipates this exact requirement as a new `flag_key` row. The *revert* half needs new PL/pgSQL, distinct from `reverse_event_match_atomic`'s per-decision, ownership-gated shape. See Pattern 4, Pitfall 3, Code Examples. |
| SAFE-04 | Cross-org false merges are blocked at RLS — resolving two recordings to one event must never widen either recording's readable audience. | `src/test/rls-regression.test.ts`'s `CROSS_ORG_TABLES`/`CLIENT_DENY_TABLES`/bespoke-`events`-block pattern confirmed live and already covering `call_participants`, `event_match_decisions`, `organization_feature_flags`, and `events` itself (SAFE-05, complete). This is the "Phase 24 precedent" the source spec cites. See Don't Hand-Roll, Validation Architecture. |
| SAFE-06 | Shadow precision is measured against a hand-labeled set before SAFE-01 is enabled for any org. Target: false-merge rate at or below 0.1%. | No existing eval/scoring/hand-labeled-dataset infrastructure found anywhere in this repo (`scripts/`, no `eval*`/`golden*` dirs) — confirmed by direct search, must be built new. TEST Supabase project confirmed to have zero recordings (Phase 31 finding), so a real internal/production org is the only viable source of real data to label. Record-linkage methodology (false-discovery-rate framing) sourced via WebSearch to ground the metric definition. See Summary, Pitfall 4, Don't Hand-Roll, Sources (Secondary). |

</phase_requirements>

## Summary

This phase closes a **live production bug**, not a theoretical one. `checkMatch()` in `dedup-fingerprint.ts` is called today, on every Zoom webhook delivery, by `handleDuplicateMerge()` in `zoom-webhook/index.ts` — and it auto-applies its verdict immediately (`UPDATE zoom_raw_calls SET is_primary = ...`), with no review queue and no ledger. The 2-of-3 rule (title ≥0.80 OR time ≥0.50 OR participants ≥0.60, any two) never requires time to be one of the two, so a title+participant match with literally zero time overlap — the exact shape of two occurrences of the same recurring meeting — passes today. Fixing `checkMatch` itself (MATCH-04) closes this live bug immediately, in the existing caller, with no changes to `zoom-webhook/index.ts` required, because the caller already imports and calls this exact function.

The good news materially reduces scope in two places the source spec got wrong or left ambiguous. First, `recurring_call_titles` is not a table (contra F10/CONTEXT.md's phrasing) — it's a `SECURITY INVOKER` **view**, and as of the most recent of its four migrations it already reads from `recordings` (not `fathom_calls`), keyed by `owner_user_id`/`title`, giving `occurrence_count`/`first_occurrence`/`last_occurrence` for free. It is already provider-agnostic and usable as-is for MATCH-05. Second, `transcript_chunks` is confirmed present with both a legacy `recording_id: number` and a UUID `canonical_recording_id`, but Phase 32's metadata tier does not need it — the SPEC's own phase-priority table (whose numbering is offset by +1 from this repo's actual phase numbers) places content-proof matching over `transcript_chunks` in the *next* phase (33/MATCH-02), not this one. MATCH-06's "reads recordings + call_participants + transcript_chunks" describes the full matcher's footprint across all three tiers, not what this phase alone must wire.

The riskier finding is architectural: **two separate merge mechanisms now coexist**, and this phase must be careful not to conflate them. The old path (`dedup-fingerprint.ts` + `zoom-webhook`'s `handleDuplicateMerge`) is Zoom-only, user-scoped, auto-applying, and writes to `zoom_raw_calls.is_primary`/`merged_from`. The new path (Phase 31's `event-resolver.ts` + `event_match_decisions` + `apply_event_match_atomic`/`reverse_event_match_atomic`) is provider-agnostic-by-design, org-scoped, shadow-mode-only (currently zero rows in `organization_feature_flags`), and writes to a proper append-only ledger. MATCH-06 requires the old path's *behavior* to be preserved (not deleted) while the new path becomes the provider-agnostic future. This phase's metadata tier is new code that extends `event-resolver.ts`, not a rewrite of `zoom-webhook/index.ts`.

**Primary recommendation:** Fix `checkMatch` in place (mandatory nonzero-time-overlap gate, independent of the 2-of-3 count) so the live bug closes for free in the existing caller; build the new metadata tier as an addition to `_shared/event-resolver.ts` reading `recordings` + `call_participants` only (same-org-only, mirroring Phase 31's pairing pattern) and writing `tier='metadata'` proposals to the *already-schema-ready* `event_match_decisions` ledger (no migration needed for this — `'metadata'` and `'merge_proposed'` are already valid enum values); implement the kill switch as a new `organization_feature_flags` row type (the Phase 31 migration's own comment explicitly anticipated this) plus one new bulk-reversal RPC built on `reverse_event_match_atomic`'s pattern; and build SAFE-06's hand-labeled set from real `event_match_decisions` rows generated by briefly enabling `event_resolution` for exactly one internal/test-only org — never a real customer — since no synthetic-dataset or eval infrastructure exists anywhere in this repo today.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `checkMatch` time-overlap guard (MATCH-04) | Backend (Edge Function shared module) | — | Pure function fix inside `dedup-fingerprint.ts`; no DB or UI involvement |
| Recurring-title suppression (MATCH-05) | Backend (Edge Function shared module) | Database (existing `recurring_call_titles` view) | Matcher reads an existing view; no new schema |
| Provider-agnostic metadata tier (MATCH-06) | Backend (Edge Function shared module, extends `event-resolver.ts`) | Database (`recordings` + `call_participants` reads) | Same architectural seam as Phase 31's tier-1 matcher |
| Metadata-tier propose-only enforcement (MATCH-03) | Backend (write path constrained to `decision='merge_proposed'`) | Database (`event_match_decisions` CHECK constraints already enforce valid `decision` values) | No auto-apply code path should exist for this tier at all |
| Asymmetric thresholds (MATCH-08) | Backend (scoring logic) | — | Business logic, not a data-layer concern |
| Display-order selection (MATCH-11) | Backend/Frontend (future UI, out of this phase's "no new UI" scope) | Database (`user_settings.dedup_priority_mode`/`dedup_platform_order`, already live) | This phase must not break the existing read path; building the event-aware display-order UI is explicitly out of scope here |
| Kill switch state (SAFE-03) | Database (`organization_feature_flags` new row type) | Backend (bulk-reversal RPC) | Mirrors the existing `runner_state.kill_switch` column-restricted-trigger pattern |
| Kill switch bulk reversal (SAFE-03) | Database (new SECURITY DEFINER RPC, atomic) | — | Must be one transaction per SAFE-03's literal wording; extends `reverse_event_match_atomic`'s pattern, cannot reuse it as-is (ownership-by-parameter doesn't fit a bulk admin action) |
| Cross-org isolation proof (SAFE-04) | Database (RLS policies + same-org-only matcher pairing) | Backend (test harness) | Enforcement is RLS; the test proves it from an authenticated JWT, not service-role |
| Shadow precision measurement (SAFE-06) | Backend (new one-off scoring script/tool) | Database (`event_match_decisions` reads) | No existing eval infrastructure in this repo — new, small, non-production tooling |

## Standard Stack

### Core

No new libraries are required this phase. Every capability is built on dependencies already live in this codebase.

| Library | Version | Purpose | Why Standard (for this repo) |
|---------|---------|---------|--------------|
| `fastest-levenshtein` | 1.0.16 (pinned via `esm.sh` URL import in `dedup-fingerprint.ts`, not a package.json dependency — Deno Edge Functions load npm packages from `esm.sh` directly) | Title similarity scoring | Already the only Levenshtein implementation in the matcher; MATCH-08's asymmetric thresholds reuse it, don't replace it |
| `zod` | `^3.25.76` [VERIFIED: package.json] | Input validation for any new RPC-adjacent Edge Function payload (e.g. a kill-switch trigger endpoint, if one is added) | Established validation convention per `supabase/CLAUDE.md` |
| `vitest` | `^4.0.16` [VERIFIED: package.json] | Unit + integration tests for the new metadata-tier matcher and kill-switch RPC | Same framework Phase 31 used for `event-resolver.test.ts` and the two integration tests |
| PL/pgSQL (`SECURITY DEFINER`) | Postgres 15 (Supabase-managed) | Atomic kill-switch bulk reversal RPC | Direct continuation of `apply_event_match_atomic`/`reverse_event_match_atomic`/`split_recording_atomic`'s established transactional pattern |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `crypto.subtle` (Deno built-in) | n/a | SHA-256 participant-set hashing | Already used in `generateFingerprint`; no change needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending `event-resolver.ts` with a metadata-tier function | A brand-new `_shared/metadata-resolver.ts` module | Rejected: Phase 31's own file header explicitly designed `TIER1_SIGNAL_EXTRACTORS` and the module's shape for "Phase 32/33 extend this one place." A new file would fragment the tier logic and duplicate the Supabase-client-injection pattern for no benefit. |
| A new dedicated kill-switch table | Reusing `organization_feature_flags` with a new `flag_key` | The migration's own comment names this exact use case ("e.g. Phase 32's SAFE-03 kill switch"). A new table would duplicate RLS/FORCE/service-role boilerplate for zero schema benefit — `flag_key` is free text specifically so no migration is needed to add a value. |
| Building a synthetic hand-labeled dataset | Sampling real shadow-mode `event_match_decisions` rows from one internal/test org | A synthetic dataset can't prove real-world precision against the actual six-provider `source_metadata` shapes this matcher will see; CONTEXT.md's own scope-escalation note anticipates this exact tradeoff and requires explicit callout regardless of auto-approval posture. |

**Installation:** None — no new packages this phase.

**Version verification:** `vitest` and `zod` versions above confirmed directly from `package.json` this session (`rtk proxy grep`). `fastest-levenshtein@1.0.16` is pinned in the `esm.sh` import URL inside `dedup-fingerprint.ts` itself — confirmed by direct file read, not package.json (Edge Functions don't share the root `package.json` dependency tree).

## Package Legitimacy Audit

Not applicable — this phase installs no new external packages. All work extends existing, already-vetted dependencies (`fastest-levenshtein`, `zod`, `vitest`, Postgres/PL/pgSQL). No `npm install` or Deno `esm.sh` import additions are anticipated.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────────────────┐
                    │  OLD PATH (live today, Zoom-only, user-scoped)       │
                    │                                                       │
  Zoom webhook ────▶│  zoom-webhook/index.ts                               │
  delivery          │    findPotentialDuplicates()                        │
                    │      │ query zoom_raw_calls WHERE user_id=?          │
                    │      │   AND recording_start_time BETWEEN ±24h       │
                    │      ▼                                               │
                    │    checkMatch()  ◀── FIXED HERE (MATCH-04)          │
                    │      │ [dedup-fingerprint.ts — shared, unchanged     │
                    │      │  file location, hardened function body]      │
                    │      ▼                                               │
                    │    handleDuplicateMerge()                            │
                    │      │ UPDATE zoom_raw_calls                         │
                    │      │   SET is_primary=?, fuzzy_match_score=?       │
                    │      ▼ (immediate, no review, no ledger)             │
                    │    [live effect on zoom_raw_calls]                   │
                    └─────────────────────────────────────────────────────┘

                    ┌─────────────────────────────────────────────────────┐
                    │  NEW PATH (Phase 31 shadow-mode + Phase 32 additions)│
                    │                                                       │
  pg_cron           │  resolve-events/index.ts (X-Reconcile-Secret gated)  │
  (every 15 min) ──▶│    │                                                 │
                    │    ▼                                                 │
                    │  event-resolver.ts                                   │
                    │    runShadowSweep()                                  │
                    │      │ SELECT recordings WHERE event_id IS NULL      │
                    │      │   AND organization_id IN (flagged orgs)       │
                    │      ▼                                               │
                    │    findDeterministicMatches()  [tier 1, live]        │
                    │      │ groups by organization_id::signal             │
                    │      ▼                                               │
                    │    findMetadataCandidates()  [tier 3, NEW this phase]│
                    │      │ reads recordings + call_participants          │
                    │      │ same-org-only, title suppressed via           │
                    │      │   recurring_call_titles view                  │
                    │      │ NEVER writes decision='merge_applied'         │
                    │      │   (MATCH-03: propose only)                    │
                    │      ▼                                               │
                    │    INSERT event_match_decisions                      │
                    │      (tier='deterministic'|'metadata',                │
                    │       decision='merge_proposed', applied=false)      │
                    │                                                       │
                    │  [separately, never auto-called by the sweep:]       │
                    │  apply_event_match_atomic() ─┐                       │
                    │  reverse_event_match_atomic()│  MATCH-10, proven,    │
                    │                              │  not wired to any     │
                    │  kill_switch_revert_merges() │  automatic path       │
                    │    (NEW this phase, SAFE-03) │◀─ bulk, one txn,      │
                    │                              │   built on            │
                    │                              │   reverse's pattern   │
                    └──────────────────────────────┴───────────────────────┘
                                        │
                                        ▼
                    RLS enforcement boundary (SAFE-04): events has no
                    organization_id column (EVT-04); visibility flows
                    through participation or an owned capture only.
                    Cross-org isolation proven from an authenticated JWT,
                    not service-role, mirroring the existing bespoke
                    `events` block in src/test/rls-regression.test.ts.
```

### Recommended Project Structure

No new top-level directories. Additions land inside the existing structure:

```
supabase/functions/
├── _shared/
│   ├── dedup-fingerprint.ts       # MODIFIED: checkMatch gains time-overlap guard (MATCH-04)
│   ├── event-resolver.ts          # EXTENDED: new metadata-tier function(s), same file
│   └── __tests__/
│       └── event-resolver.test.ts # EXTENDED: new unit tests for the metadata tier
├── zoom-webhook/
│   └── index.ts                   # UNCHANGED (MATCH-06: preserve, don't delete)
supabase/migrations/
├── YYYYMMDDHHMMSS_kill_switch_revert_rpc.sql   # NEW: bulk-reversal RPC (SAFE-03)
src/test/
├── rls-regression.test.ts         # EXTENDED: new bespoke block for SAFE-04
scripts/ (or a phase-scoped .planning/ tool)
└── shadow-precision-eval.ts       # NEW: SAFE-06 hand-labeled scoring tool — no existing precedent
```

### Pattern 1: Fix the shared function, not every caller

**What:** `checkMatch()` in `dedup-fingerprint.ts` is called by exactly one caller today (`zoom-webhook/index.ts`'s `findPotentialDuplicates`). Adding a mandatory nonzero-time-overlap gate *inside* `checkMatch` — before or independent of the 2-of-3 criteria count — closes the live bug without touching the caller at all.
**When to use:** MATCH-04 explicitly requires the fix live "inside the function," not "relying on the caller's window" — this is a locked decision (CONTEXT.md), not a design choice to relitigate.
**Example (the exact bug, confirmed by direct read):**
```typescript
// Source: supabase/functions/_shared/dedup-fingerprint.ts (current, live)
export function checkMatch(
  fingerprint1: MeetingFingerprint,
  fingerprint2: MeetingFingerprint
): MatchResult {
  const titleSimilarity = calculateTitleSimilarity(/* ... */);
  const timeOverlap = calculateTimeOverlap(/* ... */);
  const participantOverlap = calculateParticipantOverlap(/* ... */);

  const titleMet = titleSimilarity >= MATCH_THRESHOLDS.title_similarity;
  const timeMet = timeOverlap >= MATCH_THRESHOLDS.time_overlap;
  const participantsMet = participantOverlap >= MATCH_THRESHOLDS.participant_overlap;

  const criteriaMetCount = [titleMet, timeMet, participantsMet].filter(Boolean).length;
  const isMatch = criteriaMetCount >= 2;   // <-- BUG: time is never required to be one of the two
  // ...
}
```
A title+participant match with `timeOverlap === 0` still returns `is_match: true`. The fix must reject when `timeOverlap <= 0` regardless of the other two criteria's count — a pure, minimal, testable change to this one function.

### Pattern 2: Provider-prefixed, centralized signal extraction (already established, extend it)

**What:** Phase 31's `TIER1_SIGNAL_EXTRACTORS` is a single object literal mapping `source_app` to a field-extraction function, built with `Object.assign(Object.create(null), {...})` specifically to avoid prototype-pollution collisions on `sourceApp` values. The file header states this is intentionally centralized "so Phase 32/33 can extend this one map."
**When to use:** Any new provider-specific field read for the metadata tier (e.g., a per-provider participant-list shape difference) should extend this same map, not introduce parallel if/else branching.
**Example:**
```typescript
// Source: supabase/functions/_shared/event-resolver.ts (current, live)
const TIER1_SIGNAL_EXTRACTORS: Record<
  string,
  (metadata: Record<string, unknown>) => string | null
> = Object.assign(Object.create(null), {
  zoom: (metadata: Record<string, unknown>) => { /* ... */ },
});
```

### Pattern 3: Idempotent insert, never upsert, for proposal writes

**What:** `runShadowSweep` writes proposals via `.insert()` plus a local `isUniqueViolation(error)` check (`error.code === '23505'`), never `.upsert()`. This is deliberate — Phase 31's acceptance gate greps the file for the *literal absence* of `.upsert(`/`.update(` so a reviewer can prove by inspection that the write path never silently overwrites a prior decision.
**When to use:** The new metadata-tier proposer must follow this identical idiom when writing `tier='metadata'` rows.
**Example:**
```typescript
// Source: supabase/functions/_shared/event-resolver.ts (current, live)
const { error: insertError } = await supabase.from('event_match_decisions').insert({
  recording_id_a: match.recording_id_a,
  recording_id_b: match.recording_id_b,
  tier: 'deterministic',       // Phase 32 writes 'metadata' here instead
  score: null,                  // Phase 32 writes a 0..1 score here
  signals: { matched_field: matchedField },
  decision: 'merge_proposed',   // MATCH-03: metadata tier NEVER writes 'merge_applied'
  decided_by: 'auto',
  applied: false,
});
```

### Pattern 4: Ownership-by-parameter, never `auth.uid()`, in SECURITY DEFINER RPCs

**What:** Both `apply_event_match_atomic` and `reverse_event_match_atomic` validate ownership via `NOT EXISTS (SELECT 1 FROM recordings WHERE id = p_recording_id_a AND owner_user_id = p_owner_user_id)` rather than `auth.uid()`, because these RPCs run under the service-role key (`auth.uid()` is `NULL` there). This mirrors `split_recording_atomic` exactly and correctly denies when `owner_user_id IS NULL`, unlike a raw `<>` comparison.
**When to use:** Any new RPC that needs an ownership check while running as service-role.
**Caveat for the kill switch specifically:** a bulk, admin-triggered reversal across potentially many different owners cannot use this exact per-caller ownership check — see Common Pitfalls #2 below.

### Anti-Patterns to Avoid

- **Don't rebuild the ±24h window guard as the F5 fix.** The window is a candidate-selection filter, not a match-validity guard. MATCH-04 is explicit: the fix belongs inside `checkMatch`, independent of any caller's window logic.
- **Don't create a new table for the kill-switch flag.** `organization_feature_flags.flag_key` is free text by design, specifically to avoid this.
- **Don't let `apply_event_match_atomic`'s hardcoded `tier='deterministic'`** leak into this phase's work unexamined — see Common Pitfalls #3.
- **Don't treat `recurring_call_titles` as needing a migration.** It exists, it's provider-agnostic already, confirm before writing any DDL against it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Levenshtein distance | A custom string-distance function | `fastest-levenshtein` (already imported) | Already vetted, already in the hot path; MATCH-08's threshold changes are a config/logic change, not a distance-algorithm change |
| Atomic multi-row merge/reversal | Sequential Supabase client calls wrapped in try/catch | A single PL/pgSQL `SECURITY DEFINER` function (one implicit transaction) | `apply_event_match_atomic`/`reverse_event_match_atomic`/`split_recording_atomic` all use this pattern; sequential client calls are not atomic and can partially apply under a mid-sequence failure |
| Idempotent proposal writes under concurrent sweep ticks | `.upsert(..., { ignoreDuplicates: true })` | `.insert()` + `error.code === '23505'` tolerance | Phase 31's acceptance gate literally greps for the absence of `.upsert(`/`.update(` in this file — an upsert here would also silently pass the grep-invisible mutation risk the whole pattern exists to prevent |
| Precision/false-merge-rate definition | An ad-hoc "count wrong ones over all pairs" script | False-discovery-rate framing: wrong merges ÷ merges *proposed or applied*, not ÷ total pair-space | The full O(n²) pair space is dominated by true negatives; any method trivially scores near-zero FPR against it. Standard record-linkage methodology measures precision on the *positive* (proposed-match) set — see Sources |
| Cross-org isolation proof | A new, bespoke test file/harness | Extend `src/test/rls-regression.test.ts`'s existing `CROSS_ORG_TABLES`/`CLIENT_DENY_TABLES`/bespoke-`events`-block pattern | This is the exact "Phase 24 precedent" the source spec cites; it already has a working bespoke block for `events`' non-org-scoped RLS shape, and `event_match_decisions`/`organization_feature_flags` are already registered in it from Phase 31 |
| Kill-switch state | A new admin table + new RLS policies from scratch | `organization_feature_flags` new row (service-role read/write, already `FORCE ROW LEVEL SECURITY`) | Zero new schema surface; the Phase 31 migration comment names this exact future use |

**Key insight:** Almost everything Phase 32 needs at the schema/pattern level already exists — the `event_match_decisions` ledger's `tier` and `decision` CHECK constraints already include `'metadata'` and `'merge_proposed'` as valid values, unused until this phase writes them. The actual net-new surface area is small: one hardened function, one new matcher function, one new RPC, one new test block, and one new (non-production) eval script.

## Common Pitfalls

### Pitfall 1: The live production bug has already been running — fixing `checkMatch` doesn't undo past damage
**What goes wrong:** Treating MATCH-04 as purely forward-looking. `handleDuplicateMerge` has been auto-flipping `zoom_raw_calls.is_primary`/writing `fuzzy_match_score` in production on every Zoom webhook delivery for as long as this code has been live — well before this milestone existed. Fixing `checkMatch` stops *new* false merges; it does not detect or reverse ones that may have already happened.
**Why it happens:** The old path has no ledger (unlike the new `event_match_decisions` path), so there's no audit trail to review after the fact — only the current `is_primary`/`merged_from`/`fuzzy_match_score` state on `zoom_raw_calls`.
**How to avoid:** Consider a read-only, prod-ref-guarded audit query (count of `zoom_raw_calls` rows with non-null `fuzzy_match_score` and `is_primary = false`, cross-referenced against `recurring_call_titles`' `occurrence_count` for the same title) as part of this phase's verification, to gauge blast radius — not necessarily to remediate (remediation of historical merges is arguably out of this milestone's "forward-only" scope per the locked decisions, but the planner and Andrew should make that call knowingly, not by omission).
**Warning signs:** None visible without querying — this is a silent-by-design gap in the old path.

### Pitfall 2: `apply_event_match_atomic` hardcodes `tier='deterministic'` in its own ledger write
**What goes wrong:** Reading the RPC's source directly (`supabase/migrations/20260901000003_...sql`) shows its `INSERT INTO event_match_decisions` always writes `'deterministic'` as the tier literal, regardless of what tier actually produced the decision being applied. This is fine today because nothing but tier-1 ever gets applied. It becomes a real correctness gap the moment any future phase applies a metadata- or content-proof-tier decision through this same RPC (e.g., after a human approves a review-queue item) — the ledger will misrecord provenance.
**Why it happens:** The RPC was built and locked in Phase 31, before the metadata tier existed to expose the gap.
**How to avoid:** MATCH-03 means Phase 32 itself never calls `apply_event_match_atomic` for metadata-tier proposals (propose-only, by requirement) — so this gap is not blocking for this phase. Flag it explicitly in the plan as a known, deliberate deferral rather than an oversight, so a future phase (whichever one first builds the review-queue "approve" action) doesn't inherit it silently.
**Warning signs:** Any future code path that calls `apply_event_match_atomic` with a `p_signals` payload whose shape implies a non-deterministic tier.

### Pitfall 3: "Kill switch" in this codebase means two different things
**What goes wrong:** The autopilot's `runner_state.kill_switch` (a real, working precedent) is a **halt** mechanism — it stops future claiming within one poll cycle, but does not undo already-completed work. SAFE-03 requires a **revert** mechanism — undo already-applied merges in a time range, in one operation. Copying the autopilot pattern verbatim would satisfy the "flip a flag" UX but miss the actual requirement.
**Why it happens:** Both are colloquially "a kill switch," but they're different verbs (pause-future vs. undo-past).
**How to avoid:** Build both pieces explicitly: (1) a flag (new `organization_feature_flags` row, e.g. disabling `event_resolution` or a dedicated halt flag) to stop the sweep from proposing/applying anything further, and (2) a genuinely new bulk-reversal RPC that iterates `event_match_decisions WHERE decision = 'merge_applied' AND <time range>` and reverses each, all inside one PL/pgSQL function (one transaction). This RPC cannot simply loop-call `reverse_event_match_atomic` from application code (that would be N separate transactions, not "one operation," and `reverse_event_match_atomic`'s per-call ownership-by-parameter check doesn't fit a bulk admin action across many different owners).
**Warning signs:** A plan that treats "add a kill_switch boolean" as the entire SAFE-03 deliverable, with no accompanying bulk-reversal RPC.

### Pitfall 4: Conflating "TEST" (the Supabase project) with "a test org" (in production)
**What goes wrong:** This repo's `TEST` Supabase project currently has **zero recordings of any provider** (confirmed directly in Phase 31 P01's own findings). SAFE-06's hand-labeled set requires real recordings across real providers to mean anything. "Enable the flag for one internal/test org," per CONTEXT.md's own scope-escalation note, can only plausibly mean an internal org *inside production* (e.g., an internal CallVault team org) — not the TEST Supabase project, which has no data to label.
**Why it happens:** "Test" is overloaded in this codebase between "the isolated TEST Supabase project used for integration tests" and "a low-stakes internal organization inside the production database."
**How to avoid:** State this distinction explicitly in the plan and get explicit confirmation on which internal org (if any) is being flagged, before writing any code that touches `organization_feature_flags` in production. CONTEXT.md already flags this as needing explicit callout "regardless of routine-checkpoint auto-approval posture" — treat that as binding.
**Warning signs:** A plan step that says "enable the flag on TEST" without addressing that TEST has no recordings to resolve.

### Pitfall 5: `FORCE ROW LEVEL SECURITY` is easy to forget on new objects, and this codebase has already paid for that mistake once
**What goes wrong:** A real incident (`20260305000001_fix_view_rls_bypass.sql`) shipped because views created without `security_invoker = true` ran as the view owner, bypassing RLS entirely — every authenticated user could see every other user's data through those views. `recurring_call_titles` was one of the three views this hotfix had to repair.
**Why it happens:** `ENABLE ROW LEVEL SECURITY` alone does not force the policy for the table/view owner role; `FORCE ROW LEVEL SECURITY` (tables) or `security_invoker = true` (views) is required in addition.
**How to avoid:** Any new table this phase introduces (e.g., if a dedicated kill-switch action-log table is chosen over reusing `organization_feature_flags`) must include `FORCE ROW LEVEL SECURITY` from the same migration that creates it, matching the established convention Phase 30/31 already followed for `events`/`call_participants`/`event_match_decisions`/`organization_feature_flags`.
**Warning signs:** A new object with `ENABLE ROW LEVEL SECURITY` but no `FORCE ROW LEVEL SECURITY` line, or a new view with no `WITH (security_invoker = true)`.

## Code Examples

### Current `checkMatch` signature (to be hardened, MATCH-04)
```typescript
// Source: supabase/functions/_shared/dedup-fingerprint.ts (read in full this session)
export function checkMatch(
  fingerprint1: MeetingFingerprint,
  fingerprint2: MeetingFingerprint
): MatchResult {
  // ... title/time/participant scoring unchanged ...
  // ADD: mandatory nonzero-time-overlap gate here, before/independent of
  // the 2-of-3 criteriaMetCount check.
}
```

### Current `recurring_call_titles` view definition (live, provider-agnostic already — MATCH-05 substrate)
```sql
-- Source: supabase/migrations/20260310125000_migrate_call_recording_id_to_uuid.sql (latest of 4 revisions)
CREATE OR REPLACE VIEW recurring_call_titles AS
SELECT
  r.owner_user_id AS user_id,
  r.title,
  COUNT(*) AS occurrence_count,
  MAX(r.created_at) AS last_occurrence,
  MIN(r.created_at) AS first_occurrence,
  ARRAY_AGG(DISTINCT ct.name) FILTER (WHERE ct.name IS NOT NULL) AS current_tags
FROM recordings r
LEFT JOIN call_tag_assignments cta ON r.id = cta.recording_id
LEFT JOIN call_tags ct ON cta.tag_id = ct.id
GROUP BY r.owner_user_id, r.title;
```
Confirmed live and matching in the regenerated `src/types/supabase.ts` Views section: `Row: { current_tags, first_occurrence, last_occurrence, occurrence_count, title, user_id }`. Note the view predates `security_invoker` conventions at its *original* creation but was corrected by the `fix_view_rls_bypass` hotfix (see Pitfall 5) — confirm the currently-live definition still carries `WITH (security_invoker = true)` before relying on it in a new migration (the 20260310125000 revision that added the UUID join did not explicitly re-state `security_invoker`; verify against the live database, not just the migration text, per this repo's own F16/F17 discipline).

### `event_match_decisions` ledger — current live constraint shape (post Phase 31 P02 fix)
```sql
-- Composite from 20260901000002 (original) + 20260901000003 (P02's constraint fix)
CREATE TABLE event_match_decisions (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id_a         UUID        NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  recording_id_b         UUID        NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  event_id               UUID        REFERENCES events(id) ON DELETE SET NULL,
  tier                   TEXT        NOT NULL CHECK (tier IN ('deterministic', 'content_proof', 'metadata')),
  score                  NUMERIC     CHECK (score IS NULL OR (score >= 0 AND score <= 1)),
  signals                JSONB       NOT NULL DEFAULT '{}'::jsonb,
  decision               TEXT        NOT NULL CHECK (decision IN ('merge_proposed', 'merge_applied', 'reversed', 'rejected')),
  decided_by             TEXT        NOT NULL CHECK (decided_by IN ('auto', 'user', 'admin')),
  applied                BOOLEAN     NOT NULL DEFAULT false,
  reverses_decision_id   UUID        REFERENCES event_match_decisions(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT event_match_decisions_pair_ordered CHECK (recording_id_a < recording_id_b)
);
-- Live constraint (NOT the original table-wide UNIQUE — corrected by 20260901000003):
CREATE UNIQUE INDEX event_match_decisions_proposed_pair_tier_key
  ON event_match_decisions (recording_id_a, recording_id_b, tier)
  WHERE decision = 'merge_proposed';
```
`tier='metadata'` and `decision='merge_proposed'` are already valid — **no migration needed** for MATCH-03's proposal-writing behavior.

### `apply_event_match_atomic` / `reverse_event_match_atomic` signatures (Phase 31, live on TEST, proven, not auto-wired)
```sql
-- Source: supabase/migrations/20260901000003_create_event_match_apply_reverse_rpcs.sql
CREATE OR REPLACE FUNCTION public.apply_event_match_atomic(
  p_recording_id_a UUID, p_recording_id_b UUID, p_event_id UUID,
  p_decided_by TEXT, p_signals JSONB, p_owner_user_id UUID
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.reverse_event_match_atomic(
  p_decision_id UUID, p_owner_user_id UUID
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```
The kill switch's bulk-reversal RPC is new — it cannot be "call `reverse_event_match_atomic` in a loop from TypeScript" (not atomic as one operation, and the per-call ownership check doesn't fit a bulk admin action). It should be a new SQL function that loops internally (`FOR row IN SELECT ... LOOP`) and performs the same null-out-and-ledger-write logic per matching `merge_applied` row, all within its own single invocation/transaction.

### `organization_feature_flags` — kill switch's anticipated home (Phase 31, live)
```sql
-- Source: supabase/migrations/20260901000001_create_organization_feature_flags.sql
CREATE TABLE organization_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  flag_key TEXT NOT NULL,        -- comment: "e.g. Phase 32's SAFE-03 kill switch"
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, flag_key)
);
```

### Autopilot's kill-switch precedent (halt, not revert — pattern to mirror for the *flag*, not the RPC)
```sql
-- Source: supabase/migrations/20260611200000_autopilot_queue_runner_state.sql
-- Column-restriction trigger: authenticated (admin) callers may ONLY change kill_switch,
-- nothing else on the row. Same narrow-blast-radius principle applies to any new
-- client-reachable kill-switch trigger point this phase might add.
CREATE OR REPLACE FUNCTION public.enforce_runner_state_kill_switch_only() ...
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Zoom-only, `zoom_raw_calls`-scoped, user-scoped, auto-applying dedup (`dedup-fingerprint.ts` + `handleDuplicateMerge`) | Provider-agnostic, org-scoped, ledger-backed, tiered resolution (`events`/`event_match_decisions`/`event-resolver.ts`) | Phase 30-31 (2026-08-31 to 2026-09-01), this phase (32) adds the metadata tier | The old path still runs live for Zoom ingestion (preserved per MATCH-06); the new path is additive infrastructure, not yet enabled for any org |
| `recurring_call_titles` reading `fathom_calls`/`fathom_raw_calls` | `recurring_call_titles` reading `recordings` directly | `20260310125000_migrate_call_recording_id_to_uuid.sql` | Already provider-agnostic; no migration needed for MATCH-05 |
| `event_match_decisions` table-wide `UNIQUE(a,b,tier)` | Partial unique index scoped to `decision='merge_proposed'` | Phase 31 Plan 02 (`20260901000003`), same day as creation | `merge_applied`/`reversed`/`rejected` rows can now coexist with a prior `merge_proposed` row for the same pair+tier — required for MATCH-10's reversibility to be possible at all |

**Deprecated/outdated:** None yet formally deprecated — `dedup-fingerprint.ts`'s Zoom-only path is explicitly preserved (MATCH-06), not retired, this milestone.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Enable the flag for one internal/test org" (SAFE-06) means an internal org *inside production*, not the empty TEST Supabase project | Common Pitfalls #4, Summary | If wrong, the plan might target TEST (zero recordings, nothing to label) instead of a real internal org, stalling SAFE-06 entirely |
| A2 | The kill switch's bulk-reversal RPC should be entirely new PL/pgSQL, not a TypeScript loop calling `reverse_event_match_atomic` per row | Pitfall 3, Code Examples | If wrong (e.g., if "one operation" is interpreted loosely as "one user-facing action" rather than "one DB transaction"), a looser TS-orchestrated implementation might be acceptable instead — but this reads the SAFE-03 requirement text ("in one operation") as a strict atomicity requirement, consistent with MATCH-10's own precedent of atomic single-transaction merge/reverse |
| A3 | Phase 32's metadata tier does not need to read `transcript_chunks`, despite MATCH-06's literal wording | Summary, Architectural Responsibility Map | Grounded in the source SPEC's own phase-priority table (content-proof/`transcript_chunks` work is explicitly the *next* phase's MATCH-02) — HIGH confidence, but flagged as an assumption because MATCH-06's requirement text itself doesn't make the tier split explicit |
| A4 | The live `recurring_call_titles` view still carries `WITH (security_invoker = true)` after its most recent (UUID-join) revision | Code Examples | The `20260310125000` migration that last redefined the view did not explicitly restate `security_invoker` in the excerpt read this session; if a later `CREATE OR REPLACE VIEW` dropped it, the view would silently regress to the exact RLS-bypass bug `20260305000001` already fixed once. Verify directly against the live database before Phase 32 relies on this view. |

## Open Questions

1. **Which internal/test org, specifically, gets the `event_resolution` flag for SAFE-06?**
   - What we know: CONTEXT.md requires this be called out explicitly, "never a real customer's data." The autopilot/internal-tooling precedent in this codebase suggests an internal CallVault team org may already exist for this kind of purpose.
   - What's unclear: Whether such an org already exists in production, or needs to be created fresh for this purpose.
   - Recommendation: Surface this as an explicit checkpoint in the plan, not an assumed default — this is exactly the "materially different category of action than ships inert" CONTEXT.md flags.

2. **Does the historical blast radius of the live F5 bug need auditing before or as part of this phase?**
   - What we know: `handleDuplicateMerge` has been auto-flipping `zoom_raw_calls.is_primary` in production on the buggy 2-of-3 rule for an unknown period predating this milestone.
   - What's unclear: Whether any recurring-meeting instances have already been silently mis-flagged, and whether that matters given `is_primary=false` doesn't delete data (see below).
   - Recommendation: A read-only audit query (count of affected rows, cross-referenced with `recurring_call_titles.occurrence_count`) is cheap and would resolve this without expanding scope into remediation.

3. **What does `is_primary=false` actually hide from the user, downstream?**
   - What we know: The column exists and is set; it does not delete the row.
   - What's unclear: Whether any UI/query path filters `WHERE is_primary = true`, which would make a false merge behave like a real UX regression (a call disappearing from the library) even though the data survives.
   - Recommendation: One grep across `src/` for `is_primary` read sites would settle this; not done this session due to scope/budget — flag for the planner or a quick pre-planning check.

## Environment Availability

No new external dependency, tool, service, or runtime is introduced by this phase. Every capability (Postgres/PL/pgSQL, Deno Edge Functions, `pg_cron`, Vitest, the TEST Supabase project) is identical to what Phase 30/31 already proved available and working in this exact environment (`vltmrnjsubfzrgrtdqey` prod, TEST project, `supabase` CLI with `--use-api` for Docker-less deploys). Re-probing was skipped as redundant given this continuity — see Phase 31 summaries for the original proofs (prod-ref guard confirmed 3x, migrations applied cleanly, `resolve-events`/cron confirmed live).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.0.16` [VERIFIED: package.json] |
| Config file | `vitest.config.ts` — `include` globs: `src/**/*.test.{ts,tsx}`, `supabase/functions/**/__tests__/*.test.ts`, `cloudflare/**/__tests__/*.test.ts` (unit); integration tests need the `*.integration.test.ts` suffix and `VITEST_INTEGRATION_OK=true` |
| Quick run command | `npx vitest run supabase/functions/_shared/__tests__/event-resolver.test.ts` |
| Full suite command | `npm run test:integration` (integration, requires TEST project env vars) + `npx vitest run` (unit) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MATCH-04 | `checkMatch` rejects zero-time-overlap candidates even when title+participants both meet threshold | unit | `npx vitest run supabase/functions/_shared/dedup-fingerprint.test.ts` | ❌ Wave 0 — no test file exists yet for `dedup-fingerprint.ts` itself (only `event-resolver.test.ts` exists) |
| MATCH-05 | Title similarity suppressed when title's `recurring_call_titles.occurrence_count` exceeds threshold | unit | `npx vitest run supabase/functions/_shared/__tests__/event-resolver.test.ts` | ⚠️ Partial — file exists, new test cases needed |
| MATCH-03 | Metadata tier writes only `decision='merge_proposed'`, never `'merge_applied'` | unit + source-scan | Mirrors Phase 31's SAFE-02 runtime source-scan assertion (grep-style, inside the test suite) | ❌ Wave 0 — new assertion needed |
| MATCH-06 | Metadata tier reads `recordings`+`call_participants`, same-org-only, existing Zoom behavior unchanged | integration | New test in `src/test/` (e.g. `event-resolution-metadata-tier.integration.test.ts`) against TEST | ❌ Wave 0 |
| SAFE-03 | Kill switch reverts all `merge_applied` decisions in a time range, one operation | integration | New test proving bulk apply→kill-switch-revert round trip on TEST, mirroring `event-match-apply-reverse.integration.test.ts`'s pattern | ❌ Wave 0 |
| SAFE-04 | Cross-org false merges blocked at RLS | integration | Extend `src/test/rls-regression.test.ts`'s bespoke `events` block | ⚠️ Partial — harness exists, new assertions needed |
| SAFE-06 | Shadow precision ≤0.1% false-merge rate on hand-labeled set | manual + scripted | New one-off script reading `event_match_decisions`, scored against a manually-reviewed label set — not a CI-automatable gate by nature (requires human judgment to build the labels) | ❌ Wave 0, and inherently not fully automatable |

### Sampling Rate
- **Per task commit:** `npx vitest run <changed test file>`
- **Per wave merge:** `npm run test:integration` (TEST project) + full `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`, plus SAFE-06's precision proof (manual/scripted, not part of the automated suite) recorded as evidence before any `organization_feature_flags` row is set `enabled=true` for a non-internal org.

### Wave 0 Gaps
- [ ] `supabase/functions/_shared/dedup-fingerprint.test.ts` — no test file exists for this module at all today; MATCH-04's fix needs one (RED/GREEN: write the zero-time-overlap failing case first against the current buggy behavior).
- [ ] New metadata-tier test cases in `supabase/functions/_shared/__tests__/event-resolver.test.ts`.
- [ ] New bespoke block in `src/test/rls-regression.test.ts` for SAFE-04.
- [ ] New integration test for the kill-switch bulk-reversal RPC.
- [ ] New (non-CI) precision-scoring script for SAFE-06 — genuinely new tooling, no existing file to extend.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | This phase touches no auth surface |
| V3 Session Management | No | — |
| V4 Access Control | **Yes** | RLS as the enforcement boundary (SAFE-04); ownership-by-parameter in `SECURITY DEFINER` RPCs; `REVOKE EXECUTE FROM PUBLIC/anon/authenticated` on any new RPC, mirroring `apply_event_match_atomic`/`reverse_event_match_atomic` |
| V5 Input Validation | Yes | `zod` validation for the kill switch's time-range parameters (start < end, reasonable bounds) if exposed via any Edge Function trigger point |
| V6 Cryptography | No (marginal) | `crypto.subtle` SHA-256 usage is a dedup fingerprint hash, not a security/secrecy boundary — no change needed |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| False merge exposes Org B's content to Org A (or vice versa) | Information Disclosure | RLS as the sole trust boundary (never application-code-only checks); same-org-only pairing in the matcher as defense-in-depth; SAFE-04's live isolation test proves this from an authenticated JWT |
| Non-admin caller invokes the kill-switch bulk-reversal RPC | Elevation of Privilege / Tampering | `SECURITY DEFINER` + `REVOKE EXECUTE FROM PUBLIC, anon, authenticated` (service-role/admin-only), matching the existing `apply_event_match_atomic` precedent exactly |
| A new view/table forgets `FORCE ROW LEVEL SECURITY` or `security_invoker` | Information Disclosure | This is a documented, previously-exploited-in-this-codebase gap (`20260305000001_fix_view_rls_bypass.sql`) — checklist item on every new migration this phase authors |
| Kill-switch flag column allows an authenticated (non-service-role) caller to modify unrelated columns on the same row | Tampering | If a client-reachable trigger point is ever added, mirror `runner_state`'s `enforce_runner_state_kill_switch_only` column-restriction trigger pattern |

## Sources

### Primary (HIGH confidence — read directly this session)
- `supabase/functions/_shared/dedup-fingerprint.ts` — full file read, exact F5 mechanism confirmed
- `supabase/functions/zoom-webhook/index.ts` (lines 180-390) — caller wiring, live auto-merge (`handleDuplicateMerge`) confirmed
- `supabase/functions/_shared/event-resolver.ts` — full file read, Phase 31 tier-1 matcher and shadow-sweep confirmed
- `supabase/migrations/20260901000002_create_event_match_decisions.sql` — full read, ledger schema (original)
- `supabase/migrations/20260901000003_create_event_match_apply_reverse_rpcs.sql` (partial, lines 55-194) — RPC signatures and bodies
- `supabase/migrations/20260901000001_create_organization_feature_flags.sql` — full read, kill-switch anticipation confirmed in comments
- `supabase/migrations/20251128120000_call_categorization_system.sql`, `20251130000001_rename_categories_to_tags.sql`, `20260305000001_fix_view_rls_bypass.sql`, `20260310125000_migrate_call_recording_id_to_uuid.sql` — all four `recurring_call_titles` view revisions, confirming current live definition
- `src/types/supabase.ts` (regenerated post-Phase-30, authoritative per F16/F17 resolution) — `recurring_call_titles`, `transcript_chunks`, `call_participants` shapes
- `src/test/rls-regression.test.ts` (partial) — `CROSS_ORG_TABLES`, `CLIENT_DENY_TABLES`, `BESPOKE_CLIENT_DENY_TABLES`, and the bespoke `events` isolation block confirmed
- `supabase/migrations/20260611200000_autopilot_queue_runner_state.sql`, `20260615190000_runner_state_fix_agent.sql` — autopilot kill-switch precedent
- `.planning/config.json` — `nyquist_validation: true`, `security_enforcement: true`, `security_asvs_level: 1`
- `package.json` — `vitest ^4.0.16`, `zod ^3.25.76` confirmed
- `.planning/phases/31-deterministic-resolution-shadow-mode-only/31-01-SUMMARY.md`, `31-02-SUMMARY.md` — Phase 31's shipped mechanism, decisions, and deferred items
- `.planning/phases/32-match-rule-hardening-provider-agnostic-matcher/32-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.orca/drops/SPEC-event-resolution-and-provenance.md` — requirements, phase-numbering reconciliation, locked decisions

### Secondary (MEDIUM confidence)
- WebSearch: "entity resolution record linkage precision evaluation hand-labeled gold set false merge rate methodology" — used to ground the false-discovery-rate framing recommended for SAFE-06 (see Don't Hand-Roll table and arXiv 2404.05622, "How to Evaluate Entity Resolution Systems")

### Tertiary (LOW confidence)
- None — every claim in this document is either a direct code/schema read this session or explicitly tagged as an Assumption above.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; existing versions confirmed directly from `package.json` and live imports
- Architecture: HIGH — every schema, RPC signature, and file wiring claim in this document was read directly from the current repo state, not inferred from the spec
- Pitfalls: HIGH for #1/#2/#5 (directly observed in code); MEDIUM for #3/#4 (architectural reasoning about requirement intent, not yet confirmed with Andrew)

**Research date:** 2026-09-01
**Valid until:** 7 days — this phase operates on a fast-moving branch (`v2.2-event-resolution`) with schema changes landing same-day; re-verify live constraint/RLS state immediately before planning if more than a few days have passed
