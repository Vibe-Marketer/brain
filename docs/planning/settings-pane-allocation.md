# Settings Page Pane Allocation Strategy

> **Created:** Subtask 1-4 - UX Research & Navigation Design
> **Purpose:** Design multi-pane navigation structure for Settings page, mapping features to appropriate panes
> **References:**
> - `docs/research/microsoft-loop-patterns.md` - Navigation patterns
> - `docs/planning/settings-feature-audit.md` - Current feature inventory

---

## Executive Summary

This document defines the pane allocation strategy for migrating the Settings page from tab-based to multi-pane navigation. Following Microsoft Loop's three-level navigation model, we allocate the 6 current Settings tabs across a sidebar item, 2nd pane (category list), and 3rd pane (detail view), with an optional 4th pane for contextual help.

**Key Design Decisions:**
- Sidebar: Single "Settings" entry point
- 2nd Pane: Role-aware category list (6 categories, visibility filtered by role)
- 3rd Pane: Full feature content (reuse existing tab components)
- 4th Pane: Contextual help (reuse existing SettingHelpPanel)

**Expected Outcomes:**
- 50% click reduction for most workflows (4 clicks → 2 clicks)
- Consistent navigation pattern across application
- Improved discoverability via persistent category list

---

## 1. Navigation Architecture Overview

### 1.1 Three-Level Navigation Model

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          SETTINGS NAVIGATION ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Level 1: SIDEBAR          Level 2: 2ND PANE           Level 3: 3RD PANE       │
│  (Application Nav)         (Category Selection)         (Feature Detail)        │
│                                                                                 │
│  ┌─────────────────┐      ┌───────────────────┐        ┌─────────────────────┐ │
│  │                 │      │                   │        │                     │ │
│  │  📚 Library     │      │   ⚙️ SETTINGS     │        │   ACCOUNT SETTINGS  │ │
│  │  📊 Dashboard   │      │                   │        │                     │ │
│  │  ⚙️ Settings ───┼──────┤►  👤 Account    ──┼────────┤►  Profile Section   │ │
│  │  🏷️ Sorting     │      │   👥 Users*       │        │   • Display Name    │ │
│  │  ❓ Help        │      │   💳 Billing      │        │   • Email (read)    │ │
│  │                 │      │   🔗 Integrations │        │                     │ │
│  │  (* = filtered) │      │   🤖 AI           │        │   Preferences       │ │
│  │                 │      │   🔒 Admin*       │        │   • Timezone        │ │
│  │                 │      │                   │        │   • Fathom Email    │ │
│  └─────────────────┘      └───────────────────┘        │                     │ │
│                                                        │   Password          │ │
│        ~72/240px              ~280px                   │   • Change Password │ │
│        (collapsible)          (contextual)             │                     │ │
│                                                        └─────────────────────┘ │
│                                                              (flexible)        │
│                                                                                 │
│  * Users: TEAM/ADMIN only                                                       │
│  * Admin: ADMIN only                                                            │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Full Layout with 4th Pane (Help Panel)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    APPLICATION HEADER                                    │
├───────────┬────────────────┬──────────────────────────────────┬─────────────────────────┤
│   72/240  │     280px      │           Flexible               │         300px           │
│ ┌───────┐ │ ┌────────────┐ │ ┌──────────────────────────────┐ │ ┌─────────────────────┐ │
│ │ ☰ Menu│ │ │  SETTINGS  │ │ │         ACCOUNT              │ │ │   ❓ HELP           │ │
│ │ ────  │ │ │            │ │ │                              │ │ │                     │ │
│ │📚 Lib │ │ │  👤 Acct → │ │ │  Profile                     │ │ │  Account Settings   │ │
│ │📊 Dash│ │ │  👥 Users  │ │ │  ┌────────────────────────┐  │ │ │  ───────────────    │ │
│ │⚙ Set │ │ │  💳 Billing│ │ │  │ Display Name           │  │ │ │                     │ │
│ │🏷 Sort│ │ │  🔗 Integ  │ │ │  │ [John Doe        ] ✏️  │  │ │ │  Your display name  │ │
│ │❓ Help│ │ │  🤖 AI     │ │ │  └────────────────────────┘  │ │ │  appears in the app │ │
│ │       │ │ │  🔒 Admin  │ │ │  ┌────────────────────────┐  │ │ │  and notifications. │ │
│ │       │ │ │            │ │ │  │ Email (read-only)      │  │ │ │                     │ │
│ │       │ │ │            │ │ │  │ john@example.com       │  │ │ │  Keyboard Shortcuts │ │
│ │       │ │ │            │ │ │  └────────────────────────┘  │ │ │  ───────────────    │ │
│ │       │ │ │            │ │ │                              │ │ │  ⌘/ - Toggle help   │ │
│ │       │ │ │            │ │ │  Preferences                 │ │ │  Esc - Close pane   │ │
│ └───────┘ │ └────────────┘ │ └──────────────────────────────┘ │ └─────────────────────┘ │
│  SIDEBAR  │   2ND PANE     │          3RD PANE               │       4TH PANE          │
└───────────┴────────────────┴──────────────────────────────────┴─────────────────────────┘
```

---

## 2. Pane Allocation Matrix

### 2.1 Category → Pane Mapping

| Current Tab | 2nd Pane Item | 3rd Pane Content | 4th Pane Help Context | Visibility |
|-------------|---------------|------------------|----------------------|------------|
| ACCOUNT | "Account" | `<AccountTab />` | Account help content | All users |
| USERS | "Users" | `<UsersTab />` | Users help content | TEAM/ADMIN |
| BILLING | "Billing" | `<BillingTab />` | Billing help content | All users |
| INTEGRATIONS | "Integrations" | `<IntegrationsTab />` | Integrations help | All users |
| AI | "AI" | `<AITab />` | AI settings help | All users |
| ADMIN | "Admin" | `<AdminTab />` | Admin help content | ADMIN only |

### 2.2 2nd Pane (Category List) Design

**Component Name:** `SettingsCategoryPane`

**Structure:**
```typescript
interface SettingsCategory {
  id: string;                    // 'account' | 'users' | 'billing' | 'integrations' | 'ai' | 'admin'
  label: string;                 // Display name
  icon: React.ComponentType;     // Remixicon component
  description?: string;          // Optional subtitle
  requiredRole?: UserRole[];     // Role gate (empty = all users)
  badge?: string;                // Optional badge (e.g., "Coming Soon")
}

