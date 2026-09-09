---
phase: 36-live-organizations
plan: 03
subsystem: ui
tags: [react, tanstack-query, supabase, organizations, identity, shadcn, remix-icons]

# Dependency graph
requires:
  - phase: 36-01
    provides: organization_domains/organization_aliases tables + claim_organization_domain/add_organization_alias/remove_organization_alias SECURITY DEFINER RPCs (JSONB {success, code} contract)
provides:
  - "src/services/organization-identity.service.ts -- listOrganizationDomains, listOrganizationAliases, claimOrganizationDomain, addOrganizationAlias, removeOrganizationAlias, OrganizationIdentityError"
  - "src/hooks/useOrganizationIdentity.ts -- queries (domains/aliases, lazy-fetchable via an enabled param) + 3 mutations with toast + invalidation"
  - "src/components/settings/OrganizationIdentitySection.tsx -- aliases row-list + remove, domain-claim toggle-form, rendered inside OrganizationsTab's per-org Card"
  - "src/components/shared/VerifiedDomainBadge.tsx -- on-demand popover listing every verified domain, lazy-gated on popover open"
  - "organizationIdentity query-key factory in query-config.ts (domains/aliases per org id)"
  - "organization_domains/organization_aliases tables + the three Phase 36-01 RPCs spliced into src/types/supabase.ts's generated Database type (Plan 01 shipped these to TEST but never regenerated types -- this plan's frontend code could not otherwise compile)"
affects: [36-05-admin-org-merge-unclaim-ui, 36-06-prod-apply]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RPC returns a JSONB {success, code} soft-failure contract (no message field) -- the service throws a generic-message OrganizationIdentityError carrying .code, and the CONSUMING COMPONENT owns the exact per-code UI-SPEC copy (not the service), since the RPC supplies no server-authored message to relay"
    - "useOrganizationIdentity(organizationId, enabled=true) takes an optional second param so the SAME hook backs both an always-on settings section (OrganizationIdentitySection) and a lazy-fetch-on-popover-open badge (VerifiedDomainBadge), mirroring useIdentityEvidence's enabled-gate convention instead of forking a second hook"
    - "Hand-spliced generated-types delta (not a wholesale supabase gen types regeneration) for a mid-phase plan that needs to compile against tables/RPCs an earlier plan in the same phase already shipped to TEST -- same technique Plan 34-02 used for identity_aliases"

key-files:
  created:
    - src/services/organization-identity.service.ts
    - src/hooks/useOrganizationIdentity.ts
    - src/components/settings/OrganizationIdentitySection.tsx
    - src/components/shared/VerifiedDomainBadge.tsx
  modified:
    - src/lib/query-config.ts
    - src/types/supabase.ts
    - src/components/settings/OrganizationsTab.tsx

key-decisions:
  - "OrganizationIdentitySection's own heading shows the organization's actual name (not a generic 'Organization Identity' label) with VerifiedDomainBadge mounted directly beside it -- UI-SPEC's Scope section, Implementation Pointers, must_haves.truths, AND Task 3's human-check all independently describe the badge as living 'next to the org name'; since the badge is a single aggregate indicator (not tied to any one row in a possibly-multi-domain list), the section heading is the only unambiguous single mount point that satisfies all four references literally."
  - "Domain sub-block renders a row-list (one <li> per domain: domain text + 'Claimed {date}', no per-row badge) to satisfy the UI Considerations table's explicit zero-one-many requirement ('1+ -> row list') for orgs with more than one claimed domain, rather than the single-row reading of the Copywriting Contract's populated-row bullet taken in isolation."
  - "Claim-error copy (CONFLICT/NO_VERIFIED_EMAIL/BLOCKLISTED/FORBIDDEN -> exact UI-SPEC string) lives in OrganizationIdentitySection.tsx, not the service -- Task 2's action text explicitly assigns this mapping to the component, and the RPC itself returns no message field to relay."
  - "OrganizationIdentitySection is rendered unconditionally for both personal and business orgs (not gated to selectedOrg.type === 'business' the way the pre-existing cross-org-default block is) -- aliases and domain claims are meaningful for any org type, and nothing in the plan restricted this to business orgs."

requirements-completed: [ORG-01, ORG-02]

