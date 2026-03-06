---
status: investigating
trigger: "Investigate UAT gap for Phase 10.3 test 1. User report: 'I don't see this as an option in settings or in the hubs page..'"
created: 2026-02-11T00:00:00Z
updated: 2026-02-11T00:15:00Z
---

## Current Focus

hypothesis: CONFIRMED - create flows hardcode type option lists that omit youtube
test: Compare vault type enum/rendering support vs selectable options in settings + hubs create dialogs
expecting: enum and display include youtube, but both create selectors do not
next_action: Return diagnosis artifacts and missing changes list for UAT gap

## Symptoms

expected: YouTube appears as vault type option when creating a vault.
actual: User does not see YouTube as an option in settings or hubs page.
errors: None reported.
reproduction: Open settings hub management or hubs page create flow and check available vault types.
started: Reported during UAT Phase 10.3 test 1.

## Eliminated

## Evidence

- timestamp: 2026-02-11T00:00:00Z
  checked: .planning/phases/10.3-youtube-specific-vaults-video-intelligence/10.3-UAT.md test 1
  found: Test 1 failed with user report that YouTube option is missing in settings and hubs page
  implication: Gap is likely in create-vault option exposure, not downstream rendering

- timestamp: 2026-02-11T00:07:00Z
  checked: src/types/bank.ts
  found: VaultType union includes 'youtube' (`'personal' | 'team' | 'coach' | 'community' | 'client' | 'youtube'`)
  implication: Domain type system already supports youtube vault type

- timestamp: 2026-02-11T00:08:00Z
  checked: src/components/panes/VaultListPane.tsx
  found: VAULT_TYPE_CONFIG defines youtube label/icon/colors for rendering existing youtube vaults
  implication: Display layer is wired for youtube vaults, so missing option is not a rendering limitation

- timestamp: 2026-02-11T00:11:00Z
  checked: src/components/dialogs/CreateVaultDialog.tsx
  found: VAULT_TYPE_OPTIONS only includes team/coach/community/client and does not include youtube
  implication: Hubs page create dialog cannot create youtube vaults

- timestamp: 2026-02-11T00:13:00Z
  checked: src/components/settings/VaultManagement.tsx
  found: Hub Type select includes team plus disabled coach/client only; youtube missing entirely
  implication: Settings create flow also cannot create youtube vaults

- timestamp: 2026-02-11T00:14:00Z
  checked: src/hooks/useVaultMutations.ts
  found: useCreateVault inserts input.vaultType directly and only adds special defaults for team; no youtube restriction
  implication: Backend mutation path can accept youtube if UI exposes it

## Resolution

root_cause: YouTube support was implemented in type/rendering/mutation paths, but both hub-creation UIs use stale hardcoded option lists that omit `youtube`, so users never get a selectable YouTube hub type in Settings or Hubs.
fix: Add `youtube` to both creation selectors (CreateVaultDialog and VaultManagement), with proper label/icon/treatment and enabled state.
verification: Code inspection confirms missing option in both create flows and existing support in VaultType + list rendering + create mutation.
files_changed: []
