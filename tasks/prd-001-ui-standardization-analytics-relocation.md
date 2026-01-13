# PRD-001: UI Standardization and Analytics Relocation

**SPEC Reference:** `specs/spec-001-ui-standardization-analytics-relocation.md`
**Full SPEC:** `docs/specs/SPEC-ui-standardization-analytics-relocation.md`
**Created:** 2026-01-13
**Branch:** `feature/ui-standardization-analytics-relocation`

## Overview

Comprehensive UI standardization and Analytics feature relocation for CallVault.

## User Stories

### Phase 1: Header Standardization

| ID | Title | Priority | Status |
|----|-------|----------|--------|
| US-001 | Update SettingsCategoryPane header py-4 to py-3 | 1 | Pending |
| US-002 | Update SortingCategoryPane header py-4 to py-3 | 1 | Pending |
| US-003 | Standardize FolderSidebar header to match pattern | 1 | Pending |

### Phase 2: Analytics Foundation

| ID | Title | Priority | Status |
|----|-------|----------|--------|
| US-004 | Add Analytics nav item to SidebarNav | 2 | Pending |
| US-005 | Create Analytics page with 3-pane structure | 2 | Pending |
| US-006 | Create AnalyticsCategoryPane with 6 categories | 2 | Pending |
| US-007 | Create AnalyticsDetailPane shell | 2 | Pending |
| US-008 | Add /analytics route to App.tsx | 2 | Pending |

### Phase 3: Analytics Content

| ID | Title | Priority | Status |
|----|-------|----------|--------|
| US-009 | Create OverviewTab component | 3 | Pending |
| US-010 | Create DurationTab component | 3 | Pending |
| US-011 | Create ParticipationTab component | 3 | Pending |
| US-012 | Create TalkTimeTab component | 3 | Pending |
| US-013 | Create TagsTab component | 3 | Pending |
| US-014 | Create ContentTab component | 3 | Pending |

### Phase 4: Home Page Simplification

| ID | Title | Priority | Status |
|----|-------|----------|--------|
| US-015 | Remove tab navigation from TranscriptsNew | 4 | Pending |

### Phase 5: Sync & Import Enhancement

| ID | Title | Priority | Status |
|----|-------|----------|--------|
| US-016 | Add Sync & Import button with vibe gradient | 5 | Pending |

## Acceptance Criteria Summary

- All pane headers are 48px (py-3)
- Analytics accessible via top-level nav (5th item, pie chart icon)
- 6 analytics categories working with detail panes
- Home page shows only Transcripts (no tabs)
- Sync & Import button shows vibe orange gradient
- All quality checks pass (lint, typecheck, build)
