---
phase: 36-live-organizations
verified: 2026-09-10T16:05:00Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
---

# Phase 36: Live Organizations Verification Report

**Phase Goal:** Organizations stop being a tenancy label and become claimable canonical entities — without ever conferring capture access.
**Verified:** 2026-09-10T16:05:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `organization_domains` + `organization_aliases` tables exist, additive, both optional (ORG-01) | ✓ VERIFIED | `supabase/migrations/20260908130000_create_organization_domains_and_aliases.sql` — both `CREATE TABLE`s exist; `UNIQUE INDEX organization_domains_domain_unique` (global, `LOWER(domain)`) and `organization_aliases_org_alias_unique` (per-org, `organization_id, LOWER(alias)`) confirmed present |
| 2 | Domain claim via `claim_organization_domain` with FORBIDDEN/BLOCKLISTED/NO_VERIFIED_EMAIL/CONFLICT codes, conflict never names holding org (ORG-02) | ✓ VERIFIED | `20260908130001_create_org_identity_self_serve_rpcs.sql` implements all 4 codes; `src/test/claim-organization-domain-rpc.integration.test.ts` — 10/10 tests pass live against TEST DB, including "response never names the holding org" |
| 3 | Both new tables have FORCE ROW LEVEL SECURITY; non-member reads zero rows | ✓ VERIFIED | Prod introspection (`pg_class.relrowsecurity`/`relforcerowsecurity`) confirms `true`/`true` for both tables on `vltmrnjsubfzrgrtdqey`. Tables registered in `CROSS_ORG_TABLES` in `rls-regression.test.ts` (lines 84-85) |
| 4 | Alias add/remove gated to admin/owner via RPC only, no client INSERT/DELETE policy | ✓ VERIFIED | `add_organization_alias`/`remove_organization_alias` check role via `is_organization_admin_or_owner`-equivalent FORBIDDEN branch; integration tests prove non-admin rejection (FORBIDDEN, row survives) and admin success |
| 5 | `canonical_organization_id`/`merged_at`/`merged_by` additive columns, NULL = canonical root (ORG-03) | ✓ VERIFIED | `20260908140000_add_canonical_organization_id.sql` — `ADD COLUMN IF NOT EXISTS` (nullable, self-FK CHECK `!= id`), applied to prod |
| 6 | `merge_organizations_atomic` touches ONLY the losing org's pointer columns; reversible by clearing them; chain/cycle prevented | ✓ VERIFIED | Prod `pg_get_functiondef` shows single `UPDATE organizations SET canonical_organization_id/merged_at/merged_by ... WHERE id = p_losing_org_id`, nothing else. Trigger `organizations_prevent_canonical_chain` confirmed attached to `organizations` on prod. `src/test/org-merge-unclaim-rpc.integration.test.ts` — 7/7 pass in isolation (merge pointer set, FK-non-rewrite, restore-on-clear, both chain-rejection cases, unclaim happy/non-admin paths) |
| 7 | `merge_organizations_atomic`/`unclaim_organization_domain_atomic` gated on `has_role(p_admin_user_id,'ADMIN')`; EXECUTE revoked from PUBLIC/anon/authenticated | ✓ VERIFIED | Prod `pg_proc.proacl` for both functions = `{postgres=X/postgres,service_role=X/postgres}` only — anon/authenticated confirmed absent |
| 8 | A member of Org B / merged-away Org C cannot read Org A's recordings despite claimed domain / merge (ORG-04, the central invariant) | ✓ VERIFIED | Bespoke `canonical_organization_id` no-leak block in `src/test/rls-regression.test.ts` (lines ~1049-2100) — full 75-test RLS regression suite passes live against TEST DB, including this block |
| 9 | `is_organization_member`/`is_organization_admin_or_owner` byte-for-byte unchanged, never reference `canonical_organization_id` | ✓ VERIFIED | Prod `pg_get_functiondef()` for both functions shows only `organization_memberships` lookups — no reference to `canonical_organization_id` anywhere in either body |
| 10 | Edge functions `merge-organizations`/`unclaim-organization-domain` verify JWT, check `has_role`, call RPC with server-verified `p_admin_user_id`, use shared `authenticateRequest`/`getCorsHeaders`, Zod-validate payloads | ✓ VERIFIED | Both `index.ts` files import `authenticateRequest`, `getCorsHeaders`, `z` (zod); `p_admin_user_id: authResult.userId` (never client-supplied); deployed **ACTIVE** on prod (`vltmrnjsubfzrgrtdqey`) per `supabase functions list`; 9/9 integration tests pass (401 no-auth, 403 non-admin, 400 malformed payload, happy path, self-merge rejection) |
| 11 | Row-count guards (WR-01 fix) live: RPCs raise on zero-row UPDATE/DELETE instead of silent false-success | ✓ VERIFIED | `20260909010000_fix_merge_unclaim_rpc_row_count_guards.sql` applied to prod (`supabase migration list --linked` shows Local==Remote through this migration); prod `pg_get_functiondef(merge_organizations_atomic)` confirms `IF NOT FOUND THEN RAISE EXCEPTION` present |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260908130000_...` | domains+aliases tables, RLS | ✓ VERIFIED | Applied to prod, FORCE RLS confirmed live |
| `supabase/migrations/20260908130001_...` | self-serve claim/alias RPCs | ✓ VERIFIED | Applied to prod |
| `supabase/migrations/20260908140000_...` | canonical pointer + chain trigger | ✓ VERIFIED | Applied to prod, trigger confirmed attached |
| `supabase/migrations/20260908140001_...` | merge/unclaim admin RPCs | ✓ VERIFIED | Applied to prod, REVOKE confirmed |
| `supabase/migrations/20260909010000_...` | WR-01 row-count guard fix | ✓ VERIFIED | Applied to prod, function body confirms guard |
| `src/services/organization-identity.service.ts` | claim/list/alias service fns | ✓ VERIFIED | Exists |
| `src/hooks/useOrganizationIdentity.ts` | query+mutations hook | ✓ VERIFIED | Exists; WR-02 fix confirmed (no duplicate toast on claim error) |
| `src/components/settings/OrganizationIdentitySection.tsx` | Identity settings UI | ✓ VERIFIED | Wired into `OrganizationsTab.tsx` (import + render, gated by `canManageOrg`) |
| `src/components/shared/VerifiedDomainBadge.tsx` | domain badge+popover | ✓ VERIFIED | Exists; WR-03 fix confirmed (`onClick` → `setOpen(true)`) |
| `supabase/functions/merge-organizations/index.ts` | admin-gated merge fn | ✓ VERIFIED | Deployed ACTIVE on prod |
| `supabase/functions/unclaim-organization-domain/index.ts` | admin-gated unclaim fn | ✓ VERIFIED | Deployed ACTIVE on prod |
| `src/pages/admin/OrganizationsSection.tsx` | Admin org table + merge/unclaim UI | ✓ VERIFIED | Wired into `AdminCenter.tsx` renderSection + `AdminCategoryPane.tsx` nav (`RiBuilding4Line`) |
| `src/components/dialogs/MergeOrganizationsDialog.tsx` | type-to-confirm reversible merge dialog | ✓ VERIFIED | Non-irreversible copy confirmed ("Recordings and memberships are not moved... reversible by clearing the pointer") |
| `src/components/dialogs/UnclaimDomainDialog.tsx` | lightweight unclaim dialog | ✓ VERIFIED | Copy confirmed ("will lose its verified badge... can be re-claimed") |
| `src/types/supabase.ts` | regenerated types | ✓ VERIFIED | Contains `organization_domains` type block |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `claim_organization_domain` | verified email ownership | `identity_aliases` check | ✓ WIRED | RPC body checks `alias_type='email' AND verified=true` |
| `organization_domains` SELECT policy | `is_organization_member` | member visibility | ✓ WIRED | Confirmed via prod function + RLS test suite |
| `merge_organizations_atomic` | `has_role` | admin gate by parameter | ✓ WIRED | Confirmed live on prod, tests pass |
| `merge-organizations` edge fn | `merge_organizations_atomic` | service-role RPC call, `p_admin_user_id = authResult.userId` | ✓ WIRED | Confirmed in source + prod deployment + integration test |
| `OrganizationIdentitySection` | `OrganizationsTab` Card | render before `WorkspaceManagement`, gated `canManageOrg` | ✓ WIRED | Confirmed in diff |
| `OrganizationsSection` | `AdminCenter`/`AdminCategoryPane` | new "organizations" category + switch branch | ✓ WIRED | Confirmed |
| `MergeOrganizationsDialog`/`UnclaimDomainDialog` | edge functions | `supabase.functions.invoke` via `useAdminOrganizations` | ✓ WIRED | Confirmed via hook grep |

### Behavioral Spot-Checks / Live Test Execution

| Suite | Command | Result | Status |
|-------|---------|--------|--------|
| RLS regression (full, incl. ORG-04 canonical no-leak) | `npx vitest run src/test/rls-regression.test.ts` | 75/75 passed | ✓ PASS |
| Claim/alias RPC integration | `npx vitest run src/test/claim-organization-domain-rpc.integration.test.ts` | 10/10 passed | ✓ PASS |
| Merge/unclaim RPC integration | `npx vitest run src/test/org-merge-unclaim-rpc.integration.test.ts` | 7/7 passed | ✓ PASS |
| merge-organizations + unclaim-organization-domain edge fn integration | `npx vitest run supabase/functions/.../*.integration.test.ts` | 9/9 passed | ✓ PASS |

Note: running all four integration files concurrently in one vitest invocation produced 5 failures due to cross-file test pollution on the shared TEST database (order-dependent `afterAll` cleanup racing across files) — this is a pre-existing test-infra characteristic of this repo's integration suite, not a Phase 36 code defect. Re-running each file in isolation (the suite's actual `test:integration` execution model) produced 100% pass across all 26 relevant tests, confirmed above.

### Production Verification (live introspection)

- `supabase migration list --linked` (linked to `vltmrnjsubfzrgrtdqey`, confirmed via `supabase/.temp/project-ref`): Local==Remote through `20260909010000` — all 6 Phase 36 migrations (4 core + admin-read-all policy + WR-01 fix) applied.
- `organization_domains`/`organization_aliases`: `relrowsecurity=true`, `relforcerowsecurity=true` on prod.
- `merge_organizations_atomic`/`unclaim_organization_domain_atomic`: `proacl = {postgres=X/postgres,service_role=X/postgres}` — anon/authenticated confirmed absent on prod.
- `organizations_prevent_canonical_chain` trigger confirmed attached to `organizations` table on prod.
- `is_organization_member`/`is_organization_admin_or_owner` function bodies pulled live from prod — no reference to `canonical_organization_id` in either.
- `merge_organizations_atomic` body pulled live from prod — contains the WR-01 `IF NOT FOUND THEN RAISE EXCEPTION` guard.
- `merge-organizations` and `unclaim-organization-domain` edge functions: `ACTIVE`, version 1, deployed 2026-09-09 21:05 UTC on prod.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| ORG-01 | 36-01, 36-03 | organization_domains/aliases exist, multi-domain/alias capable | ✓ SATISFIED | Tables + UI confirmed |
| ORG-02 | 36-01, 36-03 | Org claimed/verified via domain ownership | ✓ SATISFIED | RPC + UI + tests confirmed |
| ORG-03 | 36-02, 36-04, 36-05 | Non-destructive reversible merge via canonical_organization_id | ✓ SATISFIED | Migration + RPCs + edge fns + admin UI + tests confirmed |
| ORG-04 | 36-02 | Org association confers no capture access, RLS-enforced | ✓ SATISFIED | Bespoke RLS test block passes live; choke-point functions confirmed unchanged on prod |

No orphaned requirements — all 4 REQUIREMENTS.md IDs for Phase 36 (ORG-01..04) are claimed across plans 01-05 and independently verified above.

### Anti-Patterns Found

None. Scanned all Phase 36 key files (services, hooks, components, dialogs, edge functions) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/"not yet implemented" — zero matches.

`npx tsc -p tsconfig.app.json --noEmit` shows pre-existing errors in `OrganizationsTab.tsx` (lines 83, 171) and elsewhere — confirmed via `git show` on the Phase 36 commit (`4a0d75c5`) that these lines/errors predate this phase's diff (the phase only added an import and a new `<CardContent>` block); zero new errors attributable to Phase 36's own files.

### Human Verification Required

None. All must-haves are either verified via live prod introspection, live TEST-DB integration test execution, or direct source inspection. No visual/UX-only claims remain unverified — the UI-SPEC copy contract items (exact error strings, dialog copy) were verified via grep against actual rendered strings, not just PLAN intent.

### Gaps Summary

No gaps. All 4 requirement IDs (ORG-01 through ORG-04) are satisfied with evidence spanning migrations, RLS, RPCs, edge functions, frontend wiring, and passing live tests against both TEST and confirmed-applied production state. The WR-01/WR-02/WR-03 code-review fixes are all confirmed live in source and (for WR-01, the DB-level fix) on production.

---

_Verified: 2026-09-10T16:05:00Z_
_Verifier: Claude (gsd-verifier)_
