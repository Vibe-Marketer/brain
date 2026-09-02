---
phase: 31-deterministic-resolution-shadow-mode-only
reviewed: 2026-09-01T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/test/event-match-apply-reverse.integration.test.ts
  - src/test/event-resolution-shadow.integration.test.ts
  - src/test/rls-regression.test.ts
  - src/types/supabase.ts
  - supabase/functions/_shared/event-resolver.ts
  - supabase/functions/_shared/__tests__/event-resolver.test.ts
  - supabase/functions/resolve-events/index.ts
  - supabase/migrations/20260901000001_create_organization_feature_flags.sql
  - supabase/migrations/20260901000002_create_event_match_decisions.sql
  - supabase/migrations/20260901000003_create_event_match_apply_reverse_rpcs.sql
  - supabase/migrations/20260901000004_event_resolution_sweep_cron.sql
findings:
  critical: 1
  warning: 3
  info: 1
  total: 5
status: issues_found
---

# Phase 31: Code Review Report

**Reviewed:** 2026-09-01T00:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the deterministic-resolution shadow-mode matcher (tables, RPCs, edge function, sweep logic, and all four integration/unit test suites) against the six explicit focus areas in the task brief.

**Confirmed clean, with direct evidence:**

- **SAFE-02 boundary (focus #1).** Repo-wide grep for `apply_event_match_atomic` / `reverse_event_match_atomic` outside this phase's own migrations and `src/types/supabase.ts` returns exactly one hit: `src/test/event-match-apply-reverse.integration.test.ts`, the dedicated direct-RPC test. Neither `_shared/event-resolver.ts` nor `resolve-events/index.ts` imports or references either RPC name, directly or transitively. `runShadowSweep` only ever performs `.insert()` against `event_match_decisions`; it never touches `recordings.event_id` or `events`.
- **RLS + EXECUTE grants (focus #2).** Both `event_match_decisions` and `organization_feature_flags` have `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`, and each has exactly one policy, scoped `TO service_role`. No `anon`/`authenticated` policy exists on either table, and no later migration touches them (grep confirms only the 4 phase-31 migration files reference either table name). `EXECUTE` is explicitly revoked from `PUBLIC`, `anon`, and `authenticated` on both `apply_event_match_atomic` and `reverse_event_match_atomic`. `rls-regression.test.ts` registers both tables in `CLIENT_DENY_TABLES` with a bespoke seed/assert block that first proves the service role *can* see the seeded rows (so the deny assertion isn't a false-pass against an empty table) before asserting both org JWTs read zero rows.
- **Ownership-by-parameter (focus #4).** Both `apply_event_match_atomic` and `reverse_event_match_atomic` validate ownership via `NOT EXISTS (... WHERE owner_user_id = p_owner_user_id)`, never `auth.uid()`, matching `split_recording_atomic`'s precedent — including the property that `p_owner_user_id IS NULL` correctly denies (SQL `= NULL` is never true) rather than silently passing.
- **Sweep idempotency (focus #5).** The `event_match_decisions_proposed_pair_tier_key` partial unique index (scoped to `decision = 'merge_proposed'`) plus `isUniqueViolation` tolerance in `runShadowSweep` correctly no-ops a re-proposed pair on an overlapping/repeated cron tick. `event-resolution-shadow.integration.test.ts`'s "re-running the sweep is idempotent" test proves this against a real DB.

**Found a real bug directly on focus area #3** (see CR-01): `extractTier1Signal` does *not* fail closed for all input — it silently produces a **content-independent, guaranteed-collision** signal when `source_app` equals a JavaScript `Object.prototype` property name such as `'constructor'`, undermining the exact-match/no-false-merge guarantee the entire phase is built around. This is currently dormant (SAFE-01's flag gate means the sweep never runs for any org today) but ships live in deployed code and will poison the `event_match_decisions` ledger — the same ledger Phase 32's precision-proof gate is meant to read — the moment any organization is flagged, if any of its recordings ever carries that `source_app` value.

Three warnings round out the review: a cross-org batch-starvation risk in the sweep's driving query (dormant today, real once 2+ orgs are flagged), and two idempotency/traceability gaps in the apply/reverse RPC pair (also dormant today — the pair has no caller yet — but should be closed before Plan 02 wires a live caller to it).

## Critical Issues

### CR-01: `extractTier1Signal` does not fail closed for `source_app` values that collide with `Object.prototype` properties — produces a content-independent, guaranteed false-match signal

**File:** `supabase/functions/_shared/event-resolver.ts:94-105, 108-110, 130-133, 247-248`

**Issue:** `TIER1_SIGNAL_EXTRACTORS` and `TIER1_MATCHED_FIELD_NAMES` are plain object literals (`Record<string, ...>`), and both are indexed with unguarded bracket notation using the caller-supplied `sourceApp` / `provider` string:

```ts
// line 130 — no ownProperty check
const extractor = TIER1_SIGNAL_EXTRACTORS[sourceApp];
if (!extractor) return null;
```

Bracket-notation property access walks the full prototype chain, not just own properties. Every plain object literal inherits `Object.prototype`, which has enumerable-looking (though non-enumerable) members named `constructor`, `toString`, `valueOf`, `hasOwnProperty`, etc. I reproduced this directly against the actual implementation:

```
extractTier1Signal('constructor', { foo: 'bar' })  -> "constructor:[object Object]"
extractTier1Signal('constructor', { totallyDifferent: 1 })   -> "constructor:[object Object]"
extractTier1Signal('constructor', { completelyUnrelated: 2 }) -> "constructor:[object Object]"
extractTier1Signal('toString',   { foo: 'bar' })  -> "toString:[object Undefined]"
```

When `sourceApp === 'constructor'`, `TIER1_SIGNAL_EXTRACTORS['constructor']` resolves to the `Object` constructor function (truthy, so the `!extractor` guard doesn't fire). Calling it as `Object(sourceMetadata)` returns `sourceMetadata` unchanged (truthy, so the `!rawValue` guard doesn't fire either), and the template literal then stringifies the object via its `.toString()`, which is **always** the literal string `"[object Object]"` regardless of what's actually inside `source_metadata`. The result: **any two same-organization recordings with `source_app = 'constructor'` produce the identical tier-1 signal `"constructor:[object Object]"` no matter what their `source_metadata` actually contains**, and `findDeterministicMatches` will propose them as a merge every time. This is not a scoring miss or a rare edge case — it's a 100% collision generator, the exact "false merge... a data-exposure incident, not a blocked import" scenario the file's own header comment (lines 10-11) explicitly says this function must never produce.

This directly contradicts the function's documented and repeatedly-tested contract: "Fails CLOSED: never throws, never returns a value for a provider without a verified-safe field" (lines 116-118), and it is a real gap in the existing test matrix — `event-resolver.test.ts`'s "never throws on wildly malformed input" block (lines 73-95) exercises numbers, arrays, nested objects, and empty/whitespace strings, but never a `source_app` value that collides with an `Object.prototype` member name.

**Is this reachable in practice?** `recordings.source_app` is unconstrained `TEXT` (verified: `20260131000007_create_recordings_tables.sql` — no `CHECK` constraint restricts its values, unlike e.g. `import_routing_defaults.source_app`, which *does* have a `^[a-z0-9][a-z0-9_-]*$` regex `CHECK`). At least one live write path validates it only as `z.string().trim().min(1, "source_app is required")` with no enum/regex restriction (`supabase/functions/connector-sync-all/index.ts:99`), so a caller-supplied, non-connector-literal `source_app` reaching a `recordings` row is plausible, not purely theoretical.

**Current blast radius:** Because SAFE-01's flag gate means `runShadowSweep` returns immediately for every organization today (no `organization_feature_flags` row has `enabled=true` anywhere), this bug cannot fire in production *right now*. But the matcher code is already deployed, and the bug will silently activate — poisoning the append-only `event_match_decisions` ledger with content-independent false-positive proposals — the instant any organization is flagged, for any recording that ever carries this `source_app` value, past or future. Since that ledger is the intended input to Phase 32's precision-proof gate (per this migration's own header comment), a poisoned ledger corrupts the exact safety mechanism the roadmap is relying on to decide whether to ever turn this feature on for real.

**Fix:** Use an own-property-only lookup (or a prototype-less map) for both tables:

```ts
// Minimal fix: guard both lookups
const extractor = Object.prototype.hasOwnProperty.call(TIER1_SIGNAL_EXTRACTORS, sourceApp)
  ? TIER1_SIGNAL_EXTRACTORS[sourceApp]
  : undefined;
if (!extractor) return null;
```

```ts
// matchedField derivation (line 248) — same fix pattern
const matchedField = Object.prototype.hasOwnProperty.call(TIER1_MATCHED_FIELD_NAMES, provider)
  ? TIER1_MATCHED_FIELD_NAMES[provider]
  : provider;
```

Better still, eliminate the prototype-chain risk entirely by declaring both maps with no prototype, or by switching to `Map`:

```ts
const TIER1_SIGNAL_EXTRACTORS: Record<string, (metadata: Record<string, unknown>) => string | null> =
  Object.assign(Object.create(null), {
    zoom: (metadata: Record<string, unknown>) => { /* unchanged */ },
  });
```

Add regression coverage for `source_app` values equal to `'constructor'`, `'toString'`, `'valueOf'`, `'hasOwnProperty'`, and `'__proto__'` to `event-resolver.test.ts`'s malformed-input suite so this class of bug can't reappear silently.

**STATUS: FIXED AND REDEPLOYED (2026-09-01).** Both `TIER1_SIGNAL_EXTRACTORS` and `TIER1_MATCHED_FIELD_NAMES` now declared via `Object.assign(Object.create(null), {...})` -- the "better still" option above -- eliminating the prototype chain entirely rather than adding per-call-site `hasOwnProperty` guards. Behavior for legitimate `source_app` values (zoom) is unchanged.

Regression coverage added to `event-resolver.test.ts`:
- `extractTier1Signal` returns `null` for `source_app` in `['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__']`, each checked against two different non-empty `source_metadata` objects.
- `findDeterministicMatches` end-to-end reproduction of the exact false-merge scenario: two same-org recordings with `source_app='constructor'` and unrelated `source_metadata` no longer get proposed as a merge.

Verified: `npx vitest run supabase/functions/_shared/__tests__/event-resolver.test.ts` green (14/14, including the 2 new tests). `npm run type-check` shows 0 new errors against the 320-error baseline.

- **Commit:** `a96f1d5a` on `v2.2-event-resolution`
- **Redeployed:** `supabase functions deploy resolve-events --use-api` against confirmed production ref `vltmrnjsubfzrgrtdqey` (verified via `supabase/.temp/project-ref` before deploy). Function version bumped 1 -> 2, `ACTIVE`, deployed 2026-09-02 02:16:46 UTC per `supabase functions list`.
- **Still dormant:** SAFE-01's flag gate means `runShadowSweep` still returns immediately for every org today -- this fix closes the gap before Phase 32 flags any organization, per the blast-radius note above.

WR-01, WR-02, WR-03, and IN-01 below remain open by design -- each is confirmed dormant (no live caller / only one org ever flagged so far) and is deferred to the phase that wires a live caller or enables multi-org flagging (Plan 02 / Phase 32+), not addressed in this fix.

## Warnings

### WR-01: Sweep's driving query can starve a flagged organization once 2+ orgs are enabled

**File:** `supabase/functions/_shared/event-resolver.ts:224-230`

**Issue:** `runShadowSweep` fetches its candidate pool with a single global query across every flagged org combined:

```ts
const { data, error } = await supabase
  .from('recordings')
  .select('id, organization_id, source_app, source_metadata')
  .is('event_id', null)
  .in('organization_id', opts.flaggedOrgIds)
  .order('created_at', { ascending: true })
  .limit(batchSize);
```

`batchSize` defaults to 500 and is applied *after* the `.in('organization_id', ...)` filter, not per-org. Once two or more organizations are flagged (Phase 32+) and one flagged org has more than `batchSize` unresolved recordings older than another flagged org's oldest unresolved recording, the smaller/newer org's recordings will never appear in any sweep batch — its recordings are permanently starved out with no error, no partial coverage, and no signal that it's happening. The code comment at lines 216-223 explicitly flags that the comparison pool needs to widen in a later phase, but doesn't address per-org fairness within a shared batch limit.

Not reachable today (SAFE-01 means zero orgs are flagged), but this is a genuine latent correctness gap that will manifest silently the first time two real organizations are both onboarded onto the sweep.

**Fix:** Either fetch per-org (loop `flaggedOrgIds`, apply `batchSize` per org) or fetch a larger pool and cap proposals per org client-side, so one org's backlog can't crowd out another's.

### WR-02: `apply_event_match_atomic` / `reverse_event_match_atomic` are not idempotent under retry

**File:** `supabase/migrations/20260901000003_create_event_match_apply_reverse_rpcs.sql:60-143, 164-229`

**Issue:** `apply_event_match_atomic` never checks whether the two recordings already share an `event_id` before deciding whether to create a new event:

```sql
IF p_event_id IS NULL THEN
  INSERT INTO events (...) VALUES (...) RETURNING id INTO v_event_id;
ELSE
  v_event_id := p_event_id;
END IF;

UPDATE recordings SET event_id = v_event_id, ... WHERE id IN (p_recording_id_a, p_recording_id_b);
```

A retried call (e.g. a client timeout after the first call actually committed) with `p_event_id: null` both times creates a **second** `events` row, re-points both recordings to it, orphans the first event, and inserts a second `merge_applied` ledger row — nothing in the schema prevents duplicate `merge_applied` rows for the same pair (only `merge_proposed` rows are protected by this same migration's new partial unique index).

Symmetrically, `reverse_event_match_atomic` only checks that the *target decision's own* `decision = 'merge_applied'` — a fact about that row that never changes once written — not whether a reversal already exists for it:

```sql
IF v_decision <> 'merge_applied' THEN
  RAISE EXCEPTION 'Decision % is not an applied merge...';
END IF;
```

Calling `reverse_event_match_atomic` twice with the same `p_decision_id` succeeds both times, writing two `reversed` rows that both reference the same `reverses_decision_id`.

Neither function is reachable from any current caller (confirmed by repo-wide grep — only the direct integration test calls either RPC), so this cannot fire in production today. Flagging so it's closed before Plan 02 wires a live (admin-review or similar) caller, where network retries are a realistic trigger.

**Fix:** For apply, check `SELECT event_id FROM recordings WHERE id = p_recording_id_a` first and short-circuit (return the existing `event_id`) if both recordings already share one. For reverse, check `NOT EXISTS (SELECT 1 FROM event_match_decisions WHERE reverses_decision_id = p_decision_id)` before proceeding, and raise if a reversal already exists.

### WR-03: `apply_event_match_atomic` has no linkage back to the `merge_proposed` row it fulfills

**File:** `supabase/migrations/20260901000003_create_event_match_apply_reverse_rpcs.sql:60-67, 133-139`

**Issue:** `reverse_event_match_atomic` correctly links a reversal to the decision it undoes via `p_decision_id` → `reverses_decision_id`. `apply_event_match_atomic` has no equivalent parameter — it takes `p_recording_id_a/b`, not a decision id — so when a pair that was originally proposed by the shadow sweep (`decision='merge_proposed'`) is later applied, the original proposal row is left permanently untouched and orphaned; there is no column linking the resulting `merge_applied` row back to the `merge_proposed` row that justified it. This undercuts the auditability goal `20260901000002`'s own header comment states as this ledger's purpose (MATCH-09): "Append-only ledger recording every proposed (and, in a later phase, applied or reversed) event-resolution merge decision." Today, given identical `(recording_id_a, recording_id_b, tier)`, the two rows *can* be correlated by application-level query, but there's no DB-enforced or explicit link, unlike the reverse path.

**Fix:** Add an optional `p_source_decision_id UUID` parameter to `apply_event_match_atomic` and, when provided, either store it in a new `fulfills_decision_id` column or reuse `reverses_decision_id` semantics (rename if needed) so an applied merge can be traced back to the proposal that produced it.

## Info

### IN-01: `runShadowSweep`'s per-item fail-closed claim doesn't hold for thrown (vs. returned) errors mid-batch

**File:** `supabase/functions/_shared/event-resolver.ts:198-284`

**Issue:** The docstring states this function "fails CLOSED: skips, writes nothing for the failed item, logs, and continues with the rest of the batch" on any error. That's true for a Supabase call that *returns* `{ error }` (e.g. the per-insert `insertError` handling inside the `for` loop, which `continue`s). But the entire `for (const match of matches)` loop is nested inside the function's single outer `try`, so a genuinely *thrown* exception (e.g. a network-level failure that supabase-js throws rather than returns) partway through the loop aborts the rest of that tick's proposals rather than continuing with the remaining matches. Self-heals on the next 15-minute cron tick (nothing is lost, just delayed), so this is a documentation/implementation mismatch rather than a correctness bug — noting for precision since the docstring's claim is stronger than what the code actually guarantees.

**Fix (optional):** Wrap the per-match insert in its own `try/catch` inside the loop if the "continues with the rest of the batch" guarantee needs to hold for thrown errors too, not just returned ones.

---

_Reviewed: 2026-09-01T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
