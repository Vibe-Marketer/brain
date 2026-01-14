# PRD-008: Integrations Box Design Cleanup

**Status:** Ready for Implementation
**Priority:** P3 - UI Polish
**Category:** Import/Integrations
**Spec:** [SPEC-008](../../specs/spec-008-integrations-box-design.md)
**Created:** 2026-01-14

---

## Overview

Simplify the integrations container design by removing unnecessary box styling and moving content up to reduce wasted space.

## Problem Statement

The current integrations section has heavy box container styling with excessive padding, creating visual overkill and wasting vertical space.

## Goals

1. Reduce visual weight of container
2. Improve content density
3. Create cleaner, more streamlined layout

## User Stories

**US-008.1:** As a CallVault user, I want a cleaner integrations section so that I can focus on managing my integrations without visual clutter.

## Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Reduce container padding | Should Have |
| FR-002 | Simplify border/background styling | Should Have |
| FR-003 | Move content up to reduce whitespace | Should Have |

## Technical Approach

**Files:**
- `src/components/sync/IntegrationSyncPane.tsx`
- `src/components/sync/IntegrationStatusRow.tsx`

Reduce padding and simplify card/container styling.

## Acceptance Criteria

- [ ] Integrations section has reduced visual weight
- [ ] Content is more compact vertically
- [ ] Design feels cleaner and less "boxy"
- [ ] Still clearly grouped as a section

---

*PRD generated from SPEC-008*
