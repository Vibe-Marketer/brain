# Microsoft Loop Multi-Pane Navigation Patterns

**Research Date:** January 2026
**Purpose:** Document Microsoft Loop's multi-pane navigation architecture for Settings and SortingTagging page refactoring
**Reference Spec:** `.auto-claude/specs/006-ui-ux-for-settings-sorting-pages/spec.md`

---

## Executive Summary

Microsoft Loop employs a **flexible multi-pane layout system** that adapts based on user context and navigation state. This document extracts the key navigation patterns that will be applied to refactor the `/settings` and `/sorting-tagging` pages from tab-based to pane-based navigation.

**Key Takeaways:**
- Three-level navigation hierarchy: Sidebar → 2nd Pane (category list) → 3rd Pane (detail view)
- Contextual panels appear/disappear based on navigation state
- Smooth transitions with consistent timing (~200-300ms)
- Clear visual hierarchy and state management
- Keyboard accessibility throughout

---

## 1. Layout Architecture

### 1.1 Three-Panel System

Microsoft Loop uses a **responsive multi-panel layout** with three main regions:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Application Shell                           │
├──────────┬──────────────┬───────────────────────────────────────────────┤
│          │              │                                               │
│  Primary │   Middle     │              Main Content                     │
│  Sidebar │   Panel      │              Area                             │
│  (1st)   │   (2nd)      │              (3rd/4th Pane)                   │
│          │              │                                               │
│  ~240px  │   ~280px     │              Flexible                         │
│  fixed   │   contextual │                                               │
│          │              │                                               │
└──────────┴──────────────┴───────────────────────────────────────────────┘
```

**Panel Specifications:**

| Panel | Width | Behavior | Purpose |
|-------|-------|----------|---------|
| Primary Sidebar | 240px (expanded) / 72px (collapsed) | Fixed, collapsible | Global navigation, app-level actions |
| Middle Panel | ~280px | Contextual, closable | Category lists, item navigation |
| Main Content | Flexible, fills remaining | Always visible | Detail view, editing interface |

### 1.2 Panel States and Transitions

**Primary Sidebar States:**
- **Expanded**: Full width (240px) with text labels
- **Collapsed**: Icon-only (72px) with tooltips
- **Transition**: Smooth slide animation, 300ms ease-in-out

**Middle Panel States:**
- **Open**: Visible at 280px width
- **Closed**: Hidden with 0 width, content area expands
- **Transition**: Slide + fade, 500ms ease-in-out

**CSS Implementation Pattern:**
```css
/* Panel transition classes */
.panel-expanded {
  width: 280px;
  opacity: 1;
  transition: all 500ms ease-in-out;
}

.panel-collapsed {
  width: 0;
  opacity: 0;
  margin-left: -12px;
  border: 0;
}
```

---

## 2. Navigation Hierarchy

### 2.1 Three-Level Navigation Model

Microsoft Loop implements a **progressive disclosure** navigation pattern:

```
Level 1: Application Navigation (Sidebar)
   ↓
Level 2: Workspace/Category Navigation (Middle Panel)
   ↓
