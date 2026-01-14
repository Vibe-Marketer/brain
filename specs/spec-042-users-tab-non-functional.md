# SPEC-042: Users Tab - Non-Functional Elements

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Settings
**Priority:** CRITICAL BUG

---

## Summary

Fix all non-functional elements in the Users tab. Status, Joined date, and View Details don't work or do anything.

## What

Make all Users tab elements functional.

**Files to investigate:**
- Users tab component
- User management hooks/APIs
- `src/components/settings/` directory

**Current issues:**
1. Status field doesn't work
2. Joined date non-functional
3. View Details does nothing
4. All user management broken

**Done:** All user management functions operational

## Why

- Core admin functionality broken
- Team management is critical feature
- Elements exist but do nothing
- Confusing and unprofessional

## User Experience

- Admin sees user status (active, pending, etc.)
- Admin sees when users joined
- Clicking "View Details" shows user detail panel
- All interactions work as expected

## Scope

**Includes:**
- Fixing Status display/functionality
- Fixing Joined date display
- Fixing View Details action
- Any other non-functional user management elements

**Excludes:**
- Adding new user management features
- Redesigning user management UI

## Acceptance Criteria

- [ ] Status displays correctly and is functional
- [ ] Joined date shows when user was added
- [ ] View Details opens user detail view
- [ ] All displayed elements are functional
- [ ] No "dead" UI elements

## User Story

**As a** CallVault admin
**I want** user management to work
**So that** I can manage my team effectively

---

*Spec ready for PRD generation.*
