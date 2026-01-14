# PRD-007: Extra Line at Top of Import Screen

**Status:** Ready for Implementation
**Priority:** P3 - UI Polish
**Category:** Import/Integrations
**Spec:** [SPEC-007](../../specs/spec-007-import-extra-line.md)
**Created:** 2026-01-14

---

## Overview

Remove the unnecessary extra line/divider at the very top of the import screen that adds visual clutter without serving a purpose.

## Problem Statement

An extra visual line element at the top of the import screen adds clutter without any functional or organizational benefit.

## Goals

1. Clean up visual clutter
2. Improve header appearance
3. Align with minimal design aesthetic

## User Stories

**US-007.1:** As a CallVault user, I want the import screen to have a clean header so that I'm not distracted by unnecessary visual elements.

## Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | No extra line at top of import screen | Must Have |
| FR-002 | Header remains properly styled | Must Have |

## Technical Approach

**Files to investigate:**
- `src/components/sync/IntegrationSyncPane.tsx`
- Import page/modal component

Find and remove the extra divider/line element at the top of the import screen.

## Acceptance Criteria

- [ ] No extra line at top of import screen
- [ ] Header remains properly styled
- [ ] No layout regressions

---

*PRD generated from SPEC-007*
