# PRP: Unified Pane Architecture

---
**PRP ID**: PRP-PANE-001
**Created**: 2026-01-12
**Status**: Ready for Implementation
**Confidence Score**: 8/10 - Comprehensive research completed, clear patterns identified
---

## Goal

**Feature Goal**: Create a unified, centralized multi-pane layout system that provides consistent sidebar navigation and pane architecture across ALL pages in the application, eliminating per-page duplication and ensuring architectural consistency.

**Deliverable**:
1. `AppShell.tsx` - Master layout component with integrated sidebar and pane system
2. `PaneContainer.tsx` - Reusable pane wrapper with consistent styling
3. `SidebarToggle.tsx` - Standalone edge-mounted toggle button component
4. Migration of ALL existing pages to use the unified system
5. Updated brand guidelines documentation

**Success Definition**:
- All pages render through `AppShell` with consistent sidebar behavior
- Sidebar toggle is edge-mounted (not hamburger) on ALL pages
- No page contains duplicated pane layout code
- Adding a new page requires zero pane/sidebar boilerplate
- Visual consistency across all pages (no extra card wrappers, consistent spacing)

## User Persona

**Target User**: Developers building features for CallVault

**Use Case**: When creating a new page, developers should be able to focus on content, not layout infrastructure

**User Journey**:
1. Developer creates new page component
2. Developer imports `AppShell` and wraps content
3. Layout, sidebar, panes all work automatically
4. Developer only defines page-specific content and pane configuration

**Pain Points Addressed**:
- Currently must copy 200+ lines of pane code to each new page
- Inconsistent implementations cause visual bugs
- Changes to sidebar require updates to 5+ files
- Some pages have incorrect layouts (extra card wrappers, wrong toggle style)

## Why

- **Code Duplication**: Currently ~200 lines of identical pane/sidebar code duplicated across 5+ page files
- **Inconsistency**: Chat.tsx uses old hamburger toggle; Collaboration page has extra card wrappers
- **Maintenance Burden**: Any sidebar change requires updating multiple files
- **One-Click Promise Violation**: Architectural complexity blocks feature development velocity
- **Future-Proofing**: New pages should inherit correct layout automatically

## What

### User-Visible Behavior

1. **Consistent Sidebar Toggle**: All pages show edge-mounted circular toggle button (not hamburger menu)
2. **Consistent Pane Styling**: All panes have identical border-radius, shadows, gaps
3. **Responsive Behavior**: All pages behave identically across mobile/tablet/desktop
4. **No Visual Artifacts**: No extra card wrappers or nested containers

### Technical Requirements

1. Single-source-of-truth for sidebar and pane layout
2. Configurable pane slots (2-pane, 3-pane, 4-pane)
3. Integrated panel store support for detail panes
4. Preserved page-specific content rendering

### Success Criteria

- [ ] All 6 major pages migrated to AppShell (TranscriptsNew, Chat, Settings, SortingTagging, CollaborationPage, ContentHub)
- [ ] Chat.tsx sidebar toggle is edge-mounted (currently hamburger)
- [ ] CollaborationPage has no extra card wrapper around panes
- [ ] Zero pane/sidebar code duplicated across pages
- [ ] Brand guidelines updated with new component documentation
- [ ] All pages pass visual regression tests

## All Needed Context

### Context Completeness Check

_This PRP provides complete context for implementation by an AI agent unfamiliar with the codebase._

### Documentation & References