coverage:
  - id: D1
    description: "Data layer: organization-identity service (5 functions + OrganizationIdentityError, branching on data.success) + useOrganizationIdentity hook (queries + 3 toast/invalidate mutations) + organizationIdentity query-key factory"
    requirement: "ORG-01"
    verification:
      - kind: other
        ref: "node scripts/type-check.mjs (baseline-gated tsc -p tsconfig.app.json --noEmit) -- 0 new errors"
        status: pass
      - kind: other
        ref: "grep organization-identity.service.ts: 8 exports present, data?.success branch confirmed at assertRpcSuccess"
        status: pass
    human_judgment: false
  - id: D2
    description: "OrganizationIdentitySection UI: aliases add/remove (canManage-gated), domain-claim toggle-form sourcing candidates from useIdentityAliases, exact per-code error copy, empty/loading/error states, attached inside OrganizationsTab's per-org Card"
    requirement: "ORG-01"
    verification:
      - kind: other
        ref: "node scripts/type-check.mjs + rtk lint OrganizationIdentitySection.tsx OrganizationsTab.tsx -- 0 new errors, 0 lint issues"
        status: pass
      - kind: other
        ref: "grep: literal CONFLICT string present (not interpolated), useIdentityAliases imported+used, canManage gates present, RiCloseLine remove button present"
        status: pass
    human_judgment: true
    rationale: "The plan's own Task 2 <human-check> defers live-UI verification (aliases add/remove flow, domain-claim Select against real verified-email domains, exact conflict copy against a real already-claimed domain) to end-of-phase per this project's human_verify_mode=end-of-phase config. Automated checks prove it compiles, lints, and contains the right literals/gates -- not that the interactive flow behaves correctly against live data."
  - id: D3
    description: "Domain-claim self-serve path (ORG-02): claim_organization_domain wired end-to-end from candidate-domain derivation through to per-code UI-SPEC error copy"
    requirement: "ORG-02"
    verification:
      - kind: other
        ref: "grep: claimErrorCopy maps CONFLICT/NO_VERIFIED_EMAIL/BLOCKLISTED/FORBIDDEN to the exact UI-SPEC Copywriting Contract strings"
        status: pass
    human_judgment: true
    rationale: "Same end-of-phase human-check deferral as D2 -- claiming a domain you own and claiming an already-claimed domain are both live-data interactive flows the plan defers to a human."
  - id: D4
    description: "VerifiedDomainBadge: on-demand popover next to the org name listing every verified domain, lazy-fetched only on open"
    requirement: "ORG-02"
    verification:
      - kind: other
        ref: "node scripts/type-check.mjs + rtk lint VerifiedDomainBadge.tsx -- 0 new errors, 0 lint issues"
        status: pass
      - kind: other
        ref: "grep: RiShieldCheckLine + text-muted-foreground (no text-vibe-orange), enabled gate references `open` directly, domains.map (not a single top pick)"
        status: pass
    human_judgment: true
    rationale: "Task 3's own <human-check> ('hover/click the badge... popover lists all claimed domains') is explicitly deferred to end-of-phase per human_verify_mode=end-of-phase. Automated checks prove the icon/color/gate/iteration contract, not the rendered popover's visual correctness."

duration: 35min
completed: 2026-09-09
status: complete
---

# Phase 36 Plan 03: Organization Identity Settings UI Summary

**Self-serve Organization Identity settings surface (aliases + verified-domain claim via `claim_organization_domain`) wired into `OrganizationsTab`'s per-org Card, plus an on-demand `VerifiedDomainBadge` popover — pure frontend, zero new backend surface, consuming Plan 01's RPCs and RLS-scoped reads.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-09-09T05:29:18Z
- **Tasks:** 3 (all `type="auto"`)
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments

- `organization-identity.service.ts` + `useOrganizationIdentity.ts` + an `organizationIdentity` query-key factory entry — the full data layer for the settings surface, branching on the claim/add/remove RPCs' `{success, code}` soft-failure contract rather than only on thrown errors
- `OrganizationIdentitySection.tsx` — aliases as a row-list with a per-row `RiCloseLine` remove affordance (canManage-gated), and a domain-claim toggle-form whose candidate `<Select>` options derive client-side from `useIdentityAliases()` verified emails (substring after `@`, de-duplicated) — no new backend "list my claimable domains" endpoint
- Exact UI-SPEC error copy wired for all four claim outcomes: CONFLICT (generic, never names the other org — grep-verified as a literal, not an interpolation), NO_VERIFIED_EMAIL (points to Account settings), BLOCKLISTED, FORBIDDEN
- `VerifiedDomainBadge.tsx` — near-verbatim `IdentityEvidenceBadge` structure, lazy-gated on the popover's own `open` state so N org badges never fan out N domain queries on mount, popover iterates every verified domain (not a single top pick)
- Fixed a real gap left by Plan 01: `src/types/supabase.ts` was never regenerated after Plan 01 shipped `organization_domains`/`organization_aliases`/the three RPCs to TEST, which would have blocked this plan's own `.from()`/`.rpc()` calls from compiling — hand-spliced the delta (mirroring the Plan 34-02 precedent) rather than a wholesale regeneration, since Plan 06 already owns the full `supabase gen types --linked` reconciliation once all of Phase 36's schema lands

