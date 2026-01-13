# SPEC-001: UI Standardization and Analytics Relocation

**Source:** `/docs/specs/SPEC-ui-standardization-analytics-relocation.md`
**Created:** 2026-01-13
**Status:** Ready for Implementation

## Summary

This spec defines a comprehensive UI standardization project across CallVault that:

1. **Standardizes all pane headers to 48px height** (py-3)
2. **Relocates Analytics from Home page tab to dedicated top-level sidebar nav**
3. **Adds Sync & Import as top-level sidebar nav item** (vibe orange gradient)
4. **Removes tab navigation from Home page**
5. **Standardizes FolderSidebar header** to match Settings/Sorting panes

## Scope

- 9 new files to create
- 5 existing files to modify
- See full SPEC at `/docs/specs/SPEC-ui-standardization-analytics-relocation.md`

## Key Files

**To Modify:**
- `src/components/panes/SettingsCategoryPane.tsx` - py-4 → py-3
- `src/components/panes/SortingCategoryPane.tsx` - py-4 → py-3
- `src/components/transcript-library/FolderSidebar.tsx` - Restructure header
- `src/components/ui/sidebar-nav.tsx` - Add Analytics nav item
- `src/pages/TranscriptsNew.tsx` - Remove tabs
- `src/App.tsx` - Add /analytics route

**To Create:**
- `src/pages/Analytics.tsx`
- `src/components/panes/AnalyticsCategoryPane.tsx`
- `src/components/panes/AnalyticsDetailPane.tsx`
- `src/components/analytics/OverviewTab.tsx`
- `src/components/analytics/DurationTab.tsx`
- `src/components/analytics/ParticipationTab.tsx`
- `src/components/analytics/TalkTimeTab.tsx`
- `src/components/analytics/TagsTab.tsx`
- `src/components/analytics/ContentTab.tsx`