```yaml
# MUST READ - Critical Brand Guidelines
- file: docs/design/brand-guidelines-v4.1.md
  why: Authoritative specifications for pane widths, animations, z-index hierarchy
  pattern: |
    - Navigation Rail: 220px expanded, 72px collapsed
    - Secondary Panel: 280px when visible
    - Transitions: 500ms ease-in-out for premium feel
    - Z-index: Overlay (z-0), Content (z-10), Toggle (z-20)
  gotcha: Must use 500ms for sidebar transitions, NOT 300ms

# MUST READ - Reference Implementation
- file: src/pages/SortingTagging.tsx
  why: CORRECT implementation of 4-pane architecture with edge-mounted toggle
  pattern: |
    Lines 312-349: Click-to-toggle overlay + floating toggle button
    Lines 318-349: Edge-mounted circular toggle with chevron rotation
    Lines 382-429: Pane container structure
  gotcha: Uses absolute top-1/2 -translate-y-1/2 -right-3 for toggle positioning

# MUST READ - Files to FIX
- file: src/pages/Chat.tsx
  why: Has OLD hamburger toggle at lines 1346-1356, needs migration
  pattern: Current incorrect pattern to remove
  gotcha: Has 3 panes, needs to match SortingTagging pattern

- file: src/pages/CollaborationPage.tsx
  why: Has extra nested card wrappers that should not exist
  pattern: Panes wrapped in additional bg-card containers
  gotcha: CollaborationDetailPane is inlined, should be extracted

# MUST READ - Current Layout System
- file: src/components/Layout.tsx
  why: Current top-level layout - only handles TopBar, NOT sidebar
  pattern: Provides TopBar wrapper, delegates content rendering
  gotcha: usesCustomLayout bypasses card wrapper for some pages

- file: src/stores/panelStore.ts
  why: Zustand store for detail panel state management
  pattern: openPanel, closePanel, isPinned, panelHistory
  gotcha: Panels rendered per-page, not centralized

# Architecture Documentation
- file: docs/3-PANE-LAYOUT-ARCHITECTURE.md
  why: Existing architecture documentation (partially implemented)
  pattern: 3-pane concept definitions
  gotcha: Mentions CallVaultLayout.tsx which was DELETED in cleanup commit

- file: docs/archive/research-completed/2025-12/microsoft-loop-patterns.md
  why: Research on Loop-style navigation patterns
  pattern: Three-level hierarchy, animation timings, state management
```

### Current Codebase Structure (Relevant Files)

```bash
src/
├── components/
│   ├── Layout.tsx                    # TOP-LEVEL - Only TopBar, needs AppShell upgrade
│   ├── ui/
│   │   ├── sidebar-nav.tsx           # Navigation items - GOOD, keep as-is
│   │   └── top-bar.tsx               # Header - GOOD, keep as-is
│   ├── panes/                        # EXISTING pane components
│   │   ├── SettingsCategoryPane.tsx
│   │   ├── SettingsDetailPane.tsx
│   │   ├── SortingCategoryPane.tsx
│   │   └── SortingDetailPane.tsx
│   └── panels/                       # EXISTING detail panels
│       ├── TagDetailPanel.tsx
│       ├── FolderDetailPanel.tsx
│       └── SettingHelpPanel.tsx
├── pages/
│   ├── TranscriptsNew.tsx           # HAS correct toggle (lines 316-344)
│   ├── Settings.tsx                 # HAS correct toggle (lines 350-381)
│   ├── SortingTagging.tsx           # HAS correct toggle (lines 318-349) - REFERENCE
│   ├── CollaborationPage.tsx        # HAS correct toggle BUT extra card wrappers
│   ├── Chat.tsx                     # BROKEN - Old hamburger toggle (lines 1346-1356)
│   ├── ContentHub.tsx               # NO multi-pane layout - single pane
│   └── LoopLayoutDemo.tsx           # Demo page - has correct pattern
├── hooks/
│   └── useBreakpoint.ts             # Responsive breakpoint detection - KEEP
└── stores/
    └── panelStore.ts                # Detail panel state - KEEP, integrate
```

### Desired Codebase Structure After Implementation

```bash
src/
├── components/
│   ├── Layout.tsx                    # UNCHANGED - delegates to AppShell
│   ├── layout/                       # NEW DIRECTORY
│   │   ├── AppShell.tsx             # NEW - Master layout with sidebar + panes
│   │   ├── PaneContainer.tsx        # NEW - Reusable pane wrapper
│   │   ├── SidebarToggle.tsx        # NEW - Edge-mounted toggle component
│   │   └── DetailPaneOutlet.tsx     # NEW - Renders active detail panel
│   ├── ui/
│   │   ├── sidebar-nav.tsx          # UNCHANGED
│   │   └── top-bar.tsx              # UNCHANGED
│   ├── panes/                       # UNCHANGED - page-specific panes
│   └── panels/                      # UNCHANGED - detail panels
├── pages/
│   ├── TranscriptsNew.tsx           # SIMPLIFIED - removes duplicate pane code
│   ├── Settings.tsx                 # SIMPLIFIED
│   ├── SortingTagging.tsx           # SIMPLIFIED
│   ├── CollaborationPage.tsx        # FIXED - no extra card wrappers
│   ├── Chat.tsx                     # FIXED - uses AppShell, correct toggle
│   └── ContentHub.tsx               # UPDATED - uses AppShell
├── hooks/
│   ├── useBreakpoint.ts             # UNCHANGED
│   └── usePaneConfig.ts             # NEW - Hook for pane configuration
└── stores/
    └── panelStore.ts                # UNCHANGED - integrated into AppShell
```

