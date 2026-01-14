# SPEC-013: Connect Integration Flow - Eliminate Extra Steps

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Import/Integrations
**Priority:** UX Friction

---

## Summary

Eliminate unnecessary confirmation steps in the integration connection flow. Users shouldn't have to click "Next" past informational screens that add no value.

## What

Streamline the connection wizard to remove unnecessary intermediate steps.

**Files to investigate:**
- `src/components/sync/InlineConnectionWizard.tsx`
- Connection flow components

**Current issues:**
- "Connect Integration - Connect Zoom - Step 1 of 3" shows informational screen
- User must click "Next" to proceed past content that adds no value
- Multiple unnecessary clicks to complete connection

**Done:** Direct path to connection with minimal clicks

## Why

- Extra steps violate One-Click Promise
- Users are forced to click through screens they don't need to read
- Increases abandonment rate
- Adds friction to critical onboarding flow

## User Experience

- User clicks "Connect Zoom" → goes directly to actionable step
- No unnecessary "Step 1 of 3" informational screens
- Fastest path to completing connection

## Scope

**Includes:**
- Auditing connection wizard steps
- Removing/combining unnecessary steps
- Keeping only required informational screens (e.g., actual requirements)

**Excludes:**
- Removing OAuth flow (required by providers)
- Skipping actual requirement acknowledgment if legally necessary

## Acceptance Criteria

- [ ] No "Next" buttons on purely informational screens
- [ ] Minimal steps between click and OAuth initiation
- [ ] Connection flow is 2 steps max: configure → connect

## User Story

**As a** CallVault user connecting an integration
**I want** to complete the connection with minimal clicks
**So that** I can start using the integration quickly

---

*Spec ready for PRD generation.*
