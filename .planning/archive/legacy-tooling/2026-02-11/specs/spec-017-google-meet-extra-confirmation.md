# SPEC-017: Google Meet Extra Confirmation Step

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Import/Integrations
**Priority:** UX Friction

---

## Summary

Eliminate the extra confirmation screen after acknowledging Google Meet requirements. The "Connect with Google Meet" button should be on the requirements page itself.

## What

Combine the requirements acknowledgment and connect button onto a single screen.

**Files to investigate:**
- `src/components/sync/InlineConnectionWizard.tsx`
- Google Meet connection flow steps

**Current:**
1. Requirements screen → acknowledge
2. Another confirmation screen → click connect
3. OAuth flow

**Done:**
1. Requirements screen with "Connect with Google Meet" button
2. OAuth flow

## Why

- Extra confirmation adds unnecessary friction
- Violates One-Click Promise
- Users already acknowledged - don't make them click again
- Reduces completion rate

## User Experience

- User reads requirements
- User clicks checkbox to acknowledge
- "Connect with Google Meet" button becomes enabled
- Single click to proceed to OAuth

## Scope

**Includes:**
- Combining requirements and connect into single step
- Enabling connect button after acknowledgment checkbox

**Excludes:**
- Removing actual requirements (if needed)
- Changing OAuth flow

## Acceptance Criteria

- [ ] No separate confirmation screen after requirements
- [ ] Connect button on same page as requirements
- [ ] Button disabled until requirements acknowledged
- [ ] Single step from requirements to OAuth

## User Story

**As a** CallVault user connecting Google Meet
**I want** to connect immediately after reading requirements
**So that** I don't have to click through extra screens

---

*Spec ready for PRD generation.*
