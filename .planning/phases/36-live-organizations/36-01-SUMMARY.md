---
phase: 36-live-organizations
plan: 01
subsystem: database
tags: [postgres, rls, security-definer, supabase, organizations, identity]

# Dependency graph
requires:
  - phase: 34-identity-consolidation
    provides: identity_aliases verified-email spine (alias_type='email', verified=true) reused as the domain-ownership proof mechanism
provides:
  - organization_domains table (global, case-insensitive UNIQUE(LOWER(domain)), no verified boolean -- every row a confirmed claim by construction)
  - organization_aliases table (per-org, case-insensitive UNIQUE(organization_id, LOWER(alias)), NOT global)
  - claim_organization_domain(uuid, text) SECURITY DEFINER RPC -- FORBIDDEN/BLOCKLISTED/NO_VERIFIED_EMAIL/CONFLICT/success contract
  - add_organization_alias(uuid, text) / remove_organization_alias(uuid) SECURITY DEFINER RPCs
  - organization_domains + organization_aliases registered in rls-regression.test.ts CROSS_ORG_TABLES
  - phase-wide schema/contract decision locked (option-a) for Plans 02-06
affects: [36-02-org-merge-canonical-pointer, 36-03-frontend-org-identity-settings, 36-06-prod-apply]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SECURITY DEFINER RPC returning a JSONB {success, code} contract instead of raising raw Postgres errors -- lets the client distinguish FORBIDDEN/BLOCKLISTED/NO_VERIFIED_EMAIL/CONFLICT instead of one opaque constraint-violation"
    - "Existence-before-authorization ordering in remove_organization_alias: NOT_FOUND is checked before the admin-gate so a caller never gets FORBIDDEN for a resource that does not exist"
    - "Real UNIQUE index as the race-safe uniqueness guarantee; the RPC's own pre-check is a UX nicety, unique_violation is always caught and mapped to a generic code"

key-files:
  created:
    - supabase/migrations/20260908130000_create_organization_domains_and_aliases.sql
    - supabase/migrations/20260908130001_create_org_identity_self_serve_rpcs.sql
    - src/test/claim-organization-domain-rpc.integration.test.ts
  modified:
    - src/test/rls-regression.test.ts

key-decisions:
  - "Task 1 reversibility gate auto-resolved to option-a (RESEARCH.md defaults) -- config.json mode=yolo, workflow.auto_advance=true, gate=\"blocking\" (not \"blocking-human\"), so the planner's own front-loaded recommended option was taken with no knob changes."
  - "Dual-membership sub-decision locked: the future merge RPC (Plan 02) touches ONLY organizations.canonical_organization_id/merged_at/merged_by -- does NOT reconcile organization_memberships."
  - "Critical non-goal locked and carried forward to Plans 02/06: is_organization_member/is_organization_admin_or_owner remain byte-for-byte unrelated to canonical_organization_id -- never dereferenced in any RLS choke point."
  - "remove_organization_alias checks alias existence (NOT_FOUND) BEFORE the admin-gate (FORBIDDEN) -- the plan's action text left this ordering ambiguous; chose the ordering that never returns FORBIDDEN for a non-existent resource."

requirements-completed: [ORG-01, ORG-02]

coverage:
  - id: D1
    description: "organization_domains + organization_aliases tables exist, forced-RLS, registered in the CI cross-org isolation gate"
    requirement: "ORG-01"
    verification:
      - kind: integration
        ref: "src/test/rls-regression.test.ts#cross-org RLS isolation (organization_domains, organization_aliases entries)"
        status: pass
    human_judgment: false
  - id: D2
    description: "claim_organization_domain resolves success + FORBIDDEN + BLOCKLISTED + NO_VERIFIED_EMAIL + CONFLICT exactly per contract, CONFLICT never names the holding org"
    requirement: "ORG-02"
    verification:
      - kind: integration
        ref: "src/test/claim-organization-domain-rpc.integration.test.ts (5 claim-path tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "add_organization_alias / remove_organization_alias admin-gated (success, duplicate CONFLICT, non-admin FORBIDDEN, non-existent NOT_FOUND path)"
    requirement: "ORG-01"
    verification:
      - kind: integration
        ref: "src/test/claim-organization-domain-rpc.integration.test.ts (5 alias-path tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Phase-wide schema/contract shape (tables, RPC contracts, dual-membership default, canonical_organization_id non-goal) locked for Plans 02-06"
    human_judgment: true
    rationale: "This is a decision-recording deliverable (checkpoint:decision), not a testable behavior -- downstream Plans 02/06 should be reviewed against this locked shape, not re-derived from a passing test."

