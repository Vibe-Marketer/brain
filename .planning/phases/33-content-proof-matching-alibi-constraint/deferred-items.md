# Phase 33 - Deferred Items

Out-of-scope discoveries logged during execution. Not fixed (Scope Boundary).

## Plan 02

### Cross-file integration-test race (pre-existing, repo-wide, previously root-caused in Phase 31 P02)

**What:** Running `src/test/event-resolution-metadata-tier.integration.test.ts` and
`src/test/event-resolution-shadow.integration.test.ts` together in one `vitest run`
invocation (as the plan's own `<verification>` block specifies) produces 2 failures:

```
[phase-32-02 event-resolution-metadata-tier] ... runShadowSweep proposes the
  provider-agnostic genuine pair ...
  AssertionError: expected +0 to be 6

[phase-32-02 event-resolution-metadata-tier] ... re-running the sweep is idempotent ...
  AssertionError: expected +0 to be 1
```

**Confirmed NOT a regression from this plan's changes:** each file passes cleanly in
isolation:
- `event-resolution-content-proof.integration.test.ts` alone: 4/4 pass
- `event-resolution-metadata-tier.integration.test.ts` alone: 6/6 pass
- `event-resolution-shadow.integration.test.ts` alone: 3/3 pass
- `event-match-apply-reverse.integration.test.ts` alone: 6/6 pass (after the SAFE-02
  doc-comment fix in this plan's Task 1/2 commits)

**Root cause (matches the exact prior finding, STATE.md Phase 31 P02 / Phase 32 P02/P03):**
Vitest's default file-parallelism runs multiple `*.integration.test.ts` files as
concurrent workers (`vitest.config.ts` sets no `fileParallelism: false` /
`poolOptions` override). Every suite's `afterAll` calls
`cleanup_test_fixture_users({ p_max_age_minutes: 0 })`, which defeats that RPC's own
documented age-threshold protection against deleting fixture users created by a
still-in-flight sibling file's run. One file's cleanup can delete another
concurrently-running file's fixture user (and cascade-delete its recordings) mid-test.

**Disposition:** Out of scope for this plan (repo-wide vitest/RPC concurrency design,
not a code defect introduced by Phase 33). Same disposition as the 3 prior phases that
hit this. Not fixed here.

### Pre-existing full-suite unit-test failures (unrelated to this plan's files)

**What:** `npx vitest run` (full non-integration suite) shows 12 failures across 4
files, unchanged in character from the baseline documented in STATE.md ("13
pre-existing full-suite test failures (admin UI x3, rpc-type-smoke, mcp-server JWT
auth)", Phase 32):

- `supabase/functions/mcp-server/__tests__/sec-jwt-fix.test.ts` (1 failure -- JWT
  crypto/atob assertion)
- `src/pages/admin/__tests__/AuditSection.test.tsx` (4 failures -- admin UI)
- `src/pages/admin/__tests__/DashboardSection.recurrence.test.tsx` (5 failures --
  admin UI)
- `src/components/support/__tests__/SupportTicketDialog.test.tsx` (2 failures --
  canvas/screenshot-capture mocking in jsdom)

**Confirmed unrelated:** `git log -- <each file>` shows none of these 4 files were
touched by any of this plan's 4 commits (9c3c5905, 84074b88, 12bd6f1d, bb739f4e) --
their most recent commits are unrelated prior work (support-ticket UX, autopilot,
admin self-audit). None import or exercise `event-resolver.ts`. The exact file
composition drifted slightly from the Phase 32 baseline (12 vs 13, `SupportTicketDialog`
in place of `rpc-type-smoke`) -- expected given unrelated development between phases,
not evidence of a new regression.

**Disposition:** Out of scope for this plan. Not fixed here.
