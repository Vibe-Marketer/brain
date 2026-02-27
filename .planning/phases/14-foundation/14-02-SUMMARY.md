---
phase: 14-foundation
plan: 02
subsystem: auth
tags: [supabase, google-oauth, pkce, tanstack-router, react-context, typescript]

requires:
  - phase: 14-01
    provides: Vite 7 + React 19 + TanStack Router scaffold with all deps installed

provides:
  - Typed Supabase client singleton at src/lib/supabase.ts (same project as v1)
  - Live database types generated from vltmrnjsubfzrgrtdqey schema (3644 lines)
  - AuthProvider + useAuth hook at src/hooks/useAuth.tsx (session, Google sign-in, sign-out)
  - Working /login page with Google OAuth button (glossy slate gradient style)
  - PKCE OAuth callback handler at /oauth/callback (exchanges code, navigates to /)
  - Auth guard layout route at _authenticated.tsx (beforeLoad blocks unauthenticated access)
  - Protected home placeholder at /_authenticated/ (shows user email, sign-out button)
  - Full TanStack Router route tree: / and /login and /oauth/callback

affects:
  - 14-03 (AppShell layout uses AuthProvider already wired in __root.tsx)
  - 14-04 (billing gating needs auth session from useAuth)
  - 15-migration (Supabase client pattern established)
  - all v2 protected routes (nest under _authenticated/ for free auth guard)

tech-stack:
  added: []
  patterns:
    - AuthProvider context pattern — useAuth() hook throws if used outside provider
    - TanStack Router beforeLoad auth guard — throws redirect({ to: '/login' }) on no session
    - PKCE OAuth flow — Supabase JS handles code exchange automatically, listen onAuthStateChange
    - createRootRouteWithContext for passing RouterContext (auth.session) to beforeLoad handlers
    - _authenticated/ pathless layout route — all protected pages nested inside

key-files:
  created:
    - /Users/Naegele/dev/callvault/src/lib/supabase.ts
    - /Users/Naegele/dev/callvault/src/types/supabase.ts
    - /Users/Naegele/dev/callvault/src/hooks/useAuth.tsx
    - /Users/Naegele/dev/callvault/src/routes/login.tsx
    - /Users/Naegele/dev/callvault/src/routes/oauth/callback.tsx
    - /Users/Naegele/dev/callvault/src/routes/_authenticated.tsx
    - /Users/Naegele/dev/callvault/src/routes/_authenticated/index.tsx
  modified:
    - /Users/Naegele/dev/callvault/src/routes/__root.tsx
    - /Users/Naegele/dev/callvault/src/main.tsx

key-decisions:
  - "signInWithOAuth lives in useAuth hook, not login.tsx — login.tsx calls signInWithGoogle() from hook"
  - "supabase gen types generated fresh from live schema (CLI was already authenticated)"
  - "Old src/routes/index.tsx deleted and replaced by src/routes/_authenticated/index.tsx"

patterns-established:
  - "Pattern 5: AuthProvider in __root.tsx wraps entire app — all routes have auth context"
  - "Pattern 6: _authenticated/ layout route for auth guard — nest all protected pages under it"
  - "Pattern 7: supabase.auth.getSession() in beforeLoad for sync auth check (not useAuth hook)"

duration: 4min
completed: 2026-02-27
---

# Phase 14 Plan 02: Auth Foundation — Summary

**Supabase Google OAuth PKCE flow wired end-to-end: typed client singleton pointing at live v1 project, AuthProvider context, /login with Google button, /oauth/callback PKCE handler, and _authenticated layout guard — existing users can sign in immediately**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-27T15:23:51Z
- **Completed:** 2026-02-27T15:27:38Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Supabase client configured pointing at the same project as v1 (vltmrnjsubfzrgrtdqey) — existing users' sessions and data are immediately accessible
- Database types generated fresh from live schema via `supabase gen types typescript` — 3644 lines typed, CLI was already authenticated
- Full Google OAuth PKCE flow: /login button → Supabase signInWithOAuth → Google → /oauth/callback → onAuthStateChange SIGNED_IN → navigate to /
- TanStack Router route tree correctly separates public routes (/login, /oauth/callback) from the _authenticated layout guard
- TypeScript type check passes with zero errors after all changes

