# PRD-005: Search Box Spacing

**Status:** Ready for Implementation
**Priority:** P3 - UI Polish
**Category:** Home Screen/All Transcripts
**Spec:** [SPEC-005](../../specs/spec-005-search-box-spacing.md)
**Created:** 2026-01-14

---

## Overview

Add proper spacing between the "Library" header and the search box in the folder sidebar so the search input has appropriate breathing room.

## Problem Statement

The search box is cramped directly against the header with insufficient padding, creating a rushed, unprofessional appearance that violates spacing principles.

## Goals

1. Improve visual breathing room
2. Follow 4px grid spacing patterns
3. Create polished, professional appearance

## User Stories

**US-005.1:** As a CallVault user with many folders, I want proper spacing around the search box so that the interface feels polished and easy to scan.

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Search box has visible gap from header border | Must Have |
| FR-002 | Spacing uses standard Tailwind values | Must Have |

## Technical Approach

**File:** `src/components/transcript-library/FolderSidebar.tsx`

Change the search container padding (around line 612):

```tsx
// Change from:
<div className="px-4 pb-2">

// To:
<div className="px-4 py-3">
```

## Acceptance Criteria

- [ ] Search box has visible gap from header
- [ ] Spacing consistent with sidebar patterns
- [ ] No layout shift or overflow issues

## Out of Scope

- Changing search functionality
- Modifying header styling
- Changing when search appears

---

*PRD generated from SPEC-005*
