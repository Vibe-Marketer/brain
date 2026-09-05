---
phase: 34-identity-consolidation
plan: 04
subsystem: database
tags: [supabase-edge-functions, identity-resolution, pure-functions, tdd, security-by-construction]

# Dependency graph
requires:
  - phase: 34-identity-consolidation
    provides: "Plan 02's identities/identity_aliases tables + identity_id columns live on TEST, and Plan 01's reader-inventory.md confirming no existing column stores a provider-participant-id"
  - phase: 31-event-resolution-shadow-mode
    provides: "resolve-events/index.ts + _shared/event-resolver.ts precedent (shared-secret gate, pure-module delegation, forward-only edge function shape) mirrored here"
provides:
  - "Pure, unit-tested identity-matching module (_shared/identity-resolver.ts): resolveByVerifiedEmail, resolveByProviderParticipantId, evaluateDisplayNameCandidate, resolveRow"
  - "IDENT-02's core guarantee enforced by construction: DisplayNameCandidate's return type pins identity_id to the literal type `null` and verified to the literal type `false` -- a display-name match cannot be coerced into a linking shape"
  - "resolve-identities edge function: forward-only, shared-secret gated, deployable but not yet deployed (deferred to Plan 07) or scheduled (trigger/cron wiring out of scope)"
affects: [34-05-PLAN, 34-06-PLAN, 34-07-PLAN, 35-speaker-resolution, 39-discovery-and-claim]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Structural (type-level) enforcement of a negative security guarantee: instead of relying on a runtime check or code-review convention to keep a weak signal (display-name) from ever setting an FK, the return type itself uses TypeScript literal types (`identity_id: null`, `verified: false`) so the invariant is a compile-time property of the function's signature, not just its current implementation"
    - "resolveRow precedence pattern: try strong evidence first (email, then provider-id); only fall through to recording a non-linking weak-signal candidate if NEITHER strong match fires -- the two outcomes (identity_id set vs. displayNameCandidate present) are mutually exclusive by construction, never both populated"

key-files:
  created:
    - supabase/functions/_shared/__tests__/identity-resolver.test.ts
    - supabase/functions/_shared/identity-resolver.ts
    - supabase/functions/resolve-identities/index.ts
  modified: []

key-decisions:
  - "Display-name candidates are tallied in the response summary, NOT persisted to identity_aliases: identity_aliases.identity_id is NOT NULL (Plan 02's schema) and identity creation is lazy (email/provider-id only, per Plan 01's locked design) -- a display-name-only row with no other evidence has no identity_id to attach candidate evidence to, and manufacturing one from a name match would be a backdoor around IDENT-02's own guarantee. This is stricter than the plan's literal 'upsert an unverified display_name candidate alias' wording, not a shortcut around it -- documented as a Rule 3 (blocking issue) resolution below."
  - "Provider-participant-id matching is implemented and unit-proven but has no live source column on any of the three candidate tables today (reader-inventory.md's 'Match sites for the resolver' table: 'No existing column on any of the three tables stores a provider participant ID'). The edge function calls resolveRow with providerParticipantId always undefined for now -- forward-compatible plumbing, not dead code: the pure function contract, unit tests, and edge-function wiring are all already correct for the day a future migration adds such a column."
  - "Default forward-only cutover set to 2026-09-05T14:00:00Z -- Plan 02's migration (20260905140000_create_identities_and_link_tables.sql) timestamp, i.e. the exact moment identity_id started existing as a column on TEST. Rows created before this moment are never swept by the default; callers may pass an explicit `since` to move the cutover forward."
  - "No normalization applied to provider-participant-id values (unlike email's lower(trim)): provider IDs are opaque platform-issued identifiers, not human-typed text, so case-folding could itself manufacture a false match between two genuinely distinct provider-issued IDs."

patterns-established:
  - "Pattern: when a plan's literal instruction ('upsert a candidate alias') conflicts with a locked prior-plan schema constraint (NOT NULL FK) and a locked prior-plan design principle (lazy identity creation), resolve toward the STRICTER guarantee (no persistence rather than inventing a workaround) and document the reasoning inline in both the code and the SUMMARY, rather than silently loosening the schema or the design principle to fit the instruction's letter."

requirements-completed: [IDENT-02]

# Metrics
duration: ~15min
completed: 2026-09-05
---

# Phase 34 Plan 04: Pure Identity Resolver (Verified Email + Provider-ID Only) Summary

**A pure, unit-tested matching module where the never-auto-link-on-display-name-alone guarantee is enforced by TypeScript's type system (not just a runtime check), wrapped in a forward-only resolve-identities edge function that mirrors resolve-events' shared-secret architecture -- 17/17 unit tests green, deployable but inert until Plan 07 wires deploy + Plan 07/operational follow-on wires a trigger**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-05T17:00:00-04:00 (approx.)
- **Completed:** 2026-09-05T17:05:50-04:00
- **Tasks:** 3 (all `type="auto"`, TDD RED -> GREEN -> wrap)
- **Files modified:** 3 (all new: test file, pure module, edge function)

