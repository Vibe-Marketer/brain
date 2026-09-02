---
phase: 32-match-rule-hardening-provider-agnostic-matcher
plan: 01
subsystem: backend
tags: [dedup, matcher, event-resolution, rls, security-invoker, vitest, deno]

# Dependency graph
requires:
  - phase: 31-deterministic-resolution-shadow-mode-only
    provides: event-resolver.ts's tier-1 matcher, event_match_decisions ledger, TIER1_SIGNAL_EXTRACTORS pattern to extend
provides:
  - Hardened checkMatch (mandatory nonzero-time-overlap gate) closing the live F5 false-merge bug
  - dedup-fingerprint.ts's first-ever dedicated unit test file
  - shouldSuppressTitleSignal + RECURRING_TITLE_OCCURRENCE_THRESHOLD primitive in event-resolver.ts for Plan 02's metadata tier
  - Corrective TEST-applied migration for recurring_call_titles' regressed security_invoker (prod apply queued for Plan 04)
affects: [32-02-metadata-tier-matcher, 32-04-guarded-prod-apply]

# Tech tracking
tech-stack:
  added: [fastest-levenshtein@1.0.16 (devDependency, test-time-only)]
  patterns: ["Vitest resolve.alias for Deno-edge-function modules with runtime (non-type-only) esm.sh imports, as an alternative to the .deno.test.ts convention when the module is pure-function/DB-free and the plan's verification contract locks to `npx vitest run`"]

key-files:
  created:
    - supabase/functions/_shared/__tests__/dedup-fingerprint.test.ts
    - supabase/migrations/20260902000001_recurring_call_titles_security_invoker.sql
  modified:
    - supabase/functions/_shared/dedup-fingerprint.ts
    - supabase/functions/_shared/event-resolver.ts
    - supabase/functions/_shared/__tests__/event-resolver.test.ts
    - vitest.config.ts
    - package.json

key-decisions:
  - "Fixed checkMatch's isMatch to `timeOverlap > 0 && criteriaMetCount >= 2` (was `criteriaMetCount >= 2` alone) -- closes F5 inside the function, caller (zoom-webhook/index.ts) byte-unchanged"
  - "Rule 3 (blocking): added a scoped vitest.config.ts resolve.alias (exact esm.sh URL -> npm package) + fastest-levenshtein@1.0.16 devDependency to make dedup-fingerprint.ts's pure functions collectible under Vitest's Node ESM loader, which cannot resolve https: URLs -- zero production impact, the Deno edge function still resolves the identical pinned esm.sh URL at deploy time"
  - "Live prod introspection confirmed recurring_call_titles.reloptions=NULL (security_invoker absent, T-32-05 realized) -- authored a corrective ALTER VIEW migration, applied to TEST only per the plan's explicit scope; prod re-verified unchanged/still regressed after the TEST push, prod apply queued for Plan 04"
  - "13 pre-existing full-suite test failures (5 files: admin UI x3, rpc-type-smoke, mcp-server JWT auth) confirmed unrelated to this plan's changes and logged to deferred-items.md rather than fixed -- scope boundary"

requirements-completed: [MATCH-04, MATCH-05]

coverage:
  - id: D1
    description: "checkMatch gains a mandatory nonzero-time-overlap gate, closing the live F5 false-merge bug inside the function (caller unedited)"
    requirement: "MATCH-04"
    verification:
      - kind: unit
        ref: "supabase/functions/_shared/__tests__/dedup-fingerprint.test.ts (5 tests: RED anchor, preserved-match, necessary-not-sufficient, reporting-intact, boundary)"
        status: pass
    human_judgment: false
  - id: D2
    description: "shouldSuppressTitleSignal + RECURRING_TITLE_OCCURRENCE_THRESHOLD pure predicate added to event-resolver.ts for the metadata tier (Plan 02) to consume"
    requirement: "MATCH-05"
    verification:
      - kind: unit
        ref: "supabase/functions/_shared/__tests__/event-resolver.test.ts#event-resolver: shouldSuppressTitleSignal (MATCH-05) (5 new tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Live recurring_call_titles view security_invoker state verified against production; regression found and repaired on TEST (prod apply deferred to Plan 04)"
    requirement: "MATCH-05"
    verification:
      - kind: manual_procedural
        ref: "supabase db query --linked \"select relname, reloptions from pg_class where relname = 'recurring_call_titles';\" -- run against prod (before: reloptions=null) and TEST (after migration: reloptions=[security_invoker=true]); prod re-checked unchanged after the TEST push"
        status: pass
    human_judgment: false
  - id: D4
    description: "zoom-webhook/index.ts and zoom-sync-meetings/index.ts remain byte-unchanged across the whole plan (MATCH-06 preserve-don't-delete)"
    verification:
      - kind: other
        ref: "git diff --stat 7d2d620a..c47b95ea -- supabase/functions/zoom-webhook/index.ts supabase/functions/zoom-sync-meetings/index.ts (empty output)"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-09-02
