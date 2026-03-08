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
  - Vercel deployment live at https://callvault.vercel.app with auto-deploy from GitHub
  - Google OAuth end-to-end verified on production URL

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
    - /Users/Naegele/dev/callvault/vercel.json
  modified: []

key-decisions:
  - "CI runs pnpm build (not tsc --noEmit) — build includes TypeScript compilation via Vite so both TS and bundler errors are caught"
  - "Repo created as private — matches v1 billing/auth code sensitivity"
  - "vercel.json with framework:vite + SPA rewrites needed for client-side routing on Vercel"
  - "Supabase custom auth domain (auth.callvaultai.com) requires matching redirect URI in Google Cloud Console"

patterns-established:
  - "Pattern 14: pnpm/action-setup@v4 + actions/setup-node@v4 with pnpm cache for CI"

duration: 45min
completed: 2026-02-27
---

# Phase 14 Plan 05: GitHub Repo, CI, and Deployment Summary

**GitHub repo live, Vercel deployed, Google OAuth verified end-to-end on production URL**

## Status: COMPLETE

- **Task 1:** DONE — GitHub repo created, CI workflow added, all commits pushed
- **Task 2:** DONE — Vercel deployed, env vars set, Supabase redirect allowlist configured, Google OAuth verified

## Performance

- **Duration:** ~45 min (including debugging OAuth redirect_uri_mismatch and Vercel SPA routing)
- **Started:** 2026-02-27T15:49:38Z
- **Completed:** 2026-02-27T18:10:00Z
- **Tasks:** 2/2 complete
- **Files created:** 2

## Accomplishments

- Private GitHub repo `Vibe-Marketer/callvault` created and all 9 Phase 14 commits pushed
- GitHub Actions CI workflow validates TypeScript compilation and build on every push and PR to main
- Repository URL: https://github.com/Vibe-Marketer/callvault

## Task Commits

Each task was committed atomically (in /dev/callvault repo):

1. **Task 1: Create GitHub repo, CI workflow, and push** — `364ceb9` (chore)
2. **Build fixes:** `6464a2f` (remove unused React namespace imports), `53506ac` (inline TW v4 @apply)
3. **SPA routing fix:** `da0fca3` + `ecfb461` (vercel.json with framework hint and rewrites)

## Files Created/Modified

- `/Users/Naegele/dev/callvault/.github/workflows/ci.yml` — GitHub Actions CI: checkout, pnpm@9, Node 22, frozen lockfile install, pnpm build
- `/Users/Naegele/dev/callvault/vercel.json` — Vite framework hint + SPA catch-all rewrite for client-side routing

## Decisions Made

- **CI uses pnpm build not tsc --noEmit**: `pnpm build` runs Vite which invokes tsc internally, catching both TypeScript errors and bundler errors in one step. No separate type-check step needed.
- **Repo created as private**: Matches sensitivity of v1 billing/auth code — can be made public later if desired.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

1. **React 19 unused imports (TS6133):** Three components had `import * as React from 'react'` which React 19 JSX transform doesn't need. Fixed by removing/converting to named imports.
2. **TailwindCSS v4 @apply with custom classes:** `@apply btn-base` fails in TW v4 — `@apply` only works with Tailwind utility classes. Fixed by inlining utilities.
3. **Google OAuth redirect_uri_mismatch:** Supabase project has custom auth domain `auth.callvaultai.com`, but Google Cloud Console only had the default Supabase URL. Fixed by adding `https://auth.callvaultai.com/auth/v1/callback` to Google Console authorized redirect URIs.
4. **Vercel SPA routing 404:** Client-side routes returned Vercel 404. Fixed by adding `vercel.json` with `"framework": "vite"` and catch-all rewrite to `index.html`.

## Deployment Details

- **Vercel project:** `callvault` on team `ai-simple`
- **Production URL:** https://callvault.vercel.app
- **Env vars set:** VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY (all environments)
- **GitHub auto-deploy connected:** Pushes to main auto-deploy to Vercel
- **Supabase redirect allowlist:** `https://callvault.vercel.app/oauth/callback` + `https://callvault.vercel.app/**`
- **Google Cloud Console:** `https://auth.callvaultai.com/auth/v1/callback` added to authorized redirect URIs
- **FOUND-09 verified:** Zero Google Meet/Calendar scope references in codebase
- **Auth end-to-end verified:** Google OAuth sign-in working on production URL

## Next Phase Readiness

- All 10 FOUND requirements and AI-02 satisfied
- Phase 14 Foundation complete
- Phase 15 (Data Migration) can begin — requires the live Vercel URL for integration testing

## Self-Check: PASSED

| Item | Status |
|------|--------|
| .github/workflows/ci.yml | FOUND |
| vercel.json | FOUND |
| GitHub repo Vibe-Marketer/callvault | FOUND (https://github.com/Vibe-Marketer/callvault) |
| Vercel production deployment | READY (https://callvault.vercel.app) |
| Google OAuth end-to-end | VERIFIED |
| All Phase 14 commits pushed | PASS |

---
*Phase: 14-foundation*
*Completed: 2026-02-27*
