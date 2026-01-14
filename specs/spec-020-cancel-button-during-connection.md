# SPEC-020: Cancel/Close Button During Connection

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Import/Integrations
**Priority:** CRITICAL BUG

---

## Summary

Fix the X button and cancel options that don't work during connection spinner. Users are currently stuck and cannot exit the connection flow.

## What

Ensure cancel/close buttons work at all times, including during loading states.

**Files to investigate:**
- `src/components/sync/InlineConnectionWizard.tsx`
- Modal/dialog close handlers

**Current issues:**
1. X button doesn't respond during spinner
2. Cancel button doesn't work
3. User is completely stuck
4. Must refresh page to escape

**Done:**
- X button always closes modal
- Cancel always works
- Connection attempt aborted if user cancels

## Why

- Users are trapped
- No escape route from broken/slow connections
- Violates basic UX principles
- Forces page refresh to recover

## User Experience

- User starts connection → spinner appears
- User decides to cancel → clicks X or Cancel
- Modal closes immediately
- Any pending connection is aborted

## Scope

**Includes:**
- Making X button always functional
- Making Cancel button always functional
- Aborting/cleaning up pending connection on cancel

**Excludes:**
- Fixing connection success/failure (separate specs)

## Acceptance Criteria

- [ ] X button closes modal during any state
- [ ] Cancel button works during any state
- [ ] Pending operations are cleaned up
- [ ] No stuck states
- [ ] User can always exit

## User Story

**As a** CallVault user
**I want** to cancel out of a connection at any time
**So that** I'm never stuck waiting for something that might never complete

---

## Technical Notes

Ensure cancel handlers:
1. Abort any fetch requests
2. Clear any pending state
3. Close modal immediately
4. Reset wizard state

```tsx
const handleCancel = () => {
  abortController?.abort();
  setConnectionState('idle');
  onCancel();
};
```

---

*Spec ready for PRD generation.*
