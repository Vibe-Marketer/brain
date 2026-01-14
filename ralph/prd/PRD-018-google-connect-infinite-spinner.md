# PRD-018: Google Connect Infinite Spinner

**Status:** Ready for Implementation
**Priority:** P0 - CRITICAL BUG
**Category:** Import/Integrations
**Spec:** [SPEC-018](../../specs/spec-018-google-connect-infinite-spinner.md)
**Created:** 2026-01-14

---

## Overview

Fix the infinite spinner issue when connecting Google. After clicking connect, the spinner runs indefinitely with no error messages, timeout, or feedback.

## Problem Statement

Users are stuck in an infinite loading state with no way to know if the connection is progressing, failed, or needs intervention. Complete UX failure.

## Goals

1. Add proper timeout handling
2. Provide clear success/failure feedback
3. Allow user recovery from stuck states

## User Stories

**US-018.1:** As a CallVault user connecting Google, I want clear feedback on connection status so that I know if it worked or what went wrong.

## Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Spinner has maximum timeout (30 seconds) | Must Have |
| FR-002 | Success shows confirmation message | Must Have |
| FR-003 | Failure shows specific error message | Must Have |
| FR-004 | User can cancel during loading | Must Have |
| FR-005 | Retry option available on failure | Should Have |

## Technical Approach

**File:** `src/components/sync/InlineConnectionWizard.tsx`

Implement connection states:
```tsx
type ConnectionState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success' }
  | { status: 'error', message: string }
  | { status: 'timeout' };
```

Add timeout with `setTimeout` and cleanup on unmount.

## Acceptance Criteria

- [ ] Spinner times out after 30 seconds
- [ ] Success message on successful connection
- [ ] Error message on failure
- [ ] Cancel button works during loading
- [ ] User can retry after failure

---

*PRD generated from SPEC-018*
