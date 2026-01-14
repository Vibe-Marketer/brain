# SPEC-011: Integration Icons Consistency

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Import/Integrations
**Priority:** UI Consistency

---

## Summary

Replace integration icons in the import/integrations area with the exact same icons used on the main transcripts page for visual consistency.

## What

Audit and update integration icons (Zoom, Google Meet, Fathom) to match icons used elsewhere in the app.

**Files to investigate:**
- `src/components/sync/IntegrationStatusRow.tsx`
- `src/components/sync/IntegrationSyncPane.tsx`
- Main transcripts page icon usage

**Current:** Different/inconsistent icons in integrations area
**Done:** Same icons used everywhere for each integration

## Why

- Inconsistent icons confuse users
- Same integration should have same visual representation
- Brand consistency is critical
- Users shouldn't wonder if Zoom here is the same as Zoom there

## User Experience

- User sees consistent icons across the entire app
- Zoom icon in integrations = Zoom icon in transcripts list
- Visual language is coherent

## Scope

**Includes:**
- Identifying correct icons from transcripts page
- Updating integration area icons to match
- All integration types (Zoom, Google Meet, Fathom)

**Excludes:**
- Changing icon library (still use Remix Icons)
- Creating new icons

## Acceptance Criteria

- [ ] Zoom icon matches across all screens
- [ ] Google Meet icon matches across all screens
- [ ] Fathom icon matches across all screens
- [ ] No visual inconsistencies

## User Story

**As a** CallVault user
**I want** consistent icons for each integration
**So that** I can quickly recognize each service regardless of where I am in the app

---

*Spec ready for PRD generation.*
