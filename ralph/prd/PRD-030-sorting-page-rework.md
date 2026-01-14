# PRD-030: Sorting & Tagging Page Complete Rework

**Status:** Ready for Implementation
**Priority:** P0 - CRITICAL EPIC
**Category:** Sorting & Tagging
**Spec:** [SPEC-030](../../specs/spec-030-sorting-page-rework.md)
**Created:** 2026-01-14

---

## Overview

The Sorting & Tagging page is fundamentally broken. A complete rework is needed to restore all functionality.

## Problem Statement

Multiple critical features are broken on this page - Tags tab, Rules tab, and the debug tool. The page is essentially unusable.

## Goals

1. Restore all tab functionality
2. Fix all errors
3. Create stable, usable page

## User Stories

**US-030.1:** As a CallVault user, I want the Sorting & Tagging page to work completely so that I can organize and automate my call management.

## Requirements

This is an EPIC encompassing:
- PRD-027: Tags Tab Error
- PRD-028: Rules Tab Error
- PRD-029: Missing Debug Tool

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | All tabs load without errors | Must Have |
| FR-002 | No screen flickering on any transition | Must Have |
| FR-003 | Tag management fully functional | Must Have |
| FR-004 | Rules management fully functional | Must Have |
| FR-005 | Debug tool accessible for admins | Should Have |

## Technical Approach

May require:
1. Error boundary implementation
2. Data loading fixes
3. State management review
4. Component stability fixes

**Files:**
- `src/pages/SortingTagging.tsx`
- All tab components
- Associated hooks

## Acceptance Criteria

- [ ] All tabs load without errors
- [ ] No flickering on any interaction
- [ ] Tag management works
- [ ] Rules management works
- [ ] Debug tool accessible
- [ ] No console errors
- [ ] Stable after multiple tab switches

---

*PRD generated from SPEC-030*
