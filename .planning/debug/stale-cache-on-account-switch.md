---
status: awaiting_human_verify
trigger: "When a user logs out of one account and logs into another, the old account's cached data still shows in the UI until the user manually refreshes the page."
created: 2026-04-14T00:00:00Z
updated: 2026-04-14T00:05:00Z
---

## Current Focus

hypothesis: CONFIRMED — QueryClient cache is never cleared on sign-out/sign-in, and orgContextStore.reset() is never called on sign-out
test: Verified via code inspection — queryClient.clear() does not appear anywhere in the auth flow
expecting: Fix: call queryClient.clear() and orgContextStore.reset() inside the onAuthStateChange SIGNED_OUT handler and in AuthContext.signOut()
next_action: Apply fix to AuthContext.tsx — expose queryClient and call clear() on SIGNED_OUT and SIGNED_IN (new user) events

## Symptoms

expected: After logging into a new account, the UI should show only the new account's data — clean slate, no remnants of previous account
actual: Old account's data (calls, workspaces, folders, organization) persists in the UI after logging into a different account. Only a manual browser refresh clears it.
errors: No visible errors — the login succeeds (toast shows "Signed in successfully!") but stale data from the previous session remains
reproduction: 1) Log into account A 2) Log out 3) Log into account B 4) See account A's data still displayed until manual page refresh
started: Ongoing issue, likely since auth system was implemented

## Eliminated

(none)

## Evidence

- timestamp: 2026-04-14T00:01:00Z
  checked: src/App.tsx lines 38-47
  found: QueryClient is created as a module-level singleton with staleTime=5min, gcTime=10min
  implication: Cache survives any React re-render or route change — only cleared by queryClient.clear() or page refresh

- timestamp: 2026-04-14T00:02:00Z
  checked: src/contexts/AuthContext.tsx — onAuthStateChange handler (lines 24-54), signOut function (lines 79-83)
  found: SIGNED_OUT event handler only calls setSession(null) and setUser(null). signOut() only calls supabase.auth.signOut() then updates React state. Neither clears the QueryClient cache nor resets Zustand stores.
  implication: When user signs out, all TanStack Query cached data (calls, workspaces, folders, org) remains in memory

- timestamp: 2026-04-14T00:03:00Z
  checked: grep for queryClient.clear across entire src/ directory
  found: Zero occurrences of queryClient.clear() anywhere in the codebase
  implication: There is absolutely no mechanism to clear the cache on account switch

- timestamp: 2026-04-14T00:04:00Z
  checked: src/stores/orgContextStore.ts — reset() function exists (lines 151-157)
  found: orgContextStore.reset() exists and correctly clears all org state + localStorage, but it is never called from AuthContext
  implication: Org context (activeOrgId, activeWorkspaceId) from account A persists into account B's session

- timestamp: 2026-04-14T00:05:00Z
  checked: src/components/ui/top-bar.tsx handleSignOut (lines 49-52)
  found: handleSignOut calls signOut() then navigate('/login') — no cache clearing here either
  implication: The sign-out path in the UI also does not clear cache

## Resolution

root_cause: The TanStack QueryClient cache is never cleared on sign-out or account switch. The QueryClient is a module-level singleton in App.tsx with a 10-minute gcTime. The AuthContext onAuthStateChange handler for SIGNED_OUT only updates React state (user/session) but never calls queryClient.clear(). The orgContextStore.reset() method exists but is never invoked during logout.
fix: In AuthContext.tsx — on SIGNED_OUT event, call queryClient.clear() and useOrgContextStore.getState().reset(). This requires passing the queryClient instance into the AuthProvider. Also reset on SIGNED_IN when the new user differs from the previous user (account switch without explicit logout).
verification:
files_changed: [src/contexts/AuthContext.tsx, src/App.tsx]
