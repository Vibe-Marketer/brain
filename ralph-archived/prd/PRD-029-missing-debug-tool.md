# PRD-029: Missing Debug Tool

**Status:** Ready for Implementation
**Priority:** P3 - Admin Feature
**Category:** Sorting & Tagging
**Spec:** [SPEC-029](../../specs/spec-029-missing-debug-tool.md)
**Created:** 2026-01-14

---

## Overview

Restore the debug script/tool that was previously available on the Sorting & Tagging page. Currently not showing for admin accounts.

## Problem Statement

Debug tool that was previously working is now missing. Admin/dev users need this for diagnostics and support.

## Goals

1. Restore debug tool visibility
2. Enable admin diagnostics
3. Fix regression

## User Stories

**US-029.1:** As a CallVault admin/developer, I want access to the debug tool so that I can diagnose issues.

## Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Debug tool visible for admin/dev accounts | Must Have |
| FR-002 | Correct permission checks in place | Must Have |
| FR-003 | Tool functionality works | Must Have |
| FR-004 | Hidden from regular users (if intended) | Should Have |

## Technical Investigation

Check:
1. Was component removed or just hidden?
2. Permission check logic changed?
3. User role/flags required?

**Files:**
- `src/pages/SortingTagging.tsx`
- Debug tool component

## Acceptance Criteria

- [ ] Debug tool visible for admin accounts
- [ ] Permission checks working correctly
- [ ] Tool functionality intact
- [ ] Hidden from regular users (if by design)

---

*PRD generated from SPEC-029*
