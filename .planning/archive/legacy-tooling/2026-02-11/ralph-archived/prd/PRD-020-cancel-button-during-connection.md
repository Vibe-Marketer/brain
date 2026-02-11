# PRD-020: Cancel/Close Button During Connection

**Status:** Ready for Implementation
**Priority:** P0 - CRITICAL BUG
**Category:** Import/Integrations
**Spec:** [SPEC-020](../../specs/spec-020-cancel-button-during-connection.md)
**Created:** 2026-01-14

---

## Overview

Fix the X button and cancel options that don't work during connection spinner. Users are currently trapped and cannot exit the connection flow.

## Problem Statement

Users are completely stuck during connection attempts. X button and Cancel don't respond, forcing a page refresh to escape. This is a critical UX failure.

## Goals

1. Ensure cancel/close always works
2. Allow user to abort any operation
3. Never trap users in modal

## User Stories

**US-020.1:** As a CallVault user, I want to cancel out of a connection at any time so that I'm never stuck waiting for something that might never complete.

## Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | X button closes modal during any state | Must Have |
| FR-002 | Cancel button works during any state | Must Have |
| FR-003 | Pending operations cleaned up on cancel | Must Have |
| FR-004 | No stuck states possible | Must Have |

## Technical Approach

**File:** `src/components/sync/InlineConnectionWizard.tsx`

```tsx
const handleCancel = () => {
  abortController?.abort();  // Abort any fetch requests
  setConnectionState('idle');
  onCancel();
};
```

Ensure cancel handlers:
1. Abort any fetch requests
2. Clear pending state
3. Close modal immediately
4. Reset wizard state

## Acceptance Criteria

- [ ] X button works during loading
- [ ] Cancel button works during loading
- [ ] Pending operations aborted
- [ ] User can always exit
- [ ] No stuck states

---

*PRD generated from SPEC-020*
