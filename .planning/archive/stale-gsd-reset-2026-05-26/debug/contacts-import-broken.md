---
status: awaiting_human_verify
trigger: "Import contacts shows 226 contacts in AI Simple org — pulling from wrong source, inaccurate stats"
created: 2026-04-07T00:00:00Z
updated: 2026-04-07T00:00:00Z
symptoms_prefilled: true
---

## Current Focus

hypothesis: CONFIRMED AND FIXED
test: Code fix applied, migration written for data cleanup
expecting: After running migration, AI Simple org will show 0 contacts; future Import All will correctly find 0 (no call_participants for that org)
next_action: Human verify — run migration, confirm AI Simple contacts are gone, confirm personal org unaffected

## Symptoms

expected: Import contacts should only show attendees/invitees from calls in the current workspace/org
actual: Shows 226 contacts from unknown sources, with inaccurate last seen, calls, and invites data
errors: No error messages, just wrong data
reproduction: Switch to AI Simple org, open contacts, try to import contacts
started: Current behavior

## Eliminated

- hypothesis: Primary call_participants query has missing org filter
  evidence: Primary path uses .eq("organization_id", orgId!) — correctly org-scoped
  timestamp: 2026-04-07

- hypothesis: contacts table query has missing org filter
  evidence: Contacts query uses .eq("org_id", orgId!) — correctly org-scoped
  timestamp: 2026-04-07

## Evidence

- timestamp: 2026-04-07
  checked: importAllContactsMutation in useContacts.ts lines 588-718
  found: Primary path queries call_participants with org filter. Fallback (when call_participants empty) queries fathom_raw_calls VIEW with user_id only — no org_id filter exists in fathom_raw_calls
  implication: If AI Simple org has no call_participants (calls synced to personal org instead), fallback fires and imports ALL 226 contacts from all user's fathom history

- timestamp: 2026-04-07
  checked: fathom_raw_calls RLS (20260303000005_rename_to_raw_tables.sql)
  found: RLS policy is user_id = auth.uid() only — no org scope
  implication: fathom_calls legacy query returns ALL user's calls regardless of org

- timestamp: 2026-04-07
  checked: call_participants backfill migration 20260309120000
  found: Backfill uses recordings.organization_id to set call_participants.organization_id. If recordings were all in personal org at backfill time, call_participants all have personal org_id
  implication: AI Simple org has 0 call_participants → legacy fallback triggers → 226 cross-org contacts imported

- timestamp: 2026-04-07
  checked: Stats computation (call_count, invited_count, attended_count, last_seen_at) in useContacts.ts
  found: Stats query on call_participants uses .eq("organization_id", orgId!) for AI Simple. Since contacts were imported from personal org's fathom calls but AI Simple has 0 call_participants, all stats return 0
  implication: Explains why last_seen, calls, invites are all wrong

## Resolution

root_cause: importAllContacts had a legacy fallback that queried fathom_raw_calls (via the fathom_calls VIEW) filtered only by user_id — no org_id filter exists in fathom_raw_calls. When AI Simple org had 0 call_participants (all calls were synced to personal org instead), the fallback fired and imported all 226 contacts from the user's entire Fathom history into AI Simple. Stats showed 0 for all contacts because the call_participants org-scoped query found nothing for AI Simple.
fix: Removed the legacy fathom_calls fallback from importAllContactsMutation entirely. If call_participants returns 0 for an org, the function now returns {totalImported:0} — meaning no calls in that org, nothing to import. Also removed the now-dead importFromLegacyCalls helper function.
verification: TypeScript compiles clean. Migration 20260407140000 written to clean up the 226 wrongly-imported contacts from non-personal orgs where no call_participants exist.
files_changed:
  - src/hooks/useContacts.ts
  - supabase/migrations/20260407140000_cleanup_cross_org_contacts.sql