### Known Gotchas & Library Quirks

```typescript
// CRITICAL: Z-index hierarchy MUST be followed
// Overlay: z-0, Content: z-10, Toggle Button: z-20
// Incorrect z-index causes click-through bugs

// CRITICAL: Toggle button MUST use stopPropagation()
// Without it, clicking toggle triggers BOTH toggle AND overlay click
onClick={(e) => {
  e.stopPropagation();  // REQUIRED
  setIsSidebarExpanded(!isSidebarExpanded);
}}

// CRITICAL: Transition timing MUST be 500ms for sidebar
// 300ms feels "cheap", 500ms creates premium feel per brand guidelines
className="transition-all duration-500 ease-in-out"

// GOTCHA: useBreakpointFlags vs useBreakpoint
// useBreakpointFlags returns { isMobile, isTablet }
// useBreakpoint returns string "mobile" | "tablet" | "desktop"
// Use useBreakpointFlags for boolean checks

// GOTCHA: Panel rendering must check panelType
// Don't just check isPanelOpen - specific panel types need specific components
const showRightPanel = isPanelOpen &&
  (panelType === 'folder-detail' || panelType === 'tag-detail');
```

## Implementation Blueprint

### Data Models and Structure

```typescript
// src/components/layout/types.ts

/**
 * Pane configuration for AppShell
 */
export interface PaneConfig {
  /** Pane identifier */
  id: string;
  /** Component to render in this pane */
  component: React.ReactNode;
  /** Pane width when visible */
  width: string;
  /** Whether pane is collapsible */
  collapsible?: boolean;
  /** Initial collapsed state */
  defaultCollapsed?: boolean;
  /** Custom className for pane container */
  className?: string;
}

/**
 * AppShell configuration options
 */
export interface AppShellConfig {
  /** Show navigation rail (Pane 1) */
  showNavRail?: boolean;
  /** Secondary pane content (Pane 2) */
  secondaryPane?: React.ReactNode;
  /** Secondary pane width */
  secondaryPaneWidth?: string;
  /** Whether secondary pane is collapsible */
  secondaryPaneCollapsible?: boolean;
  /** Show detail panel outlet (Pane 4+) */
  showDetailPane?: boolean;
  /** Detail pane width */
  detailPaneWidth?: string;
  /** Panel types to render in detail pane */
  supportedPanelTypes?: string[];
}

/**
 * Breakpoint flags interface
 */
export interface BreakpointFlags {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}
```

### Implementation Tasks (Ordered by Dependencies)

