# SPEC-022: Loading State for Hooks/Posts

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Content Section
**Priority:** UX Polish

---

## Summary

Add loading indicators for hooks, posts, and content items in the Content section. Currently there's a noticeable delay before items appear with no feedback.

## What

Implement loading skeletons or spinners for content loading states.

**Files to investigate:**
- Content page components
- `src/pages/Content*.tsx`

**Current:** Noticeable delay with blank/empty state before content appears
**Done:** Loading indicator shows user content is coming

## Why

- Empty state during load feels like broken page
- Users don't know if content is loading or doesn't exist
- Loading states are standard UX pattern
- Improves perceived performance

## User Experience

- User navigates to Content → sees skeleton loading state
- Skeleton animates → content smoothly replaces it
- User knows content is loading, not missing

## Scope

**Includes:**
- Adding skeleton components for content cards
- Loading state while hooks/posts fetch
- Consistent loading pattern with rest of app

**Excludes:**
- Optimizing actual load time (separate effort)
- Infinite scroll/pagination

## Acceptance Criteria

- [ ] Skeleton shows immediately on Content page load
- [ ] Skeleton matches content card layout
- [ ] Smooth transition from skeleton to content
- [ ] Loading state for each content type (hooks, posts)

## User Story

**As a** CallVault user
**I want** to see loading feedback in the Content section
**So that** I know my content is loading and not missing

---

*Spec ready for PRD generation.*
