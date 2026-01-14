# SPEC-010: Fetch Meetings Button Visibility

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Import/Integrations
**Priority:** Critical UX Bug

---

## Summary

Fix the "Fetch Meetings" button visibility issue where it's hidden/hard to find due to container scrolling problems, especially on full-screen views.

## What

Ensure the "Fetch Meetings" button is always clearly visible and accessible, fixing any scroll container issues.

**Files to investigate:**
- Meeting fetch flow components
- `src/components/sync/` directory

**Current issues:**
1. Button hidden/hard to find
2. Container doesn't scroll properly on full screen
3. Users can't access the primary action

**Done:** Button clearly visible, scrolling works correctly

## Why

- Primary CTA shouldn't be hidden
- Users can't complete the import flow if they can't find the button
- Scroll issues prevent task completion
- Critical usability bug

## User Experience

- User configures date range → sees "Fetch Meetings" button clearly
- Button visible without hunting/scrolling
- Scroll works properly if content overflows

## Scope

**Includes:**
- Fixing container scroll behavior
- Ensuring button is always visible/accessible
- May need to sticky the button or restructure layout

**Excludes:**
- Changing what "Fetch Meetings" does

## Acceptance Criteria

- [ ] "Fetch Meetings" button visible without scrolling (if possible)
- [ ] If scrolling required, scroll works correctly
- [ ] Button accessible on all screen sizes
- [ ] No content cut off or inaccessible

## User Story

**As a** CallVault user importing meetings
**I want** to easily find and click the Fetch Meetings button
**So that** I can complete the import process

---

*Spec ready for PRD generation.*