const SETTINGS_CATEGORIES: SettingsCategory[] = [
  { id: 'account', label: 'Account', icon: RiUserLine, description: 'Profile and preferences' },
  { id: 'users', label: 'Users', icon: RiGroupLine, description: 'Manage organization users', requiredRole: ['TEAM', 'ADMIN'] },
  { id: 'billing', label: 'Billing', icon: RiWalletLine, description: 'Plans and payments' },
  { id: 'integrations', label: 'Integrations', icon: RiPlugLine, description: 'Connected services' },
  { id: 'ai', label: 'AI', icon: RiRobot2Line, description: 'Models and knowledge base' },
  { id: 'admin', label: 'Admin', icon: RiShieldLine, description: 'System administration', requiredRole: ['ADMIN'] },
];
```

**Visual Layout:**
```
┌───────────────────────────┐
│ ⚙️ SETTINGS               │
│ ─────────────────────     │
│                           │
│ ┌─────────────────────┐   │
│ │ 👤  Account         │→  │  ← Selected state (accent border + bg)
│ │     Profile & prefs │   │
│ └─────────────────────┘   │
│                           │
│ ┌─────────────────────┐   │
│ │ 👥  Users           │   │  ← Role-gated (hidden if not TEAM/ADMIN)
│ │     Manage users    │   │
│ └─────────────────────┘   │
│                           │
│ ┌─────────────────────┐   │
│ │ 💳  Billing         │   │
│ │     Plans & payments│   │
│ └─────────────────────┘   │
│                           │
│ ┌─────────────────────┐   │
│ │ 🔗  Integrations    │   │
│ │     Connected svcs  │   │
│ └─────────────────────┘   │
│                           │
│ ┌─────────────────────┐   │
│ │ 🤖  AI              │   │
│ │     Models & KB     │   │
│ └─────────────────────┘   │
│                           │
│ ┌─────────────────────┐   │
│ │ 🔒  Admin           │   │  ← Role-gated (hidden if not ADMIN)
│ │     System admin    │   │
│ └─────────────────────┘   │
│                           │
└───────────────────────────┘
        280px width