status: complete
---

# Phase 32 Plan 01: Match-Rule Hardening + Recurring-Title Suppression Summary

**checkMatch now hard-gates on `timeOverlap > 0` closing the live F5 recurring-meeting false-merge bug; shouldSuppressTitleSignal primitive added for Plan 02; live-prod security_invoker regression on recurring_call_titles found and repaired on TEST**

## Performance

- **Duration:** 10 min
- **Started:** 2026-09-02T09:37:35Z
- **Completed:** 2026-09-02T09:47:24Z
- **Tasks:** 2
- **Files modified:** 8 (2 source, 2 test, 1 new migration, vitest.config.ts, package.json, package-lock.json)

## Accomplishments
- Closed the live F5 false-merge bug: `checkMatch` in `dedup-fingerprint.ts` now requires `timeOverlap > 0` as an absolute, independent gate on top of the existing 2-of-3 criteria count -- two occurrences of the same recurring meeting (identical title + participants, zero time overlap) no longer merge
- Wrote `dedup-fingerprint.ts`'s first-ever dedicated unit test file (5 tests, RED->GREEN proven: 3 flipped from failing to passing after the fix, 2 preserved-behavior tests passed throughout)
- Added `shouldSuppressTitleSignal` + `RECURRING_TITLE_OCCURRENCE_THRESHOLD` (default 3) to `event-resolver.ts` -- a pure, DB-free, fail-closed predicate the Plan 02 metadata tier will consume to suppress title-similarity signal for titles that recur too often to be distinguishing
- Discovered and repaired a real, live production RLS-bypass regression: `recurring_call_titles`'s `security_invoker` option was silently dropped by a prior migration (20260310125000's `DROP VIEW`/`CREATE OR REPLACE VIEW` UUID-join redefinition), reintroducing the exact cross-user-disclosure class `20260305000001_fix_view_rls_bypass.sql` already fixed once. Corrective migration authored, verified applied on TEST; prod apply queued for Plan 04 per this plan's locked scope

## Task Commits

Each task was committed atomically (Task 1 as TDD RED/GREEN, Task 2 as one commit):

1. **Task 1 RED: dedup-fingerprint.test.ts (F5 anchor)** - `daf9aba` (test)
2. **Task 1 GREEN: harden checkMatch** - `12e3098` (feat)
3. **Task 2: shouldSuppressTitleSignal + security_invoker repair** - `c47b95e` (feat)

**Plan metadata:** (this commit, following SUMMARY.md write)

## Files Created/Modified
- `supabase/functions/_shared/dedup-fingerprint.ts` - `checkMatch`'s `isMatch` now `timeOverlap > 0 && criteriaMetCount >= 2`
- `supabase/functions/_shared/__tests__/dedup-fingerprint.test.ts` - new: 5 unit tests pinning the F5 fix
- `supabase/functions/_shared/event-resolver.ts` - added `shouldSuppressTitleSignal` + `RECURRING_TITLE_OCCURRENCE_THRESHOLD`
- `supabase/functions/_shared/__tests__/event-resolver.test.ts` - 5 new unit tests for the suppression predicate
- `supabase/migrations/20260902000001_recurring_call_titles_security_invoker.sql` - new: `ALTER VIEW ... SET (security_invoker = true)`, TEST-applied only
- `vitest.config.ts` - scoped `resolve.alias` for the one esm.sh URL dedup-fingerprint.ts imports at runtime
- `package.json` / `package-lock.json` - `fastest-levenshtein@1.0.16` devDependency (test-time-only)

## Live `recurring_call_titles` security_invoker verification (verbatim, per plan `<output>` requirement)

**Prod (`vltmrnjsubfzrgrtdqey`), BEFORE the TEST-only migration:**
```
select relname, reloptions from pg_class where relname = 'recurring_call_titles';
{
  "rows": [ { "relname": "recurring_call_titles", "reloptions": null } ]
}
```
`reloptions: null` -- `security_invoker` is ABSENT. Confirms T-32-05: the view regressed after `20260310125000`'s UUID-join redefinition dropped the option `20260305000001_fix_view_rls_bypass.sql` originally added.

**TEST (`swjzxiddcrtaqixsfaac`), AFTER applying `20260902000001_recurring_call_titles_security_invoker.sql`:**
```
{
  "rows": [ { "relname": "recurring_call_titles", "reloptions": ["security_invoker=true"] } ]
}
```
Repaired and confirmed on TEST.

**Prod, final safety check (re-run after the TEST push, to prove prod was NOT touched):**
```
{
  "rows": [ { "relname": "recurring_call_titles", "reloptions": null } ]
}
```
Unchanged -- prod remains regressed, exactly as scoped. Prod apply is queued for Plan 04's guarded apply step, not this plan.

