# Settings Page 3-Pane Implementation Audit

**Audit Date:** 2026-01-01
**Subtask:** subtask-1-1
**Auditor:** auto-claude

---

## 1. Current Pane Structure

### Overview
The Settings page (`src/pages/Settings.tsx`) implements a **2-pane layout** (not 3-pane as targeted by the spec):

| Pane | Description | Width | Visibility |
|------|-------------|-------|------------|
| **Pane 1** | Navigation Rail (SidebarNav) | 240px expanded / 72px collapsed | Hidden on mobile, shown as overlay |
| **Pane 2** | N/A - Not implemented | - | - |
| **Pane 3** | Main Content with Tabs | flex-1 (fills remaining space) | Always visible |

### Pane 1: Navigation Rail (`SidebarNav`)
- **Location:** Left side of layout
- **Component:** `src/components/ui/sidebar-nav.tsx`
- **Behavior:**
  - Collapsible (240px ↔ 72px toggle via hamburger button)
  - On mobile: Hidden by default, shown as slide-in overlay with backdrop
  - Contains global app navigation (Home, AI Chat, Sorting, Settings)
  - Does NOT contain settings-specific navigation categories
- **State Management:** Local React state (`isSidebarExpanded`, `showMobileNav`)

### Pane 3: Main Content (Settings Tabs)
- **Location:** Right side of layout (fills remaining space)
- **Structure:**
  ```
  ├── Mobile header (hamburger menu) - mobile only
  ├── TabsList (horizontal tabs: ACCOUNT, USERS, BILLING, INTEGRATIONS, AI, ADMIN)
  ├── Separator line
  ├── Page Header ("Settings" title + description)
  └── TabsContent (scrollable area with tab content)
  ```
- **Tabs Implementation:** Uses Radix UI `@radix-ui/react-tabs`
  - Component: `src/components/ui/tabs.tsx`
  - Role-based tab visibility (USERS for Team/Admin, ADMIN for Admin only)
- **Content Components:**
  - `AccountTab` - Profile, Preferences, Password management
  - `UsersTab` - Organization user management (Team/Admin only)
  - `BillingTab` - Billing information
  - `IntegrationsTab` - Third-party integrations
  - `AITab` - AI settings
  - `AdminTab` - System administration (Admin only)

### Missing: Right Details Panel (Pane 2)
Per the spec requirements, the Settings page should have a right details panel for contextual help/details. This is **NOT currently implemented**.

---

## 2. CRUD Operations

### AccountTab (`src/components/settings/AccountTab.tsx`)
| Operation | Field | Implementation | Status |
|-----------|-------|----------------|--------|
| **Read** | Display Name | Loads from `user_profiles` table | ✅ Working |
| **Read** | Email | Loads from Supabase auth | ✅ Working |
| **Read** | Timezone | Local state only | ⚠️ Not persisted |
| **Read** | Fathom Email | Loads from `user_settings` table | ✅ Working |
| **Update** | Display Name | Inline edit → save to `user_profiles` | ✅ Working |
| **Update** | Timezone | Inline edit → local state only | ⚠️ Not persisted to DB |
| **Update** | Fathom Email | Inline edit → save to `user_settings` | ✅ Working |
| **Update** | Password | Form → `supabase.auth.updateUser` | ✅ Working |
| **Create** | - | N/A for account settings | - |
| **Delete** | - | N/A for account settings | - |

### UsersTab (`src/components/settings/UsersTab.tsx`)
| Operation | Target | Implementation | Status |
|-----------|--------|----------------|--------|
| **Read** | User List | Query `user_profiles` + `user_roles` tables | ✅ Working |
| **Update** | User Role | Admin-only role change via `user_roles` table | ✅ Working |
| **Create** | - | "User management actions coming soon" | ⚠️ Not implemented |
| **Delete** | - | Not implemented | ⚠️ Not implemented |

### CRUD Placement Analysis
- **Current Pattern:** All CRUD operations are within Pane 3 (main content area)
- **Inline Editing:** Edit icons toggle between view/edit modes for form fields
- **Confirmation:** Toast notifications for success/error feedback
- **No Right Panel:** Detailed editing could benefit from a dedicated right panel

---

## 3. Keyboard Navigation Status

### Current Implementation

#### Global Navigation (SidebarNav)
| Element | Keyboard Support | Status |
|---------|-----------------|--------|
| Nav items | `focus-visible:ring-2` on buttons | ✅ Basic focus ring |
| Button activation | Click handler, no `Enter`/`Space` explicit | ⚠️ Relies on native button behavior |
| Sidebar toggle | Button with click handler | ✅ Works |

#### Tabs Navigation
| Feature | Implementation | Status |
|---------|----------------|--------|
| Tab switching | Radix UI built-in keyboard support | ✅ Arrow keys work |
| Focus visible | `focus-visible:ring-2 focus-visible:ring-vibe-orange` | ✅ Working |
| Tab → content | Native focus flow | ✅ Working |

#### Form Elements (AccountTab, UsersTab)
| Feature | Implementation | Status |
|---------|----------------|--------|
| Input focus | Standard input behavior | ✅ Working |
| Button activation | Standard button behavior | ✅ Working |
| Select navigation | Radix UI Select keyboard support | ✅ Working |

