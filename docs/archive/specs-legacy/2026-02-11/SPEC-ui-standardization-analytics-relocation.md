# SPEC: UI Standardization and Analytics Relocation

## What

This spec defines a comprehensive UI standardization project across CallVault that:

1. **Standardizes all pane headers to 48px height** (py-3) - Currently inconsistent between SettingsCategoryPane (py-4), SortingCategoryPane (py-4), and FolderSidebar (custom structure)
2. **Relocates Analytics from Home page tab to dedicated top-level sidebar nav** - Creates new 3-pane Analytics page with 6 categories and detailed metrics
3. **Adds Sync & Import as top-level sidebar nav item** - Microsoft Loop-style vibe orange gradient button
4. **Removes tab navigation from Home page** - Converts from dual-tab (TRANSCRIPTS | ANALYTICS) to single-focus Transcripts page
5. **Standardizes FolderSidebar header** - Matches the icon + title + subtitle pattern used in SettingsCategoryPane and SortingCategoryPane

**Referenced Files:**
- `/Users/Naegele/dev/brain/src/pages/Settings.tsx`
- `/Users/Naegele/dev/brain/src/components/panes/SettingsCategoryPane.tsx`
- `/Users/Naegele/dev/brain/src/components/panes/SettingsDetailPane.tsx`
- `/Users/Naegele/dev/brain/src/pages/SortingTagging.tsx`
- `/Users/Naegele/dev/brain/src/components/panes/SortingCategoryPane.tsx`
- `/Users/Naegele/dev/brain/src/pages/TranscriptsNew.tsx`
- `/Users/Naegele/dev/brain/src/components/transcript-library/FolderSidebar.tsx`
- `/Users/Naegele/dev/brain/src/components/ui/sidebar-nav.tsx`
- `/Users/Naegele/dev/brain/docs/design/brand-guidelines-v4.1.md`

## Why

**Current State Issues:**
1. **Inconsistent Header Heights:** Category panes use py-4 (~56px), detail panes use py-3 (48px), and FolderSidebar has custom structure - creates visual inconsistency
2. **Analytics Buried:** Analytics tab on Home page is secondary navigation, hard to discover
3. **Tab Navigation Overhead:** Home page has only 2 tabs (Transcripts/Analytics), doesn't justify tab pattern
4. **Missing Sync Discoverability:** Sync functionality exists but has no dedicated entry point in navigation
5. **Non-Standard Library Header:** FolderSidebar header doesn't match the established pattern from Settings/Sorting panes

**Benefits of Changes:**
- Visual consistency across all pane-based layouts
- Analytics becomes first-class feature with dedicated navigation
- Simplified Home page focused solely on transcripts
- Improved Sync discoverability with dedicated nav item
- Unified header pattern across all category panes

## User Experience

### 1. Analytics - New Top-Level Page

**Sidebar Navigation:**
- New icon button appears as 5th item in SidebarNav (after Settings)
- Uses `RiPieChart2Fill` (active) / `RiPieChart2Line` (inactive)
- Same glossy 3D styling as other nav icons (44x44px, rounded-xl)
- Orange dot indicator appears below icon when on `/analytics` route
- Expanded mode: Shows "Analytics" label next to icon
- Clicking navigates to `/analytics`

**Page Structure (3-Pane Layout):**
- Follows same pattern as Settings and Sorting pages
- Pane 1: Sidebar navigation (standard)
- Pane 2: Analytics category list (280px width, py-3 header)
- Pane 3: Detail pane with charts/tables (flexible width, py-3 header)

**Category Pane (Pane 2) - 6 Categories:**

1. **Overview**
   - Icon: `RiDashboardLine` / `RiDashboardFill`
   - Description: "KPIs and call volume trends"

2. **Call Duration**
   - Icon: `RiTimeLine` / `RiTimeFill`
   - Description: "Duration distribution and averages"

3. **Participation & Speakers**
   - Icon: `RiGroupLine` / `RiGroupFill`
   - Description: "Attendee metrics and trends"

