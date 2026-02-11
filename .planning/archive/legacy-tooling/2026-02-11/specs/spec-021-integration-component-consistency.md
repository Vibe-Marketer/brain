# SPEC-021: Integration Component Consistency

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Import/Integrations
**Priority:** Code Quality

---

## Summary

Ensure the integrations component is exactly the same in both the Import screen and the Settings screen. Currently they may differ, causing inconsistent behavior.

## What

Audit and unify integration components across Import and Settings screens.

**Files to investigate:**
- `src/components/sync/IntegrationSyncPane.tsx` (Import screen)
- `src/components/settings/IntegrationsTab.tsx` (Settings screen)
- `src/components/settings/IntegrationStatusCard.tsx`

**Current:** Different components or implementations in different locations
**Done:** Single source of truth component used in both places

## Why

- Different implementations = different bugs
- Maintenance burden of keeping two in sync
- User confusion when same feature works differently
- Code duplication is technical debt

## User Experience

- User manages integrations in Import → works exactly like Settings
- User manages integrations in Settings → works exactly like Import
- Consistent behavior everywhere

## Scope

**Includes:**
- Auditing both implementations
- Creating/identifying single reusable component
- Replacing duplicates with shared component

**Excludes:**
- Adding new integration features
- Changing integration functionality

## Acceptance Criteria

- [ ] Single component used in both locations
- [ ] Identical behavior in Import and Settings
- [ ] No duplicate integration management code
- [ ] Both screens use same connection flows

## User Story

**As a** CallVault user
**I want** integrations to work the same everywhere
**So that** I'm not confused by different behaviors in different places

---

## Technical Notes

Likely refactor:
1. Create shared `IntegrationManager` component
2. Use in `IntegrationSyncPane.tsx`
3. Use in `IntegrationsTab.tsx`
4. Remove duplicate code

---

*Spec ready for PRD generation.*