duration: 20min
completed: 2026-09-09
status: complete
---

# Phase 36 Plan 01: Organization Identity Backend Tracer Summary

**organization_domains/organization_aliases tables plus claim_organization_domain self-serve RPC (verified-email ownership proof, 23-domain blocklist, generic CONFLICT that never names the holding org) proven end-to-end on TEST via RED-GREEN TDD**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-09-09T04:31:08Z
- **Tasks:** 3 (1 decision checkpoint, 1 auto, 1 auto+tdd)
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- Reversibility gate (Task 1) auto-resolved to option-a under yolo/auto_advance, locking the full Phase 36 schema/contract shape (tables, RPC contracts, dual-membership default, `canonical_organization_id` non-goal) for Plans 02-06
- `organization_domains` (global case-insensitive unique domain, no `verified` boolean -- every row a confirmed claim by construction) + `organization_aliases` (per-org case-insensitive unique alias) applied to TEST with `ENABLE` + `FORCE ROW LEVEL SECURITY`, both confirmed via live introspection
- Both tables registered in `rls-regression.test.ts`'s generic `CROSS_ORG_TABLES` loop -- full suite 67/67 green, zero cross-org leak
- `claim_organization_domain` / `add_organization_alias` / `remove_organization_alias` SECURITY DEFINER RPCs implemented via full RED-GREEN TDD cycle -- RED commit proved all 10 assertions fail for the correct reason (function not found) before any implementation existed; GREEN commit made all 10 pass
- Every claim outcome code proven end-to-end on TEST with real JWTs: success (with `LOWER(TRIM(...))` normalization), FORBIDDEN, BLOCKLISTED (case/whitespace-insensitive), NO_VERIFIED_EMAIL, CONFLICT (response body proven to contain neither the holding org's name nor its id)

## Task Commits

Each task was committed atomically:

1. **Task 1: Reversibility gate** - no commit (decision-only checkpoint, auto-resolved, no files changed)
2. **Task 2: organization_domains + organization_aliases tables migration + CROSS_ORG_TABLES registration** - `b7179184` (feat)
3. **Task 3: self-serve RPCs migration + integration proof** - `f414da5f` (test, RED) + `70dc7312` (feat, GREEN)

**Plan metadata commit:** pending (this commit)

## Files Created/Modified

- `supabase/migrations/20260908130000_create_organization_domains_and_aliases.sql` - Two tables, indexes (global unique domain, per-org unique alias), forced RLS, member-SELECT + service-role policies
- `supabase/migrations/20260908130001_create_org_identity_self_serve_rpcs.sql` - `claim_organization_domain`, `add_organization_alias`, `remove_organization_alias` SECURITY DEFINER functions, GRANTed to `authenticated`
- `src/test/claim-organization-domain-rpc.integration.test.ts` - Integration proof of all 10 RPC outcome behaviors against a real TEST DB with real JWTs
- `src/test/rls-regression.test.ts` - Two new `CROSS_ORG_TABLES` entries (`organization_domains`, `organization_aliases`, `filterColumn: "organization_id"`)

## Decisions Made

- **Task 1 reversibility gate auto-resolved to option-a** (RESEARCH.md defaults, recommended) -- `config.json` has `mode: "yolo"` and `workflow.auto_advance: true`; the checkpoint's `gate="blocking"` (not `"blocking-human"`) means auto-mode auto-selects the front-loaded recommended option per the checkpoint protocol. Locked: table shapes exactly as researched; dual-membership default (merge RPC in Plan 02 does NOT touch `organization_memberships`); the critical non-goal that `is_organization_member`/`is_organization_admin_or_owner` never dereference `canonical_organization_id`.
- **`remove_organization_alias` ordering:** checks alias existence (`NOT_FOUND`) before the admin-gate (`FORBIDDEN`). The plan's action text described the sequence ambiguously ("gate ... else FORBIDDEN, DELETE; return NOT_FOUND if no row"); chose existence-first so a caller never receives `FORBIDDEN` about an alias id that simply does not exist, while still race-guarding the DELETE itself with `RETURNING`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected a stale 5-tier role-hierarchy claim from 36-RESEARCH.md**

- **Found during:** Task 3, RED phase (integration test `beforeAll` fixture setup)
- **Issue:** 36-RESEARCH.md's Open Questions section stated `organization_memberships` has a 5-tier role hierarchy (`organization_owner > organization_admin > manager > member > guest`), "confirmed via the live `organization_memberships_role_check` CHECK constraint." My test fixture used `role: "member"` on that basis and hit a real check-constraint violation during `beforeAll` (`new row for relation "organization_memberships" violates check constraint "organization_memberships_role_check"`), blocking every test in the file from reaching its intended RED state.
- **Fix:** Grepped every migration touching `organization_memberships_role_check` and found `20260330200000_align_workspace_roles_5_to_4.sql`, which drops the 5-tier constraint from `20260301000001_rename_vaults_to_workspaces.sql` and replaces it with exactly three values: `organization_owner`, `organization_admin`, `organization_member`. Updated the test fixture to `role: "organization_member"`.
- **Files modified:** `src/test/claim-organization-domain-rpc.integration.test.ts`
- **Verification:** `beforeAll` now succeeds; all 10 tests reach the intended RED state (`PGRST202: function not found`) before implementation, then all 10 pass after GREEN.
- **Committed in:** `f414da5f` (RED phase commit)
- **Downstream flag for Plan 02:** the merge RPC's dual-membership role-precedence logic (if ever built beyond the locked "do not touch memberships" default) must use the real 3-role set (`organization_owner`/`organization_admin`/`organization_member`), not the 5-tier hierarchy 36-RESEARCH.md described.

---

**Total deviations:** 1 auto-fixed (1 blocking, corrects a stale research claim before it could propagate to Plan 02)
**Impact on plan:** No scope creep. The fix corrected a test fixture value and surfaced a real, live schema fact that 36-RESEARCH.md had wrong -- reality over documentation, per project convention.

## Issues Encountered

None beyond the deviation above. One tooling note: the `rtk` vitest reporter's compact summary format (`PASS (0) FAIL (0) skipped (10)`) initially obscured that the suite was failing inside `beforeAll` rather than being environment-skipped; `rtk proxy npx vitest run ...` (raw, unfiltered output) surfaced the actual check-constraint error immediately.

## User Setup Required

None - no external service configuration required. Both migrations applied directly to TEST via the Supabase CLI; CLI confirmed relinked to prod (`vltmrnjsubfzrgrtdqey`) after each task, per the mandatory TEST-then-prod discipline. Nothing in this plan touches production -- prod apply is explicitly Plan 06's job.

## Next Phase Readiness

- The phase's tracer vertical (table -> SECURITY DEFINER RPC -> RLS -> cross-org isolation) is proven end-to-end on TEST. Plans 02-06 can proceed on the locked schema/contract shape.
- Plan 02 (canonical_organization_id + merge/unclaim RPCs) should read this summary's role-hierarchy correction before implementing any dual-membership logic.
- No blockers.

## Self-Check: PASSED

- `supabase/migrations/20260908130000_create_organization_domains_and_aliases.sql` -- FOUND on disk.
- `supabase/migrations/20260908130001_create_org_identity_self_serve_rpcs.sql` -- FOUND on disk.
- `src/test/claim-organization-domain-rpc.integration.test.ts` -- FOUND on disk.
- `src/test/rls-regression.test.ts` -- FOUND on disk (modified).
- Commit `b7179184` (Task 2) -- FOUND in `git log`.
- Commit `f414da5f` (Task 3 RED) -- FOUND in `git log`.
- Commit `70dc7312` (Task 3 GREEN) -- FOUND in `git log`.
- TEST introspection (`supabase db query --linked`): both tables `relrowsecurity=true`/`relforcerowsecurity=true`; all three RPCs `prosecdef=true` with `authenticated_can_execute=true` -- CONFIRMED live against `swjzxiddcrtaqixsfaac`.
- CLI relinked to prod (`vltmrnjsubfzrgrtdqey`) at the end of both Task 2 and Task 3 -- CONFIRMED via `supabase/.temp/project-ref` and `supabase projects list`.
- `npx vitest run src/test/rls-regression.test.ts` -- 67/67 PASS.
- `VITEST_INTEGRATION_OK=true npx vitest run src/test/claim-organization-domain-rpc.integration.test.ts` -- 10/10 PASS.

---
*Phase: 36-live-organizations*
*Completed: 2026-09-09*