4. **Talk Time & Engagement**
   - Icon: `RiSpeakLine` / `RiSpeakFill`
   - Description: "Talk time and monologue analysis"

5. **Tags & Categories**
   - Icon: `RiPriceTag3Line` / `RiPriceTag3Fill`
   - Description: "Calls and minutes by tag"

6. **Content Created**
   - Icon: `RiFilmLine` / `RiFilmFill`
   - Description: "Clips tracking and performance"

**Detail Pane Content by Category:**

**Category 1 - Overview:**
- KPI Row: Total calls | Total hours | Avg duration | Avg % talk time | # Unique speakers
- Charts:
  - Calls per day/week (line chart)
  - Minutes per day/week (bar chart)
- Behavior: Clicking a KPI opens filtered call list in a 4th slide-out pane (optional enhancement)

**Category 2 - Call Duration:**
- KPI Row: Average duration | Median duration
- Duration Distribution Chart: 0-15min | 15-30min | 30-60min | 60+ min (bar chart)
- Tables:
  - Duration by Call Type/Category
  - Duration by Tag

**Category 3 - Participation & Speakers:**
- Avg Attendees per Call (overall)
- Avg Attendees by Category
- Trend Chart: Attendees over time
- % Solo vs Multi-speaker Calls (pie/donut chart)

**Category 4 - Talk Time & Engagement:**
- % Talk Time: Host vs Others (overall)
- % Talk Time by Category
- Talk Time by Role: Host | Closer | Client | etc. (stacked bar)
- Avg Monologue Length

**Category 5 - Tags & Categories:**
- Table with columns:
  - Tag/Category Name
  - # Calls
  - Total Minutes
  - Avg Duration per Call
- Sortable by each column

**Category 6 - Content Created:**
- KPI Row: Total clips | % Calls with clips | # Published | Published rate | # Winners
- Charts:
  - Clips Created Over Time (line chart)
  - Clips per Call Histogram
- Clips Table with columns:
  - Clip Title
  - Source Call
  - Tags
  - Published (boolean badge)
  - Winning Hook/Angle
  - Notes
  - Created By
  - Created At
- Clicking a row opens Pane 4 (slide-out detail):
  - Clip Preview
  - Published Toggle
  - Winner Toggle
  - Winning Hook Text Input
  - Performance Notes Multiline Input

### 2. Sync & Import - New Sidebar Nav Item

**Design:**
- Appears below the 5 main nav icons, above any utility items
- When collapsed: Just the "+" icon inside hollow circle (same stroke thickness for + and circle)
- When expanded: Circle icon + "+ IMPORT" text
- Styling: Vibe orange gradient (`linear-gradient(135deg, #FFEB00 0%, #FF8800 50%, #FF3D00 100%)`)
- Path: `/sync-import` or integrates with existing sync functionality
- Behavior: Clicking opens sync/import interface (exact destination TBD based on existing sync implementation)

### 3. Header Standardization

**All Category Panes (Pane 2) and Detail Panes (Pane 3):**

```tsx
<header className="flex items-center justify-between px-4 py-3 border-b border-cb-border bg-cb-card/50 flex-shrink-0">
  <div className="flex items-center gap-3 min-w-0">
    <div className="w-8 h-8 rounded-lg bg-vibe-orange/10 flex items-center justify-center flex-shrink-0">
      <Icon className="h-4 w-4 text-vibe-orange" />
    </div>
    <div className="min-w-0">
      <h2 className="text-sm font-semibold text-cb-ink uppercase tracking-wide">
        {title}
      </h2>
      <p className="text-xs text-cb-ink-muted truncate">
        {subtitle}
      </p>
    </div>
  </div>
  {/* Optional action buttons on right */}
</header>
```

**Standard Measurements:**
- Height: 48px (py-3 = 12px top + 12px bottom + ~24px content)
- Icon container: 32x32px (w-8 h-8), rounded-lg, bg-vibe-orange/10
- Icon: 16x16px (h-4 w-4), text-vibe-orange
- Title: text-sm font-semibold uppercase tracking-wide
- Subtitle: text-xs text-cb-ink-muted

