---
phase: 14-foundation
plan: 05
subsystem: infra
tags: [github, vercel, ci, supabase, oauth, deployment]

requires:
  - phase: 14-04
    provides: All v2 routes wired with AppShell, query key factory, all code ready to push

provides:
  - GitHub repo Vibe-Marketer/callvault (private) with all Phase 14 code pushed
  - GitHub Actions CI workflow validating pnpm build on every push and PR to main
  - PENDING: Vercel deployment, Supabase redirect allowlist config, end-to-end auth verification

affects:
  - Phase 15+ (deployment URL needed for all future live testing)
  - All phases requiring external service configuration (Supabase, Zoom, Fathom)

tech-stack:
  added:
    - GitHub Actions (CI/CD pipeline)
  patterns:
    - CI validates pnpm build on push/PR — catches TypeScript errors before merge

key-files:
  created:
    - /Users/Naegele/dev/callvault/.github/workflows/ci.yml
  modified: []

key-decisions:
  - "CI runs pnpm build (not tsc --noEmit) — build includes TypeScript compilation via Vite so both TS and bundler errors are caught"
  - "Repo created as private — matches v1 billing/auth code sensitivity"

patterns-established:
  - "Pattern 14: pnpm/action-setup@v4 + actions/setup-node@v4 with pnpm cache for CI"

duration: 3min
completed: 2026-02-27
---

# Phase 14 Plan 05: GitHub Repo, CI, and Deployment Summary

**GitHub repo Vibe-Marketer/callvault created with all 9 Phase 14 commits pushed and CI workflow active — Vercel deployment and auth allowlist configuration awaiting human verification**

## Status: PARTIALLY COMPLETE

- **Task 1:** DONE — GitHub repo created, CI workflow added, all commits pushed
- **Task 2:** AWAITING HUMAN VERIFICATION — Vercel deploy, Supabase allowlist, OAuth audit, end-to-end auth

## Performance

- **Duration:** 3 min (Task 1 only; Task 2 pending)
- **Started:** 2026-02-27T15:49:38Z
- **Completed (Task 1):** 2026-02-27T15:52:00Z
- **Tasks:** 1/2 complete
- **Files modified:** 1

## Accomplishments

- Private GitHub repo `Vibe-Marketer/callvault` created and all 9 Phase 14 commits pushed
- GitHub Actions CI workflow validates TypeScript compilation and build on every push and PR to main
- Repository URL: https://github.com/Vibe-Marketer/callvault

## Task Commits

Each task was committed atomically (in /dev/callvault repo):

1. **Task 1: Create GitHub repo, CI workflow, and push** — `364ceb9` (chore)

Task 2 (checkpoint) awaiting human verification — no commit yet.

## Files Created/Modified

- `/Users/Naegele/dev/callvault/.github/workflows/ci.yml` — GitHub Actions CI: checkout, pnpm@9, Node 22, frozen lockfile install, pnpm build

## Decisions Made

- **CI uses pnpm build not tsc --noEmit**: `pnpm build` runs Vite which invokes tsc internally, catching both TypeScript errors and bundler errors in one step. No separate type-check step needed.
- **Repo created as private**: Matches sensitivity of v1 billing/auth code — can be made public later if desired.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required (Task 2 — PENDING)

The following steps require human action in external dashboards. **Task 2 is a blocking checkpoint.**

### Step 1: Create Vercel project

1. Go to https://vercel.com/new
2. Import the `Vibe-Marketer/callvault` repo
3. Set environment variables:
   - `VITE_SUPABASE_URL` = (copy value of `VITE_SUPABASE_URL` from brain/.env)
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = (copy value of `VITE_SUPABASE_PUBLISHABLE_KEY` from brain/.env — the one WITHOUT "DEFAULT" in the name, starts with "eyJ")
   - WARNING: brain/.env has BOTH `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` — use `VITE_SUPABASE_PUBLISHABLE_KEY` only
4. Deploy. Note the Vercel URL (e.g., `callvault-xyz.vercel.app`)

### Step 2: Add Vercel domain to Supabase redirect allowlist (FOUND-07)

1. Supabase Dashboard -> Authentication -> URL Configuration
2. Under "Redirect URLs", add:
   - `https://{your-vercel-url}/oauth/callback`
   - `https://{your-vercel-url}/**`
3. Save. Do NOT change SITE_URL.

### Step 3: Verify Google OAuth has no Meet scopes (FOUND-09)

1. Google Cloud Console -> APIs & Services -> OAuth consent screen
2. Verify NO scopes with "meet" or "calendar" in the name
3. Remove Meet/Calendar scopes if present

### Step 4: Audit Fathom and Zoom OAuth (FOUND-08)

1. Fathom Analytics dashboard — note callback URLs referencing old domain
2. Zoom Marketplace -> Manage -> Your Apps -> CallVault — check "Redirect URL for OAuth", note if update needed for new Vercel domain

### Step 5: Verify auth end-to-end

1. Open deployed Vercel URL — should redirect to /login
2. Sign in with Google — should land at AppShell with 4-pane layout
3. Navigate to /workspaces, /settings, /import — all should render
4. Navigate to /bank — should show "Page Not Found" message
5. Refresh — session should persist
6. Test on mobile (or DevTools simulation) — layout should adapt

### Resume signal

After completing the above, type "approved" to mark Phase 14 complete, or describe issues found.

## Next Phase Readiness

After Task 2 completion:
- All 10 FOUND requirements and AI-02 satisfied
- Phase 14 Foundation complete
- Phase 15 (Data Migration) can begin — requires the live Vercel URL for integration testing

## Self-Check: PASSED (Task 1)

| Item | Status |
|------|--------|
| .github/workflows/ci.yml | FOUND |
| GitHub repo Vibe-Marketer/callvault | FOUND (https://github.com/Vibe-Marketer/callvault) |
| Commit 364ceb9 (Task 1) | FOUND |
| All 9 Phase 14 commits pushed | PASS |

---
*Phase: 14-foundation*
*Task 1 completed: 2026-02-27*
*Task 2: AWAITING HUMAN VERIFICATION*
