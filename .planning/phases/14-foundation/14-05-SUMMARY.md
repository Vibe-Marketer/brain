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

## Status: MOSTLY COMPLETE — One Human Step Remaining

- **Task 1:** DONE — GitHub repo created, CI workflow added, all commits pushed
- **Task 2:** MOSTLY DONE — Vercel deployed and live, GitHub auto-deploy connected, env vars set. **One remaining human step: add Vercel URL to Supabase redirect allowlist**

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

## Automated Setup Completed

The following was completed automatically:

- **Vercel project created:** `callvault` on team `ai-simple`
- **Production URL:** https://callvault.vercel.app
- **Env vars set:** VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY (all environments)
- **GitHub auto-deploy connected:** Pushes to main auto-deploy to Vercel
- **Build verified:** TypeScript compiles, Vite build succeeds, deployment READY
- **FOUND-09 verified:** Zero Google Meet/Calendar scope references in codebase (only DB schema columns in auto-generated types)

## One Human Step Required (FOUND-07)

### Add Vercel URL to Supabase redirect allowlist

1. Supabase Dashboard -> Authentication -> URL Configuration
2. Under "Redirect URLs", add:
   - `https://callvault.vercel.app/oauth/callback`
   - `https://callvault.vercel.app/**`
3. Save. Do NOT change SITE_URL.

### Then verify auth end-to-end

1. Open https://callvault.vercel.app — should redirect to /login
2. Sign in with Google — should land at AppShell
3. Navigate to /workspaces, /settings, /import
4. Navigate to /bank — should show "Page Not Found"
5. Refresh — session persists

### Resume signal

Type "approved" when auth works end-to-end, or describe issues found.

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
