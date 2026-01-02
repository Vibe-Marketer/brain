# Specification: Component Deduplication & Reusability Audit

## Overview

This task audits and refactors the codebase to eliminate duplicate UI components and enforce a single-source-of-truth architecture for shared elements. The goal is to ensure that layout shells (sidebar, panes) and repeated UI patterns exist in exactly one location, so that a single modification propagates to all usages across the application.

## Workflow Type

**Type**: feature (refactoring enhancement)

**Rationale**: This is a non-trivial architectural improvement that touches multiple files and establishes new component organization patterns. It requires systematic identification, extraction, and replacement of duplicate code.

## Task Scope

### Services Involved
- **main** (primary) - React frontend with all UI components

### This Task Will:
- [ ] Audit all layout and navigation components to identify duplicates
- [ ] Extract canonical versions into `/components/shared/` or consolidate in existing locations
- [ ] Replace all duplicate usages with imports from single source
- [ ] Remove orphaned duplicate code files
- [ ] Verify that modifying shared components propagates to all usages
- [ ] Create unit tests for canonical Layout and SidebarNav components (currently missing)

### Out of Scope:
- Backend/API changes
- Database modifications
- Creating new UI features (only consolidating existing)
- Changes to design tokens (already centralized in tailwind.config.ts)

## Service Context

### Main Service (Frontend)

**Tech Stack:**
- Language: TypeScript
- Framework: React
- Build Tool: Vite
- Styling: Tailwind CSS
- State Management: Zustand
- UI Libraries: Radix UI, Remix Icons

**Entry Point:** `src/App.tsx`

**How to Run:**
```bash
npm run dev
```

**Port:** 3000

**Testing:** Vitest (unit), Playwright (e2e)

## Current Architecture (As-Is)

**Important Architectural Context:**

The current codebase has a layered layout architecture that the spec must address:

1. **App.tsx** wraps all pages with `Layout` component
2. **Layout.tsx** provides TopBar only (no sidebar)
3. **Pages** (TranscriptsNew, Chat, etc.) each implement their own 3-pane layout with SidebarNav

This means there are TWO levels of potential duplication:
- **Component-level:** Multiple sidebar/shell implementations (addressed below)
- **Page-level:** Each page implements its own responsive 3-pane layout with SidebarNav

The consolidated approach should either:
- Keep Layout minimal (TopBar only) and standardize how pages consume CallVaultLayout, OR
- Migrate Layout to use CallVaultLayout as the single layout wrapper

## Identified Duplicates

### Critical Duplicate #1: PrimarySidebar (3 implementations)

| File | Status | Features |
|------|--------|----------|
| `src/components/layout/loop/PrimarySidebar.tsx` | ORPHANED | Icon nav, local state, no routing |
| `src/components/contextual/PrimarySidebar.tsx` | ORPHANED | Full nav, routing, panel store integration |
| `src/components/loop/Sidebar.tsx` | ORPHANED | Full featured, workspaces, collapsible |

**Canonical Source:** `src/components/ui/sidebar-nav.tsx` (directly imported by pages: TranscriptsNew, Chat, Settings, SortingTagging, LoopLayoutDemo)

### Critical Duplicate #2: AppShell/Layout (5 implementations)

| File | Status | Features |
|------|--------|----------|
| `src/components/layout/loop/AppShell.tsx` | ORPHANED | Simple wrapper, uses loop PrimarySidebar |
| `src/components/contextual/AppShellV2.tsx` | ORPHANED | Secondary panel, uses contextual PrimarySidebar |
| `src/components/loop/AppShell.tsx` | ORPHANED | TopBar + Sidebar, collapsible state |
| `src/components/LoopShell.tsx` | ORPHANED | Most complete, panels, inline navigation |
| `src/components/Layout.tsx` | **ACTIVE** | Currently used in App.tsx, uses TopBar |

**Canonical Source:** `src/components/layout/CallVaultLayout.tsx` (best architecture, not actively used in App.tsx)

### Critical Duplicate #3: Orphaned App Entry Points

| File | Status | Notes |
|------|--------|-------|
| `src/App_Original.tsx` | DELETE | Uses orphaned loop/AppShell |
| `src/App_Loop.tsx` | DELETE | Uses orphaned LoopShell |

## Files to Modify

| File | Service | What to Change |
|------|---------|---------------|
| `src/App.tsx` | main | Consider migrating to CallVaultLayout or consolidate Layout |
| `src/components/Layout.tsx` | main | Enhance or mark as canonical |
| `src/pages/TranscriptsNew.tsx` | main | Verify imports use canonical components; uses its own 3-pane layout |
| `src/pages/Chat.tsx` | main | Verify imports use canonical components; uses its own 3-pane layout |
| `src/pages/Settings.tsx` | main | Verify imports use canonical components |
| `src/pages/SortingTagging.tsx` | main | Verify imports use canonical components |
| `src/pages/CallDetailPage.tsx` | main | Verify imports use canonical components |
| `src/pages/LoopLayoutDemo.tsx` | main | Verify imports use canonical components (demo page)

