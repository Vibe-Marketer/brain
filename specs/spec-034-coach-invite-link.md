# SPEC-034: Coach Invite - Link Generation Broken

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Collaboration
**Priority:** CRITICAL BUG

---

## Summary

Fix the "Generate invite link" button for coach invitations. Currently does nothing when clicked.

## What

Debug and fix the shareable invite link generation.

**Files to investigate:**
- Coach invite component
- Link generation logic
- `src/pages/CollaborationPage.tsx`

**Current:** "Generate invite link" button does nothing
**Done:** Generates shareable link that can be copied

## Why

- Alternative invite method broken
- Users can't share links to invite coaches
- Completely non-functional button
- Blocks users who prefer link sharing

## User Experience

- User clicks "Generate invite link"
- Link is generated and displayed
- User can copy link to clipboard
- Link can be shared with coach
- Coach uses link to accept invite

## Scope

**Includes:**
- Fixing link generation
- Displaying generated link
- Copy to clipboard functionality

**Excludes:**
- Changing link format
- Adding link expiration UI

## Acceptance Criteria

- [ ] Button generates a link when clicked
- [ ] Link is displayed to user
- [ ] Copy to clipboard works
- [ ] Link is valid and usable
- [ ] Coach can accept via link

## User Story

**As a** CallVault user
**I want** to generate a shareable invite link
**So that** I can invite coaches without needing their email

---

## Technical Investigation

Check:
1. Click handler attached?
2. Link generation API exists?
3. Database storing invite tokens?
4. UI updating after generation?

---

*Spec ready for PRD generation.*
