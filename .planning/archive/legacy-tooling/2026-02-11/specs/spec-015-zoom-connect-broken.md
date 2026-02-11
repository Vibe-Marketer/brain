# SPEC-015: Zoom Connect Button Broken

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Import/Integrations
**Priority:** CRITICAL BUG

---

## Summary

Fix the completely non-functional Zoom connect button. Clicking "Connect with Zoom" does nothing - the OAuth flow doesn't initiate.

## What

Debug and fix the Zoom OAuth connection flow.

**Files to investigate:**
- `src/components/sync/InlineConnectionWizard.tsx`
- Zoom OAuth handler/endpoint
- `supabase/functions/` for Zoom edge function

**Current:** Clicking "Connect with Zoom" does nothing
**Done:** Clicking initiates Zoom OAuth flow properly

## Why

- Complete feature failure
- Users cannot connect Zoom at all
- Critical integration broken
- Blocks user onboarding

## User Experience

- User clicks "Connect with Zoom" → Zoom OAuth page opens
- User authorizes → redirected back with connected status

## Scope

**Includes:**
- Debugging why click handler doesn't work
- Fixing OAuth initiation
- Ensuring redirect URI is correct
- Error handling if OAuth fails

**Excludes:**
- Changing Zoom scopes (unless that's the issue)

## Acceptance Criteria

- [ ] "Connect with Zoom" button triggers click event
- [ ] Zoom OAuth URL is generated correctly
- [ ] User is redirected to Zoom authorization
- [ ] Successful callback updates connection status
- [ ] Errors are surfaced to user

## User Story

**As a** CallVault user
**I want** to connect my Zoom account
**So that** I can import my Zoom meeting recordings

---

## Technical Investigation Notes

Check:
1. Click handler attached to button?
2. OAuth URL construction correct?
3. Redirect URI matches Zoom app config?
4. Edge function deployed and responding?
5. Console errors when clicking?

---

*Spec ready for PRD generation.*
