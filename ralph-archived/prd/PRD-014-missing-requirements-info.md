# PRD-014: Missing Requirements Information

**Status:** Ready for Implementation
**Priority:** P2 - UX Bug
**Category:** Import/Integrations
**Spec:** [SPEC-014](../../specs/spec-014-missing-requirements-info.md)
**Created:** 2026-01-14

---

## Overview

Fix the screen that says "Understand the requirements" but displays no actual requirements. Either show real requirements or remove the acknowledgment checkbox entirely.

## Problem Statement

Users are asked to check a box saying they "reviewed requirements" when no requirements are actually displayed. This is deceptive and potentially problematic from a legal/compliance perspective.

## Goals

1. Either show actual requirements OR remove acknowledgment
2. Ensure users only acknowledge content they can see
3. Build trust through honest UI

## User Stories

**US-014.1:** As a CallVault user, I want to only acknowledge requirements I can actually read so that I know what I'm agreeing to.

## Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | No empty "requirements" screens | Must Have |
| FR-002 | If requirements exist, display them | Must Have |
| FR-003 | If no requirements, no acknowledgment checkbox | Must Have |

## Technical Approach

**Option A:** Display real requirements content
**Option B:** Remove the empty requirements step entirely

**File:** `src/components/sync/InlineConnectionWizard.tsx`

## Acceptance Criteria

- [ ] No empty requirements screens
- [ ] If requirements exist, they're displayed
- [ ] If no requirements, no acknowledgment checkbox
- [ ] User never acknowledges invisible content

---

*PRD generated from SPEC-014*
