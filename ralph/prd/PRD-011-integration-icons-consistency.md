# PRD-011: Integration Icons Consistency

**Status:** Ready for Implementation
**Priority:** P2 - UI Consistency
**Category:** Import/Integrations
**Spec:** [SPEC-011](../../specs/spec-011-integration-icons-consistency.md)
**Created:** 2026-01-14

---

## Overview

Ensure integration icons (Zoom, Google Meet, Fathom) are identical in the import/integrations area and the main transcripts page.

## Problem Statement

Different icons are used for the same integrations in different parts of the app, creating visual inconsistency and potential user confusion.

## Goals

1. Consistent icon usage across entire app
2. Clear visual recognition of each integration
3. Professional, cohesive appearance

## User Stories

**US-011.1:** As a CallVault user, I want consistent icons for each integration so that I can quickly recognize each service regardless of where I am in the app.

## Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Zoom icon matches across all screens | Must Have |
| FR-002 | Google Meet icon matches across all screens | Must Have |
| FR-003 | Fathom icon matches across all screens | Must Have |

## Technical Approach

1. Audit icons used in transcripts page
2. Update integration area icons to match
3. Consider creating shared icon constants

**Files:**
- `src/components/sync/IntegrationStatusRow.tsx`
- `src/components/sync/IntegrationSyncPane.tsx`

## Acceptance Criteria

- [ ] Zoom icon consistent everywhere
- [ ] Google Meet icon consistent everywhere
- [ ] Fathom icon consistent everywhere
- [ ] No visual inconsistencies between screens

---

*PRD generated from SPEC-011*
