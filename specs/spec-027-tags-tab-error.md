# SPEC-027: Tags Tab Error

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Sorting & Tagging
**Priority:** CRITICAL BUG

---

## Summary

Fix the error that occurs when clicking the Tags tab. Currently produces a big error and the screen blinks/flickers back and forth.

## What

Debug and fix the Tags tab error in the Sorting & Tagging page.

**Files to investigate:**
- `src/pages/SortingTagging.tsx`
- Tags tab component
- Associated data fetching hooks

**Current issues:**
1. Clicking Tags produces error
2. Screen blinks/flickers
3. Tab won't load

**Done:** Tags tab loads properly without errors

## Why

- Feature completely broken
- Core functionality unusable
- Error indicates underlying code issue
- Blocks users from managing tags

## User Experience

- User clicks Tags tab → tab loads with tag management interface
- No errors, no flickering
- Full functionality available

## Scope

**Includes:**
- Debugging error cause
- Fixing rendering issue
- Preventing flicker

**Excludes:**
- Adding new tag features
- Redesigning tags interface

## Acceptance Criteria

- [ ] Tags tab loads without error
- [ ] No screen flickering
- [ ] Tag management functionality works
- [ ] Console shows no errors

## User Story

**As a** CallVault user
**I want** the Tags tab to work
**So that** I can manage my call tags

---

## Technical Investigation

Check for:
1. Missing data causing render error
2. Infinite re-render loop (causing flicker)
3. Undefined component/prop access
4. Error boundary not catching error

---

*Spec ready for PRD generation.*
