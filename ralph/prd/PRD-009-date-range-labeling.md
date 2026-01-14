# PRD-009: Date Range Labeling Clarity

**Status:** Ready for Implementation
**Priority:** P2 - UX Clarity
**Category:** Import/Integrations
**Spec:** [SPEC-009](../../specs/spec-009-date-range-labeling.md)
**Created:** 2026-01-14

---

## Overview

Improve date range picker labeling to clearly explain the action being taken (importing/searching meetings) rather than the vague "pick a date range."

## Problem Statement

The current label "Pick a date range" provides no context about what happens with the selected dates. Users don't know if they're importing, searching, or filtering.

## Goals

1. Clarify the purpose of the date range selection
2. Reduce user confusion
3. Follow One-Click Promise (understand action without guessing)

## User Stories

**US-009.1:** As a CallVault user importing meetings, I want clear labels on the date range picker so that I understand what dates I'm searching/importing.

## Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Label clearly indicates purpose (importing/searching) | Must Have |
| FR-002 | Consistent wording across all integration types | Must Have |

## Technical Approach

Update label/heading text for date range picker:

**From:** "Pick a date range"
**To:** "Select date range to import meetings" or "Search for meetings from"

## Acceptance Criteria

- [ ] Label clearly indicates purpose
- [ ] User understands what the date range controls
- [ ] Consistent wording across all integration types

---

*PRD generated from SPEC-009*