```

### 2.3 3rd Pane (Detail View) Design

**Component Name:** `SettingsDetailPane`

**Content Rendering Strategy:**
The 3rd pane renders existing tab components with minimal modification:

```typescript
interface SettingsDetailPaneProps {
  category: string | null;  // Selected category ID
}

const SettingsDetailPane: React.FC<SettingsDetailPaneProps> = ({ category }) => {
  // Render appropriate tab component based on category
  switch (category) {
    case 'account':
      return <AccountTab />;
    case 'users':
      return <UsersTab />;
    case 'billing':
      return <BillingTab />;
    case 'integrations':
      return <IntegrationsTab />;
    case 'ai':
      return <AITab />;
    case 'admin':
      return <AdminTab />;
    default:
      return <SettingsEmptyState />;
  }
};
```

**Empty State:**
```
┌──────────────────────────────────────────────────────┐
│                                                      │
│                                                      │
│                                                      │
│                    ⚙️                                │
│                                                      │
│             Select a category                        │
│                                                      │
│       Choose a settings category from the left      │
│       to view and edit your preferences.            │
│                                                      │
│                                                      │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 2.4 4th Pane (Contextual Help) Design

**Component Name:** Reuse existing `SettingHelpPanel`

**Behavior:**
- Toggleable via help button or `⌘/` keyboard shortcut
- Content changes based on selected 3rd pane category
- Can be closed independently of other panes
- Persists across category changes (stays open if user opened it)

**Help Content Mapping:**
```typescript
const HELP_CONTENT: Record<string, HelpContent> = {
  account: {
    title: 'Account Settings',
    sections: [
      { heading: 'Profile', content: 'Your display name and email...' },
      { heading: 'Preferences', content: 'Timezone and notification settings...' },
      { heading: 'Password', content: 'Update your password securely...' },
    ],
  },
  users: {
    title: 'User Management',
    sections: [
      { heading: 'Roles', content: 'Understanding user roles...' },
      { heading: 'Inviting Users', content: 'How to add team members...' },
    ],
  },
  // ... other categories
};
```

---

## 3. Navigation Flow Diagrams

