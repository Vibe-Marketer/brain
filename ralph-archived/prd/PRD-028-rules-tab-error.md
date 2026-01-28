# PRD-028: Rules Tab Error

**Status:** Ready for Implementation
**Priority:** P0 - CRITICAL BUG
**Category:** Sorting & Tagging
**Spec:** [SPEC-028](../../specs/spec-028-rules-tab-error.md)
**Created:** 2026-01-14

---

## Overview

Fix the error that occurs when clicking the Rules tab. Same symptoms as Tags tab error - likely same root cause.

## Problem Statement

The Rules tab is broken with the same error symptoms as Tags. Users cannot access automation rules.

## Goals

1. Restore Rules tab functionality
2. Enable automation rule management
3. May be fixed alongside PRD-027 if same cause

## User Stories

**US-028.1:** As a CallVault user, I want the Rules tab to work so that I can set up automation rules.

## Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Rules tab loads without error | Must Have |
| FR-002 | No screen flickering | Must Have |
| FR-003 | Rules management functionality works | Must Have |

## Technical Investigation

Likely same root cause as PRD-027. Debug together.

**Files:**
- `src/pages/SortingTagging.tsx`
- Rules tab component

## Acceptance Criteria

- [ ] Rules tab loads without error
- [ ] No screen flickering
- [ ] Rules management works
- [ ] Console shows no errors

---

*PRD generated from SPEC-028*
