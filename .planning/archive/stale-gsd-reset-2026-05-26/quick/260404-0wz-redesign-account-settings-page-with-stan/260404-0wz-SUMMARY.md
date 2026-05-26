---
phase: quick
plan: 260404-0wz
subsystem: frontend/settings
tags: [ui, settings, design-system, account]
dependency_graph:
  requires: []
  provides: [redesigned-account-settings]
  affects: [AccountTab, settings-page]
tech_stack:
  added: []
  patterns: [semantic-tokens, font-montserrat-headings, avatar-initials, danger-zone-placeholder]
key_files:
  created: []
  modified:
    - src/components/settings/AccountTab.tsx
decisions:
  - "5-section layout: Profile / Security / Preferences / Integrations / Danger Zone — matches standard SaaS pattern"
  - "Merged Auto-Processing into Preferences as sub-section — both are user preferences, no need for separate section"
  - "Moved Fathom email to Integrations — semantically it is a third-party connection, not a user preference"
  - "Danger Zone is placeholder with disabled button — delete account feature not yet built, but section reserved"
  - "Avatar uses initials from display_name, falling back to email first char — no image upload needed yet"
metrics:
  duration: ~2m
  completed: 2026-04-04
  tasks: 1
  files: 1
---

# Quick Task 260404-0wz: Redesign Account Settings Page Summary

**One-liner:** Account settings page reorganized into 5 standard SaaS sections with semantic tokens, Montserrat headings, avatar initials, and a Danger Zone placeholder.

## What Was Built

Rewrote `AccountTab.tsx` to reorganize the flat settings layout into 5 clearly separated sections matching modern SaaS conventions:

1. **Profile** — Avatar initials circle (bg-muted, 64px, foreground text) + display name inline-edit + read-only email
2. **Security** — Password change with expand/collapse, show/hide toggle (moved up from bottom)
3. **Preferences** — Timezone inline-edit + Auto-Processing sub-section (auto-naming + auto-tagging switches)
4. **Integrations** — Fathom email inline-edit (moved out of Preferences into its own section)
5. **Danger Zone** — Red-bordered container (border-destructive/30) with disabled Delete Account button placeholder

## Design System Compliance

- All section headings: `font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground`
- All body text: `text-sm text-muted-foreground` (was `text-gray-500 dark:text-gray-500`)
- Primary text: `text-foreground` (was `text-gray-900 dark:text-gray-50`)
- Auto-Processing sub-label: `text-[10px] uppercase tracking-wide text-muted-foreground/60`
- Section icons: RiUserLine, RiShieldLine, RiSettings3Line, RiPlugLine, RiAlertLine

## Preserved Functionality

All existing logic untouched:
- `useEditableField` hook (inline edit pattern for display name, timezone, Fathom email)
- `loadProfileData`, `saveProfile`, `saveTimezone`, `saveHostEmail`, `changePassword` functions
- `usePreferencesStore` for auto-processing toggles
- All Supabase queries and auth patterns
- timezones array

## Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Rewrite AccountTab.tsx with 5 sections + design system tokens | `425f48d4` |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- **Delete Account button** (`src/components/settings/AccountTab.tsx`, Danger Zone section) — `disabled={true}` placeholder. Delete account feature not yet implemented. Intentional per plan spec.

## Self-Check: PASSED

- [x] `src/components/settings/AccountTab.tsx` — FOUND
- [x] Commit `425f48d4` — FOUND
- [x] 0 gray-900/gray-500 tokens — VERIFIED
- [x] 5 font-montserrat headings — VERIFIED
- [x] Danger Zone + Delete Account present — VERIFIED
- [x] All save functions preserved — VERIFIED