Level 3: Content Detail (Main Area)
```

**Application to Settings/SortingTagging:**

| Level | Loop Component | Settings Equivalent | SortingTagging Equivalent |
|-------|---------------|---------------------|---------------------------|
| 1 | Sidebar items (Recent, Ideas, Workspaces) | "Settings" sidebar item | "Sorting" sidebar item |
| 2 | Workspace page list | Settings categories (Account, Billing, etc.) | Feature categories (Folders, Tags, Rules, etc.) |
| 3 | Page content canvas | Setting detail form | Feature management interface |

### 2.2 Navigation Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SETTINGS NAVIGATION FLOW                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SIDEBAR (Level 1)          2ND PANE (Level 2)         3RD PANE (Level 3)  │
│  ┌──────────────────┐      ┌──────────────────┐       ┌──────────────────┐ │
│  │ [×] Library      │      │  SETTINGS        │       │  ACCOUNT DETAILS │ │
│  │ [×] Dashboard    │      │ ┌──────────────┐ │       │ ┌──────────────┐ │ │
│  │ [→] Settings ────┼──────┤►│ Account     ─┼─┼───────┤►│ Profile Photo │ │ │
│  │ [×] Sorting      │      │ │ Users        │ │       │ │ Name          │ │ │
│  │ [×] Help         │      │ │ Billing      │ │       │ │ Email         │ │ │
│  └──────────────────┘      │ │ Integrations │ │       │ │ Phone         │ │ │
│                            │ │ AI Settings  │ │       │ │ Timezone      │ │ │
│                            │ │ Admin        │ │       │ └──────────────┘ │ │
│                            │ └──────────────┘ │       │    [Save]        │ │
│                            └──────────────────┘       └──────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SORTING/TAGGING NAVIGATION FLOW                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SIDEBAR (Level 1)          2ND PANE (Level 2)         3RD PANE (Level 3)  │
│  ┌──────────────────┐      ┌──────────────────┐       ┌──────────────────┐ │
│  │ [×] Library      │      │  ORGANIZATION    │       │  FOLDERS         │ │
│  │ [×] Dashboard    │      │ ┌──────────────┐ │       │ ┌──────────────┐ │ │
│  │ [×] Settings     │      │ │ Folders     ─┼─┼───────┤►│ All Folders  │ │ │
│  │ [→] Sorting ─────┼──────┤►│ Tags         │ │       │ │ + New Folder │ │ │
│  │ [×] Help         │      │ │ Rules        │ │       │ │ ├─ Work      │ │ │
│  └──────────────────┘      │ │ Recurring    │ │       │ │ ├─ Personal  │ │ │
│                            │ └──────────────┘ │       │ │ └─ Archive   │ │ │
│                            └──────────────────┘       │ └──────────────┘ │ │
│                                                       └──────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Animation and Timing Analysis

### 3.1 Transition Timings

Based on Microsoft Loop's observed behavior:

| Animation | Duration | Easing | Use Case |
|-----------|----------|--------|----------|
| Panel collapse/expand | 300ms | ease-in-out | Sidebar toggle |
| Panel slide (open/close) | 500ms | ease-in-out | Middle panel visibility |
| Dropdown menus | 150-200ms | ease-out | Menus, popovers |
| Hover state changes | 100ms | ease | Button hovers, list items |
| Content swap | Instant | N/A | Page content changes |
| Focus highlight | 50ms | ease | Keyboard focus indicators |

### 3.2 Recommended Tailwind Configuration

```typescript
// tailwind.config.ts - transition classes for panes
{
  theme: {
    extend: {
      transitionDuration: {
        'panel': '300ms',      // Sidebar collapse/expand
        'panel-slow': '500ms', // Middle panel open/close
        'menu': '200ms',       // Dropdown/popover
        'fast': '100ms',       // Hover states
        'focus': '50ms',       // Focus indicators
      },
      transitionTimingFunction: {
        'panel': 'cubic-bezier(0.4, 0, 0.2, 1)', // ease-in-out
        'menu': 'cubic-bezier(0, 0, 0.2, 1)',    // ease-out
      }
    }
  }
}
```

### 3.3 CSS Animation Patterns

```css
/* Panel open animation */
.pane-enter {
  opacity: 0;
  transform: translateX(-10px);
}
.pane-enter-active {
  opacity: 1;
  transform: translateX(0);
  transition: all 300ms ease-in-out;
}

/* Panel close animation */
.pane-exit {
  opacity: 1;
  transform: translateX(0);
}
.pane-exit-active {
  opacity: 0;
  transform: translateX(-10px);
  transition: all 300ms ease-in-out;
}
```

---

## 4. Visual Hierarchy and State Management

### 4.1 Visual Design Tokens

**Colors (Brand-Agnostic):**
| Token | Usage |
|-------|-------|
| `--color-surface` | Panel backgrounds |
| `--color-surface-hover` | Hover states |
| `--color-border` | Panel dividers |
| `--color-text-primary` | Main text |
| `--color-text-secondary` | Metadata, timestamps |
| `--color-accent` | Active items, selections |

**Spacing Scale:**
| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | 4px | Tight component spacing |
| `--space-sm` | 8px | Related element gaps |
| `--space-md` | 16px | Standard spacing |
| `--space-lg` | 24px | Section separation |
| `--space-xl` | 32px | Major sections |

**Border Radius:**
| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 4px | Buttons, inputs |
| `--radius-md` | 8px | Cards, panels |
| `--radius-lg` | 12px | Modals, large cards |
| `--radius-full` | 50% | Avatars, badges |

### 4.2 State Indicators

**Active States:**
- **Selected item**: Background color change + left border accent
- **Hover state**: Subtle background color shift
- **Focus state**: Ring outline (keyboard accessibility)
- **Disabled state**: Reduced opacity (50%)

**Loop's Pattern for Active Items:**
```css
.nav-item {
  padding: 8px 12px;
  border-radius: 6px;
  border-left: 3px solid transparent;
}

