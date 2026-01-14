# SPEC-014: Missing Requirements Information

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Import/Integrations
**Priority:** UX Bug

---

## Summary

Fix the screen that says "Understand the requirements" and "Important information" but displays no actual requirements. Either show real requirements or remove the checkbox/language entirely.

## What

Address the disconnect between requirements checkbox and missing content.

**Files to investigate:**
- `src/components/sync/InlineConnectionWizard.tsx`
- Requirements step components

**Current issues:**
- Screen says "Understand the requirements"
- Screen says "Important information"
- No actual requirements or information displayed
- User must check "I reviewed requirements" for content they never saw

**Done:** Either display actual requirements OR remove the checkbox and requirements language

## Why

- Asking users to confirm they read something that doesn't exist is deceptive
- Creates distrust in the product
- Legal/compliance risk if claiming user acknowledgment
- Poor user experience

## User Experience

**Option A:** Display real requirements
- User sees actual requirements/limitations
- User acknowledges after reading real content

**Option B:** Remove requirements step
- No fake acknowledgment
- Streamlined flow

## Scope

**Includes:**
- Either adding real requirements content
- OR removing the empty requirements step entirely

**Excludes:**
- Creating fictional requirements

## Acceptance Criteria

- [ ] No empty "requirements" screens
- [ ] If requirements exist, they're displayed
- [ ] If no requirements, no acknowledgment checkbox
- [ ] User never acknowledges content they can't see

## User Story

**As a** CallVault user
**I want** to only acknowledge requirements I can actually read
**So that** I know what I'm agreeing to

---

*Spec ready for PRD generation.*