## Files to Remove (Orphaned)

| File | Reason |
|------|--------|
| `src/components/layout/loop/PrimarySidebar.tsx` | Duplicate sidebar |
| `src/components/layout/loop/AppShell.tsx` | Unused AppShell |
| `src/components/layout/loop/SecondaryPanel.tsx` | Part of unused layout |
| `src/components/layout/loop/MainLayout.tsx` | Unused layout |
| `src/components/contextual/PrimarySidebar.tsx` | Duplicate sidebar |
| `src/components/contextual/AppShellV2.tsx` | Unused AppShell |
| `src/components/contextual/SecondaryPanel.tsx` | Part of unused layout |
| `src/components/loop/Sidebar.tsx` | Duplicate sidebar |
| `src/components/loop/AppShell.tsx` | Unused AppShell |
| `src/components/loop/TopBar.tsx` | Duplicate TopBar |
| `src/components/LoopShell.tsx` | Unused shell |
| `src/App_Original.tsx` | Orphaned entry point |
| `src/App_Loop.tsx` | Orphaned entry point |

## Files to Reference (Patterns to Follow)

| File | Pattern to Copy |
|------|----------------|
| `src/components/layout/CallVaultLayout.tsx` | 3-pane responsive layout with controlled/uncontrolled state |
| `src/components/ui/sidebar-nav.tsx` | Canonical navigation with NavItem pattern |
| `src/components/ui/button.tsx` | shadcn/ui component structure |
| `tailwind.config.ts` | Design token usage (cb-, vibe-orange) |

## Patterns to Follow

### Pattern 1: Canonical Navigation Item

From `src/components/ui/sidebar-nav.tsx`:

```typescript
interface NavItem {
  id: string;
  name: string;
  icon: React.ReactNode;
  path: string;
  matchPaths?: string[];
}

const navItems: NavItem[] = [
  {
    id: 'home',
    name: 'Home',
    icon: <RiHome4Fill className={iconClass} />,
    path: '/',
    matchPaths: ['/', '/transcripts'],
  },
  // ...
];
```

**Key Points:**
- Use `id` for React keys
- Use `matchPaths` for active state detection
- Consistent icon sizing via shared class

### Pattern 2: Responsive Layout with Breakpoints

From `src/components/layout/CallVaultLayout.tsx`:

```typescript
const breakpoint = useBreakpoint();

const getDefaultNavExpanded = (bp: Breakpoint) => {
  switch (bp) {
    case "mobile": return false;
    case "tablet": return false;
    case "desktop": return true;
  }
};
```

**Key Points:**
- Support controlled and uncontrolled state
- Responsive defaults based on breakpoint
- Mobile overlays vs. persistent panels on desktop

### Pattern 3: Design Token Usage

From `tailwind.config.ts`:

```typescript
// Use semantic tokens, not raw colors
className="text-foreground"           // Not text-gray-900
className="bg-card"                   // Not bg-white
className="text-cb-vibe-orange"       // Brand color
className="border-border"             // Not border-gray-200
```

## Requirements

### Functional Requirements

1. **Single Layout Source**
   - Description: All pages must import layout from one canonical location
   - Acceptance: `grep -r "import.*Layout\|AppShell\|LoopShell" src/` returns only canonical imports

2. **Single Navigation Source**
   - Description: Navigation component exists in one location only
   - Acceptance: No duplicate PrimarySidebar or Sidebar components

3. **No Orphaned Files**
   - Description: All component files are actively imported somewhere
   - Acceptance: Running a dead code analyzer shows no unused layout components

4. **Propagation Verification**
   - Description: Changing shared component affects all usages
   - Acceptance: Modify sidebar color, see change on all pages

### Edge Cases

1. **Page-specific layouts** - Some pages (Login) may need different layouts; use conditional rendering, not duplication
2. **Feature flags** - If testing new layouts, use feature flags within single component, not separate files
3. **Mobile vs Desktop** - Use responsive breakpoints in single component, not separate mobile components

## Implementation Notes

### DO
- Follow the pattern in `src/components/ui/sidebar-nav.tsx` for navigation items
- Follow the pattern in `src/components/layout/CallVaultLayout.tsx` for responsive layouts
- Use design tokens from `tailwind.config.ts` (cb-, vibe-orange, foreground, etc.)
- Keep orphaned files backed up in a branch before deletion
- Update imports incrementally, testing each change

