# SPEC-018: Google Connect Infinite Spinner

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Import/Integrations
**Priority:** CRITICAL BUG

---

## Summary

Fix the infinite spinner issue when connecting Google. Currently, after clicking connect, the spinner runs indefinitely with no error messages, timeout, or feedback.

## What

Add proper timeout and error handling to Google connection flow.

**Files to investigate:**
- `src/components/sync/InlineConnectionWizard.tsx`
- Google OAuth callback handling
- `supabase/functions/` for Google edge functions

**Current issues:**
1. Spinner runs indefinitely
2. No timeout
3. No error messages
4. No user feedback
5. User is stuck

**Done:**
- Connection succeeds with confirmation, OR
- Connection fails with clear error message

## Why

- User is completely stuck
- No way to recover from failed state
- No indication of what went wrong
- Critical usability failure

## User Experience

- User clicks connect → spinner appears
- After reasonable time (30 seconds), either:
  - Success: "Connected successfully" message
  - Failure: Clear error message explaining issue
- User can retry or cancel at any time

## Scope

**Includes:**
- Adding timeout (30 seconds recommended)
- Error state UI
- Clear error messages
- Retry capability
- Cancel button that works during spinner

**Excludes:**
- Fixing underlying OAuth issues (separate spec if needed)

## Acceptance Criteria

- [ ] Spinner has maximum timeout
- [ ] Success shows confirmation message
- [ ] Failure shows specific error message
- [ ] User can cancel during loading
- [ ] Retry option available on failure

## User Story

**As a** CallVault user connecting Google
**I want** clear feedback on connection status
**So that** I know if it worked or what went wrong

---

## Technical Notes

Implement loading states:
```tsx
type ConnectionState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success' }
  | { status: 'error', message: string }
  | { status: 'timeout' };
```

---

*Spec ready for PRD generation.*