## Task Commits

Each task was committed atomically:

1. **Task 1: organization-identity service + hook + query keys** - `ce365bc9` (feat)
2. **Task 2: OrganizationIdentitySection + attach into OrganizationsTab** - `4a0d75c5` (feat)
3. **Task 3: VerifiedDomainBadge** - `07e77da7` (feat)

**Plan metadata commit:** pending (this commit)

## Files Created/Modified

- `src/services/organization-identity.service.ts` - 5 exported functions (listOrganizationDomains, listOrganizationAliases, claimOrganizationDomain, addOrganizationAlias, removeOrganizationAlias) + `OrganizationIdentityError`, all mutation functions branch on `data.success === false`
- `src/hooks/useOrganizationIdentity.ts` - `useOrganizationIdentity(organizationId, enabled=true)`: 2 queries + 3 mutations (toast + query-key invalidation on success/error); the `enabled` param lets `VerifiedDomainBadge` reuse the same hook lazily
- `src/lib/query-config.ts` - added `organizationIdentity` key factory (`domains(orgId)`, `aliases(orgId)`)
- `src/types/supabase.ts` - spliced `organization_domains`/`organization_aliases` table types + `claim_organization_domain`/`add_organization_alias`/`remove_organization_alias` function types (Plan 01's tables/RPCs, never previously regenerated into this file)
- `src/components/settings/OrganizationIdentitySection.tsx` - aliases + domain-claim section, nested inside `OrganizationsTab`'s existing per-org `<Card>`
- `src/components/settings/OrganizationsTab.tsx` - renders `<OrganizationIdentitySection>` inside the per-org Card, before `<WorkspaceManagement>`, unconditionally (both personal and business org types)
- `src/components/shared/VerifiedDomainBadge.tsx` - on-demand popover, `RiShieldCheckLine` + `text-muted-foreground`, lazy-fetched on open

## Decisions Made

- **VerifiedDomainBadge mounted once, in the section heading next to the org's actual name** (not per-domain-row) — UI-SPEC describes it as a single aggregate "next to the org name" indicator in four separate places (Scope section, Implementation Pointers, must_haves.truths, Task 3's human-check); a per-row mount would be ambiguous for a multi-domain org.
- **Domain sub-block is a row-list, not a single fixed row** — the UI Considerations table's zero-one-many entry explicitly requires "1+ -> row list" for E2 (Domain), so an org with more than one claimed domain gets one `<li>` per domain (text + "Claimed {date}"), consistent with the Aliases list's structure.
- **Claim-error code-to-copy mapping lives in the component, not the service** — the RPC returns `{success, code}` with no message field at all, and Task 2's action text explicitly assigns the exact-copy mapping to the component; the service's `OrganizationIdentityError.message` is a generic fallback used only by the hook's ambient toast.
- **Section renders for both personal and business orgs** — nothing in the plan restricts aliases/domain-claim to business orgs, so it's unconditional (unlike the pre-existing cross-org-default block, which is business-only).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Spliced Plan 01's tables/RPCs into `src/types/supabase.ts`, which Plan 01 never regenerated**

