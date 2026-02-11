# PRD-046: Knowledge Base Indexing - Incorrect Count

**Status:** Ready for Implementation
**Priority:** P2 - UX Bug
**Category:** Settings
**Spec:** [SPEC-046](../../specs/spec-046-knowledge-base-indexing-count.md)
**Created:** 2026-01-14

---

## Overview

Fix the conflicting count display in Knowledge Base indexing. Shows "12 transcripts ready" but progress shows "1 of 933."

## Problem Statement

Conflicting numbers confuse users about actual indexing state. Undermines trust in feature accuracy.

## Goals

1. Accurate count display
2. Consistent numbers
3. Clear indexing status

## User Stories

**US-046.1:** As a CallVault user, I want accurate indexing status information so that I know how many transcripts are being processed.

## Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Ready to index count is accurate | Must Have |
| FR-002 | Progress matches the ready count | Must Have |
| FR-003 | No conflicting numbers | Must Have |
| FR-004 | User understands actual state | Must Have |

## Technical Approach

Debug count calculation logic:
- Verify source of "ready to index" count
- Verify source of progress denominator
- Ensure both use same data source

## Acceptance Criteria

- [ ] Count is accurate
- [ ] Progress matches count
- [ ] No conflicting numbers
- [ ] User can trust displayed status

---

*PRD generated from SPEC-046*