### 3.1 Primary Navigation Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              SETTINGS PRIMARY NAVIGATION FLOW                            │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│   ┌──────────────┐                                                                      │
│   │   SIDEBAR    │                                                                      │
│   │  ───────────  │                                                                      │
│   │  ⚙️ Settings │                                                                      │
│   └──────┬───────┘                                                                      │
│          │                                                                              │
│          │ Click "Settings"                                                             │
│          │ (1st click)                                                                  │
│          ▼                                                                              │
│   ┌──────────────┐      ┌──────────────────────────────────────────────────────────┐   │
│   │  2ND PANE    │      │  3RD PANE                                                │   │
│   │  ──────────  │      │  ──────────                                              │   │
│   │              │      │                                                          │   │
│   │  👤 Account ─┼──────┤►  Select a category                                      │   │
│   │  👥 Users    │      │  Choose a settings category from the left               │   │
│   │  💳 Billing  │      │  to view and edit your preferences.                     │   │
│   │  🔗 Integr   │      │                                                          │   │
│   │  🤖 AI       │      │  (Empty state - waiting for category selection)          │   │
│   │  🔒 Admin    │      │                                                          │   │
│   │              │      │                                                          │   │
│   └──────┬───────┘      └──────────────────────────────────────────────────────────┘   │
│          │                                                                              │
│          │ Click category (e.g., "Account")                                             │
│          │ (2nd click)                                                                  │
│          ▼                                                                              │
│   ┌──────────────┐      ┌──────────────────────────────────────────────────────────┐   │
│   │  2ND PANE    │      │  3RD PANE                                                │   │
│   │  ──────────  │      │  ──────────                                              │   │
│   │              │      │                                                          │   │
│   │  👤 Account →│      │  ACCOUNT SETTINGS                                        │   │
│   │  👥 Users    │      │  ──────────────────                                      │   │
│   │  💳 Billing  │      │                                                          │   │
│   │  🔗 Integr   │      │  Profile Section                                         │   │
│   │  🤖 AI       │      │  ┌────────────────────────────────────────────────┐      │   │
│   │  🔒 Admin    │      │  │ Display Name: [John Doe           ] [✏️ Edit]  │      │   │
│   │              │      │  │ Email: john@example.com (read-only)            │      │   │
│   │              │      │  └────────────────────────────────────────────────┘      │   │
│   └──────────────┘      │                                                          │   │
│                         │  Preferences Section                                     │   │
│   ✅ COMPLETE           │  ┌────────────────────────────────────────────────┐      │   │
│   (2 clicks total)      │  │ Timezone: [Pacific Time (US)      ▼] [✏️ Edit] │      │   │
│                         │  └────────────────────────────────────────────────┘      │   │
│                         │                                                          │   │
│                         └──────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Deep Link Navigation Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              SETTINGS DEEP LINK NAVIGATION                               │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│   URL: /settings/billing                                                                │
│                                                                                         │
│         ┌─────────────────────────────────────────────────────────────────────┐         │
│         │  On page load:                                                       │         │
│         │  1. Parse URL path segment: "billing"                                │         │
│         │  2. Open 2nd pane with settings categories                           │         │
│         │  3. Set active category to "billing"                                 │         │
│         │  4. Open 3rd pane with BillingTab content                            │         │
│         └─────────────────────────────────────────────────────────────────────┘         │
│                                                                                         │
│         ┌─────────────────────────────────────────────────────────────────────┐         │
│         │  Result:                                                             │         │
│         │                                                                      │         │
│         │  ┌──────────┐  ┌─────────────┐  ┌────────────────────────────────┐   │         │
│         │  │ SIDEBAR  │  │  2ND PANE   │  │  3RD PANE                      │   │         │
│         │  │          │  │             │  │                                │   │         │
│         │  │ ⚙ Set →  │  │ 👤 Account  │  │  BILLING                       │   │         │
│         │  │          │  │ 👥 Users    │  │  ────────                      │   │         │
│         │  │          │  │ 💳 Billing →│  │                                │   │         │
│         │  │          │  │ 🔗 Integr   │  │  Current Plan: Free            │   │         │
│         │  │          │  │ 🤖 AI       │  │  ┌──────────────────────────┐  │   │         │
│         │  │          │  │ 🔒 Admin    │  │  │ PRO Plan - Coming Soon  │  │   │         │
│         │  │          │  │             │  │  │ • Feature 1             │  │   │         │
│         │  │          │  │             │  │  │ • Feature 2             │  │   │         │
│         │  │          │  │             │  │  └──────────────────────────┘  │   │         │
│         │  └──────────┘  └─────────────┘  └────────────────────────────────┘   │         │
│         │                                                                      │         │
│         │  ✅ 0 clicks required - direct to content                            │         │
│         └─────────────────────────────────────────────────────────────────────┘         │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Category Switching Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              CATEGORY SWITCHING FLOW                                     │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│   Current State: Viewing Account settings                                               │
│                                                                                         │
│   ┌─────────────┐  ┌────────────────────────────────────────────────────────────────┐   │
│   │  2ND PANE   │  │  3RD PANE                                                      │   │
│   │             │  │                                                                │   │
│   │ 👤 Account →│  │  ACCOUNT SETTINGS                                              │   │
│   │ 👥 Users    │  │  ──────────────────                                            │   │
│   │ 💳 Billing  │  │  [Account content...]                                          │   │
│   │ 🔗 Integr   │  │                                                                │   │
│   │ 🤖 AI       │  │                                                                │   │
│   │ 🔒 Admin    │  │                                                                │   │
│   └──────┬──────┘  └────────────────────────────────────────────────────────────────┘   │
│          │                                                                              │
│          │ Click "AI" in 2nd pane                                                       │
│          │ (1 click to switch)                                                          │
│          ▼                                                                              │
│   ┌─────────────┐  ┌────────────────────────────────────────────────────────────────┐   │
│   │  2ND PANE   │  │  3RD PANE                                                      │   │
│   │             │  │                                                                │   │
│   │ 👤 Account  │  │  AI SETTINGS                                                   │   │
│   │ 👥 Users    │  │  ───────────                                                   │   │
│   │ 💳 Billing  │  │                                                                │   │
│   │ 🔗 Integr   │  │  AI Model Configuration                                        │   │
│   │ 🤖 AI     → │  │  ┌──────────────────────────────────────────────────────────┐  │   │
│   │ 🔒 Admin    │  │  │ Model: [Claude 3.5 Sonnet                    ▼]          │  │   │
│   │             │  │  │ Provider: Anthropic                                      │  │   │
│   │             │  │  └──────────────────────────────────────────────────────────┘  │   │
│   └─────────────┘  │                                                                │   │
│                    │  Knowledge Base Indexing                                       │   │
│   Transitions:     │  ┌──────────────────────────────────────────────────────────┐  │   │
│   • 2nd pane:      │  │ [Index Transcripts]  [Cancel]                            │  │   │
│     active item    │  └──────────────────────────────────────────────────────────┘  │   │
│     changes        │                                                                │   │
│   • 3rd pane:      └────────────────────────────────────────────────────────────────┘   │
│     content swap                                                                        │
│     (instant)                                                                           │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Click Count Analysis

