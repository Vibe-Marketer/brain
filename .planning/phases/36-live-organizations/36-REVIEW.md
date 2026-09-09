---
phase: 36-live-organizations
reviewed: 2026-09-09T21:25:32Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - src/components/dialogs/MergeOrganizationsDialog.tsx
  - src/components/dialogs/UnclaimDomainDialog.tsx
  - src/components/panes/AdminCategoryPane.tsx
  - src/components/settings/OrganizationIdentitySection.tsx
  - src/components/settings/OrganizationsTab.tsx
  - src/components/shared/VerifiedDomainBadge.tsx
  - src/hooks/useAdminOrganizations.ts
  - src/hooks/useOrganizationIdentity.ts
  - src/lib/query-config.ts
  - src/pages/admin/AdminCenter.tsx
  - src/pages/admin/OrganizationsSection.tsx
  - src/services/admin-organizations.service.ts
  - src/services/organization-identity.service.ts
  - src/test/claim-organization-domain-rpc.integration.test.ts
  - src/test/org-merge-unclaim-rpc.integration.test.ts
  - src/test/rls-regression.test.ts
  - src/types/supabase.ts
  - supabase/functions/merge-organizations/__tests__/merge-organizations.integration.test.ts
  - supabase/functions/merge-organizations/index.ts
  - supabase/functions/unclaim-organization-domain/__tests__/unclaim-organization-domain.integration.test.ts
  - supabase/functions/unclaim-organization-domain/index.ts
  - supabase/migrations/20260908130000_create_organization_domains_and_aliases.sql
  - supabase/migrations/20260908130001_create_org_identity_self_serve_rpcs.sql
  - supabase/migrations/20260908140000_add_canonical_organization_id.sql
  - supabase/migrations/20260908140001_create_org_merge_unclaim_admin_rpcs.sql
  - supabase/migrations/20260909000000_add_admin_read_all_organizations_policy.sql
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Phase 36: Code Review Report

**Reviewed:** 2026-09-09T21:25:32Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

Phase 36 (Live Organizations) adds `organization_domains`/`organization_aliases` with FORCE RLS, a self-referencing `canonical_organization_id` merge pointer with a chain-prevention trigger, two SECURITY DEFINER admin RPCs (`merge_organizations_atomic`, `unclaim_organization_domain_atomic`) gated by `has_role` BY PARAMETER, two edge functions bridging those RPCs, and an admin-read-all RLS policy.

The security-critical invariants called out for this review all hold under direct inspection:

- **ORG-04 (canonical_organization_id never dereferenced by the RLS choke points):** confirmed by reading the live definitions of `is_organization_member` and `is_organization_admin_or_owner` (`supabase/migrations/20260301000001_rename_vaults_to_workspaces.sql:91-115`) — both query only `organization_memberships`, and no file in this phase edits them. `src/test/rls-regression.test.ts:1997-2187` additionally proves this end-to-end with a live merge (Org C merged into Org A) and a before/after probe of both functions.
- **has_role (platform) vs. is_organization_admin_or_owner (org-scoped) never confused:** both edge functions (`merge-organizations/index.ts:88`, `unclaim-organization-domain/index.ts:82`) and both atomic RPCs use `has_role`; the self-serve claim/alias RPCs (`20260908130001`) correctly use `is_organization_admin_or_owner` instead. Every one of these call sites carries an explicit comment citing the prior `20260316120000_fix_admin_role_leak.sql` incident, and the pattern is followed correctly everywhere in scope.
- **SQL injection:** none found. Every write goes through parameterized `plpgsql` statements or Zod-validated RPC params; no dynamic SQL (`EXECUTE`/`format`) anywhere in this phase's migrations or edge functions.
- **Cross-org leakage:** the new admin-read-all SELECT policies are additive, `SELECT`-only, and mirror the proven `user_profiles` pattern; `organization_domains`/`organization_aliases` are both in `CROSS_ORG_TABLES` in the regression suite, and would fail loud if the new admin policy were ever misconfigured to `USING (true)`.

