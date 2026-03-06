---
phase: 09-bank-vault-architecture
plan: 09
subsystem: settings
tags: [banks, vaults, settings, team-collaboration, folder-visibility]

dependency-graph:
  requires:
    - 09-07  # useBankContext hook
    - 09-08  # Bank Switcher UI pattern
  provides:
    - Banks settings tab for vault management
    - VaultManagement component with vault CRUD
    - Default folder creation with visibility hierarchy
  affects:
    - 09-10  # May need vault-scoped queries

tech-stack:
  added: []
  patterns:
    - "db = supabase as any for ungenerated types"
    - "Tabs pattern for multi-bank UI"
    - "TEAM-07 folder visibility hierarchy"

file-tracking:
  key-files:
    created:
      - src/components/settings/VaultManagement.tsx
      - src/components/settings/BanksTab.tsx
    modified:
      - src/components/panes/SettingsCategoryPane.tsx
      - src/components/panes/SettingsDetailPane.tsx

decisions:
  - id: vault-default-folders
    choice: "Create Hall of Fame (all_members) and Manager Reviews (managers_only) folders on team vault creation"
    why: "TEAM-07 requires hierarchical sharing - default folders demonstrate visibility levels"
  - id: any-cast-pattern
    choice: "Use db = supabase as any for bank/vault table queries"
    why: "TypeScript types not regenerated yet for new tables, follows existing codebase pattern"
  - id: team-vault-only
    choice: "Enable only team vaults initially, coach/client disabled with 'Coming Soon'"
    why: "Focus on core team collaboration, defer coach/client vault types to later phases"

metrics:
  duration: ~30min
  completed: 2026-01-31
---

# Phase 09 Plan 09: Banks Settings Tab Summary

Banks management tab created in settings for vault creation and member management.

## One-Liner

Banks & Vaults settings tab with VaultManagement component supporting team vault creation with TEAM-07 default folder visibility hierarchy.

## What Was Built

### Task 1: VaultManagement Component
Created `src/components/settings/VaultManagement.tsx`:
- Lists vaults in a bank with member counts
- Create vault dialog with name and type selection
- Team vault type enabled; coach/client show "Coming Soon"
- Creates default folders for team vaults:
  - "Hall of Fame" with `all_members` visibility
  - "Manager Reviews" with `managers_only` visibility
- Uses `db = supabase as any` pattern for ungenerated TypeScript types
- Admin/owner-only vault creation controls

### Task 2: BanksTab and Settings Integration
Created `src/components/settings/BanksTab.tsx`:
- Displays all user's banks as tabs
- Shows bank type badges (personal/business)
- Shows user role badges (owner/admin/member)
- Integrates VaultManagement for each bank
- Business banks show cross-bank default setting

Updated Settings panes:
- Added `banks` category to `SettingsCategoryPane.tsx`
- Added `RiBankLine` icon from Remix Icon
- Added CATEGORY_META entry in `SettingsDetailPane.tsx`
- Added lazy import for BanksTab
- Added banks case to renderContent switch

## Commits

| Commit | Description |
|--------|-------------|
| e0d23e9 | feat(09-09): create VaultManagement component |
| 09e5455 | feat(09-09): add banks settings tab to settings panes |

## Technical Decisions

### 1. TEAM-07 Folder Visibility Implementation
Default folders created for team vaults implement the hierarchical sharing model:
- `all_members`: Everyone in vault sees content (Hall of Fame)
- `managers_only`: Only managers and above see content (Manager Reviews)
- `owner_only`: Available for users to create private folders

### 2. TypeScript Type Handling
Used `db = supabase as any` pattern because:
- New bank/vault tables (vaults, vault_memberships, banks, bank_memberships) exist in database
- TypeScript types not regenerated from Supabase schema
- Pattern consistent with existing useBankContext implementation
- TODO: Regenerate types when schema stabilizes

### 3. Vault Type Restrictions
Only `team` vault type enabled initially:
- Coach and client vaults show "(Coming Soon)" in dropdown
- Focuses phase on core team collaboration
- Defers complex vault types to future phases

## Verification

- [x] `npm run build` passes
- [x] BanksTab added to settings categories
- [x] VaultManagement component created
- [x] Default folders use correct visibility values
- [x] Settings pane integration complete

## Success Criteria Met

- [x] BanksTab in settings shows all user's banks
- [x] Each bank shows its vaults
- [x] Create vault dialog works
- [x] Team vaults get default folders (Hall of Fame, Manager Reviews)
- [x] Only bank admins/owners can create vaults
- [x] TEAM-07 folder visibility hierarchy demonstrated in defaults

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Phase 9 plan 09 complete. Ready for 09-10 (Recording Queries Update).

### What 09-10 Should Know
- BankSwitcher and BanksTab now provide bank/vault context throughout app
- VaultManagement creates vaults with proper memberships and default folders
- Folder visibility (`all_members`, `managers_only`, `owner_only`) controls content access
- TypeScript types for bank/vault tables need regeneration for full type safety
