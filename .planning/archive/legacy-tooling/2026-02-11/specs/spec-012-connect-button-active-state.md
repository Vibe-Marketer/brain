# SPEC-012: Connect Button Active State

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Import/Integrations
**Priority:** UI Polish

---

## Summary

Fix the grayed-out appearance of Connect buttons when integrations aren't connected. Buttons should appear fully active and clickable.

## What

Update Connect button styling to look fully enabled when the integration is not yet connected.

**Files to investigate:**
- `src/components/sync/IntegrationStatusRow.tsx`
- `src/components/sync/AddIntegrationButton.tsx`

**Current:** Connect buttons appear slightly grayed out
**Done:** Connect buttons appear fully active/clickable

## Why

- Grayed-out buttons suggest disabled state
- Users may think they can't click the button
- Active-looking buttons invite interaction
- Follows button design guidelines

## User Experience

- User sees fully active Connect button
- Button clearly invites clicking
- No confusion about whether action is available

## Scope

**Includes:**
- Updating button styling for disconnected state
- Ensuring sufficient contrast and visibility

**Excludes:**
- Changing connected state styling
- Modifying button functionality

## Acceptance Criteria

- [ ] Connect buttons appear fully active (not grayed)
- [ ] Clear visual distinction between available and unavailable
- [ ] Meets accessibility contrast requirements
- [ ] Consistent across all integration types

## User Story

**As a** CallVault user
**I want** Connect buttons to look clickable
**So that** I know I can interact with them

---

*Spec ready for PRD generation.*
