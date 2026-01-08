# SPEC: Loop-Style Selection States, Icon System Upgrade & Sidebar UX Improvements

## What
Implement Microsoft Loop-inspired selection states across all navigation components, replacing emoji icons with Remix Icon outline/fill variants. Improve sidebar collapse/expand UX by moving the toggle to the right edge and enabling click-anywhere-to-toggle. Fix critical bug in Settings/Sorting navigation where clicking category items produces no visual feedback or navigation.

**Components updated:**
1. Main sidebar navigation (Home, AI Chat, Sorting, Settings)
2. Settings category pane (Account, Users, Billing, etc.)
3. Sorting category pane (Folders, Tags, Rules, Recurring)
4. Folder sidebar (already uses Remix Icons, needs fill variants)
5. Sidebar collapse/expand mechanism (Layout component)

**Files affected:**
- `/Users/Naegele/dev/brain/src/components/ui/sidebar-nav.tsx` - Main navigation icons & selection states
- `/Users/Naegele/dev/brain/src/components/panes/SettingsCategoryPane.tsx` - Settings categories
- `/Users/Naegele/dev/brain/src/components/panes/SortingCategoryPane.tsx` - Sorting categories
- `/Users/Naegele/dev/brain/src/components/transcript-library/FolderSidebar.tsx` - Folder navigation
- `/Users/Naegele/dev/brain/src/components/Layout.tsx` - Sidebar collapse/expand behavior
- `/Users/Naegele/dev/brain/src/pages/Settings.tsx` - State management (investigation needed)
- `/Users/Naegele/dev/brain/src/pages/SortingTagging.tsx` - State management (investigation needed)

## Why

**Icon System Upgrade:**
Current emoji icons (🏠, ✨, 🏷️, ⚙️) lack professional polish and don't provide clear visual feedback for selected states. The Loop-style pill indicator + filled icon pattern creates a more cohesive, modern experience that aligns with brand guidelines (Remix Icon exclusively, no emojis).

**Sidebar UX Improvement:**
The current collapse/expand toggle is "oddly placed" at the top of the sidebar (per user feedback). Users expect the toggle to be on the edge where panels meet, and clicking empty sidebar space should toggle expansion. This matches Loop's polished interaction pattern and reduces friction.

**Critical Navigation Bug:**
Users cannot navigate Settings/Sorting categories because clicking category items produces no visual feedback or navigation—this is a critical usability bug that blocks access to settings/sorting features.

## User Experience

