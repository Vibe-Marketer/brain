# Quick Task 003: Run Migration, Fix Sync Hub Naming & Workspace Scope

**One-liner:** Applied workspace-scoped folders/tags migration, renamed "Sync to vault" → "Sync to Hub", added workspace context messaging.

---

## Metadata

| Field | Value |
|-------|-------|
| Plan | quick-003 |
| Completed | 2026-02-10 |
| Duration | ~2 minutes |
| Tasks | 1/1 |

---

## What Was Done

### Step A: Migration Applied
- Pushed migration `20260210170000_add_bank_id_to_folders_and_tags.sql` to remote database
- **Initial push failed:** `call_tags` had orphaned rows (users without personal banks) causing NULL values after backfill
- **Fix applied:** Added `DELETE FROM call_tags WHERE bank_id IS NULL` and equivalent for `folders` to clean orphaned rows before NOT NULL constraint
- Second push succeeded — migration verified in both Local and Remote columns

### Step B: SyncTab Label & Messaging
- Changed `label="Sync to vault"` → `label="Sync to Hub"` on VaultSelector in SyncTab.tsx (line 597)
- Added workspace context note below hub selector: *"Calls sync to your current workspace. Switch workspace in the header to sync elsewhere."*
- Styled with `text-xs text-muted-foreground` for subtle, non-intrusive messaging

### Step C: VaultSelector Workspace Scoping Verified
- Confirmed `useBankContext()` hook returns `vaults` already filtered by `activeBankId` (line 144 of useBankContext.ts)
- VaultSelector uses this pre-filtered list — no additional code change needed
- Hub dropdown automatically shows only hubs for the currently active workspace

### Step D: VaultSelector Default Label
- Default label is `'Import to hub'` — correct for YouTube import form
- SyncTab now passes its own label `"Sync to Hub"` — no change needed in VaultSelector

### Step E: Build Verification
- `npx tsc --noEmit` — passed clean (exit 0)
- `npm run build` — passed clean (exit 0)

---

## Commits

| Hash | Message |
|------|---------|
| e7fded6 | feat(quick-003): apply workspace-scoped migration, fix Sync Hub naming, add workspace messaging |

---

## Files Modified

| File | Change |
|------|--------|
| `supabase/migrations/20260210170000_add_bank_id_to_folders_and_tags.sql` | Added orphan cleanup before NOT NULL constraint |
| `src/components/transcripts/SyncTab.tsx` | Changed label to "Sync to Hub", added workspace context messaging |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migration failed due to orphaned call_tags rows**
- **Found during:** Step A (migration push)
- **Issue:** Some `call_tags` rows had users without personal banks, so the backfill UPDATE left bank_id as NULL, and the subsequent NOT NULL constraint failed
- **Fix:** Added `DELETE FROM call_tags WHERE bank_id IS NULL` and `DELETE FROM folders WHERE bank_id IS NULL` cleanup steps between backfill and NOT NULL constraint
- **Files modified:** `supabase/migrations/20260210170000_add_bank_id_to_folders_and_tags.sql`
- **Commit:** e7fded6

---

## Verification Results

| Check | Status |
|-------|--------|
| Migration `20260210170000` in remote column | ✅ Confirmed |
| `grep "Sync to Hub" SyncTab.tsx` | ✅ Match at line 597 |
| `grep "current workspace" SyncTab.tsx` | ✅ Match at line 602 |
| `npx tsc --noEmit` | ✅ Exit 0 |
| `npm run build` | ✅ Exit 0 |