## Task Commits

Each task was committed atomically (in /dev/callvault repo):

1. **Task 1: Supabase client, database types, and auth hook** - `966b92b` (feat)
2. **Task 2: Auth routes — root, login, OAuth callback, auth guard** - `46f2c64` (feat)

## Files Created/Modified

- `/Users/Naegele/dev/callvault/src/lib/supabase.ts` - Typed Supabase client singleton with localStorage persistence, same project as v1
- `/Users/Naegele/dev/callvault/src/types/supabase.ts` - Live database types generated from vltmrnjsubfzrgrtdqey (3644 lines)
- `/Users/Naegele/dev/callvault/src/hooks/useAuth.tsx` - AuthProvider + useAuth hook: session, user, loading, signInWithGoogle, signOut
- `/Users/Naegele/dev/callvault/src/routes/__root.tsx` - Updated to createRootRouteWithContext, AuthProvider wraps Outlet
- `/Users/Naegele/dev/callvault/src/routes/login.tsx` - Public /login route with Google OAuth button (glossy slate gradient, Montserrat heading)
- `/Users/Naegele/dev/callvault/src/routes/oauth/callback.tsx` - PKCE exchange handler, loading/success/error states with Remix Icons
- `/Users/Naegele/dev/callvault/src/routes/_authenticated.tsx` - Pathless layout route with beforeLoad auth guard (throws redirect to /login)
- `/Users/Naegele/dev/callvault/src/routes/_authenticated/index.tsx` - Placeholder home at / showing user email and sign-out button
- `/Users/Naegele/dev/callvault/src/main.tsx` - Router created with context: { auth: { session: null } }
- Deleted: `/Users/Naegele/dev/callvault/src/routes/index.tsx` - Replaced by _authenticated/index.tsx

## Decisions Made

- **signInWithOAuth in hook not route**: `signInWithOAuth` lives in `useAuth.tsx`. The `login.tsx` calls `signInWithGoogle()` from the hook. Cleaner abstraction — routes don't touch Supabase SDK directly.
- **Types generated fresh**: Supabase CLI was already authenticated (`supabase gen types` succeeded immediately). No placeholder needed.
- **Old index.tsx deleted**: `src/routes/index.tsx` (Plan 01 placeholder) conflicted with `_authenticated/index.tsx`. Deleted the old one.

## Deviations from Plan

None — plan executed exactly as written. The signInWithOAuth pattern placement (hook vs route) was the intended hook abstraction per the plan's design.

## Issues Encountered

None.

## User Setup Required

**Supabase OAuth redirect URL must be configured** for the PKCE flow to work after Google sign-in:

In the Supabase Dashboard → Authentication → URL Configuration → Redirect URLs, ensure `http://localhost:3000/oauth/callback` is in the allowed list. This is a one-time setup for local development. The production URL will also need to be added when deploying.

Note: This is standard Supabase OAuth setup — it may already be configured from v1 development. The callback URL has changed from v1's `${window.location.origin}/` to `${window.location.origin}/oauth/callback` (PKCE pattern).

## Next Phase Readiness

- Auth foundation complete — any page nested under `src/routes/_authenticated/` is automatically guarded
- `useAuth()` hook available everywhere for session/user data and sign-out
- Plan 03 (AppShell layout) can import `useAuth` directly for the user menu
- Dev server starts cleanly on port 3000 with no TypeScript errors

## Self-Check: PASSED

All files verified present on disk. All task commits verified in git log.

| Item | Status |
|------|--------|
| src/lib/supabase.ts | FOUND |
| src/types/supabase.ts | FOUND |
| src/hooks/useAuth.tsx | FOUND |
| src/routes/__root.tsx | FOUND |
| src/routes/login.tsx | FOUND |
| src/routes/oauth/callback.tsx | FOUND |
| src/routes/_authenticated.tsx | FOUND |
| src/routes/_authenticated/index.tsx | FOUND |
| Commit 966b92b (Task 1) | FOUND |
| Commit 46f2c64 (Task 2) | FOUND |
| TypeScript type check | PASS (zero errors) |

---
*Phase: 14-foundation*
*Completed: 2026-02-27*