### 4. Home Page Transformation

**Before:**
```tsx
<Tabs>
  <TabsList>
    <TabsTrigger>TRANSCRIPTS</TabsTrigger>
    <TabsTrigger>ANALYTICS</TabsTrigger>
  </TabsList>
  <TabsContent value="transcripts">...</TabsContent>
  <TabsContent value="analytics">...</TabsContent>
</Tabs>
```

**After:**
```tsx
{/* No tabs - direct content */}
<div className="px-4 md:px-10 flex-shrink-0">
  <div className="mt-2 mb-2">
    <p className="text-sm font-semibold text-cb-gray-dark dark:text-cb-gray-light uppercase tracking-wider mb-0.5">
      LIBRARY
    </p>
    <h1 className="font-display text-2xl md:text-4xl font-extrabold text-cb-black dark:text-cb-white uppercase tracking-wide mb-0.5">
      TRANSCRIPTS
    </h1>
    <p className="text-sm text-cb-gray-dark dark:text-cb-gray-light">
      Organize, search, and manage all your transcripts in one place.
    </p>
  </div>
</div>
{/* Transcripts content directly below */}
<TranscriptsTab ... />
```

**Changes:**
- Remove `<Tabs>`, `<TabsList>`, `<TabsTrigger>` components
- Remove `<TabsContent>` wrappers
- Display Transcripts content directly (no tab switching)
- Add Montserrat page title: "TRANSCRIPTS" (32px on mobile, 48px on desktop)
- Add subtitle: "Organize, search, and manage all your transcripts in one place."

### 5. FolderSidebar Header Standardization

**Before (Current Custom Structure):**
```tsx
<div className="flex items-center justify-between p-4 pb-2">
  <h1 className="font-display text-base md:text-lg font-extrabold uppercase text-cb-ink">
    Folders
  </h1>
  <Button variant="ghost" size="icon" onClick={onNewFolder}>
    <RiAddLine className="h-4 w-4" />
  </Button>
</div>
```

**After (Standardized Pattern):**
```tsx
<header className="flex items-center justify-between px-4 py-3 border-b border-cb-border bg-cb-card/50 flex-shrink-0">
  <div className="flex items-center gap-3 min-w-0">
    <div className="w-8 h-8 rounded-lg bg-vibe-orange/10 flex items-center justify-center flex-shrink-0">
      <RiFolderLine className="h-4 w-4 text-vibe-orange" />
    </div>
    <div className="min-w-0">
      <h2 className="text-sm font-semibold text-cb-ink uppercase tracking-wide">
        Library
      </h2>
      <p className="text-xs text-cb-ink-muted truncate">
        {folders.length} folders
      </p>
    </div>
  </div>
  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={onNewFolder}>
    <RiAddLine className="w-4 h-4" />
  </Button>
</header>
```

**Changes:**
- Replaces large title with standardized icon + title + count pattern
- Height: 48px (py-3)
- Icon: `RiFolderLine` in vibe orange background container
- Title: "LIBRARY" (uppercase, text-sm font-semibold)
- Subtitle: Dynamic folder count (e.g., "5 folders")
- Button remains but moved to right side of header

## Scope

### Applies To:

**New Files to Create:**
1. `/Users/Naegele/dev/brain/src/pages/Analytics.tsx` - New Analytics page with 3-pane layout
2. `/Users/Naegele/dev/brain/src/components/panes/AnalyticsCategoryPane.tsx` - Analytics category list (Pane 2)
3. `/Users/Naegele/dev/brain/src/components/panes/AnalyticsDetailPane.tsx` - Analytics detail view (Pane 3)
4. `/Users/Naegele/dev/brain/src/components/analytics/OverviewTab.tsx` - Overview category content
5. `/Users/Naegele/dev/brain/src/components/analytics/DurationTab.tsx` - Call Duration content
6. `/Users/Naegele/dev/brain/src/components/analytics/ParticipationTab.tsx` - Participation & Speakers content
7. `/Users/Naegele/dev/brain/src/components/analytics/TalkTimeTab.tsx` - Talk Time & Engagement content
8. `/Users/Naegele/dev/brain/src/components/analytics/TagsTab.tsx` - Tags & Categories content
9. `/Users/Naegele/dev/brain/src/components/analytics/ContentTab.tsx` - Content Created content

