# SPEC-026: Call Cards Size Reduction

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Content Section
**Priority:** UI Polish

---

## Summary

Reduce the height of call cards significantly. Current cards are too large with excessive wasted space, making the list harder to scan.

## What

Reduce vertical size of call cards to make them more compact.

**Files to investigate:**
- Call card components in Content section
- `src/components/content/` directory

**Current:** Cards are way too large with excessive wasted space
**Done:** Compact cards with reduced height

## Why

- Large cards = fewer visible at once
- Wasted space doesn't add value
- Harder to scan through calls
- Dense information display is more efficient

## User Experience

- User sees more call cards per screen
- Cards show essential info compactly
- Easier to scan and find specific calls
- No important information removed

## Scope

**Includes:**
- Reducing card padding
- Tightening vertical spacing
- Maintaining readability

**Excludes:**
- Removing card content/fields
- Changing card layout structure
- Mobile-specific changes

## Acceptance Criteria

- [ ] Card height reduced by ~30-50%
- [ ] All essential info still visible
- [ ] More cards visible per screen
- [ ] No cramped or unreadable text
- [ ] Consistent spacing with other cards

## User Story

**As a** CallVault user browsing calls
**I want** compact call cards
**So that** I can see more calls without scrolling

---

*Spec ready for PRD generation.*
