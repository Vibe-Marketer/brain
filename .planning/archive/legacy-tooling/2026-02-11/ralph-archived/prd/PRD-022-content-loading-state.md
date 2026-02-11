# PRD-022: Loading State for Hooks/Posts

**Status:** Ready for Implementation
**Priority:** P2 - UX Polish
**Category:** Content Section
**Spec:** [SPEC-022](../../specs/spec-022-content-loading-state.md)
**Created:** 2026-01-14

---

## Overview

Add loading indicators for hooks, posts, and content items in the Content section. Currently there's a noticeable delay with no feedback.

## Problem Statement

Users see a blank/empty state during content loading, creating the impression that the page is broken or has no content.

## Goals

1. Provide visual feedback during loading
2. Improve perceived performance
3. Reduce user uncertainty

## User Stories

**US-022.1:** As a CallVault user, I want to see loading feedback in the Content section so that I know my content is loading and not missing.

## Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Skeleton shows immediately on page load | Must Have |
| FR-002 | Skeleton matches content card layout | Must Have |
| FR-003 | Smooth transition from skeleton to content | Should Have |

## Technical Approach

Add skeleton components matching content card layout:

```tsx
function ContentCardSkeleton() {
  return (
    <div className="p-4 space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}
```

## Acceptance Criteria

- [ ] Skeleton shows during content loading
- [ ] Skeleton matches card layout
- [ ] Smooth transition to actual content
- [ ] Loading state for each content type

---

*PRD generated from SPEC-022*
