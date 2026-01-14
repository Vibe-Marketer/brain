# SPEC-043: Billing Section Non-Functional

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Settings
**Priority:** CRITICAL BUG

---

## Summary

Fix the Billing section where nothing is functional and displayed plans aren't correct or current.

## What

Make billing section fully functional with accurate information.

**Files to investigate:**
- Billing tab/section in Settings
- `src/components/settings/` directory
- Stripe/billing integration

**Current issues:**
1. Billing section exists but nothing works
2. Plans displayed aren't accurate
3. No way to manage billing

**Done:** Billing fully functional with accurate plan information

## Why

- Can't manage subscriptions
- Incorrect plan info causes confusion
- Core business functionality broken
- Users may churn over billing issues

## User Experience

- User sees current plan accurately
- User can view/manage billing
- Plan changes work
- Payment method management works

## Scope

**Includes:**
- Fixing plan display accuracy
- Making billing management functional
- Connecting to payment provider

**Excludes:**
- Adding new billing features
- Changing pricing structure

## Acceptance Criteria

- [ ] Current plan displayed accurately
- [ ] Plan upgrade/downgrade works
- [ ] Payment method management works
- [ ] Billing history accessible
- [ ] All billing actions functional

## User Story

**As a** CallVault user
**I want** billing to work correctly
**So that** I can manage my subscription

---

*Spec ready for PRD generation.*
