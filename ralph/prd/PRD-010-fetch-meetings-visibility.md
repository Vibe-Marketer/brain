# PRD-010: Fetch Meetings Button Visibility

**Status:** Ready for Implementation
**Priority:** P1 - Critical UX Bug
**Category:** Import/Integrations
**Spec:** [SPEC-010](../../specs/spec-010-fetch-meetings-visibility.md)
**Created:** 2026-01-14

---

## Overview

Fix the "Fetch Meetings" button visibility issue where it's hidden or hard to find due to container scrolling problems.

## Problem Statement

The primary CTA "Fetch Meetings" button is hidden or difficult to access. The container doesn't scroll properly on full screen, preventing users from completing the import flow.

## Goals

1. Ensure primary CTA is always visible/accessible
2. Fix scroll container behavior
3. Remove blocker from import flow

## User Stories

**US-010.1:** As a CallVault user importing meetings, I want to easily find and click the Fetch Meetings button so that I can complete the import process.

## Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Fetch Meetings button clearly visible | Must Have |
| FR-002 | Scroll behavior works correctly | Must Have |
| FR-003 | Button accessible on all screen sizes | Must Have |

## Technical Approach

Options:
1. Fix container overflow/scroll settings
2. Make button sticky at bottom
3. Restructure layout to keep button in view

## Acceptance Criteria

- [ ] "Fetch Meetings" button visible without scrolling (if possible)
- [ ] If scrolling required, scroll works correctly
- [ ] Button accessible on all screen sizes
- [ ] No content cut off or inaccessible

---

*PRD generated from SPEC-010*
