# SPEC-007: Extra Line at Top of Import Screen

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Import/Integrations
**Priority:** UI Polish

---

## Summary

Remove the unnecessary extra line/divider at the very top of the import screen that adds visual clutter without serving a purpose.

## What

Identify and remove the extra visual line element at the top of the import/integrations screen.

**Files to investigate:**
- `src/components/sync/IntegrationSyncPane.tsx`
- Import page/modal component

**Current:** Extra line visible at top
**Done:** Clean header with no unnecessary dividers

## Why

- Unnecessary visual element adds clutter
- Doesn't serve any functional or organizational purpose
- Detracts from clean, minimal design aesthetic

## User Experience

- User opens import screen → sees clean header without extra lines
- Improved visual hierarchy

## Scope

**Includes:**
- Finding and removing the extra line element
- Verifying removal doesn't break layout

**Excludes:**
- Removing necessary separators between sections

## Acceptance Criteria

- [ ] No extra line at top of import screen
- [ ] Header remains properly styled
- [ ] No layout regressions

## User Story

**As a** CallVault user
**I want** the import screen to have a clean header
**So that** I'm not distracted by unnecessary visual elements

---

*Spec ready for PRD generation.*