## Accomplishments

- Authored `supabase/functions/_shared/__tests__/identity-resolver.test.ts` as a RED unit suite (confirmed failing via `Failed to resolve import "../identity-resolver.ts"` before the module existed) covering: case-normalized verified-email matching (including mixed-case/whitespace-padded input on both the candidate and the stored-alias side, per Assumption A1), exact provider-id+provider matching, unverified-alias rejection for both email and provider-id, and the centerpiece negative test suite for `evaluateDisplayNameCandidate`/`resolveRow`.
- Authored `supabase/functions/_shared/identity-resolver.ts`, making all 17 unit tests GREEN. The IDENT-02 guarantee is enforced by construction: `DisplayNameCandidate.identity_id` is typed as the literal `null` (not `string | null`) and `verified` as the literal `false` (not `boolean`) -- it is a compile-time error, not just a runtime convention, to make this shape carry a link. `resolveRow` never populates both `identity_id` and `displayNameCandidate` on the same result.
- Authored `supabase/functions/resolve-identities/index.ts`, mirroring `resolve-events/index.ts`'s shape exactly: `X-Reconcile-Secret` gate before any DB work, Zod-validated `{ mode: 'forward', since? }` body, service-role client, forward-only sweep (`identity_id IS NULL AND created_at >= since`) across `speakers`/`contacts`/`call_participants`, delegating every match decision to the pure module. Confirmed via grep that the file contains `RECONCILE_SECRET`/`X-Reconcile-Secret`/`identity_id` and contains no reference to the auth user store.
- Ran `npm run type-check`: `0 new errors, 320/320 baseline` -- the new Deno-esm-import edge function introduced no new type-check regressions.
- Resolved a real tension between the plan's literal wording ("upsert an unverified display_name candidate alias") and Plan 02's locked schema (`identity_aliases.identity_id NOT NULL`) plus Plan 01's locked lazy-identity-creation design, by tallying display-name signals in the response summary rather than persisting them nowhere-to-attach-to (see Deviations below) -- this is a stricter reading of IDENT-02, not a looser one.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave-0 scaffold — failing resolver unit tests (incl. the never-link-on-name negative test)** - `6ee783eb` (test, RED confirmed)
2. **Task 2: Pure matching module identity-resolver.ts (make the unit tests green)** - `0d354dbd` (feat, GREEN confirmed: 17/17 tests)
3. **Task 3: resolve-identities edge function (forward-only, shared-secret gated)** - `b379dbe4` (feat)

**Plan metadata:** committed alongside this SUMMARY (docs: complete plan)

## Files Created/Modified

- `supabase/functions/_shared/__tests__/identity-resolver.test.ts` - 17 unit tests: verified-email case-normalization, provider-id exact match, unverified-alias rejection, and the centerpiece never-link-on-display-name negative tests (including "resolveRow ends with identity_id unset when the ONLY signal is a display-name match, even an exact-string match to a real identity's name")
- `supabase/functions/_shared/identity-resolver.ts` - Pure matching module: `resolveByVerifiedEmail`, `resolveByProviderParticipantId`, `evaluateDisplayNameCandidate` (structurally non-linking), `resolveRow` (precedence + never-conflate contract), plus `EmailAliasRecord`/`ProviderAliasRecord`/`DisplayNameCandidate`/`CandidateRow`/`ResolveRowResult` types and `normalizeEmail`
- `supabase/functions/resolve-identities/index.ts` - Forward-only, shared-secret-gated edge function: loads verified aliases, sweeps the three candidate tables for `identity_id IS NULL` rows since a cutover, links via the pure module, tallies (never persists) display-name signals

## Decisions Made

**Display-name candidates are tallied, not persisted, to identity_aliases.** See `key-decisions` in frontmatter for the full reasoning: `identity_aliases.identity_id` is `NOT NULL` (verified directly in `supabase/migrations/20260905140000_create_identities_and_link_tables.sql` line 58) and identity creation is lazy (email/provider-id only, per Plan 01's locked design, Open Question #2's accepted recommendation) -- there is structurally no identity to attach a display-name-only candidate to. Tallying in the response summary preserves full observability of how often the display-name path fires without inventing a write target that would either violate the NOT NULL constraint or require manufacturing a new identity from a name alone (the exact backdoor IDENT-02 forbids).