**Files to Modify:**
1. `/Users/Naegele/dev/brain/src/components/panes/SettingsCategoryPane.tsx` - Change py-4 to py-3 (line 222)
2. `/Users/Naegele/dev/brain/src/components/panes/SettingsDetailPane.tsx` - Verify py-3 (line 252)
3. `/Users/Naegele/dev/brain/src/components/panes/SortingCategoryPane.tsx` - Change py-4 to py-3 (line 182)
4. `/Users/Naegele/dev/brain/src/components/panes/SortingDetailPane.tsx` - Verify py-3
5. `/Users/Naegele/dev/brain/src/components/transcript-library/FolderSidebar.tsx` - Restructure header (lines 589-597)
6. `/Users/Naegele/dev/brain/src/components/ui/sidebar-nav.tsx` - Add Analytics and Sync & Import nav items
7. `/Users/Naegele/dev/brain/src/pages/TranscriptsNew.tsx` - Remove tab navigation, simplify to single page
8. `/Users/Naegele/dev/brain/src/components/transcripts/AnalyticsTab.tsx` - Either delete or migrate content to new Analytics pages
9. Routing configuration (e.g., `App.tsx` or `router.tsx`) - Add `/analytics` route

### Does NOT Apply To:

- Mobile bottom sheets or overlays (header standardization applies only to desktop panes)
- Other sidebar components not listed above
- Existing Analytics data fetching logic (can be reused)
- Existing Sync functionality (just adds new nav entry point)
- FolderSidebar collapsed view (icon-only mode) - no header changes needed

## Decisions Made

### 1. Analytics Icon Choice
**Decision:** Use `RiPieChart2Fill` / `RiPieChart2Line`
**Why:** Universally recognized analytics symbol, matches the data/metrics nature of the feature. Alternative icons considered: `RiBarChartLine` (too generic), `RiLineChartLine` (too specific to one chart type).

### 2. Header Height Standard
**Decision:** Standardize all pane headers to 48px (py-3)
**Why:** Detail panes already use py-3. This is the established standard in SettingsDetailPane and SortingDetailPane. Category panes currently use py-4 (~56px) which is inconsistent. 48px provides sufficient touch target size while maintaining clean proportions.

### 3. FolderSidebar Header Pattern
**Decision:** Match SettingsCategoryPane pattern (icon container + title + subtitle)
**Why:** Creates visual consistency across all category-type panes. User learns one pattern. The current custom header in FolderSidebar stands out as non-standard.

### 4. Sync & Import Placement
**Decision:** Place below main nav icons, styled as action button with vibe orange gradient
**Why:** Sync is a creation/import action (not core navigation like Home/Chat/Settings). Microsoft Loop uses similar pattern for "Create" actions. Vibe orange draws attention to growth-focused feature.

### 5. Tab Removal on Home Page
**Decision:** Remove tab navigation entirely, make Transcripts the direct content
**Why:** Only 2 tabs doesn't justify the tab pattern. With Analytics moving to top-level nav, the tab becomes unnecessary overhead. Simpler mental model: Transcripts is the default view.

### 6. Analytics Category Structure
**Decision:** 6 categories (Overview, Duration, Participation, Talk Time, Tags, Content)
**Why:** Logical grouping by metric type. Avoids overwhelming single-page dashboard. Each category can focus on specific insights. Allows progressive disclosure of complexity.

### 7. Pane Width for Analytics
**Decision:** Category pane 280px (same as Settings/Sorting), Detail pane flexible
**Why:** Maintains consistency with existing 3-pane layouts. 280px is sufficient for category names + descriptions. Detail pane needs flexibility for charts/tables.

