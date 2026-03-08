---
status: resolved
trigger: "Bank switcher missing for naegele412@gmail.com - no bank/vault records for existing user"
created: 2026-02-09T00:00:00Z
updated: 2026-02-09T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED AND FIXED
test: Verify bank switcher appears for naegele412@gmail.com after login
expecting: Bank switcher visible showing "Personal" bank
next_action: Browser verification

## Symptoms

expected: Bank switcher should appear in header showing user's Personal bank with vaults
actual: Bank switcher completely missing from header for naegele412@gmail.com
errors: None reported
reproduction: Log in as naegele412@gmail.com, navigate to any page, bank switcher absent
started: Since Phase 9 bank/vault system was added - user signed up 2025-11-29, migration added 2026-01-31

## Eliminated

## Evidence

- timestamp: 2026-02-09T00:00:30Z
  checked: bank_memberships table for both users
  found: a@vibeos.com has Personal bank (bank_owner). naegele412@gmail.com has ZERO bank records.
  implication: Root cause confirmed - missing bank data for pre-Phase 9 user

- timestamp: 2026-02-09T00:00:45Z
  checked: fathom_calls for naegele412@gmail.com
  found: 0 fathom_calls for this user
  implication: Batch migration function wouldn't have created bank either (it only runs for users with calls)

- timestamp: 2026-02-09T00:00:50Z
  checked: Total users vs users with banks
  found: 11 total users, only 5 have banks. 6 users (all pre-2026-01-31) missing banks.
  implication: Systemic issue - ALL pre-Phase 9 users without fathom_calls are affected

- timestamp: 2026-02-09T00:00:55Z
  checked: handle_new_user() trigger and migrate_fathom_call_to_recording()
  found: Signup trigger creates bank for NEW users only. Migration function creates bank only when migrating a call. No backfill for users with 0 calls.
  implication: Gap in migration plan - users without calls never got backfilled

- timestamp: 2026-02-09T00:01:30Z
  checked: Applied migration backfill
  found: All 6 users successfully received personal banks and vaults
  implication: Database state is now correct for all users

- timestamp: 2026-02-09T00:01:45Z
  checked: Build verification
  found: npm run build succeeds with no errors
  implication: Code changes are clean

## Resolution

root_cause: Pre-Phase 9 users who had 0 fathom_calls never got bank/vault records created. The signup trigger (handle_new_user) only fires for NEW signups. The migration function only creates banks as a side-effect of migrating calls. 6 of 11 users were affected.
fix: Three-part fix: (1) SQL RPC `ensure_personal_bank` - idempotent function that creates personal bank+vault if missing, (2) SQL backfill DO block that ran once during migration to fix all 6 affected users, (3) Frontend useBankContext hook now calls `ensure_personal_bank` RPC when no banks found instead of just setting error (future-proofing).
verification: DB queries confirm all 11 users now have banks. Build passes.
files_changed:
  - supabase/migrations/20260209090000_ensure_personal_bank.sql (NEW - RPC + backfill)
  - src/hooks/useBankContext.ts (auto-create bank when none found)
  - src/integrations/supabase/types.ts (added ensure_personal_bank type)
  - src/types/supabase.ts (added ensure_personal_bank type)
