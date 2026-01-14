# SPEC-038: Confirmation Icons Visibility

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Settings
**Priority:** UI Polish

---

## Summary

Fix checkmark and X icon visibility. Currently they're gray and hard to see. Should use red X for cancel/error and green checkmark for confirm/success.

## What

Update confirmation/cancel icon colors for better visibility.

**Files to investigate:**
- Settings form components
- Edit confirmation UI components

**Current:** Checkmarks and X marks are gray and hard to see
**Done:** Red X for cancel/error, green checkmark for confirm/success

## Why

- Gray icons lack visual distinction
- Users may miss confirmation/cancel buttons
- Color coding is standard UX pattern
- Improves accessibility and usability

## User Experience

- User editing field sees clear confirm (green ✓) and cancel (red ✕)
- Instantly recognizable actions
- No confusion about which button does what

## Scope

**Includes:**
- Changing X icon to red/destructive color
- Changing checkmark to green/success color
- Ensuring sufficient contrast

**Excludes:**
- Changing icon shapes
- Adding new confirmation patterns

## Acceptance Criteria

- [ ] Cancel/X icon is red
- [ ] Confirm/checkmark icon is green
- [ ] Both clearly visible
- [ ] Meets accessibility contrast requirements

## User Story

**As a** CallVault user editing settings
**I want** clear confirm/cancel buttons
**So that** I know exactly what each action does

---

*Spec ready for PRD generation.*