### 8. Content Created 4th Pane
**Decision:** Slide-out pane for clip detail (not modal)
**Why:** Follows existing pattern in Settings/Sorting for detail views. Keeps context visible. User can compare clips by sliding pane back and forth without losing table view.

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| **User on `/analytics` when Analytics nav is clicked** | No navigation occurs - already on page. Category pane ensures it's open (if user had closed it). |
| **No analytics data exists** | Display empty state in detail pane: "No data available. Import calls to see analytics." with link to Sync & Import. |
| **Extremely long folder name in FolderSidebar header** | Subtitle truncates with ellipsis (already handles via `truncate` class). |
| **User has < 3 folders** | FolderSidebar header still shows standardized pattern (e.g., "2 folders"). Doesn't change to singular form for simplicity. |
| **Mobile viewport** | Analytics page follows existing mobile pattern: single pane with back button, not side-by-side. Same as Settings/Sorting mobile behavior. |
| **Browser navigation (back/forward) from /analytics to /analytics/{category}** | URL deep linking works same as Settings pages - category parameter in URL reflects selected category. |
| **Analytics loads slowly (large dataset)** | Show loading skeleton in detail pane while data fetches. Category pane remains interactive. |
| **User deletes all clips in Content Created category** | KPI row shows "0 clips", table shows empty state: "No clips created yet. Create your first clip from a call transcript." |
| **Sync button clicked but no integrations connected** | Opens sync interface showing "Connect an integration to start importing calls" prompt. |
| **Sync & Import nav item in collapsed sidebar** | Shows just the "+" icon in circle (no text). Tooltip on hover: "Sync & Import". |

## Open Questions

**NONE** - All requirements are clearly defined and no user confirmation needed. Implementation can proceed.

## Priority

### Must Have (MVP):

**Phase 1: Header Standardization**
1. Update SettingsCategoryPane header: py-4 → py-3
2. Update SortingCategoryPane header: py-4 → py-3
3. Restructure FolderSidebar header to match standard pattern
4. Verify SettingsDetailPane and SortingDetailPane already use py-3

**Phase 2: Analytics Relocation**
5. Add Analytics nav item to SidebarNav (icon, route, styling)
6. Create Analytics page with 3-pane structure (follow Settings.tsx pattern)
7. Create AnalyticsCategoryPane with 6 categories
8. Create AnalyticsDetailPane shell (renders category-specific content)
9. Add `/analytics` route to router
10. Migrate/create basic content for each of 6 analytics categories

**Phase 3: Home Page Simplification**
11. Remove tab navigation from TranscriptsNew.tsx
12. Remove TabsList, TabsTrigger, TabsContent wrappers
13. Add Montserrat page title + subtitle
14. Ensure TranscriptsTab content renders directly

**Phase 4: Sync & Import Nav**
15. Add Sync & Import button to SidebarNav
16. Style with vibe orange gradient (collapsed and expanded states)
17. Wire up onClick to existing sync functionality or `/sync-import` route

### Nice to Have (Post-MVP):

**Analytics Enhancements:**
1. 4th pane slide-out for Content Created clip detail
2. KPI drill-down to filtered call lists
3. Date range selector for time-based charts
4. Export analytics data to CSV
5. Saved analytics views/dashboards
6. Real-time data refresh indicators

**Visual Polish:**
1. Smooth transitions when switching Analytics categories
2. Skeleton loading states for all chart types
3. Empty state illustrations for each Analytics category
4. Interactive chart tooltips with detailed breakdowns
5. Responsive chart sizing for different viewport widths

**Advanced Features:**
1. Custom analytics date ranges (not just preset periods)
2. Compare periods (e.g., this month vs last month)
3. Analytics sharing/reporting (email scheduled reports)
4. Custom KPI definitions
5. Analytics API endpoints for third-party integrations

---

## Implementation Notes