### 4.1 Workflow Comparison

| Workflow | Old (Tabs) | New (Panes) | Reduction | Notes |
|----------|------------|-------------|-----------|-------|
| Open Settings page | 1 click | 1 click | 0% | Same (sidebar click) |
| Navigate to specific category | 2 clicks (page + tab) | 2 clicks (sidebar + category) | 0% | Equal, but better discoverability |
| Change a setting value | 4 clicks (page + tab + edit + save) | 3 clicks (sidebar + cat + edit/save) | 25% | 3rd pane visible immediately |
| Switch between categories | 1 click (tab) | 1 click (category) | 0% | Equal efficiency |
| Access with deep link | 0 clicks | 0 clicks | N/A | Both support deep links |
| View help for current section | 1 click (toggle help) | 1 click (toggle help) | 0% | Same (4th pane) |

### 4.2 Common Workflow Click Analysis

**Workflow 1: Edit Display Name**
```
Old Flow (Tabs):
1. Click "Settings" in sidebar → Settings page loads
2. Already on Account tab (default) → No click
3. Click "Edit" button on Display Name → Edit mode
4. Type new name → N/A (not a click)
5. Click "Save" → Saved
Total: 3 clicks

New Flow (Panes):
1. Click "Settings" in sidebar → 2nd pane opens
2. Click "Account" in 2nd pane → 3rd pane shows Account
3. Click "Edit" button on Display Name → Edit mode
4. Type new name → N/A
5. Click "Save" → Saved
Total: 4 clicks

Note: Slight increase for default category, but...
```

**Workflow 1 (Optimized): Default Category on Open**
```
If we auto-open Account (or last-visited category) when Settings clicked:

New Flow (Optimized):
1. Click "Settings" in sidebar → 2nd pane + 3rd pane (Account) open
2. Click "Edit" button → Edit mode
3. Type new name → N/A
4. Click "Save" → Saved
Total: 3 clicks (matches old)
```

**Workflow 2: Change AI Model**
```
Old Flow (Tabs):
1. Click "Settings" in sidebar → Settings page
2. Click "AI" tab → AI settings visible
3. Click dropdown → Dropdown opens
4. Click model → Model selected (auto-saves)
Total: 4 clicks

New Flow (Panes):
1. Click "Settings" in sidebar → 2nd pane opens with AI pre-selected
2. Already at AI (remembered from last visit)
3. Click dropdown → Dropdown opens
4. Click model → Model selected
Total: 3 clicks (with state persistence)
```

**Workflow 3: Access Admin Panel (ADMIN user)**
```
Old Flow (Tabs):
1. Click "Settings" in sidebar → Settings page
2. Click "Admin" tab → Admin settings visible
Total: 2 clicks

New Flow (Panes):
1. Click "Settings" in sidebar → 2nd pane opens
2. Click "Admin" in 2nd pane → 3rd pane shows Admin
Total: 2 clicks (equal)
```

### 4.3 Click Reduction Summary

