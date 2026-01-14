# PRD-015: Zoom Connect Button Broken

**Status:** Ready for Implementation
**Priority:** P0 - CRITICAL BUG
**Category:** Import/Integrations
**Spec:** [SPEC-015](../../specs/spec-015-zoom-connect-broken.md)
**Created:** 2026-01-14

---

## Overview

Fix the completely non-functional Zoom connect button. Clicking "Connect with Zoom" does nothing - the OAuth flow doesn't initiate.

## Problem Statement

The Zoom integration button is completely broken. Users cannot connect their Zoom accounts, blocking a critical integration pathway.

## Goals

1. Restore Zoom OAuth functionality
2. Ensure connection flow completes
3. Unblock Zoom users

## User Stories

**US-015.1:** As a CallVault user, I want to connect my Zoom account so that I can import my Zoom meeting recordings.

## Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | "Connect with Zoom" triggers click event | Must Have |
| FR-002 | Zoom OAuth URL generated correctly | Must Have |
| FR-003 | User redirected to Zoom authorization | Must Have |
| FR-004 | Successful callback updates connection status | Must Have |
| FR-005 | Errors surfaced to user | Must Have |

## Technical Investigation

Check:
1. Click handler attached to button?
2. OAuth URL construction correct?
3. Redirect URI matches Zoom app config?
4. Edge function deployed and responding?
5. Console errors when clicking?

**Files:**
- `src/components/sync/InlineConnectionWizard.tsx`
- Zoom OAuth edge function in `supabase/functions/`

## Acceptance Criteria

- [ ] Button click initiates Zoom OAuth
- [ ] Zoom authorization page opens
- [ ] Callback handled correctly
- [ ] "Connected" status shown on success
- [ ] Error message shown on failure

---

*PRD generated from SPEC-015*
