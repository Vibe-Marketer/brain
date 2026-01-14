# SPEC-028: Rules Tab Error

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Sorting & Tagging
**Priority:** CRITICAL BUG

---

## Summary

Fix the error that occurs when clicking the Rules tab. Same symptoms as the Tags tab error - won't load, likely same root cause.

## What

Debug and fix the Rules tab error in the Sorting & Tagging page.

**Files to investigate:**
- `src/pages/SortingTagging.tsx`
- Rules tab component
- Associated data fetching hooks

**Current:** Clicking Rules produces error, won't load
**Done:** Rules tab loads properly without errors

## Why

- Feature completely broken
- May share root cause with Tags error
- Core functionality unusable
- Blocks users from managing automation rules

## User Experience

- User clicks Rules tab → tab loads with rules management interface
- No errors, no flickering
- Full functionality available

## Scope

**Includes:**
- Debugging error cause
- Fixing rendering issue
- May be fixed alongside SPEC-027 if same root cause

**Excludes:**
- Adding new rules features
- Redesigning rules interface

## Acceptance Criteria

- [ ] Rules tab loads without error
- [ ] No screen flickering
- [ ] Rules management functionality works
- [ ] Console shows no errors

## User Story

**As a** CallVault user
**I want** the Rules tab to work
**So that** I can set up automation rules

---

## Technical Investigation

Likely same root cause as SPEC-027 (Tags Tab Error). Debug together.

---

*Spec ready for PRD generation.*