```yaml
Task 1: CREATE src/components/layout/SidebarToggle.tsx
  - IMPLEMENT: Standalone edge-mounted circular toggle button
  - FOLLOW pattern: src/pages/SortingTagging.tsx lines 318-349
  - NAMING: SidebarToggle component with isExpanded, onToggle props
  - PLACEMENT: src/components/layout/
  - SPECS:
    - Position: absolute top-1/2 -translate-y-1/2 -right-3
    - Size: w-6 h-6 rounded-full
    - Z-index: z-20
    - Icon: Chevron that rotates 180deg on state change
    - Transition: duration-500

Task 2: CREATE src/components/layout/PaneContainer.tsx
  - IMPLEMENT: Reusable pane wrapper with consistent styling
  - FOLLOW pattern: Pane containers in SortingTagging.tsx
  - NAMING: PaneContainer with variant prop (primary, secondary, detail)
  - PLACEMENT: src/components/layout/
  - SPECS:
    - Styles: bg-card rounded-2xl border border-border/60 shadow-sm
    - Variants: primary (flex-1), secondary (w-[280px]), detail (w-[360px])
    - Transitions: duration-500 ease-in-out
    - Responsive: Collapse on mobile/tablet

Task 3: CREATE src/components/layout/DetailPaneOutlet.tsx
  - IMPLEMENT: Centralized detail panel renderer
  - FOLLOW pattern: Panel conditional rendering in SortingTagging.tsx lines 403-429
  - NAMING: DetailPaneOutlet component
  - PLACEMENT: src/components/layout/
  - DEPENDENCIES: panelStore
  - SPECS:
    - Reads panelType from panelStore
    - Renders correct panel component based on type
    - Handles animation (w-0 when closed, w-[360px] when open)
    - Supports tablet width variant (w-[320px])

Task 4: CREATE src/components/layout/AppShell.tsx
  - IMPLEMENT: Master layout component with integrated sidebar and panes
  - FOLLOW pattern: SortingTagging.tsx 3-pane structure
  - NAMING: AppShell with config prop
  - PLACEMENT: src/components/layout/
  - DEPENDENCIES: SidebarToggle, PaneContainer, DetailPaneOutlet, SidebarNav
  - SPECS:
    - Integrates TopBar from Layout.tsx
    - Renders Pane 1 (NavRail) with edge-mounted toggle
    - Renders Pane 2 (Secondary) when provided
    - Renders main content (children)
    - Renders DetailPaneOutlet when configured
    - Handles mobile overlays
    - Manages isSidebarExpanded state internally

Task 5: CREATE src/hooks/usePaneConfig.ts
  - IMPLEMENT: Hook for pane state management
  - NAMING: usePaneConfig
  - PLACEMENT: src/hooks/
  - SPECS:
    - Returns { isSidebarExpanded, setIsSidebarExpanded, isSecondaryOpen, setIsSecondaryOpen }
    - Auto-collapses sidebar on tablet
    - Syncs with breakpoint changes

Task 6: MODIFY src/pages/Chat.tsx
  - MIGRATE: Replace inline pane code with AppShell
  - FIND: Lines 1336-1365 (inline 3-pane layout)
  - REMOVE: Entire inline pane structure
  - REPLACE WITH: AppShell wrapper
  - PRESERVE: ChatSidebar as secondaryPane, main chat content as children
  - VERIFY: Edge-mounted toggle appears, hamburger removed

Task 7: MODIFY src/pages/CollaborationPage.tsx
  - MIGRATE: Replace inline pane code with AppShell
  - FIX: Remove extra card wrappers around panes
  - EXTRACT: CollaborationDetailPane to separate file if still inline
  - VERIFY: No nested bg-card containers

Task 8: MODIFY src/pages/TranscriptsNew.tsx
  - MIGRATE: Replace inline pane code with AppShell
  - SIMPLIFY: Remove ~150 lines of duplicate pane code
  - PRESERVE: FolderSidebar as secondaryPane, TranscriptsTab as content

Task 9: MODIFY src/pages/Settings.tsx
  - MIGRATE: Replace inline pane code with AppShell
  - PRESERVE: SettingsCategoryPane as secondaryPane, SettingsDetailPane as content
  - INTEGRATE: SettingHelpPanel via DetailPaneOutlet

Task 10: MODIFY src/pages/SortingTagging.tsx
  - MIGRATE: Replace inline pane code with AppShell
  - PRESERVE: SortingCategoryPane as secondaryPane, SortingDetailPane as content
  - INTEGRATE: TagDetailPanel/FolderDetailPanel via DetailPaneOutlet

Task 11: MODIFY src/pages/ContentHub.tsx
  - MIGRATE: Wrap in AppShell (currently no multi-pane)
  - CONFIG: showNavRail=true, no secondaryPane
  - VERIFY: Consistent with other pages

Task 12: UPDATE docs/design/brand-guidelines-v4.1.md
  - ADD: AppShell component documentation
  - ADD: PaneContainer usage examples
  - UPDATE: Sidebar UX Patterns section with new component references
  - INCREMENT: Version to v4.1.x

Task 13: CREATE tests for new components
  - IMPLEMENT: Unit tests for SidebarToggle, PaneContainer, AppShell
  - FOLLOW pattern: src/components/ui/__tests__/sidebar-nav.test.tsx
  - VERIFY: Toggle click behavior, responsive breakpoints, pane rendering
```

