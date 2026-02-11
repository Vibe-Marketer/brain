# PRD-012: Connect Button Active State

**Status:** Ready for Implementation
**Priority:** P3 - UI Polish
**Category:** Import/Integrations
**Spec:** [SPEC-012](../../specs/spec-012-connect-button-active-state.md)
**Created:** 2026-01-14

---

## Overview

Fix the grayed-out appearance of Connect buttons when integrations aren't connected. Buttons should appear fully active and clickable.

## Problem Statement

Connect buttons appear grayed out when integrations aren't connected, suggesting a disabled state. This may cause users to think they can't click the button.

## Goals

1. Clear visual indication that action is available
2. Invite user interaction
3. Follow button design guidelines

## User Stories

**US-012.1:** As a CallVault user, I want Connect buttons to look clickable so that I know I can interact with them.

## Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Connect buttons appear fully active (not grayed) | Must Have |
| FR-002 | Clear visual distinction from truly disabled states | Must Have |
| FR-003 | Meet accessibility contrast requirements | Must Have |

## Technical Approach

**Files:**
- `src/components/sync/IntegrationStatusRow.tsx`
- `src/components/sync/AddIntegrationButton.tsx`

Update button styling for disconnected integrations to use active/default variant instead of muted appearance.

## Acceptance Criteria

- [ ] Connect buttons appear fully active (not grayed)
- [ ] Sufficient contrast and visibility
- [ ] Consistent across all integration types

---

*PRD generated from SPEC-012*
