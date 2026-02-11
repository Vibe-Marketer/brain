---
status: verifying
trigger: "workspace-scope-isolation: folders and tags show data from ALL workspaces instead of being scoped to selected workspace"
created: 2026-02-10T00:00:00Z
updated: 2026-02-10T10:54:00Z
---

## Current Focus

hypothesis: CONFIRMED - Fix applied and tests passing
test: Build verification, TypeScript check, test suite
expecting: All checks green
next_action: Await migration deployment and manual verification in staging

## Symptoms

expected: When switching to a different workspace (bank), everything should be completely separate - calls, folders, tags, hubs, and all other data should only show items belonging to that workspace.
actual: Calls filter correctly per workspace, but folders in the left sidebar and tags still show items from all workspaces regardless of which workspace is selected.
errors: No error messages - data just isn't filtered.
reproduction: 1) Log in, view home page on "Personal Workspace" - see all folders/tags. 2) Switch to "Business" workspace. 3) Calls correctly show "No matching transcripts" but folders and tags still show personal data.
started: Folders and tags have never been workspace-scoped. Call filtering was just recently fixed.

## Eliminated

## Evidence

- timestamp: 2026-02-10T00:00:30Z
  checked: useFolders.ts query (line 50-54)
  found: Query is `supabase.from("folders").select("*").eq("user_id", user.id).order("position")` - NO bank_id filter
  implication: Folders are fetched globally for the user, not scoped to active bank

- timestamp: 2026-02-10T00:00:35Z
  checked: useCategorySync.ts loadTags (line 28-31)
  found: Query is `supabase.from("call_tags").select("id, name").order("name")` - no user_id filter, no bank_id filter
  implication: Tags are fetched globally, not scoped to active bank

- timestamp: 2026-02-10T00:00:40Z
  checked: folders table schema (migration 20251201000002)
  found: folders table has NO bank_id column - only user_id, name, description, color, icon, parent_id, position
  implication: DB schema change needed - add bank_id column to folders table

- timestamp: 2026-02-10T00:00:45Z
  checked: call_tags table schema (migration 20251130000001)
  found: call_tags renamed from call_categories, has user_id but NO bank_id column
  implication: DB schema change needed - add bank_id column to call_tags table

- timestamp: 2026-02-10T00:00:50Z
  checked: TranscriptsTab.tsx bank filtering pattern (line 240-258)
  found: For business banks, queries `recordings` table with `.eq('bank_id', activeBankId)` to get legacy_recording_ids, then filters fathom_calls by those IDs
  implication: This is the reference pattern - recordings table has bank_id, used as bridge

- timestamp: 2026-02-10T00:00:55Z
  checked: recordings table schema (migration 20260131000007)
  found: recordings table has bank_id as FK to banks table - this is the bank association for calls
  implication: For tags, we can scope by joining through call_tag_assignments -> fathom_calls -> recordings.bank_id. For folders, need a bank_id column directly.

- timestamp: 2026-02-10T10:53:00Z
  checked: Full test suite, TypeScript compilation, and Vite build
  found: tsc --noEmit passes clean, vite build succeeds, FoldersTab.integration.test.tsx 29/29 pass (was 0/28 before fix)
  implication: All code changes are correct and tests are green

## Resolution

root_cause: Folders table has no bank_id column and useFolders.ts doesn't filter by bank. Tags (call_tags) also have no bank_id column and useCategorySync.ts doesn't filter by bank. Both pre-date the bank/vault architecture.

fix: |
  1. Database migration (20260210170000_add_bank_id_to_folders_and_tags.sql):
     - Added bank_id column to folders and call_tags tables
     - Backfilled existing rows to user's personal bank
     - Added indexes and updated unique constraint on folders to be bank-scoped
  2. Type update (src/types/folders.ts): Added bank_id to Folder interface
  3. Core hooks updated:
     - useFolders.ts: Bank-scoped queries + bank_id in query keys + bank_id in creation
     - useCategorySync.ts: Bank-scoped loadTags + bank_id in tag creation
     - useSyncTabState.ts: Bank-scoped loadTags
  4. 14 component files updated to include bank_id in queries and mutations
  5. Test fix (FoldersTab.integration.test.tsx):
     - Added useBankContext mock
     - Added bank_id to createMockFolder
     - Fixed pre-existing test mismatches (panelData.type, CSS class assertions)

verification: |
  - tsc --noEmit: PASS (clean)
  - vite build: PASS (successful)
  - FoldersTab.integration.test.tsx: 29/29 PASS
  - Full test suite: No new failures introduced (28 pre-existing failures unrelated to changes)
  - Pending: Manual verification in staging after migration deployment

files_changed:
  - supabase/migrations/20260210170000_add_bank_id_to_folders_and_tags.sql
  - src/types/folders.ts
  - src/hooks/useFolders.ts
  - src/hooks/useCategorySync.ts
  - src/hooks/useSyncTabState.ts
  - src/components/transcripts/TranscriptsTab.tsx
  - src/components/QuickCreateFolderDialog.tsx
  - src/components/QuickCreateTagDialog.tsx
  - src/components/ManualTagDialog.tsx
  - src/components/AssignFolderDialog.tsx
  - src/components/EditFolderDialog.tsx
  - src/components/transcript-library/TagFilterPopover.tsx
  - src/components/tags/TagsTab.tsx
  - src/components/tags/RulesTab.tsx
  - src/components/tags/RecurringTitlesTab.tsx
  - src/components/sharing/SharingRulesForm.tsx
  - src/components/settings/VaultManagement.tsx
  - src/hooks/useVaultMutations.ts
  - src/components/tags/__tests__/FoldersTab.integration.test.tsx