.nav-item:hover {
  background: var(--color-surface-hover);
}

.nav-item.active {
  background: var(--color-surface-hover);
  border-left-color: var(--color-accent);
  font-weight: 600;
}
```

### 4.3 Panel State Management

**State Structure (Zustand Pattern):**
```typescript
interface PaneState {
  // 2nd Pane (Category List)
  secondPane: {
    isOpen: boolean;
    content: 'settings-categories' | 'sorting-categories' | null;
  };

  // 3rd Pane (Detail View)
  thirdPane: {
    isOpen: boolean;
    content: string | null; // e.g., 'account', 'billing', 'folders', 'tags'
    data: any;
  };

  // Navigation History (for back navigation)
  history: Array<{ pane: string; content: string; data: any }>;

  // Actions
  openSecondPane: (content: string) => void;
  openThirdPane: (content: string, data?: any) => void;
  closePane: (pane: 'second' | 'third') => void;
  goBack: () => void;
}
```

---

## 5. Interaction Patterns

### 5.1 Click Flow Optimization

**Current Tab-Based Flow (Anti-Pattern):**
```
Home → Settings Page → Click Tab → Scroll to Section → Find Setting
(4+ clicks/actions)
```

**Target Pane-Based Flow:**
```
Sidebar Settings → Category in 2nd Pane → Setting visible in 3rd Pane
(2 clicks)
```

### 5.2 Keyboard Navigation

**Microsoft Loop Keyboard Shortcuts:**
| Shortcut | Action |
|----------|--------|
| `Tab` | Move focus forward |
| `Shift + Tab` | Move focus backward |
| `Escape` | Close current panel/menu |
| `Arrow Up/Down` | Navigate lists |
| `Enter` | Select item, open detail |
| `⌘ + J` / `Ctrl + J` | Open search |

**Implementation Requirements:**
- Focus trap within modals/dialogs
- Focus restoration when panels close
- Arrow key navigation in category lists
- Escape key closes panels in order (3rd → 2nd → 1st)

### 5.3 Context Preservation

**Navigation State Persistence:**
- When returning to a page, restore previous pane states
- Deep links should open correct pane combination
- Browser back/forward should navigate pane history

**URL Pattern for Deep Links:**
```
/settings                    → Opens 2nd pane with categories
/settings/account            → Opens 2nd pane + 3rd pane with account
/settings/billing            → Opens 2nd pane + 3rd pane with billing
/sorting-tagging             → Opens 2nd pane with categories
/sorting-tagging/folders     → Opens 2nd pane + 3rd pane with folders
/sorting-tagging/tags        → Opens 2nd pane + 3rd pane with tags
```

---

## 6. Component Architecture

### 6.1 Existing Components to Reuse

Based on the codebase analysis:

| Component | Location | Purpose in New Architecture |
|-----------|----------|----------------------------|
| `SidebarNav` | `src/components/ui/sidebar-nav.tsx` | Primary navigation rail |
| `FolderSidebar` | `src/components/transcript-library/FolderSidebar.tsx` | Pattern for category lists |
| `panelStore` | `src/stores/panelStore.ts` | Extend for settings/sorting panes |
| `Layout` | `src/components/Layout.tsx` | App shell structure |

### 6.2 New Components Required

| Component | Purpose | Location |
|-----------|---------|----------|
| `SettingsCategoryPane` | 2nd pane for settings categories | `src/components/panes/` |
| `SettingsDetailPane` | 3rd pane for settings forms | `src/components/panes/` |
| `SortingCategoryPane` | 2nd pane for sorting categories | `src/components/panes/` |
| `SortingDetailPane` | 3rd pane for sorting features | `src/components/panes/` |

### 6.3 Panel Type Extensions

```typescript
// Extend existing PanelType in panelStore.ts
export type PanelType =
  | 'workspace-detail'
  | 'call-detail'
  | 'insight-detail'
  | 'filter-tool'
  | 'ai-assistant'
  | 'inspector'
  | 'folder-detail'
  | 'tag-detail'
  | 'setting-help'
  // New types for settings/sorting panes:
  | 'settings-category'   // 2nd pane for settings
  | 'settings-detail'     // 3rd pane for settings
  | 'sorting-category'    // 2nd pane for sorting/tagging
  | 'sorting-detail'      // 3rd pane for sorting/tagging
  | null;
