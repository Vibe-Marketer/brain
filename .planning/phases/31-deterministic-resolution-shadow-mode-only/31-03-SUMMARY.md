---
phase: 31-deterministic-resolution-shadow-mode-only
plan: 03
subsystem: testing
tags: [postgres, rls, supabase, vitest, deterministic-matching, shadow-mode, ci-gate]

# Dependency graph
requires:
  - phase: 31-01
    provides: event_match_decisions + organization_feature_flags tables, live on TEST with RLS enabled + forced and no client policy (deny-by-default)
provides:
  - CLIENT_DENY_TABLES registration for event_match_decisions and organization_feature_flags, with an explanatory comment on why they belong there and not CROSS_ORG_TABLES
  - A bespoke seed+assert isolation block (mirrors the existing `events` block) proving an authenticated JWT reads zero rows from either table even when a service-role-seeded row genuinely exists
  - BESPOKE_CLIENT_DENY_TABLES skip-set pattern for deny-tables whose seed shape the generic single-PK loop cannot produce
affects: [31-04-prod-apply-and-cron]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BESPOKE_CLIENT_DENY_TABLES: a deny-table is still registered in CLIENT_DENY_TABLES (the canonical registry, satisfies the file's own documentation contract) but the generic loop skips it via a Set lookup when its seed needs multi-column FK parents the loop's single-PK insert cannot produce -- the bespoke it() blocks elsewhere in the file do the real seed+assert"

key-files:
  created: []
  modified:
    - src/test/rls-regression.test.ts
    - .planning/phases/31-deterministic-resolution-shadow-mode-only/deferred-items.md

key-decisions:
  - "Tested the deny assertion from BOTH clientA and clientB (not just clientA as the plan's action text literally names), mirroring the existing generic CLIENT_DENY_TABLES loop's own dual-client rigor -- stronger proof that the deny holds for any authenticated JWT, not just one org's, with zero extra seeding cost"
  - "Sorted the two Org-A recording UUIDs at runtime ([recordingAId, recordingA2Id].sort()) to satisfy the DB's recording_id_a < recording_id_b CHECK constraint -- JS lexicographic string comparison of canonical lowercase-hyphenated UUID text matches Postgres's native byte-wise uuid comparison, verified against the live migration's CHECK constraint text before relying on it"
  - "Added an explicit service-role existence-proof assertion (T-31-03-03 in this plan's own threat model) before the zero-row client assertions, so the deny proof cannot pass merely because the table is empty -- the generic CLIENT_DENY_TABLES loop implicitly relies on the same guarantee via its seed step but never asserts it; this plan's bespoke block asserts it explicitly"
  - "Root-caused (not just observed) a pre-existing, unrelated organizations-cleanup gap in this same file's own afterAll: 90 orphaned test orgs on TEST predating this plan by ~3 months, caused by interrupted test runs never reaching afterAll (agent timeouts/Ctrl-C/crashes), not a logic bug in the delete call itself (a direct manual re-delete of this plan's own 6 verification-run orgs succeeded immediately with no error). cleanup_test_fixture_users has no organizations sweep since organizations has no direct FK to auth.users. Logged to deferred-items.md, not fixed (Scope Boundary rule -- unrelated to the CLIENT_DENY_TABLES registration this plan's task asked for)"

patterns-established:
  - "Bespoke deny-table isolation block: for a service-role-only table needing FK parents the generic CLIENT_DENY_TABLES loop can't seed, register the table name in the array (documentation contract) + add it to BESPOKE_CLIENT_DENY_TABLES (generic-loop skip) + write a dedicated seed-in-beforeAll / assert-in-its() / cleanup-in-afterAll block, mirroring the events block precedent"

requirements-completed: [MATCH-09, SAFE-01]

coverage:
  - id: D1
    description: "event_match_decisions is registered as a client-deny table: an authenticated JWT reads ZERO rows even when the service role has seeded a real row"
    requirement: "MATCH-09"
    verification:
      - kind: integration
        ref: "src/test/rls-regression.test.ts#authenticated JWTs cannot read the service-role-seeded event_match_decisions row"
        status: pass
    human_judgment: false
  - id: D2
    description: "organization_feature_flags is registered as a client-deny table: an authenticated JWT reads ZERO rows even when the service role has seeded a row"
    requirement: "SAFE-01"
    verification:
      - kind: integration
        ref: "src/test/rls-regression.test.ts#authenticated JWTs cannot read the service-role-seeded organization_feature_flags row"
        status: pass
    human_judgment: false
  - id: D3
    description: "The registration lives in the CI-enforced rls-regression suite (same file/job the CI gate already runs) so a future permissive-policy mistake fails the build; the service role's own visibility into both seeded rows is asserted first so the deny proof cannot be an empty-table false pass"
    verification:
      - kind: integration
        ref: "src/test/rls-regression.test.ts#service role sees the seeded event_match_decisions and organization_feature_flags rows (existence proof, T-31-03-03)"
        status: pass
      - kind: other
        ref: "Full suite: npx vitest run src/test/rls-regression.test.ts -- 53/53 passed, run 3x consecutively against TEST"
        status: pass
    human_judgment: false

# Metrics
duration: ~35min
completed: 2026-09-01
status: complete
---

# Phase 31 Plan 03: Client-Deny Registration for event_match_decisions + organization_feature_flags Summary

**Both new backend-control tables (the merge-decision ledger and the per-org enable flag) are now wired into the CI-enforced `rls-regression.test.ts` cross-org isolation suite via a bespoke seed+assert block, proving from real signed-in JWTs against TEST that a client reads zero rows from either even when a service-role-seeded row genuinely exists — no migration, no db push, 53/53 tests green.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-09-01
- **Tasks:** 1
- **Files modified:** 2 (`src/test/rls-regression.test.ts`, `deferred-items.md`)

## Accomplishments

- Registered `event_match_decisions` and `organization_feature_flags` in `CLIENT_DENY_TABLES` with an explanatory comment on why they're deny-tables (backend-control: ledger + enable flag) and why they don't join `CROSS_ORG_TABLES` (no org-scoping pivot column, per 31-RESEARCH.md Pitfall 3)
- Added a `BESPOKE_CLIENT_DENY_TABLES` skip-set so the existing generic `CLIENT_DENY_TABLES` loop (whose seed shape is `fathom_calls_orphan_report`-specific — a single BIGINT PK) doesn't attempt to seed either new table with the wrong columns
- Added a bespoke seed+assert isolation block (mirrors the existing `events` block): seeds a second Org-A recording, one `event_match_decisions` row (`recording_id_a < recording_id_b`, computed via runtime UUID sort), and one `organization_feature_flags` row via service-role in `beforeAll`; asserts the service role sees both seeded rows first (existence proof, satisfies this plan's own T-31-03-03 threat-model mitigation), then asserts BOTH `clientA` and `clientB` read zero rows from each table
- Extended `afterAll` to explicitly delete both new fixtures plus the extra recording, and confirmed empirically (not just via code review) that this leaves TEST byte-for-byte clean: ran the full suite 3 times against TEST and queried `event_match_decisions`/`organization_feature_flags`/`recordings` directly after each run — 0 rows every time
- Along the way, root-caused (with a direct empirical test, not just a hypothesis) a pre-existing, unrelated gap in this same file's own `organizations` cleanup step — 90 orphaned test orgs dating back to 2026-06-11, caused by interrupted historical test runs never reaching `afterAll`, not a logic bug in the delete call itself. Logged to `deferred-items.md`, left unfixed (out of scope), and swept only the 6 orgs this plan's own verification runs added (courtesy cleanup, not a fix)

## Task Commits

Single task, committed atomically:

1. **Task 1: Register both new tables as client-deny and prove zero-row reads from an authenticated JWT** - `a25231b` (test)

**Plan metadata:** (this commit, immediately following)

## Files Created/Modified

- `src/test/rls-regression.test.ts` - `CLIENT_DENY_TABLES` gains both tables + comment; new `BESPOKE_CLIENT_DENY_TABLES` skip-set; generic loop skips bespoke-handled tables; `beforeAll` step 5f seeds the FK-parent fixtures; bespoke isolation block (3 `it()`s: existence proof, `event_match_decisions` deny, `organization_feature_flags` deny) placed after the existing `events` block; `afterAll` cleanup extended for the new fixtures
- `.planning/phases/31-deterministic-resolution-shadow-mode-only/deferred-items.md` - Logged the pre-existing `organizations` cleanup gap found while verifying this plan's changes

## Decisions Made

- **Bespoke block, not the generic loop, for both new tables.** The generic `CLIENT_DENY_TABLES` loop's seed step inserts `{ fathom_call_id, recording_id_bigint }` — a shape specific to `fathom_calls_orphan_report`. `event_match_decisions` needs two distinct recordings satisfying a `CHECK (recording_id_a < recording_id_b)` constraint; `organization_feature_flags` needs an organization. Neither fits the generic shape, so both tables are registered in the array (for the documentation/registry contract and the plan's literal acceptance grep) but skipped by the loop via `BESPOKE_CLIENT_DENY_TABLES`, with the real seed+assert living in a dedicated block mirroring the file's own `events` precedent — exactly what 31-RESEARCH.md Pitfall 3 and this plan's `<interfaces>` note prescribed.
- **Tested both clientA and clientB**, not just clientA as the plan's action text literally illustrates. The generic deny loop already does this (loops `["A", clientA], ["B", clientB]`), and a deny table should be invisible to any authenticated JWT regardless of org — testing both is strictly more rigorous at zero extra seeding cost, so this stays faithful to the plan's intent (registering a real, universal deny guarantee) rather than its narrowest literal reading.
- **UUID ordering via runtime `.sort()`.** Read the live migration's `CONSTRAINT event_match_decisions_pair_ordered CHECK (recording_id_a < recording_id_b)` before writing the seed code, then verified that default JS string sort on two canonical lowercase-hyphenated UUID strings produces the same ordering as Postgres's native byte-wise `uuid` comparison (hyphens sit at identical fixed positions in both strings, and hex-digit ASCII ordering matches byte-value ordering) — avoids a flaky test that fails ~50% of the time depending on `gen_random_uuid()` output order.
- **Explicit existence-proof assertion**, beyond what the plan's literal acceptance criteria's automated grep checks for, because this plan's own threat model (T-31-03-03) calls it out as a named mitigation: "The service role first asserts the seeded row IS visible to it, so the zero-rows-from-JWT assertion cannot pass merely because the table is empty."

## Deviations from Plan

### Auto-fixed Issues

None — the plan's action text already anticipated the FK-seeding complexity and prescribed the bespoke-block approach; no bugs, missing functionality, or blocking issues were found in the target files during implementation.

### Out-of-Scope Discovery (logged, not fixed)

**1. [Scope Boundary] Pre-existing `organizations` cleanup gap in `rls-regression.test.ts`'s own `afterAll`**
- **Found during:** Verifying this plan's changes (running the suite 3x directly against TEST)
- **Issue:** 96 orphaned test `organizations` rows found on TEST, 90 predating this plan by up to ~3 months (oldest: 2026-06-11). Root-caused via a direct empirical test (not just a hypothesis): a manual re-delete of this plan's own 6 orphaned orgs succeeded immediately with no error, so the delete call in step 1e isn't structurally broken — the real cause is interrupted historical test runs (agent timeout/Ctrl-C/crash) that never reached `afterAll`, combined with `cleanup_test_fixture_users`' safety-net RPC having no `organizations` sweep (no direct FK from `organizations` to `auth.users`).
- **Not fixed:** Unrelated to the `CLIENT_DENY_TABLES` registration this plan's task asked for; fixing it would mean either extending the shared `cleanup_test_fixture_users` migration (repo-wide infra change) or manually purging 90 historical rows neither this plan's scope nor its file list covers.
- **Files touched:** `.planning/phases/31-deterministic-resolution-shadow-mode-only/deferred-items.md` (documentation only)
- **Courtesy action taken:** Swept only the 6 orgs this plan's own 3 verification runs created (direct service-role delete, confirmed 0 remaining afterward), leaving the 90 pre-existing rows untouched.

---

**Total deviations:** 0 auto-fixed; 1 out-of-scope discovery logged (not fixed, per Scope Boundary rule)
**Impact on plan:** None on this plan's own deliverable — `event_match_decisions`/`organization_feature_flags`/the extra recording all verified to leave zero trace on TEST across 3 consecutive runs.

## Issues Encountered

- `npm run test:integration -- rls-regression.test.ts` (the plan's own literal acceptance command) has the same pre-existing npm-script-glob issue documented in Plan 01/02's deferred-items entries — the hardcoded glob only matches `*.integration.test.ts` files, and `rls-regression.test.ts` doesn't match that naming pattern at all (it's a plain `*.test.ts` gated by its own `describe.skipIf(!integrationDbReachable)`, not by `VITEST_INTEGRATION_OK`). Verified the suite directly and reliably instead: `npx vitest run src/test/rls-regression.test.ts` (auto-loads `.env.test` via `integration-setup.ts`'s dotenv call, runs only this one file, sidesteps the documented cross-file `cleanup_test_fixture_users(p_max_age_minutes: 0)` race entirely). Ran it 3 times consecutively; 53/53 passed every time.
- Confirmed `rls-regression.test.ts` is covered by `npm run type-check` (baseline-diffed, 0 new errors against the existing 320-error baseline) and `npx eslint src/test/rls-regression.test.ts` (no issues).

## User Setup Required

None - no external service configuration required. No migration, no `db push` (this plan's scope, confirmed: `git diff --stat` for this task touches only `src/test/rls-regression.test.ts` and `deferred-items.md`).

## Next Phase Readiness

- MATCH-09 and SAFE-01's client-invisibility guarantee is now CI-enforced, not just asserted once: a future permissive-policy mistake on either table fails the build.
- Plan 04 (prod apply + cron) inherits this same safety net once `event_match_decisions`/`organization_feature_flags` reach production — no further action needed from this plan for that to hold, since the test itself is project-agnostic (runs against whatever `VITE_SUPABASE_TEST_URL` points at).
- The pre-existing `organizations` cleanup gap (90 orphaned test orgs) remains open on TEST — logged for whoever next owns integration test infrastructure hygiene, same owner as the Plan 02 cross-file-race entry.
- No blockers.

---
*Phase: 31-deterministic-resolution-shadow-mode-only*
*Completed: 2026-09-01*

## Self-Check: PASSED

All claimed files verified present on disk (`src/test/rls-regression.test.ts`, `deferred-items.md`, this SUMMARY). Claimed commit hash `a25231b` verified present in `git log --oneline --all`. `event_match_decisions` and `organization_feature_flags` both confirmed present in `src/test/rls-regression.test.ts` (23 and 21 occurrences respectively). No missing items.