### Header Height Calculation

**py-3 = 48px total height:**
- Padding top: 12px (0.75rem)
- Content: ~24px (8x8px icon container + 3px gap + two lines of text)
- Padding bottom: 12px (0.75rem)

**py-4 = 56px total height (current, to be removed):**
- Padding top: 16px (1rem)
- Content: ~24px
- Padding bottom: 16px (1rem)

### Icon System Consistency

All pane headers use:
- Icon container: `w-8 h-8 rounded-lg bg-vibe-orange/10`
- Icon: `h-4 w-4 text-vibe-orange`
- Remix Icon library (line variant unless specified otherwise)

### Brand Compliance Checklist

- ✅ Typography: Titles are uppercase, tracking-wide, font-semibold
- ✅ Spacing: 4px grid maintained (gap-3 = 12px between icon and text)
- ✅ Colors: Vibe orange used only for approved use cases (icons, accents)
- ✅ Icons: Remix Icon library exclusively
- ✅ Selection states: Pill indicator + fill icon + orange tint (for Analytics categories)
- ✅ Responsive: Mobile adaptations follow existing patterns (single pane, back button)

### Testing Checklist

**Visual Regression:**
- [ ] Compare before/after screenshots of Settings category pane header
- [ ] Compare before/after screenshots of Sorting category pane header
- [ ] Compare before/after screenshots of FolderSidebar header
- [ ] Verify all headers are same height across panes

**Functional Testing:**
- [ ] Analytics nav icon navigates to `/analytics`
- [ ] Analytics category selection updates detail pane
- [ ] Sync & Import button triggers correct action
- [ ] Home page renders without tab navigation
- [ ] FolderSidebar header shows correct folder count
- [ ] Deep linking to `/analytics/{category}` works
- [ ] Browser back/forward navigation works on Analytics page

**Accessibility:**
- [ ] All headers have proper ARIA labels
- [ ] Keyboard navigation works in Analytics category pane
- [ ] Focus states visible on all interactive elements
- [ ] Screen reader announces category selections
- [ ] Color contrast meets WCAG AA (vibe orange on white background)

**Responsive:**
- [ ] Mobile: Analytics page shows single pane with back button
- [ ] Mobile: Sync & Import button appears in mobile nav overlay
- [ ] Tablet: Panes resize appropriately
- [ ] Desktop: 3-pane layout displays correctly

---

## File Change Summary

| File | Change Type | Lines Affected | Description |
|------|-------------|----------------|-------------|
| `SettingsCategoryPane.tsx` | Modify | ~222 | Change `py-4` to `py-3` |
| `SortingCategoryPane.tsx` | Modify | ~182 | Change `py-4` to `py-3` |
| `FolderSidebar.tsx` | Modify | ~589-610 | Restructure header to standard pattern |
| `sidebar-nav.tsx` | Modify | ~138-179 | Add Analytics and Sync & Import nav items |
| `TranscriptsNew.tsx` | Modify | ~427-436 | Remove tabs, add page title |
| `Analytics.tsx` | Create | New | 3-pane Analytics page |
| `AnalyticsCategoryPane.tsx` | Create | New | Analytics category list |
| `AnalyticsDetailPane.tsx` | Create | New | Analytics detail view |
| `analytics/OverviewTab.tsx` | Create | New | Overview content |
| `analytics/DurationTab.tsx` | Create | New | Duration content |
| `analytics/ParticipationTab.tsx` | Create | New | Participation content |
| `analytics/TalkTimeTab.tsx` | Create | New | Talk Time content |
| `analytics/TagsTab.tsx` | Create | New | Tags content |
| `analytics/ContentTab.tsx` | Create | New | Content Created content |

**Total:** 9 new files, 5 modified files

---

**SPEC STATUS:** Ready for implementation
**APPROVAL REQUIRED:** No (all requirements clearly defined from user input)
**ESTIMATED EFFORT:** 3-5 days (1 day standardization, 2-3 days Analytics build, 1 day polish/testing)