```

---

## 7. Responsive Behavior

### 7.1 Breakpoint Strategy

| Breakpoint | Sidebar | 2nd Pane | 3rd Pane | Behavior |
|------------|---------|----------|----------|----------|
| Desktop (>1024px) | Expanded/Collapsed | Side-by-side | Side-by-side | Full multi-pane |
| Tablet (768-1024px) | Collapsed (icons) | Overlay | Full width | Stacked with transitions |
| Mobile (<768px) | Hidden (hamburger) | Full width | Full width | Single pane + back nav |

### 7.2 Mobile Navigation Pattern

```
┌──────────────────────────┐
│ ← Back    SETTINGS       │  ← Header with back button
├──────────────────────────┤
│ ┌──────────────────────┐ │
│ │ Account             →│ │  ← Category list (full width)
│ │ Users               →│ │
│ │ Billing             →│ │
│ │ Integrations        →│ │
│ │ AI Settings         →│ │
│ │ Admin               →│ │
│ └──────────────────────┘ │
└──────────────────────────┘

       ↓ (tap Account)

┌──────────────────────────┐
│ ← Settings  ACCOUNT      │  ← Back to category list
├──────────────────────────┤
│ ┌──────────────────────┐ │
│ │ Profile Photo        │ │  ← Detail view (full width)
│ │ Name: John Doe       │ │
│ │ Email: john@...      │ │
│ │ Phone: +1...         │ │
│ │                      │ │
│ │      [Save]          │ │
│ └──────────────────────┘ │
└──────────────────────────┘
```

---

## 8. Implementation Recommendations

### 8.1 Migration Strategy

**Phase 1: Add New (Dual Mode)**
1. Create new pane components alongside existing tabs
2. Both systems functional simultaneously
3. Validate pane navigation works correctly

**Phase 2: Wire Navigation**
1. Connect sidebar items to open 2nd pane
2. Connect 2nd pane items to open 3rd pane
3. Test full navigation flows

**Phase 3: Remove Old**
1. Remove Radix Tabs from Settings.tsx
2. Remove Radix Tabs from SortingTagging.tsx
3. Update routes/deep links

**Phase 4: Polish**
1. Add animations and transitions
2. Implement keyboard navigation
3. Add responsive behavior

### 8.2 Key Implementation Patterns

**From LoopLayoutDemo.tsx:**
```typescript
// Sidebar expansion toggle
const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

// Middle panel (Library) visibility
const [isLibraryOpen, setIsLibraryOpen] = useState(true);

// Panel width classes
className={cn(
  "transition-all duration-500 ease-in-out",
  isLibraryOpen ? "w-[280px] opacity-100" : "w-0 opacity-0 -ml-3"
)}
```

**State synchronization with routes:**
```typescript
// Read from URL on mount
useEffect(() => {
  const category = searchParams.get('category');
  if (category) {
    openSecondPane('settings-categories');
    openThirdPane(category);
  }
}, []);

