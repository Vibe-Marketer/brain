# QA Fix Request

**Status**: REJECTED
**Date**: 2025-12-30
**QA Session**: 1

## Critical Issues to Fix

### 1. GlobalSearchModal Not Rendered
**Problem**: Component exists but is never imported/rendered anywhere
**Fix**: Add to src/App.tsx after Toaster:
  import { GlobalSearchModal } from '@/components/search/GlobalSearchModal';
  Then add <GlobalSearchModal /> inside Router after <Toaster />

### 2. Wrong TopBar Modified
**Problem**: Modified loop/TopBar.tsx but app uses ui/top-bar.tsx
**Fix**: Update src/components/ui/top-bar.tsx to:
  - Import useSearchStore from @/stores/searchStore
  - Add Cmd/Ctrl+K keyboard shortcut handler
  - Wire search button onClick to openModal()

### 3. Missing Route
**Problem**: Results navigate to /call/:id which doesn't exist
**Fix**: Either add the route to App.tsx or update SearchResultItem to use existing route

## After Fixes
1. Test: Cmd/Ctrl+K opens modal
2. Test: Click search icon opens modal
3. Test: Click result navigates correctly
4. Run: npm run test
5. Run: npm run build
6. Commit with: fix: integrate GlobalSearchModal and wire up correct TopBar (qa-requested)