### Visual States
When a user selects any navigation item:
1. **Pill indicator** appears on the LEFT side (slightly inset, not flush to edge)
   - Shape: Rounded pill (`w-1 h-[80%]` with `rounded-r-full`)
   - Color: Vibe orange (#FF8800)
   - Position: Left edge, vertically centered
   - Animation: Smooth scale-y transition (200ms ease-in-out)

2. **Icon changes** from outline to filled variant
   - Line variant (`-Line` suffix) when inactive
   - Fill variant (`-Fill` suffix) when active
   - Color changes to vibe orange when active

3. **Background highlight** appears
   - `bg-vibe-orange/10 dark:bg-vibe-orange/20`
   - Subtle, doesn't compete with pill indicator

4. **Text color** changes to vibe orange (if visible)
   - Font weight increases to semibold/medium

### Navigation Flow (Fixed)
**Before (broken):**
- User clicks "Account" in Settings → Nothing happens
- No visual feedback, no content loads
- User confused, clicks repeatedly

**After (fixed):**
- User clicks "Account" in Settings
- Pill indicator animates in (left edge)
- Icon fills and turns orange
- Background highlights
- Detail pane (3rd pane) loads Account settings content
- Selection state persists

### Interaction Details
- **Hover**: Subtle background change (`hover:bg-muted/50 dark:hover:bg-white/5`)
- **Focus**: Vibe orange ring (`ring-2 ring-vibe-orange`)
- **Keyboard navigation**: Arrow keys to move focus, Enter/Space to select
- **Transition timing**: 200ms for color/scale changes, 150ms for hover

## Scope

### Applies to:
1. **Main sidebar navigation** (`sidebar-nav.tsx`)
   - Replace emoji icons with Remix Icons
   - Add filled variants for active states
   - Update pill indicator positioning
   - **IMPROVE COLLAPSE/EXPAND UX**: Replace top-mounted toggle with Loop-style implementation

2. **Settings category pane** (`SettingsCategoryPane.tsx`)
   - Already has pill indicator (verify positioning)
   - Add filled icon variants
   - **FIX CRITICAL BUG**: Ensure onClick properly updates parent state

3. **Sorting category pane** (`SortingCategoryPane.tsx`)
   - Already has pill indicator (verify positioning)
   - Add filled icon variants
   - **FIX CRITICAL BUG**: Ensure onClick properly updates parent state

4. **Folder sidebar** (`FolderSidebar.tsx`)
   - Update pill indicator to be slightly inset (not edge-mounted)
   - Already uses Remix Icons, verify fill/line variants exist

5. **Sidebar collapse/expand behavior** (ALL pages using Layout component)
   - Move toggle from top of sidebar to circular button on right edge, centered vertically
   - Add click-anywhere-to-toggle functionality on empty sidebar area
   - Use Loop demo implementation as reference

### Does NOT apply to:
- Detail panes (3rd pane content) - no changes needed
- Modal/dialog navigation - out of scope
- Mobile bottom sheet navigation - follows same pattern automatically
- Tab components (separate pattern)

## Decisions Made

### Icon Mappings
**Main Sidebar Navigation:**

| Old Emoji | New Line Icon | New Fill Icon | Component |
|-----------|---------------|---------------|-----------|
| 🏠 | `RiHome4Line` | `RiHome4Fill` | Home |
| ✨ | `RiSparklingLine` | `RiSparklingFill` | AI Chat |
| 🏷️ | `RiPriceTag3Line` | `RiPriceTag3Fill` | Sorting |
| ⚙️ | `RiSettings3Line` | `RiSettings3Fill` | Settings |

**Settings Categories (already using Line variants, add Fill):**

| Category | Line Icon | Fill Icon |
|----------|-----------|-----------|
| Account | `RiUserLine` | `RiUserFill` |
| Users | `RiTeamLine` | `RiTeamFill` |
| Billing | `RiWalletLine` | `RiWalletFill` |
| Integrations | `RiPlugLine` | `RiPlugFill` |
| AI | `RiRobot2Line` | `RiRobot2Fill` |
| Admin | `RiShieldLine` | `RiShieldFill` |

**Sorting Categories (already using Line variants, add Fill):**

| Category | Line Icon | Fill Icon |
|----------|-----------|-----------|
| Folders | `RiFolderLine` | `RiFolderFill` |
| Tags | `RiPriceTag3Line` | `RiPriceTag3Fill` |
| Rules | `RiFlowChart` | (No fill variant) |
| Recurring | `RiRepeatLine` | `RiRepeatFill` |

*Note: `RiFlowChart` has no fill variant in Remix Icon. Use line variant with orange color for active state.*

### Pill Indicator Positioning
**Current implementation analysis:**
- Settings/Sorting panes: `absolute left-0` (flush to edge)
- Folder sidebar: `absolute left-0` (flush to edge)
- Main sidebar: `absolute left-0` (flush to edge) in expanded mode

**New implementation:**
- **Category panes**: Keep flush to edge (`left-0`) - correct per existing design
- **Folder sidebar**: Keep flush to edge (`left-0`) - user confirmed this is correct
- **Main sidebar expanded**: Keep flush to edge (`left-0`) - consistent with panes
- **Main sidebar collapsed**: Use dot indicator at bottom (already implemented correctly)

**Rationale:** After reviewing the code, the pill indicators are correctly positioned flush to the left edge. The "slightly inset" language in the user's initial request was clarified to mean the pill itself has rounded edges (`rounded-r-full`), creating visual inset without actual positioning offset. No positioning changes needed.

### Bug Fix Approach
**Investigation findings:**
- Settings.tsx (lines 176-180): `handleCategorySelect` correctly calls `setSelectedCategory` and `setCurrentTab`
- SortingTagging.tsx (lines 150-154): `handleCategorySelect` correctly calls `setSelectedCategory` and `setActiveTab`
- Both parent components properly pass `onCategorySelect` to category panes
- Category panes have onClick handlers at line 264 (Settings) and 230 (Sorting)

**Root cause hypothesis:**
The onClick handlers ARE connected and state IS being updated. The issue is likely that the detail panes aren't rendering because:
1. The parent page isn't showing a "select a category" message properly, OR
2. The detail pane content isn't rendering based on the selected category

**Testing required:**
1. Verify `selectedCategory` state updates in React DevTools
2. Verify detail pane rendering logic in parent components
3. Check if the issue is visual (state updates but no feedback) or functional (state doesn't update)

**Fix approach:**
1. Add console logging to confirm state changes
2. Verify detail pane rendering conditions
3. Ensure category selection triggers proper content load
4. Test with React DevTools to trace state flow

### Typography
**Keep current Title Case pattern:**
- Category name: `text-sm font-medium` (becomes `font-semibold` + orange when active)
- Description: `text-xs text-cb-ink-muted` (never changes)
- No changes to text transform or capitalization

### Sidebar Collapse/Expand Behavior
**Current implementation (to be replaced):**
- Toggle button at top of sidebar (oddly placed per user feedback)
- No click-anywhere functionality
- Separate toggle control from main content area

**New Loop-style implementation (from LoopLayoutDemo.tsx lines 106-158):**

1. **Circular toggle button on right edge**
   - Position: `absolute top-1/2 -translate-y-1/2 -right-3`
   - Size: `w-6 h-6` circular button
   - Style: `rounded-full bg-card border border-border shadow-sm`
   - Icon: Chevron left/right that rotates 180° on collapse
   - Z-index: `z-20` (above clickable overlay)

2. **Click-anywhere-to-toggle functionality**
   - Invisible overlay: `absolute inset-0 cursor-pointer z-0`
   - onClick toggles `isSidebarExpanded` state
   - All interactive elements have `relative z-10` to remain clickable
   - Circular toggle button has `onClick={(e) => e.stopPropagation()}` to work independently

3. **Smooth transitions**
   - Width: `transition-all duration-500 ease-in-out`
   - Width values: `w-[220px]` (expanded) → `w-[72px]` (collapsed)
   - Icon rotation: `transition-transform duration-500`
   - Content opacity/visibility handled by existing SidebarNav component

4. **Implementation structure:**
```tsx
<div className="relative ... transition-all duration-500">
  {/* Click-to-toggle background overlay */}
  <div
    className="absolute inset-0 cursor-pointer z-0"
    onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
  />

  {/* Floating collapse/expand toggle on right edge */}
  <button
    onClick={(e) => {
      e.stopPropagation();
      setIsSidebarExpanded(!isSidebarExpanded);
    }}
    className="absolute top-1/2 -translate-y-1/2 -right-3 z-20 w-6 h-6 rounded-full bg-card border border-border shadow-sm"
  >
    <svg className={cn("transition-transform duration-500", isSidebarExpanded ? "rotate-0" : "rotate-180")}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  </button>

  {/* Content with z-10 to remain interactive */}
  <div className="relative z-10">
    <SidebarNav isCollapsed={!isSidebarExpanded} />
  </div>
</div>
```

**Files affected:**
- `/Users/Naegele/dev/brain/src/components/Layout.tsx` - Main layout wrapper
- Any parent components managing sidebar state

**Benefits:**
- ✅ More intuitive UX (click anywhere to toggle)
- ✅ Better visual hierarchy (button on edge, not in content flow)
- ✅ Matches Loop's polished interaction pattern
- ✅ Reduces clicks (entire sidebar becomes toggle target)

### Brand Compliance
**Vibe orange usage (per brand-guidelines-v4.1.md):**
- ✅ Active indicator pills (6px angular - but we use rounded for Loop style)
- ✅ Left-edge indicators (approved use case)
- ✅ Icon color when active
- ✅ Text color when active
- ✅ Background tint at 10%/20% opacity

**Icon system (per brand-guidelines-v4.1.md):**
- ✅ Remix Icon library exclusively
- ✅ Consistent icon sizing (`h-4 w-4` for 16px)
- ✅ Neutral professional style (`-Line` variants)
- ❌ NO emoji icons in navigation (violates icon system guidelines)

**Animation timing:**
- Pill scale/opacity: 200ms ease-in-out (matches Loop pattern)
- Color transitions: 200ms ease-in-out
- Hover states: 150ms ease-in-out
- Sidebar width transitions: 500ms ease-in-out (Loop pattern)

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| User has no access to category (Settings/Users for non-TEAM) | Category hidden in list, never selectable |
| User directly navigates to `/settings/users` without permission | Redirect to `/settings`, show first available category |
| Multiple categories selected via rapid clicking | Last click wins, state updates correctly |
| Keyboard navigation to hidden category | Focus skips hidden items, only selectable items focusable |
| Icon has no fill variant (e.g., RiFlowChart) | Use line variant with orange color, skip fill swap |
| Mobile view with collapsed sidebar | Use dot indicator pattern (already implemented), no pill |
| User clicks same category twice | No state change, pill remains visible, idempotent |
| User clicks nav item while sidebar collapsing | Navigation triggers immediately, animation continues |
| User clicks folder while sidebar expanding | Folder selection works, animation continues |
| User rapidly toggles sidebar expand/collapse | Animation respects last click, no janky transitions |
| User clicks circular toggle button | Sidebar toggles, click doesn't propagate to overlay |
| User clicks empty sidebar space in collapsed mode | Sidebar expands (click-anywhere works) |
| User clicks nav icon in collapsed mode (glossy 3D) | Navigation works, no toggle triggered |
| User drags folder item while sidebar is animating | Drag works normally, animation doesn't interfere |

## Implementation Plan

### Phase 1: Main Sidebar Navigation (sidebar-nav.tsx)
1. Replace emoji spans with Remix Icon imports
2. Add conditional rendering: Line variant when inactive, Fill variant when active
3. Verify pill indicator positioning in expanded mode (already correct)
4. Test collapsed mode dot indicator (already correct)
5. Update NavIcon component to support icon components instead of React nodes

**Changes:**
```tsx
// Before
icon: <span className="text-xl">🏠</span>

// After
iconLine: RiHome4Line,
iconFill: RiHome4Fill,

// Render
const IconComponent = active ? item.iconFill : item.iconLine;
<IconComponent className="w-5 h-5" />
```

### Phase 2: Settings Category Pane (SettingsCategoryPane.tsx)
1. Update SETTINGS_CATEGORIES to include filled icon variants
2. Add conditional icon rendering based on `isActive`
3. Debug state flow: Add logging to `onCategorySelect` and parent handler
4. Verify detail pane rendering logic in Settings.tsx
5. Test navigation flow end-to-end

**Changes:**
```tsx
// Add to CategoryItem interface
iconFill?: React.ComponentType<{ className?: string }>;

// Update rendering (line 289)
const IconComponent = isActive && category.iconFill ? category.iconFill : category.icon;
<IconComponent className={cn(..., isActive ? "text-vibe-orange" : "text-cb-ink-muted")} />
```

### Phase 3: Sorting Category Pane (SortingCategoryPane.tsx)
1. Update SORTING_CATEGORIES to include filled icon variants
2. Add conditional icon rendering based on `isActive`
3. Debug state flow: Add logging to `onCategorySelect` and parent handler
4. Verify detail pane rendering logic in SortingTagging.tsx
5. Test navigation flow end-to-end

**Changes:** (Same pattern as Settings)

### Phase 4: Folder Sidebar (FolderSidebar.tsx)
1. Verify pill indicator positioning (already correct at `left-0`)
2. Check if custom folder icons support fill variants (likely N/A for custom icons)
3. For default folder icon (RiFolderLine), add RiFolderFill for active state
4. Test nested folder selection states

**Changes:**
```tsx
// In DroppableFolderItem (lines 165-178)
const FolderIconComponent = isSelected && folder.icon === 'folder' 
  ? RiFolderFill 
  : getIconComponent(folder.icon);
```

### Phase 5: Sidebar Collapse/Expand UX (Layout.tsx)
1. Find current sidebar toggle implementation in Layout component
2. Replace top-mounted toggle with Loop-style implementation:
   - Add clickable overlay (`absolute inset-0 cursor-pointer z-0`)
   - Add circular toggle button on right edge (`-right-3`)
   - Update z-index hierarchy (overlay: z-0, content: z-10, button: z-20)
   - Add chevron SVG with rotation transition
3. Update transition timing to match Loop (500ms ease-in-out)
4. Test click-anywhere functionality doesn't interfere with nav items
5. Verify stopPropagation works correctly on circular button

**Changes:**
```tsx
// In Layout.tsx sidebar container
<div className="relative ... transition-all duration-500">
  {/* Click overlay - NEW */}
  <div className="absolute inset-0 cursor-pointer z-0" onClick={toggleSidebar} />

  {/* Toggle button - MOVED from top to right edge */}
  <button
    onClick={(e) => { e.stopPropagation(); toggleSidebar(); }}
    className="absolute top-1/2 -translate-y-1/2 -right-3 z-20 w-6 h-6 rounded-full bg-card border border-border shadow-sm"
  >
    <svg className={cn("transition-transform duration-500", isExpanded ? "rotate-0" : "rotate-180")}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  </button>

  {/* Content - ADD relative z-10 */}
  <div className="relative z-10">
    <SidebarNav isCollapsed={!isExpanded} />
    <FolderSidebar ... />
  </div>
</div>
```

### Phase 6: Testing & Validation
1. Visual regression testing with Playwright
2. Keyboard navigation testing (arrow keys, Enter/Space)
3. Dark mode verification
4. Mobile responsive behavior
5. Verify no performance issues with icon swapping
6. Test sidebar collapse/expand interactions:
   - Click anywhere on sidebar to toggle
   - Circular button toggles independently
   - Nav items remain clickable
   - Folder items remain clickable
   - Smooth 500ms transitions

### Phase 7: Brand Guidelines Update
After all implementation and testing is complete, update brand guidelines to document the new patterns.

**File to update:** `/Users/Naegele/dev/brain/docs/design/brand-guidelines-v4.1.md`

**Required changes:**

1. **Version increment** (3 places):
   - Title: `# Brand Guidelines v4.1.2` → `v4.1.3` (patch - 2-3 section updates)
   - DOCUMENT VERSION section
   - END OF BRAND GUIDELINES (last line)

2. **Update changelog:** `/Users/Naegele/dev/brain/docs/brand-guidelines-changelog.md`
   - Add entry with date, time, and commit hash
   - Summary: "Add Loop-style selection states, icon fill/line variants, and sidebar UX patterns"

3. **Icon System section updates:**
   - Document filled icon variants for active/selected states
   - Add icon mapping table (Home, AI Chat, Sorting, Settings)
   - Clarify Line variant for inactive, Fill variant for active
   - Update examples to show RiHome4Line → RiHome4Fill pattern

4. **Navigation & Selection States section (NEW or UPDATE):**
   - Document pill indicator pattern (position, size, color, animation)
   - Explain icon + pill + background highlight combo for selection
   - Add visual state progression (inactive → hover → active)
   - Include timing specifications (200ms transitions)

5. **Sidebar Patterns section (NEW or UPDATE):**
   - Document Loop-style collapse/expand behavior
   - Circular toggle button positioning and styling
   - Click-anywhere-to-toggle functionality
   - Width transition timing (500ms)
   - Z-index hierarchy for interactive overlays

6. **Category Pane Patterns section (UPDATE if exists):**
   - Confirm two-row layout pattern (name + description)
   - Typography rules for category items
   - Selection state visual treatment
   - Icon fill variant usage

7. **Remove outdated guidance (if any):**
   - Any references to emoji icons in navigation
   - Old toggle button placement patterns
   - Conflicting selection state guidance

**Verification checklist:**
- [ ] Version number updated in 3 places
- [ ] Changelog entry added with date/time/hash
- [ ] Icon fill/line variant pattern documented
- [ ] Selection state pattern fully specified
- [ ] Sidebar collapse/expand pattern documented
- [ ] Examples and code snippets added where helpful
- [ ] No conflicting guidance remains
- [ ] "Last Updated" date/time updated in header

**When to do this:**
Only after Phases 1-6 are complete, tested, and merged. This ensures the brand guidelines reflect the actual implemented behavior, not just the spec.

## Open Questions

1. **Settings/Sorting Navigation Bug:**
   - Is the state updating but detail pane not rendering?
   - Or is the state not updating at all?
   - Need to check React DevTools during interaction

2. **Icon Fill Variants:**
   - Does `RiFlowChart` have a fill variant? (Already confirmed: NO)
   - Any other icons missing fill variants?

3. **Collapsed Sidebar:**
   - Should we show fill variants in glossy 3D NavIcon components?
   - Current implementation uses emoji in NavIcon, need to adapt for icon components

4. **Custom Folder Icons:**
   - User-uploaded emojis don't have fill variants
   - Should we skip fill behavior for custom icons? (Likely yes)

## Priority

### Must have:
- Replace emoji icons with Remix Icons in main sidebar
- Add fill/line variant swapping for all navigation items
- Fix Settings/Sorting navigation bug (detail pane not loading)
- Verify pill indicator positioning consistency
- Implement Loop-style sidebar collapse/expand UX
- **Update brand guidelines to document new patterns (Phase 7)**

### Nice to have:
- Subtle animation when icon changes from line to fill
- Preload fill variant icons to prevent flicker
- Add Storybook stories for all selection states
- Add animated GIFs/videos to brand guidelines showing interaction patterns

## Brand Compliance Confirmation

✅ **Vibe orange usage:** Approved for left-edge indicators, icon color, and text color  
✅ **Icon library:** Remix Icon exclusively, no emoji in navigation  
✅ **Animation timing:** 200ms matches Loop pattern and brand guidelines  
✅ **Typography:** Title Case preserved, no changes needed  
✅ **Accessibility:** Focus states use vibe orange ring per guidelines  
✅ **Dark mode:** Background opacity adjusted for dark mode (10% vs 20%)  

**Reference:** `/Users/Naegele/dev/brain/docs/design/brand-guidelines-v4.1.md`

---

**Spec complete.** Ready for implementation once navigation bug is diagnosed.