The four findings below are real but non-security: two RPC-layer correctness gaps around "success" being reported when nothing actually changed, one UI double-messaging bug, and one interaction logic bug. None block the invariants above; all are independent of them.

## Warnings

### WR-01: `merge_organizations_atomic` / `unclaim_organization_domain_atomic` report success even when zero rows were affected

**File:** `supabase/migrations/20260908140001_create_org_merge_unclaim_admin_rpcs.sql:65-69`
**Issue:** After the `has_role` gate, `merge_organizations_atomic` runs a single `UPDATE organizations ... WHERE id = p_losing_org_id` with no row-count check:
```sql
UPDATE organizations
SET canonical_organization_id = p_winning_org_id,
    merged_at = NOW(),
    merged_by = p_admin_user_id
WHERE id = p_losing_org_id;
```
If `p_losing_org_id` does not exist (e.g. the org was deleted between the admin loading the Organizations table and clicking "Merge into…" — `DeleteOrganizationDialog` lets an org owner self-delete at any time), the `UPDATE` matches zero rows, no exception is raised, and the function returns normally. `merge-organizations/index.ts:117-131` sees no `mergeError` and returns `{ success: true }`; the UI (`useAdminOrganizations.ts:49` toast) tells the admin "Organizations merged" even though nothing changed. Contrast this with the sibling RPC in the very same migration file, `remove_organization_alias` (`20260908130001_create_org_identity_self_serve_rpcs.sql:165-169`), which already uses `DELETE ... RETURNING id INTO v_deleted_id` specifically to catch this class of no-op — the pattern is known in this codebase but wasn't applied here.

There is also no guard against re-targeting an org that is *already* a loser: the chain-prevention trigger (`20260908140000`) only rejects merging *into* an already-merged org and merging an org that others already point to — it does not stop `merge_organizations_atomic` from silently overwriting an *existing* `canonical_organization_id` with a new value. Compounding this, `AdminOrganization` (`admin-organizations.service.ts:32-39`) never selects `canonical_organization_id`/`merged_at`/`merged_by`, so `OrganizationsSection.tsx` shows every org — including already-merged losers — as a normal row with a live "Merge into…" button and no indication it was already merged.

`unclaim_organization_domain_atomic` has the identical gap one function down (`DELETE FROM organization_domains WHERE id = p_domain_id;` at line 107, no row-count check) — lower-impact since "delete if present" is idempotent-safe for an unclaim, but the same false-success report applies.

**Failure scenario:** Admin A loads the Organizations table. Admin B, in a separate tab, merges Org X into Org Y. Admin A (working off stale data) clicks "Merge into…" on Org X and selects Org Z. The RPC's `UPDATE ... WHERE id = X` still matches the row (X still exists), so this actually *would* succeed and silently overwrite Y with Z — Admin A never sees any indication that X was already merged into Y, and Admin B's merge decision is silently discarded.

**Fix:**
```sql
  UPDATE organizations
  SET canonical_organization_id = p_winning_org_id,
      merged_at = NOW(),
      merged_by = p_admin_user_id
  WHERE id = p_losing_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization % not found', p_losing_org_id;
  END IF;
```
and the same `IF NOT FOUND THEN RAISE EXCEPTION ...` after the `DELETE` in `unclaim_organization_domain_atomic`. Separately, surface `canonical_organization_id`/`merged_at` in `AdminOrganization`/`listAllOrganizations` so the Organizations table can grey out or label already-merged rows instead of offering a fully-live "Merge into…" action on them.

### WR-02: Domain-claim failure shows two different, inconsistent error messages at once