### Implementation Patterns & Key Details

```typescript
// SidebarToggle.tsx - Edge-mounted toggle pattern
export function SidebarToggle({
  isExpanded,
  onToggle
}: {
  isExpanded: boolean;
  onToggle: () => void
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();  // CRITICAL: Prevents double-toggle
        onToggle();
      }}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 -right-3 z-20",
        "w-6 h-6 rounded-full bg-card border border-border shadow-sm",
        "flex items-center justify-center hover:bg-muted transition-colors"
      )}
      aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
      aria-expanded={isExpanded}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(
          "transition-transform duration-500",
          isExpanded ? "rotate-0" : "rotate-180"
        )}
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}

// AppShell.tsx - Master layout pattern
export function AppShell({
  children,
  secondaryPane,
  config = {}
}: {
  children: React.ReactNode;
  secondaryPane?: React.ReactNode;
  config?: AppShellConfig;
}) {
  const { isMobile, isTablet } = useBreakpointFlags();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(!isTablet);
  const [isSecondaryOpen, setIsSecondaryOpen] = useState(true);
  const { isPanelOpen, panelType } = usePanelStore();

  // Auto-collapse on tablet
  useEffect(() => {
    if (isTablet) setIsSidebarExpanded(false);
  }, [isTablet]);

  return (
    <div className="h-full flex gap-3 overflow-hidden p-1">
      {/* PANE 1: Navigation Rail */}
      {!isMobile && (
        <nav className={cn(
          "relative flex-shrink-0 bg-card rounded-2xl border border-border/60 shadow-sm",
          "flex flex-col py-2 h-full z-10 transition-all duration-500 ease-in-out",
          isSidebarExpanded ? "w-[220px]" : "w-[72px] items-center"
        )}>
          {/* Click-to-toggle overlay */}
          <div
            className="absolute inset-0 cursor-pointer z-0"
            onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
          />

          {/* Edge-mounted toggle */}
          <SidebarToggle
            isExpanded={isSidebarExpanded}
            onToggle={() => setIsSidebarExpanded(!isSidebarExpanded)}
          />

          {/* Header */}
          <div className="w-full px-2 mb-2 flex items-center justify-between relative z-10">
            {isSidebarExpanded && <span className="text-sm font-semibold ml-2">Menu</span>}
          </div>

          {/* Navigation items */}
          <SidebarNav
            isCollapsed={!isSidebarExpanded}
            className="w-full flex-1 relative z-10"
            onLibraryToggle={() => setIsSecondaryOpen(!isSecondaryOpen)}
          />
        </nav>
      )}

      {/* PANE 2: Secondary Panel */}
      {!isMobile && secondaryPane && (
        <div className={cn(
          "flex-shrink-0 bg-card/80 backdrop-blur-md rounded-2xl",
          "border border-border/60 shadow-sm flex flex-col h-full z-10",
          "overflow-hidden transition-all duration-500 ease-in-out",
          isSecondaryOpen ? "w-[280px] opacity-100" : "w-0 opacity-0 -ml-3 border-0"
        )}>
          {secondaryPane}
        </div>
      )}

      {/* PANE 3: Main Content */}
      <div className="flex-1 min-w-0 bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col h-full relative z-0 transition-all duration-500">
        {children}
      </div>

      {/* PANE 4: Detail Panel Outlet */}
      {!isMobile && config.showDetailPane && (
        <DetailPaneOutlet
          isOpen={isPanelOpen}
          panelType={panelType}
          width={isTablet ? "w-[320px]" : "w-[360px]"}
        />
      )}
    </div>
  );
}
```

### Integration Points

```yaml
LAYOUT:
  - MODIFY: src/components/Layout.tsx
  - PATTERN: Layout.tsx continues to provide TopBar, AppShell handles panes
  - NOTE: Pages using AppShell should have usesCustomLayout=true

STORES:
  - INTEGRATE: src/stores/panelStore.ts
  - PATTERN: AppShell reads panelStore state for DetailPaneOutlet
  - NO CHANGES to panelStore itself

ROUTING:
  - PRESERVE: All existing routes unchanged
  - PATTERN: Pages render through Layout → AppShell
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# Run after each file creation
npm run lint -- src/components/layout/
npm run type-check

# Expected: Zero errors
```

