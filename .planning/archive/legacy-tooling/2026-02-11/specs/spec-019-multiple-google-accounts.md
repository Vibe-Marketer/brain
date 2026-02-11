# SPEC-019: Multiple Google Account Handling

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Import/Integrations
**Priority:** UX Enhancement

---

## Summary

Handle multiple Google account scenarios properly. Show clear indication when a Google account is already connected, and either allow multiple accounts or explain why not.

## What

Improve UX for users with existing Google connections who try to connect additional accounts.

**Files to investigate:**
- `src/components/sync/IntegrationStatusRow.tsx`
- `src/components/sync/InlineConnectionWizard.tsx`
- Google integration state management

**Current issues:**
1. No indication if Google already connected
2. No prevention/info about conflicts when connecting additional accounts
3. Confusing state

**Done:**
- Clear display of currently connected Google account
- If additional accounts allowed: flow to add more
- If not allowed: clear explanation

## Why

- Users don't know current state
- Connecting duplicate/conflicting accounts causes issues
- Clear status prevents user confusion
- Proper handling of common use case

## User Experience

**If already connected:**
- User sees "Google Meet - Connected (email@example.com)"
- Option to disconnect or add another (if supported)

**If connecting additional:**
- Clear messaging about what will happen
- Either allows multiple or explains limitation

## Scope

**Includes:**
- Showing connected account email
- Handling "already connected" state
- Clear messaging for multiple account scenarios

**Excludes:**
- Backend changes to support multiple accounts (if not already supported)

## Acceptance Criteria

- [ ] Connected Google account shows email/identifier
- [ ] Clear "Connected" status visible
- [ ] Attempt to connect again either works or explains why not
- [ ] No silent failures or confusing states

## User Story

**As a** CallVault user with multiple Google accounts
**I want** clear visibility into which account is connected
**So that** I can manage my integrations properly

---

*Spec ready for PRD generation.*
