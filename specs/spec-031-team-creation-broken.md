# SPEC-031: Team Creation Broken

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Collaboration
**Priority:** CRITICAL BUG

---

## Summary

Fix the "Create a Team" button which spins briefly then fails silently. Team creation doesn't work regardless of settings.

## What

Debug and fix team creation functionality.

**Files to investigate:**
- Collaboration page components
- `src/pages/CollaborationPage.tsx`
- Team creation API/edge function

**Current issues:**
1. "Create a Team" button spins briefly
2. Fails silently - no error message
3. Happens regardless of "admin visibility" checkbox state
4. Team is never created

**Done:** Team creation works and creates a team

## Why

- Core collaboration feature broken
- Teams are foundation of collaboration
- Users cannot collaborate without teams
- Silent failure provides no path forward

## User Experience

- User clicks "Create a Team" → team is created
- Success confirmation shown
- Team appears in team list
- User can proceed with team management

## Scope

**Includes:**
- Fixing team creation API call
- Adding proper error handling
- Success confirmation

**Excludes:**
- Adding new team features
- Redesigning team creation flow

## Acceptance Criteria

- [ ] "Create a Team" successfully creates team
- [ ] Success message shown on creation
- [ ] Error message shown if creation fails
- [ ] No silent failures
- [ ] Works with any checkbox state

## User Story

**As a** CallVault user
**I want** to create a team
**So that** I can collaborate with colleagues

---

## Technical Investigation

Check:
1. API endpoint exists and responds?
2. Request payload correct?
3. Database write happening?
4. Error being caught but not displayed?

---

*Spec ready for PRD generation.*