### Missing Keyboard Features
| Feature | Spec Requirement | Current Status |
|---------|------------------|----------------|
| Cross-pane Tab navigation | Tab key moves focus between panes | ⚠️ No explicit pane focus management |
| Keyboard shortcuts (Cmd+N, etc.) | Create/delete shortcuts | ❌ Not implemented |
| Arrow keys within settings list | Navigate settings categories | ⚠️ No settings-specific navigation |
| Escape key handling | Close mobile overlay | ⚠️ Only closes via click on backdrop |

---

## 4. Accessibility Issues

### Identified Issues

#### Critical
| Issue | Element | Impact | Recommendation |
|-------|---------|--------|----------------|
| Missing ARIA landmark | Main content pane | Screen readers can't navigate to main content | Add `role="main"` or `<main>` element |
| Missing ARIA labels | Mobile overlay nav | Overlay purpose unclear to screen readers | Add `aria-label="Navigation menu"` |
| Missing escape key handler | Mobile overlay | Keyboard users trapped in overlay | Add `onKeyDown` escape handler |

#### High Priority
| Issue | Element | Impact | Recommendation |
|-------|---------|--------|----------------|
| Inline SVG icons | Close/hamburger icons | No accessible names | Add `aria-label` or `<title>` to SVGs |
| Loading state announcement | Loading spinner | Not announced to screen readers | Add `aria-live="polite"` or `role="status"` |
| Form field grouping | AccountTab sections | Fields not logically grouped | Use `<fieldset>` and `<legend>` |

#### Medium Priority
| Issue | Element | Impact | Recommendation |
|-------|---------|--------|----------------|
| Color contrast | `text-muted-foreground` | May not meet WCAG AA | Verify contrast ratios |
| Focus order | Tab order may skip | Visual order vs DOM order mismatch | Review and fix focus order |
| Heading hierarchy | Section headings all `<h2>` | May confuse screen readers | Consider proper heading hierarchy |

### Positive Accessibility Features
- ✅ Radix UI Tabs provide built-in accessibility (roles, keyboard nav)
- ✅ Focus visible styles on interactive elements
- ✅ Form labels properly associated with inputs via `htmlFor`/`id`
- ✅ Button components use semantic `<button>` elements
- ✅ Select uses Radix UI Select with full accessibility support

---

## 5. State Management Analysis

### Current State Pattern
| State | Location | Scope |
|-------|----------|-------|
| Sidebar expanded | Local React state | Settings page only |
| Mobile nav visible | Local React state | Settings page only |
| Active tab | Radix Tabs `defaultValue` | Settings page only |
| Form editing states | Local React state | Per-tab component |

### Existing Zustand Stores (Reference)
Two Zustand stores exist that could inform 3-pane implementation:

1. **`panelStore.ts`** - Panel management with:
   - `isPanelOpen`, `panelType`, `panelData`
   - `isPinned` for panel persistence
   - `panelHistory` for back navigation
   - Actions: `openPanel`, `closePanel`, `togglePin`, `goBack`

2. **`searchStore.ts`** - Modal/search state management

### Recommendation for 3-Pane
The `panelStore` pattern could be extended or a new `settingsPaneStore` created to manage:
- Settings sidebar state (collapsed/expanded)
- Selected settings category
- Right panel visibility and content
- Cross-pane focus management

---

## 6. Summary of Findings

### What's Working Well
1. Tab-based navigation with Radix UI (accessible, keyboard-friendly)
2. Inline editing pattern for settings with visual feedback
3. Role-based visibility for admin/team features
4. Responsive design with mobile overlay pattern
5. Consistent styling with design system

### Gaps vs. Spec Requirements
| Requirement | Current State | Gap Level |
|-------------|---------------|-----------|
| 3-pane layout | 2-pane only | 🔴 Major |
| Settings categories in sidebar | Global nav only, no settings sidebar | 🔴 Major |
| Right details panel | Not implemented | 🔴 Major |
| Keyboard shortcuts | Not implemented | 🟡 Medium |
| Full CRUD for settings | Partial (no create/delete for users) | 🟡 Medium |
| ARIA landmarks | Incomplete | 🟡 Medium |
| Cross-pane focus management | Not implemented | 🟡 Medium |

### Recommended Next Steps
1. **Phase 1:** Add settings-specific sidebar navigation in Pane 1
2. **Phase 2:** Create right details panel (Pane 2) for contextual help
3. **Phase 3:** Implement Zustand store for settings pane state
4. **Phase 4:** Add keyboard shortcuts and enhanced accessibility
5. **Phase 5:** Migrate tab content to 3-pane CRUD pattern

---

## Appendix: File References

| File | Purpose |
|------|---------|
| `src/pages/Settings.tsx` | Main Settings page component |
| `src/components/ui/sidebar-nav.tsx` | Navigation rail component |
| `src/components/ui/tabs.tsx` | Radix UI Tabs wrapper |
| `src/components/settings/AccountTab.tsx` | Account settings tab |
| `src/components/settings/UsersTab.tsx` | User management tab |
| `src/stores/panelStore.ts` | Panel state management (reference) |
| `src/stores/searchStore.ts` | Search modal state (reference) |