### DON'T
- Create new layout files when consolidating existing ones works
- Copy-paste code between components; extract shared utilities
- Use raw color values; always use design tokens
- Delete files without first verifying they're truly orphaned
- Make breaking changes to actively-used components without migration path

## Development Environment

### Start Services

```bash
npm run dev
```

### Service URLs
- Main App: http://localhost:3000

### Required Environment Variables
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Supabase anon key

## Implementation Strategy

### Phase 1: Audit & Document (No Code Changes)
1. Verify all identified duplicates are truly duplicates
2. Confirm which files are actively imported vs orphaned
3. Document any dependencies between files

### Phase 2: Consolidate Using Existing Structure
```
src/components/
├── layout/
│   └── CallVaultLayout.tsx    # CANONICAL: 3-pane responsive layout
├── ui/
│   ├── sidebar-nav.tsx        # CANONICAL: Navigation component (keep here, shadcn pattern)
│   └── top-bar.tsx            # TopBar component
├── Layout.tsx                  # Simple wrapper with TopBar (consider integrating with CallVaultLayout)
└── ...                         # Feature-specific components
```

**Decision Point:** Rather than creating a new `shared/` directory:
- Keep `sidebar-nav.tsx` in `ui/` (follows shadcn/ui convention)
- Keep or enhance `CallVaultLayout.tsx` in `layout/`
- Remove orphaned directories: `layout/loop/`, `contextual/`, `loop/`

### Phase 3: Consolidate (Incremental)
1. Start with least-used duplicates (safest to remove)
2. Update imports one file at a time
3. Run tests after each change
4. Commit after each successful consolidation

### Phase 4: Cleanup
1. Remove orphaned files
2. Delete orphaned entry points (App_Original.tsx, App_Loop.tsx)
3. Update any remaining imports

### Phase 5: Verify
1. Run full test suite
2. Manual verification of all pages
3. Confirm single-source propagation works

## Success Criteria

The task is complete when:

1. [ ] Only ONE layout component is used across all pages
2. [ ] Only ONE sidebar/navigation component exists
3. [ ] All orphaned layout files are removed
4. [ ] Changing shared component color propagates to all pages
5. [ ] No console errors
6. [ ] All existing tests pass (`npm run test`)
7. [ ] All pages render correctly in browser
8. [ ] No duplicate imports when searching codebase
9. [ ] Unit tests exist for Layout and SidebarNav components

## QA Acceptance Criteria

**CRITICAL**: These criteria must be verified by the QA Agent before sign-off.

### Unit Tests
| Test | File | What to Verify |
|------|------|----------------|
| Layout renders children | `src/components/Layout.test.tsx` | Children prop renders correctly (**TO BE CREATED**) |
| Navigation active state | `src/components/ui/sidebar-nav.test.tsx` | Active state detection works (**TO BE CREATED**) |

**Note:** These test files do not currently exist. They should be created as part of this task to ensure test coverage for canonical components.

### Integration Tests
| Test | Services | What to Verify |
|------|----------|----------------|
| Layout + Pages | main | All pages render within layout |
| Navigation + Routing | main | Clicking nav items changes routes |

### End-to-End Tests
| Flow | Steps | Expected Outcome |
|------|-------|------------------|
| Page Navigation | 1. Load app 2. Click each nav item | Each page loads correctly |
| Responsive Layout | 1. Load app 2. Resize window | Layout adapts without breaking |

### Browser Verification
| Page/Component | URL | Checks |
|----------------|-----|--------|
| Home/Transcripts | `http://localhost:3000/` | Sidebar visible, content loads |
| Chat | `http://localhost:3000/chat` | Layout consistent with Home |
| Settings | `http://localhost:3000/settings` | Layout consistent with Home |
| Sorting & Tagging | `http://localhost:3000/sorting-tagging` | Layout consistent with Home |
| Call Detail | `http://localhost:3000/call/1` | Layout consistent with Home |
| Loop Demo | `http://localhost:3000/loop` | Layout demo page renders |

### Verification Commands
| Check | Command | Expected |
|-------|---------|----------|
| No duplicate Sidebar imports | `grep -r "import.*Sidebar" src/pages src/App.tsx` | Only canonical imports |
| No orphaned files | `git status` after cleanup | Deleted files listed |
| Tests pass | `npm run test` | All tests pass |
| Build succeeds | `npm run build` | No errors |

### QA Sign-off Requirements
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] Browser verification complete
- [ ] No regressions in existing functionality
- [ ] Code follows established patterns (design tokens, component structure)
- [ ] No security vulnerabilities introduced
- [ ] Single-source modification propagates to all usages