## Decisions Made
- `checkMatch`'s new gate is `timeOverlap > 0`, strictly greater than zero, independent of `MATCH_THRESHOLDS.time_overlap` (0.50, unchanged, still the 2-of-3 threshold) -- matches MATCH-04's locked "mandatory nonzero-time-overlap guard, inside the function" design exactly.
- `shouldSuppressTitleSignal` fails closed toward NOT-suppressed (returns `false`) for null/undefined/NaN/negative occurrence counts, so a missing count from the metadata tier's `recurring_call_titles` read can never accidentally suppress a real match signal.
- The corrective migration was scoped to TEST-only in this plan per the plan's own explicit branching instruction ("apply it to TEST only in this plan, and note it for Plan 04's prod apply") -- not a deviation, the plan's designed conditional path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] dedup-fingerprint.ts's runtime esm.sh import is unresolvable by Vitest's Node ESM loader**
- **Found during:** Task 1, first `npx vitest run` attempt against the newly-written test file
- **Issue:** `dedup-fingerprint.ts` imports `distance` from `'https://esm.sh/fastest-levenshtein@1.0.16'` as a runtime (non-type-only) value import -- unlike `event-resolver.ts`'s type-only Supabase import, this actually needs to resolve at module-load time. Vitest's Node ESM loader throws `Only URLs with a scheme in: file and data are supported`. The codebase's own established, documented answer to this (per `vitest.config.ts`'s comment and 3 existing precedent files) is the `.deno.test.ts` suffix + `deno test`, run outside `npm test`/CI -- but the plan's own `<verify>` locks to `npx vitest run supabase/functions/_shared/__tests__/dedup-fingerprint.test.ts` and the frontmatter artifact path is `.test.ts`, not `.deno.test.ts`. Since this module is pure-function/DB-free (no `Deno.serve`, no env vars, no Deno-specific runtime behavior unlike the existing `.deno.test.ts` precedents), a scoped Vite alias was the better fit for the plan's literal, explicit contract.
- **Fix:** Verified `fastest-levenshtein@1.0.16` is a legitimate, exact-matching published npm package (`npm view`), installed it as a devDependency, and added one exact-string `resolve.alias` entry in `vitest.config.ts` mapping the precise esm.sh URL to the npm package name. The Deno edge function's own import statement is completely untouched -- it still resolves the identical pinned esm.sh URL at deploy/runtime, unaffected by this test-time-only Vite resolution graph change.
- **Files modified:** `vitest.config.ts`, `package.json`, `package-lock.json`
- **Verification:** `npx vitest run supabase/functions/_shared/__tests__/dedup-fingerprint.test.ts` now collects and runs all 5 tests (RED: 3/5 fail against the pre-fix bug; GREEN: 5/5 pass after the fix)
- **Committed in:** `daf9aba` (RED commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to make the plan's own explicit `<verify>` command and artifact path actually work for a module with a runtime esm.sh import; zero production behavior change. No scope creep beyond test-time tooling.

## Issues Encountered
- Full-suite `npx vitest run` (plan-level verification) surfaced 13 pre-existing failures across 5 files (admin UI components, `rpc-type-smoke.test.ts`, `mcp-server/__tests__/sec-jwt-fix.test.ts`) that do not import or depend on either file this plan modified. Confirmed unrelated and logged to `.planning/phases/32-match-rule-hardening-provider-agnostic-matcher/deferred-items.md` per the scope-boundary rule rather than fixed. The two Phase-32-specific test files (`dedup-fingerprint.test.ts`, `event-resolver.test.ts`) both pass cleanly (24/24) both individually and within the full-suite run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `checkMatch` is hardened and tested but NOT yet deployed -- `dedup-fingerprint.ts` bundles into `zoom-webhook`/`zoom-sync-meetings` only at Plan 04's guarded apply step. The live F5 bug remains active in production until then.
- `shouldSuppressTitleSignal` + `RECURRING_TITLE_OCCURRENCE_THRESHOLD` are ready for Plan 02's metadata tier to import and consume against `recurring_call_titles.occurrence_count`.
- The `recurring_call_titles` security_invoker repair is proven safe on TEST; Plan 04 must include `20260902000001_recurring_call_titles_security_invoker.sql` in its guarded prod-apply migration set (it is currently the newest unpushed-to-prod migration).
- 13 pre-existing, unrelated test failures logged in `deferred-items.md` remain open for a future triage pass -- not a blocker for Plan 02.

---
*Phase: 32-match-rule-hardening-provider-agnostic-matcher*
*Completed: 2026-09-02*

## Self-Check: PASSED

- FOUND: `supabase/functions/_shared/__tests__/dedup-fingerprint.test.ts`
- FOUND: `supabase/migrations/20260902000001_recurring_call_titles_security_invoker.sql`
- FOUND: commit `daf9aba` (test: RED)
- FOUND: commit `12e3098` (feat: GREEN, checkMatch gate)
- FOUND: commit `c47b95e` (feat: suppression primitive + security_invoker repair)
