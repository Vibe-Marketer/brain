# SPEC-033: Coach Invite - Email Not Sending

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Collaboration
**Priority:** CRITICAL BUG

---

## Summary

Fix the coach email invitation feature. Currently shows email input field but submitting doesn't actually send any email.

## What

Debug and fix email invitation functionality for coaches.

**Files to investigate:**
- Coach invite component
- `src/pages/CollaborationPage.tsx`
- Email sending edge function

**Current:** Email input accepts address, submission does nothing, no email sent
**Done:** Email invitations actually send

## Why

- Core feature completely broken
- Users can't invite coaches via email
- No error feedback - user thinks it worked
- Blocks collaboration workflow

## User Experience

- User enters coach email address
- User clicks send/invite
- Email is sent to coach
- User sees confirmation
- Coach receives invite email

## Scope

**Includes:**
- Fixing email send functionality
- Adding success/error feedback
- Ensuring email actually delivers

**Excludes:**
- Redesigning invite flow
- Adding new invite methods

## Acceptance Criteria

- [ ] Email invitation sends when submitted
- [ ] Success message shown
- [ ] Error message if send fails
- [ ] Coach receives email
- [ ] Email contains proper invite content

## User Story

**As a** CallVault user
**I want** to invite coaches via email
**So that** I can get coaching feedback on my calls

---

## Technical Investigation

Check:
1. Email sending service configured?
2. API endpoint being called?
3. Email template exists?
4. Error being swallowed?

---

*Spec ready for PRD generation.*
