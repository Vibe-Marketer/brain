# SPEC-040: New Profile Creation Flow

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Settings
**Priority:** UX Bug

---

## Summary

Fix the new profile creation flow issues: no indication to scroll down, content doesn't update when switching profiles.

## What

Improve the profile creation and selection UX.

**Files to investigate:**
- Profile settings components
- `src/components/settings/` directory

**Current issues:**
1. Creating profile gives no indication user needs to scroll to fill it out
2. Content doesn't update when switching profiles in selector
3. Still shows CallVault data instead of selected profile

**Done:**
1. Auto-scroll to new profile after creation, OR clear indication
2. Profile selector updates displayed content
3. Correct profile data shown when selected

## Why

- Users don't know to scroll down
- Profile switching doesn't work as expected
- Confusing disconnect between selector and content
- Core profile management broken

## User Experience

- User creates new profile → scrolls to or sees the new profile form
- User switches profiles → content updates immediately
- Selected profile's data is displayed, not default data

## Scope

**Includes:**
- Auto-scroll or indication after profile creation
- Fixing profile selector to update content
- Ensuring correct data displays for selected profile

**Excludes:**
- Adding new profile types
- Redesigning profile structure

## Acceptance Criteria

- [ ] New profile creation leads user to the form
- [ ] Profile selector updates content on change
- [ ] Correct profile data always displayed
- [ ] No stale/wrong data shown

## User Story

**As a** CallVault user with multiple profiles
**I want** profile management to work correctly
**So that** I can maintain separate business profiles

---

*Spec ready for PRD generation.*