**Provider-participant-id matching ships as verified, forward-compatible plumbing with no live data source yet.** Confirmed against `reader-inventory.md`'s "Match sites for the resolver" table (Plan 01): none of `speakers`/`contacts`/`call_participants` has a column storing a provider participant ID today (`call_participants.sources` is source *names*, not a participant ID). `resolveByProviderParticipantId` and its unit tests are complete and correct; the edge function's per-row call passes `providerParticipantId: undefined` until a future migration adds a real source column -- at that point, only the edge function's row-shape mapping needs to change, not the pure module or its tests.

**Cutover default: `2026-09-05T14:00:00Z`**, the exact timestamp of Plan 02's migration filename (`20260905140000_...`) -- the moment `identity_id` began existing as a column on TEST. Rows created before this instant are structurally guaranteed to have `identity_id IS NULL` already (the column didn't exist), but are excluded from the default sweep window regardless, keeping the "forward-only, no historical backfill" philosophy explicit and inspectable rather than incidental.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Display-name candidate NOT persisted to identity_aliases as the plan's action text literally describes**
- **Found during:** Task 3 (authoring resolve-identities/index.ts)
- **Issue:** The plan's Task 3 action block says "on a display-name-only signal, upsert an unverified display_name candidate alias and leave identity_id NULL." `identity_aliases.identity_id` is `NOT NULL REFERENCES identities(id)` (Plan 02's schema, confirmed by direct migration read) and identity creation is lazy/email-or-provider-id-only (Plan 01's locked design) -- there is no valid `identity_id` to satisfy the NOT NULL constraint for a row whose only signal is an unresolved display name.
- **Fix:** The resolver still evaluates `evaluateDisplayNameCandidate` for every non-linking row (the pure function is fully exercised and unit-proven) and tallies the result in the edge function's response summary (`displayNameCandidates` count), but does not attempt a DB write that would either violate the schema or require inventing an identity from a name match alone.
- **Files modified:** `supabase/functions/resolve-identities/index.ts` (inline comment documents the reasoning at the write site)
- **Verification:** Manual review confirms no code path writes to `identity_aliases` from this function at all; `grep -c "identity_aliases" supabase/functions/resolve-identities/index.ts` shows only the read (alias-loading) call site.
- **Committed in:** `b379dbe4` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3, blocking issue -- schema/design-constraint conflict with the plan's literal wording, resolved toward the stricter guarantee)
**Impact on plan:** No scope creep. IDENT-02's core guarantee (never auto-link, never even indirectly enable a name-driven identity) is preserved more strictly than the plan's literal text required. No migration was authored (as the plan specifies -- this plan consumes Plan 02's schema, it does not extend it).

## Issues Encountered

None beyond the deviation documented above. `rtk proxy grep` was used (not the RTK-wrapped `grep`) for multi-match reader-inventory.md lookups, per the pattern already flagged in 34-01-SUMMARY.md's Issues Encountered section, to avoid truncated/summarized grep output on this session's investigation of the provider-participant-id column question.

## User Setup Required

None. `RECONCILE_SECRET` is already configured (it gates `resolve-events`/`fathom-reconcile` in production and TEST today) -- no new secret is introduced.

## Next Phase Readiness

- Plan 05/06 (UI: verified-emails settings section, evidence popover) can proceed independently -- this plan touches no frontend code and no migration.
- Plan 07 (prod apply) has a clean, isolated new edge function to deploy (`resolve-identities --use-api --no-verify-jwt`) once the identity spine itself is applied to prod; no new secret to provision.
- **Flag for whoever wires the trigger/cron (operational follow-on, explicitly out of this plan's scope):** `resolve-identities` currently must be invoked manually (e.g., via `curl` with the `X-Reconcile-Secret` header) to run a sweep -- it has no scheduled trigger, exactly mirroring `resolve-events`'s state before Phase 32 wired its cron. When that follow-on work happens, it should also reconsider whether `since` should track a persisted watermark (e.g., a settings-table row) rather than always defaulting to the fixed Plan 02 migration timestamp, so repeated invocations don't rescan the entire growing window from a fixed point.
- **Flag for whoever adds a provider-participant-id column to any of the three tables:** `resolveByProviderParticipantId`/`resolveRow` are already correct and unit-tested for this; only `resolve-identities/index.ts`'s per-row `CandidateRowShape` mapping (currently `providerParticipantId` always undefined) needs to read the new column.
- No blockers.

---
*Phase: 34-identity-consolidation*
*Completed: 2026-09-05*

## Self-Check: PASSED

- FOUND: `supabase/functions/_shared/__tests__/identity-resolver.test.ts`
- FOUND: `supabase/functions/_shared/identity-resolver.ts`
- FOUND: `supabase/functions/resolve-identities/index.ts`
- FOUND: `.planning/phases/34-identity-consolidation/34-04-SUMMARY.md`
- FOUND commit: `6ee783eb`
- FOUND commit: `0d354dbd`
- FOUND commit: `b379dbe4`
