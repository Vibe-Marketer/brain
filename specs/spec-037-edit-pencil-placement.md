# SPEC-037: Edit Pencil Placement

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Settings
**Priority:** UI Polish

---

## Summary

Move edit pencil icons inside their associated input boxes rather than appearing as separate buttons outside the field.

## What

Relocate edit icons to be inside input fields rather than beside them.

**Files to investigate:**
- `src/components/settings/` directory
- Settings form components

**Current:** Edit pencils appear outside boxes, in separate buttons next to fields
**Done:** Edit icons inside input boxes - users can click within field to edit

## Why

- Current placement is non-intuitive
- Users expect to click in a field to edit it
- Inline edit icons are more discoverable
- Cleaner visual design

## User Experience

- User sees input field with pencil icon inside (right side)
- User clicks field or pencil → enters edit mode
- More intuitive interaction pattern

## Scope

**Includes:**
- Moving edit icons inside input containers
- Updating click handlers
- Consistent pattern across all editable fields

**Excludes:**
- Changing what fields are editable
- Adding inline editing where it doesn't exist

## Acceptance Criteria

- [ ] Edit icons inside input fields
- [ ] Clicking anywhere on field enables edit
- [ ] Consistent across all settings fields
- [ ] Clear visual indication of editability

## User Story

**As a** CallVault user
**I want** to click on a field to edit it
**So that** the interaction is intuitive

---

*Spec ready for PRD generation.*
