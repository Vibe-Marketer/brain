# SPEC-032: Team Status Display

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Collaboration
**Priority:** UX Enhancement

---

## Summary

Improve the "You're not part of a team yet" message to provide clear guidance on next steps.

## What

Enhance team status messaging with actionable guidance.

**Files to investigate:**
- Collaboration page components
- `src/pages/CollaborationPage.tsx`

**Current:** Says "You're not part of a team yet" with no clear guidance
**Done:** Clear messaging about team status and next steps

## Why

- Current message is a dead end
- Users don't know what to do next
- Should guide user toward action
- Reduces support requests

## User Experience

- User sees "You're not part of a team yet"
- Below that: clear CTA to create team or join existing
- Steps clearly outlined

## Scope

**Includes:**
- Improving empty state messaging
- Adding clear CTAs
- Explaining options (create vs join)

**Excludes:**
- Adding new team functionality
- Changing team creation flow

## Acceptance Criteria

- [ ] Empty state has clear messaging
- [ ] CTA to create team is prominent
- [ ] If join option exists, it's shown
- [ ] User understands their options

## User Story

**As a** CallVault user without a team
**I want** clear guidance on what to do next
**So that** I can get started with collaboration

---

*Spec ready for PRD generation.*
