# SPEC-036: Excessive Divider Lines in Settings

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Settings
**Priority:** UI Polish

---

## Summary

Remove unnecessary divider lines throughout the Settings page that clutter the interface and reduce visual hierarchy effectiveness.

## What

Audit and remove excessive dividers in Settings UI.

**Files to investigate:**
- `src/pages/Settings*.tsx`
- `src/components/settings/` directory

**Current:** Way too many divider lines throughout settings
**Done:** Streamlined visual hierarchy with appropriate separators

## Why

- Excessive dividers create visual noise
- Reduces effectiveness of intentional separators
- Makes page feel cluttered
- Harder to scan and find settings

## User Experience

- User sees clean settings page
- Dividers only where sections genuinely need separation
- Clear visual hierarchy without clutter

## Scope

**Includes:**
- Auditing all dividers in Settings
- Removing unnecessary ones
- Keeping functional separators

**Excludes:**
- Redesigning settings layout
- Removing all dividers

## Acceptance Criteria

- [ ] Dividers only between major sections
- [ ] No redundant or decorative dividers
- [ ] Clear visual hierarchy maintained
- [ ] Page feels cleaner and scannable

## User Story

**As a** CallVault user
**I want** a clean settings page
**So that** I can easily find and change settings

---

*Spec ready for PRD generation.*
