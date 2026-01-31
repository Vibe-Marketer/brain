---
phase: 09
plan: 08
title: Bank Switcher UI in Header
subsystem: frontend-ui
tags: [react, dropdown, bank-context, vault-context, header]
completed: 2026-01-31

dependency-graph:
  requires: ["09-07"]
  provides: ["bank-switcher-component", "header-bank-context"]
  affects: ["09-09", "09-10"]

tech-stack:
  added: []
  patterns: ["dropdown-menu-component", "context-consumer-pattern"]

key-files:
  created:
    - src/components/header/BankSwitcher.tsx
  modified:
    - src/components/ui/top-bar.tsx

decisions: []

metrics:
  duration: "~2 minutes"
  commits: 2
---

# Phase 09 Plan 08: Bank Switcher UI in Header Summary

**One-liner:** BankSwitcher dropdown in header replaces TeamSwitcher, showing bank/vault context with role badges and vault selection.

## What Was Built

### BankSwitcher Component (`src/components/header/BankSwitcher.tsx`)

A dropdown component following the existing TeamSwitcher pattern that enables users to:

1. **Switch between banks** - Personal and business banks listed with role badges (owner/admin/member)
2. **Switch between vaults** - Vaults within the active bank shown in a separate section
3. **See current context** - Button shows current bank + vault with appropriate icons
4. **Create new banks** - "Create Business Bank" CTA with Pro badge for upsell

**Key Features:**
- Personal bank icon: `RiUserLine` 
- Business bank icon: `RiBuildingLine` (with vibe-orange color when active)
- Vault type icons: personal, team, coach, community, client each have appropriate icon
- Loading state shows skeleton placeholder
- "All Recordings" option to clear vault filter
- "Manage Banks" link for settings navigation

### TopBar Integration (`src/components/ui/top-bar.tsx`)

- Replaced `TeamSwitcher` import with `BankSwitcher`
- Bank/vault context now visible in top header bar
- Seamless integration with existing header utilities (search, notifications, theme, user menu)

## Technical Implementation

### Pattern Alignment

The component follows established patterns:
- **Icons:** Uses Remix Icons (`@remixicon/react`) per frontend guidelines
- **Dropdown:** Uses existing DropdownMenu components from `@/components/ui/dropdown-menu`
- **Context:** Consumes `useBankContext` hook from 09-07
- **Styling:** Uses `cn()` utility for conditional classes, follows brand guidelines

### Component Structure

```
BankSwitcher (main component)
├── Loading skeleton (if isLoading)
├── Trigger button (shows current bank + vault)
├── DropdownMenuContent
│   ├── Banks section (DropdownMenuLabel + BankMenuItems)
│   ├── Vaults section (if vaults exist in active bank)
│   │   ├── "All Recordings" option
│   │   └── VaultMenuItems
│   └── Actions section
│       ├── "Create Business Bank" (if personal bank active)
│       └── "Manage Banks"
└── BankMenuItem / VaultMenuItem (subcomponents)
```

## Commits

| Hash | Message |
|------|---------|
| 7fd3d5e | feat(09-08): create BankSwitcher component |
| dabb643 | feat(09-08): integrate BankSwitcher into TopBar |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- [x] `npm run build` passes
- [x] BankSwitcher component compiles without TypeScript errors
- [x] Imports resolve correctly (useBankContext, types, UI components)
- [x] Component integrated into TopBar in correct position

## Next Phase Readiness

**Ready for 09-09: Recording Queries Update**

The bank switcher UI is complete. The next steps involve:
1. Updating recording queries to use bank/vault context
2. Integrating vault filtering into the search pipeline
3. Updating the Library/Calls views to respect active context

**Dependencies satisfied:**
- Bank context hook working (09-07)
- Bank switcher visible in header (09-08)
- Database tables with RLS ready (09-02 through 09-04)
