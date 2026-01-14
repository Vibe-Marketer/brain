# PRD-013: Connect Integration Flow - Eliminate Extra Steps

**Status:** Ready for Implementation
**Priority:** P2 - UX Friction
**Category:** Import/Integrations
**Spec:** [SPEC-013](../../specs/spec-013-connection-wizard-extra-steps.md)
**Created:** 2026-01-14

---

## Overview

Eliminate unnecessary confirmation steps in the integration connection flow. Users shouldn't have to click "Next" past informational screens that add no value.

## Problem Statement

The connection wizard shows unnecessary intermediate steps (e.g., "Step 1 of 3") with purely informational content requiring a "Next" click to proceed. This adds friction without adding value.

## Goals

1. Minimize clicks to complete connection
2. Follow One-Click Promise philosophy
3. Reduce abandonment in connection flow

## User Stories

**US-013.1:** As a CallVault user connecting an integration, I want to complete the connection with minimal clicks so that I can start using the integration quickly.

## Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | No "Next" buttons on purely informational screens | Must Have |
| FR-002 | Minimal steps between click and OAuth initiation | Must Have |
| FR-003 | Connection flow is 2 steps max: configure → connect | Should Have |

## Technical Approach

**File:** `src/components/sync/InlineConnectionWizard.tsx`

1. Audit wizard steps
2. Remove/combine unnecessary steps
3. Keep only required informational screens

## Acceptance Criteria

- [ ] No unnecessary confirmation screens
- [ ] Maximum 2 steps to initiate OAuth
- [ ] User can connect faster than before

---

*PRD generated from SPEC-013*
