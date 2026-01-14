# SPEC-035: Analytics - All Tabs Broken

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Analytics
**Priority:** CRITICAL BUG

---

## Summary

Fix the Analytics Overview page where clicking on any tab causes an error. No analytics tabs are functional.

## What

Debug and fix all analytics tabs to load and display data properly.

**Files to investigate:**
- `src/pages/Analytics*.tsx`
- `src/components/panes/AnalyticsCategoryPane.tsx`
- Analytics tab components
- Analytics data hooks

**Current issues:**
1. Clicking any tab in Analytics Overview causes error
2. No tabs are functional
3. Entire analytics feature unusable

**Done:** All analytics tabs load and display data properly

## Why

- Core feature completely broken
- Users cannot access any analytics
- Blocks all call performance insights
- Critical product functionality missing

## User Experience

- User opens Analytics → sees overview/default tab
- User clicks any tab → tab loads with data
- All analytics visualizations work
- No errors on any interaction

## Scope

**Includes:**
- Fixing all analytics tab errors
- Ensuring data loads properly
- Proper error handling/fallbacks

**Excludes:**
- Adding new analytics features
- Redesigning analytics visualizations

## Acceptance Criteria

- [ ] All analytics tabs load without error
- [ ] Data displays correctly in each tab
- [ ] Tab switching works smoothly
- [ ] No console errors
- [ ] Empty states shown if no data (not errors)

## User Story

**As a** CallVault user
**I want** the Analytics page to work
**So that** I can review my call performance and insights

---

## Technical Investigation

Check:
1. Same root cause as Sorting & Tagging errors?
2. Data fetching failing?
3. Component rendering issues?
4. Missing error boundaries?

---

*Spec ready for PRD generation.*
