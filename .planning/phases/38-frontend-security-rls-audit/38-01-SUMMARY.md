---
plan: 38-01
phase: 38
title: RLS regression test on CI — cross-org isolation safety net
status: complete
completed: 2026-05-12
requirements: [SEC-04C]
---

# Plan 38-01 Summary

## What was built

A Vitest integration test (`src/test/rls-regression.test.ts`) that creates 2 orgs + 2 users via service-role, signs in both users via `signInWithPassword` against the real Supabase auth API, then queries every user-facing table from each user's JWT and asserts the cross-org read returns 0 rows. Failure messages name the leaking table.

CI wired in `.github/workflows/ci.yml` as a new `rls-regression` job, gated on `vars.SUPABASE_SECRETS_CONFIGURED == 'true'` (matches existing e2e-smoke gate). A failed assertion fails the build.

Operational docs added to `supabase/CLAUDE.md` (failure runbook + how to add new tables). `.env.test.example` updated with `VITE_SUPABASE_TEST_ANON_KEY` hint.

## Files

**Created:**
- `src/test/rls-regression.test.ts` — 348 lines. Reuses `src/test/integration-setup.ts` (Phase 30). Tests 11 user-facing tables × 2 directions = 22 assertion blocks.

**Modified:**
- `.github/workflows/ci.yml` — new `rls-regression` job, runs `npx vitest run src/test/rls-regression.test.ts --reporter=verbose`.
- `supabase/CLAUDE.md` — new `## RLS Regression Test (CI-Enforced)` section with failure runbook.
- `.env.test.example` — documents `VITE_SUPABASE_TEST_ANON_KEY` for local runs.

## Tables exercised cross-org

`recordings`, `workspaces`, `folders`, `organization_memberships`, `workspace_entries`, `folder_assignments`, `tag_preferences`, `call_tag_assignments`, `transcript_tag_assignments`, `call_speakers`, `call_participants` — 11 tables, each tested A→B and B→A.

## Verification

- `npm run type-check` exits 0 — test compiles cleanly.
- `grep -c "describe.skipIf(!integrationDbReachable)" src/test/rls-regression.test.ts` → 1.
- `grep -c "signInWithPassword" src/test/rls-regression.test.ts` → 2 (one per user).
- `grep -c "RLS LEAK:" src/test/rls-regression.test.ts` → 4 (2 directions × 2 assertion messages).
- `grep -c "rls-regression.test.ts" .github/workflows/ci.yml` → 1.
- `grep -c "RLS Regression" .github/workflows/ci.yml` → 2.
- YAML validates (`npx js-yaml .github/workflows/ci.yml` exits 0).
- `grep -c "rls-regression.test.ts" supabase/CLAUDE.md` → 3.

## Self-Check: PASSED

- [x] Test file exists, compiles, follows the integration-setup pattern.
- [x] Test creates fixtures, signs in real JWTs, queries cross-org, asserts 0 rows.
- [x] Cleanup in afterAll re-runnable.
- [x] CI job added with appropriate secret gating.
- [x] Failure message names the leaking table (greppable via `RLS LEAK:`).
- [x] Documentation added to supabase/CLAUDE.md.
- [x] SEC-04C satisfied.

## Notes for future testers

- Local run (with `.env.test` populated): `npx vitest run src/test/rls-regression.test.ts`.
- Without secrets: the suite reports "skipped", not "failed" (correct behavior).
- The test does NOT clean up if `beforeAll` throws — but fixtures are stamped with `Date.now()` so a stale row from a prior failed run never collides.
