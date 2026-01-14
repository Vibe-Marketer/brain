# SPEC-039: Email Edit Functionality

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Settings
**Priority:** Feature Gap

---

## Summary

Add the ability to edit email address in settings. Currently there's no way to change account email.

## What

Add email edit capability to account settings.

**Files to investigate:**
- Account settings components
- `src/components/settings/` directory
- User profile API

**Current:** No way to edit email address
**Done:** Email address can be edited (with proper verification flow)

## Why

- Users need to update email over time
- Can't correct typos from signup
- Standard account management feature
- Missing basic functionality

## User Experience

- User clicks edit on email field
- User enters new email
- Verification email sent to new address
- Email updated after verification

## Scope

**Includes:**
- Adding edit button to email field
- Email change flow
- Verification requirement (security)

**Excludes:**
- Changing without verification
- Multiple email addresses

## Acceptance Criteria

- [ ] Email field has edit option
- [ ] New email requires verification
- [ ] Clear feedback during process
- [ ] Email updates after verification

## User Story

**As a** CallVault user
**I want** to change my email address
**So that** I can keep my account up to date

---

## Security Notes

Email change should require:
1. Current session authentication
2. Verification of new email address
3. Optional: notification to old email

---

*Spec ready for PRD generation.*