**File:** `src/hooks/useOrganizationIdentity.ts:76-78` and `src/components/settings/OrganizationIdentitySection.tsx:149-162`
**Issue:** `claimMutation` in `useOrganizationIdentity` toasts on every error:
```ts
onError: (error: Error) => {
  toast.error(error.message)
},
```
`error.message` here is `OrganizationIdentityError`'s generic fallback from `genericMessageForCode()` in `organization-identity.service.ts:50-65` (e.g. `'This is already claimed.'` for CONFLICT). But `handleClaimDomain` in `OrganizationIdentitySection.tsx` *also* catches the same rejection and renders its own, differently-worded inline message via `claimErrorCopy()` (e.g. `'This domain is already claimed by another organization.'` for the same CONFLICT code). Both fire for the same failure. This is inconsistent with the sibling `handleAddAlias`/`handleRemoveAlias` handlers in the same file, which deliberately swallow the error with a comment — `// useOrganizationIdentity's onError already toasts.` — precisely to avoid this double-surface. The component's own doc comment even claims ownership of the copy ("this component owns the user-facing copy"), which the hook's independent toast undermines.
**Failure scenario:** An org admin tries to claim a domain that's already claimed elsewhere. They see a toast reading "This is already claimed." *and*, simultaneously, an inline red line under the Select reading "This domain is already claimed by another organization." — two different sentences describing the same single failure.
**Fix:** Remove the generic toast from `claimMutation`'s `onError` in `useOrganizationIdentity.ts` (mirror `addAliasMutation`/`removeAliasMutation`'s pattern of leaving error surfacing entirely to the caller when the caller already handles it), since `OrganizationIdentitySection` already renders the precise UI-SPEC copy inline for every code path.

### WR-03: `VerifiedDomainBadge`'s click handler undoes its own hover-open on every mouse click

**File:** `src/components/shared/VerifiedDomainBadge.tsx:33-43`
**Issue:** The trigger button wires both hover-open and click-toggle to the same `open` state:
```tsx
onClick={(e) => {
  e.preventDefault()
  e.stopPropagation()
  setOpen((prev) => !prev)
}}
onMouseEnter={() => setOpen(true)}
onMouseLeave={() => setOpen(false)}
```
On any mouse-driven device, `onMouseEnter` necessarily fires before `onClick` (the pointer must be over the element to click it), so `open` is already `true` by the time the click handler runs. The click's `setOpen(prev => !prev)` then flips it back to `false`, immediately closing the popover the hover just opened. A literal click on this badge is a no-op-or-worse on desktop — it never keeps the popover open past the click, and if the hover hadn't yet registered as `true` for some timing reason, the two handlers are still fighting over the same boolean instead of composing.
**Failure scenario:** Admin hovers the shield badge next to an org name (popover opens showing verified domains), then clicks it to pin it open before moving the mouse elsewhere to interact with the row — the click instead closes the popover on the spot.
**Fix:** Drop the toggle in favor of an idempotent open, since hover/focus already own opening and `onMouseLeave`/`onBlur` already own closing:
```tsx
onClick={(e) => {
  e.preventDefault()
  e.stopPropagation()
  setOpen(true)
}}
```

## Info

### IN-01: `add_organization_alias` accepts an empty/whitespace-only alias if called directly

**File:** `supabase/migrations/20260908130001_create_org_identity_self_serve_rpcs.sql:109-117`
**Issue:** `v_alias TEXT := TRIM(p_alias);` is inserted with no non-empty check afterward — the RPC relies entirely on the client's `if (!trimmed) return` guard in `OrganizationIdentitySection.tsx:127-128`. A direct RPC call (or a future client that forgets the guard) can insert an alias row whose `alias` value is `''`. No security impact (the unique index still dedupes future empty submissions as CONFLICT), just a data-quality gap in a SECURITY DEFINER function that otherwise validates everything else server-side.
**Fix:**
```sql
IF v_alias = '' THEN
  RETURN jsonb_build_object('success', false, 'code', 'INVALID');
END IF;
```

---

_Reviewed: 2026-09-09T21:25:32Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
