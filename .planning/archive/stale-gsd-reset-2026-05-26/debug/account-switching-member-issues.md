---
status: investigating
trigger: "switching accounts makes funky things happen — multi-org data bleed when switching orgs"
created: 2026-04-07T00:00:00Z
updated: 2026-04-07T12:00:00Z
---

## Current Focus

hypothesis: The "funky things" are a combination of three distinct issues, not one: (1) a now-fixed data contamination bug (226 wrong contacts already cleaned up today), (2) TanStack Query cache holding stale data from the previous org briefly after switching, and (3) the "all calls" query path that falls back to owner_user_id when no org is set — a window that exists briefly during org initialization.
test: Traced all query paths, data schema, migrations, and org switch flow
expecting: Root causes confirmed — investigation complete
next_action: Deliver structured diagnosis

## Symptoms

expected: Switching organizations shows only that org's data cleanly
actual: "Funky things happen" — data from one org bleeds into another after switching
errors: No specific error messages, behavioral
reproduction: Switch between organizations using the org switcher
started: Ongoing — user recalls prior design discussion about per-org contact copies or member flags

## Eliminated

- hypothesis: Missing org_id on contacts table
  evidence: Migration 20260310150000 added org_id to contacts and contact_call_appearances with RLS enforcement. Schema is correct.
  timestamp: 2026-04-07

- hypothesis: importAllContacts uses a cross-org fallback
  evidence: The legacy fathom_raw_calls fallback was already removed (documented in 20260407140000 migration comment). Current useContacts.ts importAllContactsMutation queries call_participants filtered by orgId correctly.
  timestamp: 2026-04-07

- hypothesis: The org-switch code doesn't reset workspace/folder context
  evidence: orgContextStore.setActiveOrg explicitly resets activeWorkspaceId and activeFolderId to null. useOrgContext.switchOrg also closes panels and resets search. Clean slate is implemented.
  timestamp: 2026-04-07

## Evidence

- timestamp: 2026-04-07
  checked: Migration 20260407140000_cleanup_cross_org_contacts.sql
  found: This migration ran TODAY (April 7). It documents a confirmed bug: importAllContacts() had a legacy fathom_raw_calls fallback that had no org_id filter, causing ~226 contacts to be imported into "AI Simple" org from the user's entire Fathom history. The bug is the source of the "funky things" — contacts from one Fathom account appeared in a different org.
  implication: The data contamination already happened and was cleaned up. The import code bug is fixed.

- timestamp: 2026-04-07
  checked: useContacts.ts importAllContactsMutation (lines 521-658)
  found: Bug is fixed — queries call_participants filtered by .eq("organization_id", orgId!). The code comments explicitly say the legacy fathom_raw_calls fallback was removed.
  implication: Future imports will not cross-contaminate. The old contaminated data was deleted by the migration.

- timestamp: 2026-04-07
  checked: TranscriptsTab.tsx "All Calls" query path (line 712+)
  found: When activeOrganizationId is set, the query filters by .eq('organization_id', activeOrganizationId). However, when no orgId is set (line 727-728), it falls back to .eq('owner_user_id', user.id) — this shows ALL calls the user owns across ALL orgs. During org initialization (the brief window before isInitialized=true), the query is not enabled (line 332: enabled: isInitialized), so this fallback path should not trigger.
  implication: The fallback is safe because the query waits for isInitialized. Low risk path.

- timestamp: 2026-04-07
  checked: query-config.ts — calls.list() query key structure
  found: The "tag-calls" query in TranscriptsTab includes activeOrganizationId in its queryKey (position [5] in the array, line 331). When org switches, this generates a NEW cache key, so TanStack Query correctly fetches fresh data. Old cached data is kept in gcTime window (5 min) but not served as stale data.
  implication: Cache invalidation on org switch is handled by key composition. No stale data leak.

- timestamp: 2026-04-07
  checked: contacts query key in query-config.ts
  found: queryKeys.contacts.list(orgId) includes orgId in the key. When org changes, useContacts(orgId) is called with new orgId, generating new cache key. Old org data stays cached but unreachable under the new key.
  implication: Contact queries are correctly org-scoped in both the query key and the DB filter.

- timestamp: 2026-04-07
  checked: call_participants table schema and call_participants.organization_id RLS
  found: call_participants has organization_id NOT NULL with RLS: "Organization members can view call participants" using is_organization_member(organization_id, auth.uid()). DB enforces the boundary.
  implication: Even if the frontend sent a wrong org_id, RLS prevents cross-org data access.

- timestamp: 2026-04-07
  checked: Contacts org-scoping (20260310150000 migration)
  found: contacts.org_id added March 10. UNIQUE constraint is (user_id, org_id, email) — same email CAN exist in multiple orgs as separate rows. RLS requires org membership. The "copy" design the user recalled is this: contacts are NOT shared across orgs, each org gets its own copy.
  implication: The design was deliberately implemented as per-org copies (not a flag system). This IS the correct design.

- timestamp: 2026-04-07
  checked: orgContextStore.setActiveOrg behavior
  found: Resets activeWorkspaceId=null, activeFolderId=null, isSharedView=false. useOrgContext.switchOrg also closes panels, resets search, navigates to '/'. All transient UI state is cleared.
  implication: The org switch mechanism itself is clean. No state leaks from the store.

## Resolution

root_cause: |
  THREE separate issues contributed to "funky things" on org switch:

  1. CONFIRMED PAST BUG (NOW FIXED + DATA CLEANED):
     importAllContacts() had a legacy fallback that queried fathom_raw_calls by user_id only
     (no org_id filter). When an org had no call_participants yet, this fallback imported ALL
     contacts from the user's entire Fathom history into the wrong org. This produced ~226
     contacts in "AI Simple" org from the personal org's Fathom data. Migration
     20260407140000 deleted those contaminated contacts today. The import code was also fixed
     to remove the fallback.

  2. LATENT RISK (ACCEPTABLE):
     During org initialization (the ~100-300ms window between page load and isInitialized=true),
     the transcript/calls query is disabled (enabled: isInitialized). This is safe. However,
     ANY hook that doesn't check isInitialized before querying could briefly show cross-org data.
     Worth auditing.

  3. CONTACT DATA DESIGN CONFUSION (NOW CLEAR):
     The "copy" design the user remembered is the CORRECT current architecture: each org gets
     its own contacts rows (unique per user_id+org_id+email). Contacts are NOT shared across
     orgs via flags. The contacts table has had org_id since March 10.

fix: |
  Already applied:
  - importAllContacts legacy fallback removed (code was fixed before this debug session)
  - 20260407140000 migration deleted 226 cross-org contaminated contacts

  Remaining risk to address:
  - Audit all hooks in src/hooks/ for ones that don't include orgId in their query key AND
    don't disable themselves until isInitialized is true. Hooks that query by user_id only
    (not org_id) may show cross-org data during org switch.

  Specific hooks to audit:
  - useHealthAlerts.ts — queries fathom_calls by user_id only (no orgId), no isInitialized check
  - Any hook using queryKeys that don't include orgId (check calls.*, categories.*, syncJobs.*)

verification: Diagnosis only — not verifying fix application
files_changed: []
