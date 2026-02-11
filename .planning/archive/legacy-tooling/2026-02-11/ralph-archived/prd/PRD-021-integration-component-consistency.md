# PRD-021: Integration Component Consistency

**Status:** Ready for Implementation
**Priority:** P2 - Code Quality
**Category:** Import/Integrations
**Spec:** [SPEC-021](../../specs/spec-021-integration-component-consistency.md)
**Created:** 2026-01-14

---

## Overview

Ensure the integrations component is exactly the same in both the Import screen and the Settings screen. Currently they may differ, causing inconsistent behavior.

## Problem Statement

Different implementations of integration management exist in Import and Settings screens, leading to potential inconsistent behavior, bugs, and maintenance burden.

## Goals

1. Single source of truth for integration component
2. Consistent behavior everywhere
3. Reduce maintenance burden

## User Stories

**US-021.1:** As a CallVault user, I want integrations to work the same everywhere so that I'm not confused by different behaviors in different places.

## Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Single component used in both locations | Must Have |
| FR-002 | Identical behavior in Import and Settings | Must Have |
| FR-003 | Same connection flows in both places | Must Have |

## Technical Approach

**Files:**
- `src/components/sync/IntegrationSyncPane.tsx`
- `src/components/settings/IntegrationsTab.tsx`

Refactor:
1. Create shared `IntegrationManager` component
2. Use in `IntegrationSyncPane.tsx`
3. Use in `IntegrationsTab.tsx`
4. Remove duplicate code

## Acceptance Criteria

- [ ] Single component used in both locations
- [ ] Behavior identical in Import and Settings
- [ ] No duplicate integration management code
- [ ] Both screens use same connection flows

---

*PRD generated from SPEC-021*