### Level 2: Unit Tests (Component Validation)

```bash
# Test new components
npm run test -- src/components/layout/__tests__/

# Test affected pages
npm run test -- src/pages/__tests__/

# Expected: All tests pass
```

### Level 3: Integration Testing (Visual Validation)

```bash
# Start dev server
npm run dev

# Manual validation checklist:
# 1. Visit each page and verify:
#    - Sidebar toggle is edge-mounted (circular, on right edge)
#    - NOT hamburger menu at top
#    - Toggle animation is smooth (500ms)
#    - Pane widths match specs (220/280/360px)

# 2. Test responsive behavior:
#    - Desktop: All panes visible
#    - Tablet: Sidebar auto-collapsed
#    - Mobile: Overlay patterns
```

### Level 4: Visual Regression Testing

```bash
# Use Playwright/Chrome DevTools MCP to capture screenshots
# Compare before/after for each page:

# Pages to verify:
# - /                     (TranscriptsNew)
# - /chat                 (Chat - MUST have new toggle)
# - /settings             (Settings)
# - /sorting-tagging      (SortingTagging - reference)
# - /team                 (CollaborationPage - no extra wrappers)
# - /content              (ContentHub)
```

## Final Validation Checklist

### Technical Validation

- [ ] All new components created (SidebarToggle, PaneContainer, AppShell, DetailPaneOutlet)
- [ ] All 6 major pages migrated to AppShell
- [ ] No TypeScript errors: `npm run type-check`
- [ ] No linting errors: `npm run lint`
- [ ] All existing tests pass

### Feature Validation

- [ ] Chat.tsx has edge-mounted toggle (NOT hamburger)
- [ ] CollaborationPage has no extra card wrappers
- [ ] All pages have consistent sidebar behavior
- [ ] All pages have correct pane widths (220/280/360px)
- [ ] All transitions are 500ms ease-in-out
- [ ] Mobile overlay patterns work correctly

### Code Quality Validation

- [ ] Zero duplicate pane code across pages
- [ ] AppShell is single source of truth for layout
- [ ] New components follow existing patterns
- [ ] Brand guidelines updated with component docs

### Regression Validation

- [ ] Existing functionality preserved on all pages
- [ ] Panel store integration works (detail panels open/close)
- [ ] Keyboard navigation preserved
- [ ] Accessibility attributes preserved (aria-labels, roles)

---

## Anti-Patterns to Avoid

- ❌ Don't copy pane code to individual pages - use AppShell
- ❌ Don't use hamburger menu toggle - use edge-mounted circular button
- ❌ Don't use 300ms transitions for sidebar - use 500ms for premium feel
- ❌ Don't nest card containers - one card wrapper per pane maximum
- ❌ Don't inline panel rendering - use DetailPaneOutlet
- ❌ Don't hardcode widths in pages - use AppShell config
- ❌ Don't forget stopPropagation() on toggle button
- ❌ Don't skip mobile overlay patterns

---

## Implementation Notes for AI Agent

### Priority Order

1. **FIRST**: Create SidebarToggle.tsx - smallest, most isolated component
2. **SECOND**: Create PaneContainer.tsx - reusable wrapper
3. **THIRD**: Create DetailPaneOutlet.tsx - panel rendering
4. **FOURTH**: Create AppShell.tsx - composes all above
5. **FIFTH**: Migrate Chat.tsx - most broken, highest impact fix
6. **SIXTH**: Migrate other pages in any order
7. **LAST**: Update documentation

### Critical Success Factors

1. **Edge-mounted toggle**: The defining visual indicator of correct implementation
2. **No duplicate code**: Pages should have <50 lines of layout-related code
3. **Consistent styling**: All panes use identical border-radius, shadows, spacing
4. **Responsive defaults**: Sidebar collapses on tablet automatically

### Reference Files to Keep Open

- `src/pages/SortingTagging.tsx` - The gold standard implementation
- `docs/design/brand-guidelines-v4.1.md` - Authoritative specs
- `src/stores/panelStore.ts` - Panel state interface
