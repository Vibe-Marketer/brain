# SPEC-025: Business Profile Edit Access

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Content Section
**Priority:** Feature Gap

---

## Summary

Add ability to edit, view, or update a business profile once it's connected. Currently there's no visible option to manage connected profiles.

## What

Add edit/view functionality for connected business profiles.

**Files to investigate:**
- Business profile components
- `src/components/content/` or `src/components/settings/`

**Current:** Once profile connected, no way to edit/view/update
**Done:** Clear edit/view button or link for connected profiles

## Why

- Users need to update business info over time
- No way to correct mistakes
- No way to view what's connected
- Missing standard functionality

## User Experience

- User sees connected business profile
- User clicks edit/view button
- Profile opens for editing
- User can update and save changes

## Scope

**Includes:**
- Add edit button to business profile display
- Open profile editor on click
- Allow updates to profile fields

**Excludes:**
- Creating new profile types
- Changing how profiles are connected initially

## Acceptance Criteria

- [ ] Edit button visible for connected profiles
- [ ] Clicking opens profile for editing
- [ ] Changes can be saved
- [ ] View-only mode available if not editing

## User Story

**As a** CallVault user with a connected business profile
**I want** to edit my profile information
**So that** I can keep it up to date

---

*Spec ready for PRD generation.*
