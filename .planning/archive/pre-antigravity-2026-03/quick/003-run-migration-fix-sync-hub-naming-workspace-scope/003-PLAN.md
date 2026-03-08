---
phase: quick-003
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260210170000_add_bank_id_to_folders_and_tags.sql  # (applied, not modified)
  - src/components/transcripts/SyncTab.tsx
  - src/components/vault/VaultSelector.tsx
autonomous: true

must_haves:
  truths:
    - "Migration 20260210170000 is applied to remote database (folders and call_tags have bank_id)"
    - "SyncTab shows 'Sync to Hub' label instead of 'Sync to vault'"
    - "SyncTab displays workspace context messaging so user knows calls sync to current workspace"
    - "VaultSelector dropdown only shows hubs belonging to the currently active workspace"
    - "App builds clean with no TypeScript errors"
  artifacts:
    - path: "src/components/transcripts/SyncTab.tsx"
      provides: "Updated sync label and workspace messaging"
    - path: "src/components/vault/VaultSelector.tsx"
      provides: "Workspace-scoped hub filtering"
  key_links:
    - from: "VaultSelector"
      to: "useBankContext"
      via: "vaults already filtered by activeBankId in hook"
      pattern: "filter.*bank_id.*activeBankId"
---

<objective>
Run the pending workspace-scoped folders/tags migration, fix Sync tab naming ("Sync to Hub"), add workspace context messaging, verify hub dropdown is workspace-scoped, and confirm clean build.

Purpose: Complete the workspace isolation for folders/tags at the DB level, and align UI terminology (vault→hub) on the Sync tab with contextual messaging about which workspace calls will land in.

Output: Applied migration, updated SyncTab and VaultSelector labels, clean build.
</objective>

<execution_context>
@~/.config/Claude/get-shit-done/workflows/execute-plan.md
@~/.config/Claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/components/transcripts/SyncTab.tsx
@src/components/vault/VaultSelector.tsx
@src/hooks/useBankContext.ts
@supabase/migrations/20260210170000_add_bank_id_to_folders_and_tags.sql
</context>

<tasks>

<task type="auto">
  <name>Task 1: Run pending migration and fix Sync/Import naming + workspace messaging</name>
  <files>
    src/components/transcripts/SyncTab.tsx
    src/components/vault/VaultSelector.tsx
  </files>
  <action>
  **Step A - Run migration:**
  Run `npx supabase db push` to apply the pending migration `20260210170000_add_bank_id_to_folders_and_tags.sql`.
  Verify it applied by running `npx supabase migration list` and confirming the migration timestamp appears in the remote column.

  **Step B - Fix SyncTab label and add workspace messaging:**
  In `src/components/transcripts/SyncTab.tsx`:
  1. Change the VaultSelector `label` prop from `"Sync to vault"` to `"Sync to Hub"` (line ~597).
  2. Add a small info message below the VaultSelector (before the ActiveSyncJobsCard) that tells the user:
     - Calls will be synced into the currently selected workspace.
     - If they want calls in a different workspace, switch workspace first using the header dropdown.
     - Use `text-xs text-muted-foreground` styling. Keep it brief (1-2 lines max). Example:
       ```
       Calls sync to your current workspace. Switch workspace in the header to sync elsewhere.
       ```

  **Step C - Verify VaultSelector is already workspace-scoped:**
  Examine `VaultSelector` → it calls `useBankContext()` which returns `vaults` already filtered to the active bank (line 144 of useBankContext.ts: `.filter((m: any) => m.vault && m.vault.bank_id === activeBankId)`). This means the dropdown already only shows hubs for the current workspace. No code change needed for scoping — just verify this is the case.

  **Step D - Fix VaultSelector default label:**
  In `src/components/vault/VaultSelector.tsx`:
  1. The default `label` prop is `'Import to hub'` (line 59). This is fine for the YouTube import form but the SyncTab now passes its own label. No change needed here.

  **Step E - Build verification:**
  Run `npx tsc --noEmit` to confirm no TypeScript errors.
  Run `npm run build` to confirm production build succeeds.
  </action>
  <verify>
  1. `npx supabase migration list` shows `20260210170000` applied (both columns populated)
  2. `grep -n "Sync to Hub" src/components/transcripts/SyncTab.tsx` returns a match
  3. `grep -n "current workspace" src/components/transcripts/SyncTab.tsx` returns a match (messaging)
  4. `npx tsc --noEmit` exits 0
  5. `npm run build` exits 0
  </verify>
  <done>
  - Migration 20260210170000 is applied to remote database
  - SyncTab shows "Sync to Hub" label
  - SyncTab shows workspace context messaging
  - VaultSelector confirmed to already filter by active workspace (no change needed)
  - App builds clean
  </done>
</task>

</tasks>

<verification>
1. Migration applied: `npx supabase migration list` shows 20260210170000 in remote column
2. Label fixed: SyncTab renders "Sync to Hub" instead of "Sync to vault"
3. Messaging present: User sees workspace context note near the hub selector
4. Hub scoping: VaultSelector already uses useBankContext which filters vaults by activeBankId
5. Clean build: `npx tsc --noEmit && npm run build` both succeed
</verification>

<success_criteria>
- Pending migration applied to remote Supabase database
- "Sync to vault" renamed to "Sync to Hub" in SyncTab
- Workspace context message visible in SyncTab below hub selector
- Production build passes with no errors
</success_criteria>

<output>
After completion, create `.planning/quick/003-run-migration-fix-sync-hub-naming-workspace-scope/003-SUMMARY.md`
</output>
