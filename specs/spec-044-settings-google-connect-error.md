# SPEC-044: Settings - Google Connect Error

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Settings
**Priority:** CRITICAL BUG

---

## Summary

Fix the Google integration connection error in Settings. Clicking allow returns "edge function returned a non-200 code" and integration remains "Not Connected."

## What

Debug and fix the Google OAuth callback/integration in Settings.

**Files to investigate:**
- `src/components/settings/IntegrationsTab.tsx`
- Google OAuth edge function
- `supabase/functions/` for Google handler

**Current issues:**
1. User clicks Allow on Google permissions (Drive and Calendar)
2. Returns "edge function returned a non-200 code" error
3. Integration remains "Not Connected"

**Done:** Google OAuth completes successfully and shows "Connected" status

## Why

- Critical integration broken
- Users can't connect Google services
- Error message is technical, not user-friendly
- Blocks Google integration functionality

## User Experience

- User clicks connect → Google OAuth screen
- User grants permissions
- Redirect back → "Connected" status
- Integration works

## Scope

**Includes:**
- Debugging edge function error
- Fixing OAuth callback handling
- User-friendly error messages
- Proper connection status update

**Excludes:**
- Adding new Google scopes
- Redesigning integration flow

## Acceptance Criteria

- [ ] Google OAuth completes without error
- [ ] "Connected" status shows after success
- [ ] User-friendly error messages on failure
- [ ] Edge function returns 200 on success

## User Story

**As a** CallVault user
**I want** to connect Google successfully
**So that** I can use Google integration features

---

## Technical Notes

Related to SPEC-018 (Google Connect Infinite Spinner) - may be same root cause.

Check:
1. Edge function logs
2. OAuth redirect handling
3. Token storage
4. Status update logic

---

*Spec ready for PRD generation.*