| Scenario | Tab-Based | Pane-Based | Improvement |
|----------|-----------|------------|-------------|
| First-time access to non-default tab | 2 | 2 | 0% |
| Subsequent access (state remembered) | 2 | 1* | 50% |
| Switch between settings categories | 1 | 1 | 0% |
| Deep link access | 0 | 0 | 0% |
| Multi-step workflow (edit + save) | 4-5 | 3-4 | 20-25% |

*With category state persistence

**Overall Target:** ≥20% click reduction across top workflows ✅

---

## 5. State Management Design

### 5.1 Panel Store Extensions

```typescript
// Extend panelStore.ts with new panel types
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
  // New settings pane types:
  | 'settings-category'  // 2nd pane - category list
  | 'settings-detail'    // 3rd pane - category content
  | null;

// Settings-specific state
interface SettingsPaneState {
  // 2nd pane visibility
  isCategoryPaneOpen: boolean;

  // 3rd pane state
  selectedCategory: SettingsCategory | null;

  // Remember last category for return visits
  lastVisitedCategory: SettingsCategory | null;
}
```

### 5.2 URL Synchronization

```typescript
// Route structure
const SETTINGS_ROUTES = {
  base: '/settings',
  patterns: [
    '/settings',           // Opens with last-visited or default (Account)
    '/settings/:category', // Opens with specific category
  ],
};

// URL → State mapping
const urlToState = (pathname: string) => {
  const match = pathname.match(/^\/settings\/(\w+)$/);
  if (match) {
    const categoryId = match[1];
    return { selectedCategory: categoryId };
  }
  return { selectedCategory: null }; // Use default
};

// State → URL sync
const syncUrlFromState = (category: string | null) => {
  if (category) {
    navigate(`/settings/${category}`, { replace: true });
  } else {
    navigate('/settings', { replace: true });
  }
};
```

### 5.3 Category State Persistence

```typescript
// Store last-visited category in localStorage or Zustand persist
const useSettingsCategoryPersistence = () => {
  const STORAGE_KEY = 'settings-last-category';

  const getLastCategory = (): string => {
    return localStorage.getItem(STORAGE_KEY) || 'account';
  };

  const setLastCategory = (category: string) => {
    localStorage.setItem(STORAGE_KEY, category);
  };

  return { getLastCategory, setLastCategory };
};
```

---

## 6. Role-Based Visibility

### 6.1 Category Visibility Matrix

| Category | USER | TEAM | ADMIN |
|----------|------|------|-------|
| Account | ✅ | ✅ | ✅ |
| Users | ❌ | ✅ | ✅ |
| Billing | ✅ | ✅ | ✅ |
| Integrations | ✅ | ✅ | ✅ |
| AI | ✅ | ✅ | ✅ |
| Admin | ❌ | ❌ | ✅ |

### 6.2 Implementation Pattern

```typescript
const SettingsCategoryPane: React.FC = () => {
  const { userRole } = useUserRole();

  const visibleCategories = SETTINGS_CATEGORIES.filter(category => {
    // No role requirement = visible to all
    if (!category.requiredRole || category.requiredRole.length === 0) {
      return true;
    }
    // Check if user has required role
    return category.requiredRole.includes(userRole);
  });

  return (
    <div className="settings-category-pane">
      {visibleCategories.map(category => (
        <CategoryItem key={category.id} {...category} />
      ))}
    </div>
  );
};
```

### 6.3 Deep Link Role Protection

```typescript
// Handle deep links to restricted categories
const SettingsPage: React.FC = () => {
  const { category: urlCategory } = useParams();
  const { userRole } = useUserRole();

  useEffect(() => {
    // If URL contains restricted category, redirect to accessible category
    const targetCategory = SETTINGS_CATEGORIES.find(c => c.id === urlCategory);

    if (targetCategory?.requiredRole && !targetCategory.requiredRole.includes(userRole)) {
      // Redirect to default accessible category
      navigate('/settings/account', { replace: true });
      toast.error('You do not have permission to access that section');
    }
  }, [urlCategory, userRole]);

  // ... rest of component
};
```

---

## 7. Animation and Transition Specifications

### 7.1 Pane Transitions

Following Microsoft Loop patterns from research document:

