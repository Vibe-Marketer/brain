# PRD-044: Settings - Google Connect Error

**Status:** Ready for Implementation
**Priority:** P0 - CRITICAL BUG
**Category:** Settings
**Spec:** [SPEC-044](../../specs/spec-044-settings-google-connect-error.md)
**Created:** 2026-01-14

---

## Overview

Fix the Google integration error in Settings. Returns "edge function returned a non-200 code" and remains "Not Connected."

## Problem Statement

Google OAuth callback fails with technical error. Users cannot connect Google services from Settings.

## Goals

1. Fix OAuth callback handling
2. Proper error messages
3. Successful connection flow

## User Stories

**US-044.1:** As a CallVault user, I want to connect Google successfully so that I can use Google integration features.

## Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Google OAuth completes without error | Must Have |
| FR-002 | "Connected" status on success | Must Have |
| FR-003 | User-friendly error messages | Must Have |
| FR-004 | Edge function returns 200 on success | Must Have |

## Technical Investigation

Related to PRD-018. Check:
1. Edge function logs
2. OAuth redirect handling
3. Token storage
4. Status update logic

**Files:**
- `src/components/settings/IntegrationsTab.tsx`
- Google OAuth edge function

## Acceptance Criteria

- [ ] OAuth completes successfully
- [ ] "Connected" status shown
- [ ] User-friendly errors on failure
- [ ] Edge function working properly

---

*PRD generated from SPEC-044*