- **Found during:** Task 1, before writing the service file
- **Issue:** Plan 01 (36-01) created `organization_domains`/`organization_aliases` and the three self-serve RPCs on TEST, but its own SUMMARY's `key-files.modified` list does not include `src/types/supabase.ts`, and a grep confirmed zero matches for any of the five new identifiers in the generated `Database` type. Without this, every `.from('organization_domains'|'organization_aliases')` and `.rpc('claim_organization_domain'|'add_organization_alias'|'remove_organization_alias', ...)` call this plan needs to write would fail to type-check against the typed `supabase` client (`createClient<Database>(...)`), blocking Task 1's own acceptance criterion ("Type-check passes").
- **Fix:** Hand-spliced the delta directly into `src/types/supabase.ts` — two table entries (`organization_aliases`, `organization_domains`, alphabetically ordered, `Row`/`Insert`/`Update`/`Relationships` shaped exactly per the live migration columns) and three function entries (`add_organization_alias`, `claim_organization_domain`, `remove_organization_alias`, `Args`/`Returns: Json` shaped per the live RPC signatures), inserted at their alphabetically-correct positions to match the generator's own convention. This mirrors the Plan 34-02 precedent ("TEST-generated types file rejected wholesale... spliced only the identity-spine delta onto a prod-verified baseline instead") rather than running a full `supabase gen types typescript --linked` regeneration, which risks pulling in unrelated drift and duplicates work Plan 06 already owns as its own must-have ("`src/types/supabase.ts` is regenerated from the live DB... and reconciled").
- **Files modified:** `src/types/supabase.ts`
- **Verification:** `node scripts/type-check.mjs` → `TYPE CHECK PASSED: 0 new errors` both immediately after the splice and after every subsequent task's files were added.
- **Committed in:** `ce365bc9` (Task 1 commit)
- **Downstream flag for Plan 06:** when Plan 06 runs its full `supabase gen types typescript --linked` regeneration, this hand-spliced delta will be superseded/reconciled automatically — no manual cleanup should be needed since the live DB will already have these exact tables/RPCs (assuming Plan 06 applies Plan 01's migrations to prod first, which its own must-haves already require).

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No scope creep — the fix only added type definitions describing backend surface Plan 01 already shipped to TEST; it did not touch any runtime behavior, migration, or RLS policy. Without it, none of this plan's three tasks could have type-checked.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None - no external service configuration required. This plan is pure frontend against already-TEST-applied backend surface from Plan 01; no new environment variables, no migrations, no edge function deploys.

## Next Phase Readiness

- ORG-01/ORG-02 UI is complete and consistent with the UI-SPEC's Design System/Copywriting/Color/Typography contracts (Remix Icons only, no `lucide-react`/`framer-motion`, no positive "AI-powered" copy — all grep-confirmed absent).
- Plan 05 (admin merge/unclaim UI, `depends_on: [36-03, 36-04]`) can proceed — it does not consume any artifact from this plan directly (its own service/hook/query-keys are separate), but shares the `OrganizationsTab.tsx` file, so future edits there should preserve the `OrganizationIdentitySection` attachment point (inside the per-org `<Card>`, before `<WorkspaceManagement>`).
- Plan 06 (prod apply) must regenerate `src/types/supabase.ts` from the live DB as its own must-have already requires — see the Downstream flag above; this plan's hand-spliced delta is a bridge, not a permanent fixture.
- Live-UI human verification (aliases add/remove, domain-claim against real verified emails, conflict-copy against a real already-claimed domain, badge popover) is deferred to end-of-phase per `human_verify_mode=end-of-phase` — flagged via `human_judgment: true` on the relevant coverage entries above, not re-litigated here.
- No blockers.

## Self-Check: PASSED

- `src/services/organization-identity.service.ts` -- FOUND on disk.
- `src/hooks/useOrganizationIdentity.ts` -- FOUND on disk.
- `src/components/settings/OrganizationIdentitySection.tsx` -- FOUND on disk.
- `src/components/shared/VerifiedDomainBadge.tsx` -- FOUND on disk.
- `src/lib/query-config.ts` -- FOUND on disk (modified).
- `src/types/supabase.ts` -- FOUND on disk (modified).
- `src/components/settings/OrganizationsTab.tsx` -- FOUND on disk (modified).
- Commit `ce365bc9` (Task 1) -- FOUND in `git log`.
- Commit `4a0d75c5` (Task 2) -- FOUND in `git log`.
- Commit `07e77da7` (Task 3) -- FOUND in `git log`.
- `node scripts/type-check.mjs` -- `TYPE CHECK PASSED: 0 new errors` (320/320 baseline errors unchanged, all pre-existing).
- `rtk lint` on all 4 new/edited component+hook+service files -- `ESLint: No issues found`.
- `grep -rn "lucide-react\|framer-motion"` across all new/edited files -- zero matches.
- `grep -rn "AI-powered"` across all new/edited files -- zero matches.

---
*Phase: 36-live-organizations*
*Completed: 2026-09-09*
