---
phase: 16-workspace-redesign
plan: "06"
subsystem: onboarding
tags: [onboarding, model-explorer, animation, user-preferences, sidebar]
dependency_graph:
  requires: ["16-03"]
  provides: ["16-07"]
  affects: ["_authenticated layout", "SidebarNav", "preferencesStore"]
tech_stack:
  added:
    - "motion/react AnimatePresence for step transitions"
  patterns:
    - "useOnboarding reads/writes user_profiles.auto_processing_preferences JSONB (not localStorage)"
    - "showOnboarding UI flag lives in preferencesStore (shared between SidebarNav trigger and layout renderer)"
    - "ModelExplorer overlay rendered in _authenticated.tsx layout route (not in individual pages)"
key_files:
  created:
    - "/Users/Naegele/dev/callvault/src/components/onboarding/ModelExplorer.tsx"
    - "/Users/Naegele/dev/callvault/src/hooks/useOnboarding.ts"
  modified:
    - "/Users/Naegele/dev/callvault/src/routes/_authenticated.tsx"
    - "/Users/Naegele/dev/callvault/src/components/layout/SidebarNav.tsx"
    - "/Users/Naegele/dev/callvault/src/stores/preferencesStore.ts"
decisions:
  - "user_preferences table does not exist — used user_profiles.auto_processing_preferences JSONB to store onboarding_seen_v2 flag (same server-side persistence goal, no new table needed)"
  - "showOnboarding moved from useOnboarding local state to preferencesStore — allows SidebarNav (trigger) and _authenticated.tsx (renderer) to share the same flag without prop drilling through AppShell"
metrics:
  duration: "~4 minutes"
  completed: "2026-02-28"
  tasks_completed: 2
  files_created: 2
  files_modified: 3
---

# Phase 16 Plan 06: Onboarding Explorer Summary

**One-liner:** Interactive 5-step ModelExplorer with motion/react animations persisting completion in user_profiles JSONB, wired as first-login overlay in the auth layout.

---

## What Was Built

### Task 1: ModelExplorer component and useOnboarding hook

**ModelExplorer** (`src/components/onboarding/ModelExplorer.tsx`)
- 5-step interactive explorer: Account → Organization → Workspace → Folder → Call
- Visual tree builds up as user clicks through — each step adds a node at increasing depth
- `AnimatePresence mode="wait"` with spring transitions for step content (`motion/react`, NOT framer-motion)
- Progress dots at top: filled/wide for completed/current, narrow for upcoming
- `RiHome4Line` house icon for Organization step (personal org emphasis)
- "My Calls" workspace explained as default import destination
- "Next" button with `RiArrowRightLine` advances steps; final step shows "Get Started"
- "Skip" text link dismisses overlay at any point
- Props: `{ onComplete: () => void }` — called on "Get Started" or "Skip"

**useOnboarding** (`src/hooks/useOnboarding.ts`)
- `hasCompletedOnboarding`: TanStack Query reads `user_profiles.auto_processing_preferences.onboarding_seen_v2`
- `markOnboardingSeen()`: mutation upserts `onboarding_seen_v2: true` (merges with existing prefs)
- `showOnboarding` / `setShowOnboarding`: from `preferencesStore` (shared UI state)
- Uses `queryKeys.user.preferences()` key; invalidates on mutation success

### Task 2: Wire onboarding into auth layout and sidebar

**_authenticated.tsx** (`src/routes/_authenticated.tsx`)
- First-login overlay: `!hasCompletedOnboarding && !isLoading` — renders ModelExplorer over normal content
- Manual re-trigger: `showOnboarding && hasCompletedOnboarding` — for "How it works" sidebar link
- Both overlays: `fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4`
- `Outlet` renders underneath — page content still renders under the overlay

**SidebarNav** (`src/components/layout/SidebarNav.tsx`)
- "How it works" button: `onClick={() => setShowOnboarding(true)}`
- Icon changed from `RiInformationLine` to `RiQuestionLine` (per plan spec)
- `useOnboarding()` imported directly (not passed as prop through AppShell)

**preferencesStore** (`src/stores/preferencesStore.ts`)
- Added `showOnboarding: boolean` (default `false`) and `setShowOnboarding(show)` action
- Session-only (not persisted to localStorage) — correct for transient overlay state

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] user_preferences table does not exist in DB schema**
- **Found during:** Task 1
- **Issue:** Plan states "The user_preferences table already exists in the Supabase schema" but it is not in `src/types/supabase.ts` and does not exist in the DB
- **Fix:** Used `user_profiles.auto_processing_preferences` JSONB column (which does exist with full type support) to store the `onboarding_seen_v2` flag. Achieves identical result: server-side persistence under a stable key, queryable via TanStack Query
- **Files modified:** `src/hooks/useOnboarding.ts`
- **Commit:** 2a9b787

**2. [Rule 1 - Bug] showOnboarding as local state would not be shared between SidebarNav and _authenticated.tsx**
- **Found during:** Task 2 implementation
- **Issue:** If `showOnboarding` lived in `useOnboarding` as React local state, two call sites (`SidebarNav` and `_authenticated.tsx`) would get separate state instances — the sidebar button would never trigger the overlay
- **Fix:** Moved `showOnboarding` / `setShowOnboarding` to `preferencesStore` (Zustand UI state — correct per FOUND-06 boundary). Both components read/write the same store entry
- **Files modified:** `src/stores/preferencesStore.ts`, `src/hooks/useOnboarding.ts`
- **Commit:** 3e1bc4e

---

## Build Verification

```
pnpm build → ✓ built in 1.58s (zero TypeScript errors)
```

All artifact checks passed:
- `ModelExplorer.tsx`: `motion/react` import confirmed, `RiHome4Line` confirmed, `Get Started` and `Skip` confirmed
- `useOnboarding.ts`: `onboarding_seen_v2` key confirmed
- `_authenticated.tsx`: `ModelExplorer` import confirmed, `hasCompletedOnboarding` conditional rendering confirmed
- `SidebarNav.tsx`: "How it works" text confirmed, `setShowOnboarding(true)` onClick confirmed

---

## Self-Check: PASSED

Files exist:
- `src/components/onboarding/ModelExplorer.tsx` — FOUND
- `src/hooks/useOnboarding.ts` — FOUND
- `src/routes/_authenticated.tsx` — FOUND (contains ModelExplorer)
- `src/components/layout/SidebarNav.tsx` — FOUND (contains "How it works")
- `src/stores/preferencesStore.ts` — FOUND (contains showOnboarding)

Commits exist:
- `2a9b787` — feat(16-06): add ModelExplorer and useOnboarding hook — CONFIRMED
- `3e1bc4e` — feat(16-06): wire onboarding into auth layout and sidebar — CONFIRMED

Build: clean (zero errors, zero TypeScript errors)
