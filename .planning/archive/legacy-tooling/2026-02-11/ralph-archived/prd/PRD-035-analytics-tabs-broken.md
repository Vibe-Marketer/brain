# PRD-035: Analytics - All Tabs Broken

**Status:** Ready for Implementation
**Priority:** P0 - CRITICAL BUG
**Category:** Analytics
**Spec:** [SPEC-035](../../specs/spec-035-analytics-tabs-broken.md)
**Created:** 2026-01-14

---

## Overview

Fix the Analytics Overview page where clicking on any tab causes an error. No analytics tabs are functional.

## Problem Statement

The entire Analytics feature is broken. Every tab produces an error when clicked, making call performance insights completely inaccessible.

## Goals

1. Restore all analytics tab functionality
2. Enable performance insights access
3. Fix underlying error cause

## User Stories

**US-035.1:** As a CallVault user, I want the Analytics page to work so that I can review my call performance and insights.

## Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | All analytics tabs load without error | Must Have |
| FR-002 | Data displays correctly in each tab | Must Have |
| FR-003 | Tab switching works smoothly | Must Have |
| FR-004 | Empty states shown if no data (not errors) | Must Have |

## Technical Investigation

Check:
1. Same root cause as Sorting & Tagging errors?
2. Data fetching failing?
3. Component rendering issues?
4. Missing error boundaries?

**Files:**
- `src/pages/Analytics*.tsx`
- `src/components/panes/AnalyticsCategoryPane.tsx`
- Analytics data hooks

## Acceptance Criteria

- [ ] All tabs load without errors
- [ ] Data displays correctly
- [ ] Tab switching smooth
- [ ] No console errors
- [ ] Empty states instead of errors when no data

---

*PRD generated from SPEC-035*
