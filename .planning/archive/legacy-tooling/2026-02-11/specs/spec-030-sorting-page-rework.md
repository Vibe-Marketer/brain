# SPEC-030: Sorting & Tagging Page Complete Rework

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Sorting & Tagging
**Priority:** CRITICAL - EPIC

---

## Summary

The Sorting & Tagging page is fundamentally broken. A complete rework is needed to remove all bugs and make all tabs functional.

## What

Comprehensive fix/rework of the Sorting & Tagging page to restore full functionality.

**Files to investigate:**
- `src/pages/SortingTagging.tsx`
- All tab components
- Associated hooks and data fetching

**Current issues:**
1. Tags tab broken (SPEC-027)
2. Rules tab broken (SPEC-028)
3. Debug tool missing (SPEC-029)
4. General instability

**Done:** All tabs functional, stable page, no errors

## Why

- Page is fundamentally unusable
- Multiple critical features blocked
- Core product functionality missing
- Needs coordinated fix, not piecemeal patches

## User Experience

- User navigates to Sorting & Tagging
- All tabs (Tags, Rules, etc.) load properly
- Full functionality available
- No errors, no flickering, stable experience

## Scope

**Includes:**
- Fixing Tags tab (SPEC-027)
- Fixing Rules tab (SPEC-028)
- Restoring debug tool (SPEC-029)
- Ensuring overall page stability
- Testing all tab transitions

**Excludes:**
- Adding new features
- Redesigning page layout

## Acceptance Criteria

- [ ] All tabs load without errors
- [ ] No screen flickering on any transition
- [ ] Tag management fully functional
- [ ] Rules management fully functional
- [ ] Debug tool accessible (for admins)
- [ ] No console errors
- [ ] Stable after multiple tab switches

## User Story

**As a** CallVault user
**I want** the Sorting & Tagging page to work completely
**So that** I can organize and automate my call management

---

## Implementation Notes

This is an EPIC spec that encompasses:
- SPEC-027: Tags Tab Error
- SPEC-028: Rules Tab Error
- SPEC-029: Missing Debug Tool

May require:
1. Error boundary implementation
2. Data loading fixes
3. State management review
4. Component stability fixes

---

*Spec ready for PRD generation.*
