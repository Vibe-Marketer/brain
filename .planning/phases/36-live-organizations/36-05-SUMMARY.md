---
phase: 36-live-organizations
plan: 05
subsystem: ui
tags: [react, tanstack-query, supabase, admin, organizations, rls, remix-icons, radix-ui]

# Dependency graph
requires:
  - phase: 36-03
    provides: organizationIdentity query-key factory precedent (self-serve settings UI) — sibling, not consumed directly
  - phase: 36-04
    provides: merge-organizations / unclaim-organization-domain has_role(ADMIN)-gated edge functions
provides:
  - "src/services/admin-organizations.service.ts -- listAllOrganizations (orgs + nested domains/aliases), mergeOrganizations, unclaimOrganizationDomain edge-fn invocations, AdminOrganizationsError"
  - "src/hooks/useAdminOrganizations.ts -- admin org-list query + useMergeOrganizations/useUnclaimOrganizationDomain mutations (toast + invalidation)"
  - "src/pages/admin/OrganizationsSection.tsx -- admin org table, per-row Radix Collapsible expand revealing domains (with Unclaim) + aliases, row-level Merge into…"
  - "src/components/dialogs/MergeOrganizationsDialog.tsx -- type-to-confirm-the-loser, reversible-merge copy, winning-org Select"
  - "src/components/dialogs/UnclaimDomainDialog.tsx -- lightweight no-type-to-confirm unclaim dialog"
  - "adminOrganizations query-key factory block in query-config.ts"
  - "'organizations' category registered in AdminCategoryPane.tsx + AdminCenter.tsx renderSection"
  - "supabase/migrations/20260909000000 -- has_role(ADMIN) admin-read-all SELECT policies on organizations/organization_domains/organization_aliases (deviation, TEST-only)"
