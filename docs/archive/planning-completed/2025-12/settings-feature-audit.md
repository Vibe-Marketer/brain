# Settings Page Feature Audit

> **Created:** Subtask 1-2 - UX Research & Navigation Design
> **Purpose:** Document all current Settings page features with click-count analysis

---

## Overview

The Settings page uses a tabbed navigation pattern with 6 distinct tabs. Tab visibility is role-gated:
- **All Users:** Account, Billing, Integrations, AI
- **TEAM/ADMIN Only:** Users
- **ADMIN Only:** Admin

### Navigation Structure
```
Settings Page
├── Tab Bar (horizontal)
│   ├── ACCOUNT
│   ├── USERS (TEAM/ADMIN)
│   ├── BILLING
│   ├── INTEGRATIONS
│   ├── AI
│   └── ADMIN (ADMIN only)
├── Help Panel (right side, toggleable)
└── Navigation Rail (left sidebar, collapsible)
```

---

## Tab 1: ACCOUNT

**File:** `src/components/settings/AccountTab.tsx`
**Visibility:** All users

### Features

| Feature | Section | Description | Click Count to Complete |
|---------|---------|-------------|------------------------|
| Edit Display Name | Profile | Update user's display name | 3 clicks (Edit → Type → Save) |
| View Email | Profile | Read-only email display | 0 clicks (view only) |
| Edit Timezone | Preferences | Select timezone from dropdown | 3 clicks (Edit → Select → Save) |
| Edit Fathom Email | Preferences | Update Fathom-associated email | 3 clicks (Edit → Type → Save) |
| Change Password | Password | Update account password | 4 clicks (Change Password → Type New → Type Confirm → Update) |

### UI Pattern Analysis
- Uses inline edit pattern with Edit/Save/Cancel icon buttons
- Form fields grouped by logical sections (Profile, Preferences, Password)
- Grid layout: 3-column on large screens (1 for label, 2 for content)
- Password form expands on demand, collapses after completion/cancel

### Current Issues/Observations
- Timezone save is placeholder (comment notes "future implementation")
- Password visibility toggle only on new password field
- No validation feedback until save attempt

---

## Tab 2: USERS

**File:** `src/components/settings/UsersTab.tsx`
**Visibility:** TEAM and ADMIN roles only

### Features

| Feature | Section | Description | Click Count to Complete |
|---------|---------|-------------|------------------------|
| View Organization Users | Organization Users | Table showing all org users | 0 clicks (view only) |
| Change User Role | Organization Users | Dropdown to update user role (ADMIN only) | 2 clicks (Select → Choose role) |
| View Role Descriptions | User Management | Information about each role type | 0 clicks (view only) |

### UI Pattern Analysis
- Uses `UserTable` component for user list display
- Role badges with color variants (outline, default, destructive)
- Empty state with icon and message
- Role change triggers immediate save (no confirm dialog)

### Current Issues/Observations
- "Manage User" action shows "coming soon" toast
- Last login tracking noted as TODO
- No pagination for large user lists
- No bulk actions available

---

## Tab 3: BILLING

**File:** `src/components/settings/BillingTab.tsx`
**Visibility:** All users

### Features

| Feature | Section | Description | Click Count to Complete |
|---------|---------|-------------|------------------------|
| View Current Plan | Current Plan | Display current subscription status | 0 clicks (view only) |
| View PRO Features | PRO Plan | Preview of upcoming PRO features | 0 clicks (view only) |

### UI Pattern Analysis
- Minimal interactivity (display-only)
- Card-based layout with icons
- "Coming Soon" badge for PRO plan
- Feature list uses bullet points

### Current Issues/Observations
- No actual billing management functionality
- No payment method management
- No upgrade/downgrade CTA buttons
- Purely informational at this stage

---

## Tab 4: INTEGRATIONS

**File:** `src/components/settings/IntegrationsTab.tsx`
**Visibility:** All users

### Features

| Feature | Section | Description | Click Count to Complete |
|---------|---------|-------------|------------------------|
| Connect Fathom | Fathom Integration | Initial Fathom connection wizard | 1 click (Connect button opens wizard) |
| View Connection Status | Fathom Integration | Status card showing connected/disconnected | 0 clicks (view only) |
| Edit API Credentials | Manage Fathom Connection | Update API key and webhook secret | 4 clicks (Edit → Type API Key → Type Webhook → Save) |
| OAuth Reconnect | Manage Fathom Connection | Re-authenticate via OAuth | 1 click (redirects to OAuth) |
| View KB Stats | AI Knowledge Base | Total calls, indexed, chunks counts | 0 clicks (view only) |
| Index Transcripts | AI Knowledge Base | Embed unindexed transcripts | 1 click (Index button) |
| Refresh KB Status | AI Knowledge Base | Reload knowledge base statistics | 1 click (Refresh button) |
| View Coming Soon | More Integrations | Zoom, GoHighLevel placeholders | 0 clicks (view only) |

### UI Pattern Analysis
- `IntegrationStatusCard` component for consistent integration display
- Conditional sections (credentials only shown when connected)
- Progress bar during embedding process
- Stats displayed in 3-column grid with semantic labels

### Current Issues/Observations
- Wizard modal appears twice in code (duplicate FathomSetupWizard render)
- Zoom and GoHighLevel show "coming soon" status
- No disconnect/remove integration option visible
- Webhook secret uses password input with toggle visibility

