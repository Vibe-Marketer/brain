---
phase: 13-drag-to-folder-global-search
plan: 02
subsystem: search
tags: [global-search, cmd-k, modal, keyboard-shortcut]
dependency_graph:
  requires: [searchStore, useGlobalSearch, useSearchShortcut, Dialog]
  provides: [GlobalSearchModal, Cmd+K keyboard shortcut wired to modal]
  affects: [top-bar.tsx, any page using TopBar]
tech_stack:
  added: []
  patterns: [Radix Dialog, useSearchStore modal state, useSearchShortcut keyboard hook]
key_files:
  created:
    - src/components/search/GlobalSearchModal.tsx
  modified:
    - src/components/ui/top-bar.tsx
decisions:
  - "Cmd+K registered in GlobalSearchModal via useSearchShortcut, not in top-bar — modal owns its own shortcut, avoids double-registration"
  - "GlobalSearchModal mounted inside <header> in TopBar — globally available on every page without AppShell changes"
  - "Build failure (zoom-api-client) confirmed pre-existing in OAuthCallback.tsx — deferred, out of scope"
metrics:
  duration: "2m"
  completed_date: "2026-03-30"
  tasks_completed: 2
  files_changed: 2
---

# Phase 13 Plan 02: Global Search Modal Summary

**One-liner:** Rebuilt deleted GlobalSearchModal (223 lines) with Radix Dialog, wired Cmd+K and search button via useSearchStore.openModal.

## What Was Built

The `GlobalSearchModal` component was deleted in commit `2ae0e175`. This plan rebuilt it from the ground up using the existing `useGlobalSearch` hook and `searchStore` infrastructure that was already complete.

### GlobalSearchModal (`src/components/search/GlobalSearchModal.tsx`)

- Radix Dialog-based modal with `open={isModalOpen}` controlled by `useSearchStore`
- Registers `Cmd+K` keyboard shortcut via `useSearchShortcut(openModal)` — modal owns its own shortcut
- Auto-focuses search input 50ms after open (lets dialog animation start first)
- Clears query via `clear()` when modal closes
- Five render states: empty (no query), too-short query, loading spinner, no results, results list
- Result rows: title, 2-line snippet, date, platform dot (fathom=blue-400, zoom=blue-600, youtube=red-500, upload=muted)
- Clicking a result navigates to `/?callId=<sourceCallId>` then closes modal
- `sr-only` DialogTitle for screen reader accessibility
- Hint bar showing `Esc to close` / `Enter to open`

### TopBar (`src/components/ui/top-bar.tsx`)

- Removed the `useEffect` keydown listener for Cmd+K (was dispatching `dispatchFocusInlineSearch`)
- Replaced `dispatchFocusInlineSearch()` in `handleSearchClick` with `openModal()` from `useSearchStore`
- Removed `dispatchFocusInlineSearch` import (no longer used in this file)
- Added `import { useSearchStore }` and `import { GlobalSearchModal }`
- Mounts `<GlobalSearchModal />` inside `<header>` — globally available on all pages that use TopBar

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Build GlobalSearchModal component | db4c828b | src/components/search/GlobalSearchModal.tsx |
| 2 | Wire Cmd+K and search button to open GlobalSearchModal | 6af6190a | src/components/ui/top-bar.tsx |

## Deviations from Plan

### Pre-existing Issue (Deferred)

**[Out-of-scope] Build failure in OAuthCallback.tsx**
- **Found during:** Task 2 verification (npm run build)
- **Issue:** `src/pages/OAuthCallback.tsx` imports `@/lib/zoom-api-client` which does not exist — causes Vite production build to fail
- **Confirmed pre-existing:** `git stash && npm run build` reproduced the same failure before my changes
- **Action:** Logged to deferred-items, not fixed — out of scope for this plan
- **TypeScript (`npx tsc --noEmit`) passes cleanly** — only the Vite bundler fails on the missing file

## Known Stubs

None. The modal is fully wired: search input → `useGlobalSearch` → Supabase query → results → navigate to call.

## Self-Check: PASSED

Files exist:
- FOUND: src/components/search/GlobalSearchModal.tsx
- FOUND: src/components/ui/top-bar.tsx

Commits exist:
- db4c828b — feat(13-02): build GlobalSearchModal component
- 6af6190a — feat(13-02): wire Cmd+K and search button to open GlobalSearchModal