// Update URL on navigation
const navigateToCategory = (category: string) => {
  setSearchParams({ category });
  openThirdPane(category);
};
```

---

## 9. Success Metrics

### 9.1 Click Reduction Targets

| Workflow | Old (Tabs) | New (Panes) | Reduction |
|----------|------------|-------------|-----------|
| Change account setting | 4 clicks | 2 clicks | 50% |
| Create new folder | 3 clicks | 2 clicks | 33% |
| Edit AI settings | 4 clicks | 2 clicks | 50% |
| View tag details | 3 clicks | 2 clicks | 33% |
| Access admin panel | 4 clicks | 2 clicks | 50% |

**Target: ≥20% average click reduction across top 5 workflows**

### 9.2 UX Quality Checklist

- [ ] Smooth animations (no jank, consistent timing)
- [ ] Clear visual hierarchy (active states obvious)
- [ ] Keyboard navigable (Tab, Escape, Arrow keys)
- [ ] Responsive (graceful mobile degradation)
- [ ] Deep links work (panes open correctly from URL)
- [ ] No console errors during navigation
- [ ] Feature parity with tab-based version

---

## 10. References

### 10.1 Internal Documentation
- `docs/planning/Microsoft Loop UI Reverse Engineering.md` - Comprehensive Loop UI analysis
- `docs/planning/loop-complete-audit.md` - Detailed component documentation
- `src/pages/LoopLayoutDemo.tsx` - Existing Loop-style implementation

### 10.2 Design System Resources
- Microsoft Fluent Design System 2.0
- Tailwind CSS transitions/animations
- Radix UI component patterns

### 10.3 Existing Codebase Patterns
- `src/stores/panelStore.ts` - Panel state management
- `src/components/ui/sidebar-nav.tsx` - Navigation rail
- `src/components/transcript-library/FolderSidebar.tsx` - Category list pattern

---

## Appendix A: Visual Reference (ASCII Diagrams)

### A.1 Full Layout with All Panes Open

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    APPLICATION HEADER                                │
├──────────────┬────────────────┬────────────────────────────┬────────────────────────┤
│    72/240px  │     280px      │         Flexible           │       300px            │
│  ┌─────────┐ │ ┌────────────┐ │ ┌────────────────────────┐ │ ┌──────────────────┐  │
│  │  Menu   │ │ │  SETTINGS  │ │ │      ACCOUNT           │ │ │    HELP/INFO     │  │
│  │  ─────  │ │ │            │ │ │                        │ │ │                  │  │
│  │ Library │ │ │  Account → │ │ │  Profile Settings      │ │ │  Quick tips for  │  │
│  │ Dash    │ │ │  Users     │ │ │                        │ │ │  account setup   │  │
│  │ Settings│ │ │  Billing   │ │ │  Name: ___________     │ │ │                  │  │
│  │ Sorting │ │ │  Integr.   │ │ │  Email: __________     │ │ │  • Tip 1         │  │
│  │ Help    │ │ │  AI        │ │ │  Phone: __________     │ │ │  • Tip 2         │  │
│  │         │ │ │  Admin     │ │ │                        │ │ │  • Tip 3         │  │
│  │         │ │ │            │ │ │      [Save Changes]    │ │ │                  │  │
│  └─────────┘ │ └────────────┘ │ └────────────────────────┘ │ └──────────────────┘  │
│   SIDEBAR    │   2ND PANE     │        3RD PANE            │      4TH PANE         │
└──────────────┴────────────────┴────────────────────────────┴────────────────────────┘
```

### A.2 Collapsed Sidebar State

```
┌──────┬────────────────┬──────────────────────────────────────────────────────────────┐
│  72  │     280px      │                        Flexible                              │
│ ┌──┐ │ ┌────────────┐ │ ┌──────────────────────────────────────────────────────────┐ │
│ │☰ │ │ │  SETTINGS  │ │ │                        ACCOUNT                           │ │
│ │──│ │ │            │ │ │                                                          │ │
│ │📚│ │ │  Account → │ │ │  Profile Settings                                        │ │
│ │📊│ │ │  Users     │ │ │                                                          │ │
│ │⚙ │ │ │  Billing   │ │ │  [Form fields expand to use available width]             │ │
│ │🏷│ │ │  Integr.   │ │ │                                                          │ │
│ │❓│ │ │  AI        │ │ │                                                          │ │
│ │  │ │ │  Admin     │ │ │                                                          │ │
│ └──┘ │ └────────────┘ │ └──────────────────────────────────────────────────────────┘ │
└──────┴────────────────┴──────────────────────────────────────────────────────────────┘
```

---

**Document Version:** 1.0
**Last Updated:** January 2026
**Author:** Auto-Claude Agent
