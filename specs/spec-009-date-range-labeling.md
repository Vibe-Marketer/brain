# SPEC-009: Date Range Labeling Clarity

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Import/Integrations
**Priority:** UX Clarity

---

## Summary

Improve date range picker labeling to clearly explain that the user is selecting a range to add/search for calls/meetings, rather than just saying "pick a date range" with no context.

## What

Update labels/text around the date range picker to clarify the action being taken.

**Files to investigate:**
- Date range picker component in sync flow
- `src/components/sync/` directory

**Current:** "Pick a date range" - vague, no context
**Done:** Clear label like "Select date range to import meetings" or "Search for meetings from"

## Why

- Current label doesn't explain what happens with the date range
- Users don't know if they're importing, searching, or filtering
- Clear labeling reduces confusion and support requests
- Follows One-Click Promise: user should understand action without guessing

## User Experience

- User sees clear label explaining the date range purpose
- User understands they're selecting a range to fetch/import meetings
- No ambiguity about what will happen

## Scope

**Includes:**
- Updating label/heading text for date range picker
- Adding helper text if needed

**Excludes:**
- Changing date picker functionality
- Modifying date selection mechanics

## Acceptance Criteria

- [ ] Label clearly indicates purpose (importing/searching meetings)
- [ ] User understands what the date range controls
- [ ] Consistent wording across all integration types

## User Story

**As a** CallVault user importing meetings
**I want** clear labels on the date range picker
**So that** I understand what dates I'm searching/importing

---

*Spec ready for PRD generation.*
