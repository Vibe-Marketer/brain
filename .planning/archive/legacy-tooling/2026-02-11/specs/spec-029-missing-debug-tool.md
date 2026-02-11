# SPEC-029: Missing Debug Tool

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Sorting & Tagging
**Priority:** Admin Feature

---

## Summary

Restore the debug script/tool that was previously available on the Sorting & Tagging page. Currently not showing for the user's account.

## What

Investigate and restore debug tool visibility for appropriate accounts.

**Files to investigate:**
- `src/pages/SortingTagging.tsx`
- Debug tool component
- User role/permission checks

**Current:** Debug tool previously visible, now missing for user's account
**Done:** Debug tool visible for appropriate accounts (admin/dev users)

## Why

- Development/debugging tool needed for support
- Was working before, regression
- Admin users need diagnostic capabilities
- Support efficiency depends on it

## User Experience

- Admin/dev users see debug tool on page
- Regular users don't see it (if by design)
- Tool provides expected debugging functionality

## Scope

**Includes:**
- Finding debug tool component
- Checking visibility conditions
- Restoring for appropriate user types

**Excludes:**
- Showing debug tool to all users
- Creating new debug features

## Acceptance Criteria

- [ ] Debug tool visible for admin/dev accounts
- [ ] Correct permission checks in place
- [ ] Tool functionality works
- [ ] Hidden from regular users (if intended)

## User Story

**As a** CallVault admin/developer
**I want** access to the debug tool
**So that** I can diagnose issues

---

## Technical Investigation

Check:
1. Was component removed or just hidden?
2. Permission check logic changed?
3. User role/flags required?

---

*Spec ready for PRD generation.*
