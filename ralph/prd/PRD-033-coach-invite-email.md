# PRD-033: Coach Invite - Email Not Sending

**Status:** Ready for Implementation
**Priority:** P0 - CRITICAL BUG
**Category:** Collaboration
**Spec:** [SPEC-033](../../specs/spec-033-coach-invite-email.md)
**Created:** 2026-01-14

---

## Overview

Fix the coach email invitation feature. Shows email input but submitting doesn't actually send any email.

## Problem Statement

Email invitations are completely broken. Users enter coach emails, submit, see no error, but no email is ever sent. Users think it worked when it didn't.

## Goals

1. Restore email invitation functionality
2. Provide proper feedback
3. Enable coach onboarding workflow

## User Stories

**US-033.1:** As a CallVault user, I want to invite coaches via email so that I can get coaching feedback on my calls.

## Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Email invitation sends when submitted | Must Have |
| FR-002 | Success message shown | Must Have |
| FR-003 | Error message if send fails | Must Have |
| FR-004 | Coach receives invitation email | Must Have |

## Technical Investigation

Check:
1. Email service configured?
2. API endpoint being called?
3. Email template exists?
4. Error being swallowed?

**Files:**
- `src/pages/CollaborationPage.tsx`
- Email sending edge function

## Acceptance Criteria

- [ ] Email sends on submission
- [ ] Success confirmation shown
- [ ] Error message on failure
- [ ] Coach receives proper invite email

---

*PRD generated from SPEC-033*