| Transition | Duration | Easing | Description |
|------------|----------|--------|-------------|
| 2nd pane open | 300ms | ease-in-out | Slides in from left |
| 2nd pane close | 300ms | ease-in-out | Slides out to left |
| 3rd pane content swap | Instant | N/A | Content changes immediately |
| Category highlight | 100ms | ease | Background color change |
| 4th pane toggle | 300ms | ease-in-out | Slides from right |

### 7.2 Tailwind CSS Classes

```css
/* 2nd Pane animation */
.settings-category-pane {
  @apply transition-all duration-300 ease-in-out;
}

.settings-category-pane.open {
  @apply w-[280px] opacity-100;
}

.settings-category-pane.closed {
  @apply w-0 opacity-0 -ml-3 border-0 overflow-hidden;
}

/* Category item hover/active states */
.category-item {
  @apply px-3 py-2 rounded-md cursor-pointer
         border-l-3 border-transparent
         transition-colors duration-100 ease;
}

.category-item:hover {
  @apply bg-muted/50;
}

.category-item.active {
  @apply bg-muted border-l-primary font-medium;
}
```

---

## 8. Keyboard Navigation

### 8.1 Keyboard Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `↓` / `↑` | Navigate categories | 2nd pane focused |
| `Enter` | Select category | 2nd pane focused |
| `Escape` | Close 3rd pane | 3rd pane focused |
| `Escape` (again) | Close 2nd pane | 2nd pane focused |
| `⌘/` or `Ctrl+/` | Toggle help panel | Anywhere in settings |
| `Tab` | Move focus forward | Standard |
| `Shift+Tab` | Move focus backward | Standard |

### 8.2 Focus Management

```typescript
// Focus order: Sidebar → 2nd Pane → 3rd Pane → 4th Pane
const usePaneFocusManagement = () => {
  const categoryPaneRef = useRef<HTMLDivElement>(null);
  const detailPaneRef = useRef<HTMLDivElement>(null);

  // When 2nd pane opens, focus first category
  useEffect(() => {
    if (isCategoryPaneOpen && categoryPaneRef.current) {
      const firstCategory = categoryPaneRef.current.querySelector('[role="button"]');
      (firstCategory as HTMLElement)?.focus();
    }
  }, [isCategoryPaneOpen]);

  // When category selected, focus 3rd pane content
  useEffect(() => {
    if (selectedCategory && detailPaneRef.current) {
      detailPaneRef.current.focus();
    }
  }, [selectedCategory]);

  return { categoryPaneRef, detailPaneRef };
};
```

---

## 9. Responsive Behavior

### 9.1 Breakpoint Strategy

| Breakpoint | Sidebar | 2nd Pane | 3rd Pane | 4th Pane |
|------------|---------|----------|----------|----------|
| Desktop (≥1280px) | 240px expanded | 280px side-by-side | Flexible | 300px optional |
| Laptop (1024-1279px) | 72px collapsed | 280px side-by-side | Flexible | Hidden/overlay |
| Tablet (768-1023px) | 72px collapsed | Full-width overlay | Full-width stacked | Hidden |
| Mobile (<768px) | Hidden (hamburger) | Full-width | Full-width stacked | Hidden |

### 9.2 Mobile Navigation Pattern

```
Mobile: Single-pane with back navigation

┌──────────────────────────┐      ┌──────────────────────────┐
│ ☰  SETTINGS              │      │ ← Settings    ACCOUNT    │
├──────────────────────────┤      ├──────────────────────────┤
│                          │      │                          │
│ ┌──────────────────────┐ │      │  Profile                 │
│ │ 👤 Account          →│ │  →   │  ┌──────────────────────┐│
│ └──────────────────────┘ │      │  │ Display Name         ││
│ ┌──────────────────────┐ │      │  │ [John Doe      ] ✏️  ││
│ │ 💳 Billing          →│ │      │  └──────────────────────┘│
│ └──────────────────────┘ │      │                          │
│ ┌──────────────────────┐ │      │  Email: john@example.com │
│ │ 🔗 Integrations     →│ │      │                          │
│ └──────────────────────┘ │      │  Preferences             │
│ ┌──────────────────────┐ │      │  ...                     │
│ │ 🤖 AI               →│ │      │                          │
│ └──────────────────────┘ │      │                          │
│                          │      │                          │
└──────────────────────────┘      └──────────────────────────┘
    Category List View                  Detail View
    (tap category to open)              (back to return)
```