affects: [36-06-prod-apply]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Admin-read-all RLS policy additive alongside the existing member-scoped SELECT policy (mirrors the already-live user_profiles.\"Admins can view all profiles\" has_role(auth.uid(),'ADMIN') pattern verbatim) rather than a new list-all edge function/RPC -- same authority tier already established in this codebase for platform-wide admin reads"
    - "Mutation variables carry a display-only field (losingOrganizationName) purely so the mutation hook's onError can render the exact UI-SPEC reassurance copy without a second, redundant component-level toast -- the service call itself only needs the two org ids"
    - "Per-row admin-table expand is two sibling <tr> elements (not one Collapsible.Root wrapping both) -- Radix Collapsible.Root/Content render <div>s, which cannot legally wrap <tr> siblings inside a <tbody>; Collapsible.Root/Content are scoped to only the second <tr>'s <td>, with isOpen lifted to plain useState so the first row's chevron button can toggle the same state"

key-files:
  created:
    - supabase/migrations/20260909000000_add_admin_read_all_organizations_policy.sql
    - src/services/admin-organizations.service.ts
    - src/hooks/useAdminOrganizations.ts
    - src/pages/admin/OrganizationsSection.tsx
    - src/components/dialogs/MergeOrganizationsDialog.tsx
    - src/components/dialogs/UnclaimDomainDialog.tsx
  modified:
    - src/lib/query-config.ts
    - src/components/panes/AdminCategoryPane.tsx
    - src/pages/admin/AdminCenter.tsx

key-decisions:
  - "Added migration 20260909000000 granting has_role(ADMIN) SELECT bypass on organizations/organization_domains/organization_aliases -- not in the plan's declared files_modified, added because listAllOrganizations() cannot show ALL organizations without it (the only pre-existing SELECT policy on these three tables is member-scoped is_organization_member(...), which would silently limit the admin table to \"orgs the operator personally belongs to\"). Mirrors the already-live user_profiles admin-bypass policy exactly. TEST-applied only, CLI relinked to prod after verification, per this phase's established TEST-then-Plan-06 discipline (Plans 01-04 all did the same)."
  - "Merge-failure toast copy lives in the mutation hook's onError (useMergeOrganizations), not the dialog component -- unlike 36-03's per-code claim-error mapping (which needed the thrown error's .code, only available in a catch block), the exact UI-SPEC string only needs the losing org's name, which is passed through as a mutation variable purely for this formatting purpose. Avoids a double-toast (hook toast + component toast) for the same failure."
  - "Admin org-table row expand renders the collapse <tr> as an always-present DOM sibling (per the plan's own literal instruction) with Collapsible.Root/Content scoped to only that second row's <td>, not wrapping both <tr>s -- Radix's Collapsible.Root/Content render real <div> elements, which browsers hoist out of an invalid table position if used to wrap <tr> siblings directly."
  - "Search filters by org name OR any claimed domain substring (not aliases) -- matches the empty-state copy 'Try a different name or domain' verbatim, and no additional role/plan-style filter dropdowns were added since nothing in the UI-SPEC specifies filter criteria for organizations beyond search."

requirements-completed: [ORG-03]

coverage:
  - id: D1
    description: "Data layer: admin-organizations service (listAllOrganizations joining orgs+domains+aliases client-side, mergeOrganizations, unclaimOrganizationDomain) + useAdminOrganizations hook (query + 2 toast/invalidate mutations) + adminOrganizations query-key factory, backed by a new admin-read-all RLS policy"
    requirement: "ORG-03"
    verification:
      - kind: other
        ref: "node scripts/type-check.mjs -- 0 new errors, baseline unchanged (320/320)"
        status: pass
      - kind: other
        ref: "grep admin-organizations.service.ts + useAdminOrganizations.ts: literal 'merge-organizations'/'unclaim-organization-domain' function names present, no adminOrganizations/organizationIdentity invalidation gaps"
        status: pass
      - kind: other
        ref: "Live TEST introspection (pg_policies): 3 new has_role(auth.uid(),'ADMIN') SELECT policies confirmed on organizations/organization_domains/organization_aliases, additive alongside the pre-existing member-scoped policies"
        status: pass
    human_judgment: false
  - id: D2
    description: "OrganizationsSection admin page: search header, summary line ({N} organizations · {M} verified domains, tabular-nums), 5-column table (Organization/Domains/Aliases/Created/actions), loading/error/empty states matching UI-SPEC copy exactly, per-row Radix Collapsible expand revealing domains (Unclaim button) + aliases, row-level 'Merge into…'; registered as a new Admin Center category"
    requirement: "ORG-03"
    verification:
      - kind: other
        ref: "node scripts/type-check.mjs + rtk lint OrganizationsSection.tsx AdminCategoryPane.tsx AdminCenter.tsx -- 0 new type errors, 0 lint errors (1 pre-existing react-refresh warning on AdminCategoryPane.tsx, unrelated to this change's export shape)"
        status: pass
      - kind: other
        ref: "grep: 'organizations' present in AdminCategory union + ADMIN_CATEGORIES (icon RiBuilding4Line) + AdminCenter renderSection case branch; empty-state copy 'No organizations match your search'/'Try a different name or domain.' present verbatim; no lucide-react/framer-motion in any new/edited file"
        status: pass
      - kind: other
        ref: "npm run build -- clean production build (6.88s, 0 errors) including the new AdminCenter/OrganizationsSection bundle"
        status: pass
    human_judgment: true
    rationale: "This plan's own Task 2 <human-check> defers live interactive verification (opening /admin → Organizations, searching, expanding a row, confirming dialogs open from the right entry points) to end-of-phase per this project's human_verify_mode=end-of-phase config -- same deferral pattern every prior plan in this phase (03, 04) used. Automated checks prove it compiles, lints, builds, and contains the required literals/structure -- not that the interactive expand/search/dialog-open flow behaves correctly against live data."
  - id: D3
    description: "MergeOrganizationsDialog (type-to-confirm the LOSING org's name, winning-org Select, reversible non-destructive copy, exact merge-failure toast) + UnclaimDomainDialog (no type-to-confirm, confirm enabled on open, exact UI-SPEC body copy, backstop generic failure toast)"
    requirement: "ORG-03"
    verification:
      - kind: other
        ref: "node scripts/type-check.mjs + rtk lint MergeOrganizationsDialog.tsx UnclaimDomainDialog.tsx -- 0 new errors"
        status: pass
      - kind: other
        ref: "grep: 'not moved'/'reversible' present in MergeOrganizationsDialog body copy, 'cannot be undone' absent; canMerge gate requires both winningOrgId AND confirmText===losingOrg.name; exact 'Merge failed — {org} was not changed. No data was altered.' template present in useAdminOrganizations.ts onError; exact 'will lose its verified badge...' UnclaimDomainDialog body copy present verbatim; no confirm Input in UnclaimDomainDialog"
        status: pass
    human_judgment: true
    rationale: "Task 3's own <human-check> ('Trigger a merge... and an unclaim; confirm the copy, the type-to-confirm gate, and that toasts fire') is explicitly deferred to end-of-phase, against prod after Plan 06 deploys the edge functions this dialog calls -- these functions do not exist in production yet (Plan 04's own Next Phase Readiness note). Automated checks prove the gating logic, exact copy strings, and structural contract -- not the live round-trip against a deployed edge function."

duration: ~25min
completed: 2026-09-09
status: complete
---

# Phase 36 Plan 05: Admin Center Organizations (Merge/Unclaim) UI Summary

**Internal, platform-admin-only Admin Center "Organizations" section — org table with inline row-expand, type-to-confirm reversible-merge dialog, and lightweight unclaim dialog, wired to Plan 04's has_role(ADMIN)-gated edge functions; ships alongside a new admin-read-all RLS policy (deviation) since the pre-existing organizations RLS was member-scoped only.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-09T06:16:42Z
- **Tasks:** 3 (all `type="auto"`)
- **Files modified:** 9 (6 created, 3 modified)

## Accomplishments

- `admin-organizations.service.ts` + `useAdminOrganizations.ts` + an `adminOrganizations` query-key factory entry — the full admin data layer: `listAllOrganizations()` reads `organizations` + `organization_domains` + `organization_aliases` in parallel and joins them client-side into one `AdminOrganization[]` (each with nested `domains`/`aliases` arrays, not just counts, so the row-expand can render full detail without a second fetch); `mergeOrganizations`/`unclaimOrganizationDomain` invoke exactly `merge-organizations`/`unclaim-organization-domain` (Plan 04's edge functions).
- `OrganizationsSection.tsx` — mirrors `UsersSection.tsx`'s search header + table + loading/error/empty states exactly (8× `Skeleton` rows, `text-destructive` error text, icon-circle empty state). Summary line `"{N} organizations · {M} verified domains"` uses unfiltered platform-wide totals (mirroring `UsersSection`'s own `{totalUsers} users · {adminCount} admins` convention). Each row expands inline via Radix `Collapsible` to reveal that org's domains (each with a destructive-ghost "Unclaim" button) and aliases; a row-level "Merge into…" button opens `MergeOrganizationsDialog` pre-selected as the losing org.
- `MergeOrganizationsDialog.tsx` — borrows `DeleteOrganizationDialog`'s shell (header icon circle, confirm `Input`, two-button footer) but explicitly NOT its irreversible wording: body states plainly that recordings/memberships are not moved and the merge is reversible by clearing the `canonical_organization_id` pointer (grep-confirmed: "not moved"/"reversible" present, "cannot be undone" absent). Submit disabled until a winning org is selected AND the typed text matches the losing org's name exactly.
- `UnclaimDomainDialog.tsx` — the lighter variant with no type-to-confirm field, confirm enabled immediately on open, exact UI-SPEC body copy ("Unclaim {domain}? {org} will lose its verified badge...").
- `'organizations'` registered as a new Admin Center category (`RiBuilding4Line`, description "Merge duplicates, manage domains") in `AdminCategoryPane.tsx`, with the corresponding `renderSection()` case in `AdminCenter.tsx`. `AdminCenter` is already wrapped in `<AdminGuard>` (client-side `has_role==='ADMIN'` gate) — the new section inherits platform-admin-only access with no additional gating code needed, satisfying 36-CONTEXT.md's "internal/admin-only, not exposed to org owners" requirement architecturally.
- Full production build (`npm run build`) succeeds cleanly, confirming the new files bundle without unresolved-import issues beyond what `tsc` alone would catch.

## Task Commits

Each task was committed atomically:

1. **Task 1: admin-organizations service + hook + query keys** - `3c8157da` (feat)
2. **Task 2: OrganizationsSection admin page + Admin Center registration** - `e209066b` (feat)
3. **Task 3: MergeOrganizationsDialog + UnclaimDomainDialog** - `f151f794` (feat)

**Plan metadata commit:** pending (this commit)

## Files Created/Modified

- `supabase/migrations/20260909000000_add_admin_read_all_organizations_policy.sql` - 3 new `has_role(auth.uid(),'ADMIN')` SELECT policies (organizations, organization_domains, organization_aliases), additive alongside existing member-scoped policies, TEST-only
- `src/services/admin-organizations.service.ts` - `listAllOrganizations`, `mergeOrganizations`, `unclaimOrganizationDomain`, `AdminOrganizationsError`
- `src/hooks/useAdminOrganizations.ts` - `useAdminOrganizations` query, `useMergeOrganizations`/`useUnclaimOrganizationDomain` mutations
- `src/lib/query-config.ts` - added `adminOrganizations` key factory (`list()`), sibling to `organizationIdentity`, that block left untouched
- `src/pages/admin/OrganizationsSection.tsx` - admin org table + `AdminOrganizationRow` (per-row Collapsible expand) + dialog wiring
- `src/components/dialogs/MergeOrganizationsDialog.tsx` - type-to-confirm reversible-merge dialog
- `src/components/dialogs/UnclaimDomainDialog.tsx` - lightweight unclaim-confirm dialog
- `src/components/panes/AdminCategoryPane.tsx` - `'organizations'` added to `AdminCategory` union + `ADMIN_CATEGORIES`
- `src/pages/admin/AdminCenter.tsx` - `OrganizationsSection` import + `renderSection()` case branch

## Decisions Made

- **Admin-read-all RLS policy added as a deviation** (see Deviations below) — the plan's Task 1 text assumed "a normal authenticated read is fine" for `listAllOrganizations()`, but live introspection (both TEST and prod) showed `organizations` has only a member-scoped SELECT policy (`is_organization_member(id, auth.uid())`), no admin bypass. Mirrored the exact already-live `user_profiles."Admins can view all profiles"` pattern rather than inventing a new mechanism.
- **Merge-failure toast copy lives in the hook, not the dialog** — `losingOrganizationName` is threaded through as a mutation variable purely so `useMergeOrganizations`'s `onError` can render the exact UI-SPEC string without a second, redundant toast from the dialog component itself.
- **Row-expand uses two sibling `<tr>`s with `Collapsible.Root`/`Content` scoped only to the second row's `<td>`** — not one `Collapsible.Root` wrapping both rows, since Radix's `Collapsible.Root`/`Content` render `<div>`s that are not valid direct children of a `<tbody>` alongside `<tr>` siblings.
- **Search matches org name or domain substring only** (not aliases) — matches the UI-SPEC empty-state copy "Try a different name or domain" literally; no extra filter dropdowns added since none were specified for this table (unlike Users' role/plan filters).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added an admin-read-all RLS policy for organizations/organization_domains/organization_aliases**

- **Found during:** Task 1, before writing the service file, while reasoning about how `listAllOrganizations()` could return "all organizations" as the plan's own `must_haves.truths` requires ("OrganizationsSection lists all orgs with search/filter").
- **Issue:** Live introspection against both TEST (`swjzxiddcrtaqixsfaac`) and prod (`vltmrnjsubfzrgrtdqey`) via `supabase db query --linked` confirmed the only SELECT policy on `organizations` is `"Users can view organizations they belong to"` (`is_organization_member(id, auth.uid())`) — there is no ADMIN-role bypass. `organization_domains`/`organization_aliases` (Plan 01) likewise only have a member-scoped SELECT policy. A platform ADMIN operator is not necessarily a member of every organization on the platform (the same non-goal this whole milestone's threat model repeatedly protects — "a platform operator merging two customer orgs is not necessarily a member of either", 36-PATTERNS.md). Implementing `listAllOrganizations()` as a plain client `.from('organizations').select()` per the plan's literal Task 1 text ("a normal authenticated read is fine") would have silently returned only the orgs the signed-in admin personally belongs to — not "all organizations" as required, with no error to signal the gap.
- **Fix:** Added migration `20260909000000_add_admin_read_all_organizations_policy.sql` — three new `CREATE POLICY ... FOR SELECT TO authenticated USING (has_role(auth.uid(), 'ADMIN'::app_role))` policies, one per table. This is additive alongside the existing member-scoped policies (Postgres RLS policies for the same command are OR'd, so non-admin visibility is completely unchanged) and mirrors the already-live `user_profiles."Admins can view all profiles"` policy verbatim — same authority tier, no new helper function, no change to `is_organization_member`/`is_organization_admin_or_owner` (the phase-wide non-goal). Read-only: admin write authority remains exclusively the has_role-gated edge functions from Plan 04.
- **Files modified:** `supabase/migrations/20260909000000_add_admin_read_all_organizations_policy.sql`
- **Verification:** Applied to TEST via `supabase db push --linked`; live introspection (`pg_policies`) confirmed all 3 policies present with the correct `has_role(auth.uid(), 'ADMIN'::app_role)` qual and `{authenticated}` role. CLI relinked back to prod (`vltmrnjsubfzrgrtdqey`) and confirmed via `supabase/.temp/project-ref` immediately after, per this phase's established TEST-then-prod discipline.
- **Committed in:** `3c8157da` (Task 1 commit)
- **Downstream flag for Plan 06:** this migration must be included in Plan 06's prod-apply sweep alongside Plans 01/02's migrations — it is not yet live in production. Plan 06's own must-have ("All four Phase 36 migrations are applied to production") should become "all five" to account for this one, or this migration should be folded into that count explicitly when Plan 06 executes.

---

**Total deviations:** 1 auto-fixed (1 missing-authorization gap, self-contained to a new additive migration; zero impact on any existing policy, RLS choke-point function, or file outside this plan's own scope)
**Impact on plan:** No scope creep — the fix only adds read authority for the platform-ADMIN role, mirroring an already-shipped pattern exactly. Without it, Task 1's own acceptance criterion (a working "list all organizations" data layer) could not have been genuinely satisfied — the code would type-check and lint clean while silently returning wrong data for any admin who isn't a member of every org.

## Issues Encountered

None beyond the deviation above.

## Threat Flags

| Flag | File | Description |
|------|------|--------------|
| threat_flag: new-read-authority | `supabase/migrations/20260909000000_add_admin_read_all_organizations_policy.sql` | New RLS SELECT surface not enumerated in this plan's own `<threat_model>` (which only covers the merge/unclaim write paths, T-36-17..19). Grants `has_role(ADMIN)` full read access to every row of `organizations`/`organization_domains`/`organization_aliases`, platform-wide. Read-only, additive, mirrors the already-live `user_profiles` admin-bypass policy — same authority tier as an existing, accepted pattern, not a new privilege class. |

## User Setup Required

None — no external service configuration required. This plan is pure frontend plus one additive RLS-policy migration against already-TEST-applied backend surface from Plans 01/02/04; no new environment variables, no edge function deploys (Plan 04 already shipped those, deploy-deferred to prod). The new migration is TEST-only, exactly like every other schema change in this phase — prod apply is Plan 06's job.

## Next Phase Readiness

- ORG-03's UI is complete: a platform admin can merge duplicate orgs (type-to-confirm the loser, reversible copy) and unclaim domains from a dedicated Admin Center section, both routed through the has_role-gated edge functions from Plan 04. Consistent with the UI-SPEC's Design System/Copywriting/Color/Typography contracts (Remix Icons only, no `lucide-react`/`framer-motion` — grep-confirmed absent across all new/edited files).
- Plan 06 (prod apply) needs to: (1) apply all Phase 36 migrations to prod, now including this plan's `20260909000000` admin-read-all policy alongside Plans 01/02's; (2) deploy `merge-organizations`/`unclaim-organization-domain` to prod via `--use-api` (Plan 04's job, still pending); (3) regenerate `src/types/supabase.ts` from the live DB, which will also pick up `canonical_organization_id`/`merged_at`/`merged_by` (not yet spliced by hand anywhere, since this plan's frontend code never needed to select those columns directly).
- Live-UI human verification (open `/admin` → Organizations, search, expand a row, trigger a merge and an unclaim, confirm toasts/copy) is deferred to end-of-phase per `human_verify_mode=end-of-phase` — flagged via `human_judgment: true` on the relevant coverage entries above, consistent with how Plans 03 and 04 handled the same deferral.
- No blockers.

## Self-Check: PASSED

- `supabase/migrations/20260909000000_add_admin_read_all_organizations_policy.sql` -- FOUND on disk.
- `src/services/admin-organizations.service.ts` -- FOUND on disk.
- `src/hooks/useAdminOrganizations.ts` -- FOUND on disk.
- `src/pages/admin/OrganizationsSection.tsx` -- FOUND on disk.
- `src/components/dialogs/MergeOrganizationsDialog.tsx` -- FOUND on disk.
- `src/components/dialogs/UnclaimDomainDialog.tsx` -- FOUND on disk.
- `src/lib/query-config.ts` -- FOUND on disk (modified).
- `src/components/panes/AdminCategoryPane.tsx` -- FOUND on disk (modified).
- `src/pages/admin/AdminCenter.tsx` -- FOUND on disk (modified).
- Commit `3c8157da` (Task 1) -- FOUND in `git log`.
- Commit `e209066b` (Task 2) -- FOUND in `git log`.
- Commit `f151f794` (Task 3) -- FOUND in `git log`.
- `node scripts/type-check.mjs` -- `TYPE CHECK PASSED: 0 new errors` (320/320 baseline unchanged, both before and after all 3 tasks).
- `rtk lint` on all 8 new/edited TS/TSX files -- `0 errors` (1 pre-existing `react-refresh/only-export-components` warning on `AdminCategoryPane.tsx`, unrelated to this plan's diff — the file already exported both a component and non-component values before this change).
- `npm run build` -- clean production build, 6.88s, 0 errors.
- `grep -rn "lucide-react\|framer-motion"` across all new/edited files -- zero matches.
- `grep -n "cannot be undone"` in `MergeOrganizationsDialog.tsx` -- zero matches (confirms the plan's prohibition against irreversible-sounding copy).
- Live TEST introspection (`pg_policies`) -- 3 new `has_role(auth.uid(), 'ADMIN'::app_role)` SELECT policies confirmed present on `organizations`/`organization_domains`/`organization_aliases`.
- CLI relinked to prod (`vltmrnjsubfzrgrtdqey`) after the TEST migration apply -- CONFIRMED via `supabase/.temp/project-ref`.

---
*Phase: 36-live-organizations*
*Completed: 2026-09-09*