---

## Tab 5: AI

**File:** `src/components/settings/AITab.tsx`
**Visibility:** All users (Admin section only for ADMIN)

### Features

| Feature | Section | Description | Click Count to Complete |
|---------|---------|-------------|------------------------|
| Select AI Model | AI Model Configuration | Choose default chat model from dropdown | 2 clicks (Select → Choose model) |
| View Model Details | AI Model Configuration | See provider, pricing, context length | 0 clicks (view only) |
| Index All Transcripts | Knowledge Base Indexing | Trigger bulk transcript indexing | 1 click (Index button) |
| Cancel Indexing | Knowledge Base Indexing | Stop active indexing job | 1 click (Cancel button) |
| View Indexing Progress | Knowledge Base Indexing | Progress bar and stats during indexing | 0 clicks (view only) |
| Manage System Models | Admin Model Manager | ADMIN only - configure available models | Variable (admin component) |

### UI Pattern Analysis
- Model selector grouped by provider (OpenAI, Anthropic, Google)
- Cards with accent bar design for visual hierarchy
- Progress bar with percentage and chunk counts
- Model auto-saves on selection (no explicit save button)

### Current Issues/Observations
- Legacy model preset mapping for backward compatibility
- Model validation in useEffect to reset invalid selections
- AdminModelManager component embedded conditionally
- "How it works" explanation text at bottom of indexing section

---

## Tab 6: ADMIN

**File:** `src/components/settings/AdminTab.tsx`
**Visibility:** ADMIN role only

### Features

| Feature | Section | Description | Click Count to Complete |
|---------|---------|-------------|------------------------|
| View System Stats | System Overview | Total, active, role-based user counts | 0 clicks (view only) |
| Search Users | User Management | Filter users by name, email, or ID | 1 click + typing |
| Filter by Role | User Management | Dropdown to filter users by role | 2 clicks (Select → Choose role) |
| Change User Role | User Management | Update any user's role | 2 clicks (Select → Choose role) |
| View User Count | User Management | Shows filtered/total counts | 0 clicks (view only) |

### UI Pattern Analysis
- 7-column stat cards grid (responsive to 2-4 columns on smaller screens)
- Each stat card has accent bar, icon, label, and large number
- Search with icon prefix in input field
- UserTable component with role-change dropdown
- Real-time filter updates (no apply button)

### Current Issues/Observations
- "Advanced user management" shows "coming soon" toast
- last_login_at is always null (TODO noted)
- No export/download user list functionality
- No user detail view or edit modal
- No delete user capability

---

## Cross-Tab Features

### Help Panel
- Right side panel (desktop) or bottom sheet (mobile)
- Contextual help based on current tab
- Toggle via `?` button in header or `Cmd+/` keyboard shortcut
- Close via `Escape` key

### Navigation Rail
- Collapsible sidebar (tablet: auto-collapsed, desktop: expanded)
- Mobile: hamburger menu opens overlay
- Persists across tab changes

### Responsive Behavior
- Mobile: Navigation as overlay, help panel as bottom sheet
- Tablet: Collapsed sidebar, narrower help panel (320px)
- Desktop: Expandable sidebar (240px), full help panel (360px)

---

## Click Count Summary by Tab

| Tab | Total Interactive Features | Avg Clicks per Feature |
|-----|---------------------------|----------------------|
| Account | 5 | 2.6 |
| Users | 3 | 0.7 |
| Billing | 2 | 0 |
| Integrations | 8 | 1.0 |
| AI | 6 | 0.7 |
| Admin | 5 | 0.8 |

**Total Unique Features:** 29
**Features Requiring No Clicks (View Only):** 12
**Features Requiring 1+ Clicks (Interactive):** 17

---

## UX Improvement Opportunities

### High Priority
1. **Inline Edit Pattern Inconsistency** - Account tab uses edit mode toggle, AI tab uses auto-save
2. **Missing Confirmation Dialogs** - Role changes apply immediately without confirmation
3. **No Undo Capability** - Changes are immediate with no undo option
4. **Placeholder Features** - Multiple "coming soon" items could be hidden instead

### Medium Priority
1. **Pagination Missing** - User tables lack pagination for scalability
2. **Bulk Actions Missing** - No way to select and act on multiple users
3. **Empty State Improvements** - Some empty states lack actionable guidance
4. **Search/Filter UX** - No clear/reset filters button

### Low Priority
1. **Keyboard Navigation** - Limited beyond help panel shortcuts
2. **Form Validation** - Validation only on submit, not real-time
3. **Loading States** - Inconsistent loading indicator placement

---

## Technical Patterns Identified

### State Management
- Local component state with useState/useEffect
- Supabase for data persistence
- Panel state via `usePanelStore` (Zustand)

### Auth & Permissions
- `useUserRole` hook for role checks
- `getSafeUser` utility for authenticated user
- Role-based conditional rendering

### UI Components
- Shadcn/ui component library
- Remixicon for icons
- Sonner for toast notifications
- Custom separator styling patterns

### Layout Patterns
- 3-column grid (1 label + 2 content)
- Card sections with accent bars
- Responsive breakpoint hooks

---

*Document generated as part of UX Research & Navigation Design phase*