---

## 10. Implementation Checklist

### 10.1 Component Creation

- [ ] Create `src/components/panes/SettingsCategoryPane.tsx`
  - Category list with icons and descriptions
  - Role-based filtering
  - Active state highlighting
  - Click handlers to open 3rd pane

- [ ] Create `src/components/panes/SettingsDetailPane.tsx`
  - Switch statement to render correct tab component
  - Empty state for no selection
  - Header with category name

- [ ] Create `src/components/settings/SettingsEmptyState.tsx`
  - Placeholder when no category selected

### 10.2 State Management

- [ ] Extend `panelStore.ts` with settings pane types
- [ ] Add `selectedSettingsCategory` state
- [ ] Add `lastVisitedSettingsCategory` persistence
- [ ] Implement URL synchronization

### 10.3 Integration

- [ ] Modify `Settings.tsx` to use pane layout
- [ ] Wire sidebar "Settings" click to open 2nd pane
- [ ] Implement deep link handling
- [ ] Add keyboard navigation

### 10.4 Polish

- [ ] Add pane transition animations
- [ ] Implement responsive breakpoints
- [ ] Test all role-based visibility
- [ ] Verify click-count improvements

---

## 11. Risk Mitigation

### 11.1 Potential Issues

| Risk | Mitigation |
|------|------------|
| Tab components have layout assumptions | Review each tab component for width/height dependencies |
| Deep links to restricted categories | Add role check before rendering, redirect if unauthorized |
| State sync with URL may cause flicker | Use React Router's `replace` mode, debounce updates |
| Mobile users lose context with full-width panes | Implement breadcrumb header with back navigation |

### 11.2 Fallback Strategy

If pane-based navigation encounters major issues:
1. Keep tab components intact during migration (dual-mode)
2. Test thoroughly before removing tabs
3. Feature flag to enable/disable new navigation
4. Rollback plan: revert to tab-based in single commit

---

## Appendix A: Category Detail Diagrams

### A.1 Account Category (3rd Pane)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 👤 ACCOUNT                                                     [?] Help  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Profile                                                                 │
│  ───────────────────────────────────────────────────────────────────    │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Display Name                                                        │ │
│  │ [John Doe                                           ] [✏️ Edit]     │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │ Email                                                               │ │
│  │ john.doe@example.com                                  (read-only)   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Preferences                                                             │
│  ───────────────────────────────────────────────────────────────────    │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Timezone                                                            │ │
│  │ [Pacific Time (US & Canada)              ▼] [✏️ Edit]               │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │ Fathom Email                                                        │ │
│  │ [john.fathom@example.com                    ] [✏️ Edit]             │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Password                                                                │
│  ───────────────────────────────────────────────────────────────────    │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                     [🔑 Change Password]                            │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### A.2 Integrations Category (3rd Pane)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 🔗 INTEGRATIONS                                                [?] Help  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Fathom Integration                                                      │
│  ───────────────────────────────────────────────────────────────────    │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 🎙️ Fathom                                          ● Connected     │ │
│  │                                                                     │ │
│  │ Meeting recordings and transcription service                        │ │
│  │                                                                     │ │
│  │ [Manage Connection ▼]  [Reconnect OAuth]                            │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  AI Knowledge Base                                                       │
│  ───────────────────────────────────────────────────────────────────    │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │ │
│  │ │ Total Calls │  │   Indexed   │  │   Chunks    │                  │ │
│  │ │     142     │  │     138     │  │    2,847    │                  │ │
│  │ └─────────────┘  └─────────────┘  └─────────────┘                  │ │
│  │                                                                     │ │
│  │ [Index Unprocessed Transcripts]  [🔄 Refresh Stats]                │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  More Integrations                                                       │
│  ───────────────────────────────────────────────────────────────────    │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 📹 Zoom                                           Coming Soon       │ │
│  │ 📊 GoHighLevel                                    Coming Soon       │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

*Document created as part of subtask-1-4: Design pane allocation strategy for Settings page*
*Reference: UX Research & Navigation Design Phase*
