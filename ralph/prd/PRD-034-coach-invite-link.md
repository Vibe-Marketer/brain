# PRD-034: Coach Invite - Link Generation Broken

**Status:** Ready for Implementation
**Priority:** P0 - CRITICAL BUG
**Category:** Collaboration
**Spec:** [SPEC-034](../../specs/spec-034-coach-invite-link.md)
**Created:** 2026-01-14

---

## Overview

Fix the "Generate invite link" button for coach invitations. Currently does nothing when clicked.

## Problem Statement

The invite link generation is non-functional. Users click the button and nothing happens - no link generated, no feedback.

## Goals

1. Restore link generation functionality
2. Enable alternative invite method
3. Provide copy-to-clipboard capability

## User Stories

**US-034.1:** As a CallVault user, I want to generate a shareable invite link so that I can invite coaches without needing their email.

## Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Button generates a link when clicked | Must Have |
| FR-002 | Link is displayed to user | Must Have |
| FR-003 | Copy to clipboard works | Must Have |
| FR-004 | Link is valid and usable | Must Have |
| FR-005 | Coach can accept via link | Must Have |

## Technical Investigation

Check:
1. Click handler attached?
2. Link generation API exists?
3. Database storing invite tokens?
4. UI updating after generation?

**Files:**
- `src/pages/CollaborationPage.tsx`
- Link generation API

## Acceptance Criteria

- [ ] Button generates link on click
- [ ] Link displayed in UI
- [ ] Copy to clipboard works
- [ ] Generated link is valid
- [ ] Coach can use link to accept

---

*PRD generated from SPEC-034*
