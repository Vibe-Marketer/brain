---
phase: 36-live-organizations
plan: 04
subsystem: api
tags: [supabase, edge-functions, deno, admin, rbac, postgres, zod]

# Dependency graph
requires:
  - phase: 36-02
    provides: "merge_organizations_atomic(p_losing_org_id,p_winning_org_id,p_admin_user_id) + unclaim_organization_domain_atomic(p_domain_id,p_admin_user_id) -- both has_role(ADMIN)-gated, SECURITY DEFINER, EXECUTE revoked from PUBLIC/anon/authenticated (service-role-only)"
provides:
  - "supabase/functions/merge-organizations/index.ts -- has_role(caller,'ADMIN')-gated edge function bridging to merge_organizations_atomic, p_admin_user_id always the JWT-verified caller id"
  - "supabase/functions/unclaim-organization-domain/index.ts -- same has_role gate bridging to unclaim_organization_domain_atomic"
  - "LOCAL_DENO_TEST_PORT pattern -- both edge functions optionally read this env var (default 8000, byte-identical to every other function in the repo when unset) so deploy-deferred `deno run` integration-test suites can bind distinct local ports and coexist in one `npm run test:integration` invocation"
  - "Two deploy-deferred integration test suites (deno run + real HTTP + real signed-in JWTs) proving the has_role gate, the JWT-verified p_admin_user_id wiring, Zod 400s, and generic (non-leaking) error responses end-to-end on TEST"
affects: [36-05-admin-org-merge-unclaim-ui, 36-06-prod-apply]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-client edge-function auth (anon client verifies JWT via authenticateRequest; service-role client does the has_role check + the locked-down RPC call), mirroring admin-manage-user/index.ts exactly -- the sole sanctioned bridge pattern for RPCs whose EXECUTE is revoked from every client role"
    - "Platform-scoped has_role(caller,'ADMIN') gate, never the org-scoped is_organization_admin_or_owner -- a platform operator merging two customer orgs is not necessarily a member of either (36-RESEARCH.md Pitfall 5, this codebase's own prior fix_admin_role_leak incident)"
    - "Uniform generic-error RPC-failure translation: every merge_organizations_atomic/unclaim_organization_domain_atomic error (admin-gate rejection, self-merge rejection, chain-prevention rejection) is console.error'd server-side and surfaced to the client as one short generic message -- never the raw RAISE EXCEPTION text, regardless of which internal rule fired"
    - "LOCAL_DENO_TEST_PORT: an edge function optionally reads a port-override env var (falls back to Deno's own default 8000 when unset) so its local `deno run` deploy-deferred test harness can bind a port distinct from sibling deploy-deferred suites -- production/deploy behavior is untouched since Supabase's Edge Runtime never sets this var and manages its own request dispatch independent of the literal Deno.serve port"

key-files:
  created:
    - supabase/functions/merge-organizations/index.ts
    - supabase/functions/merge-organizations/__tests__/merge-organizations.integration.test.ts
    - supabase/functions/unclaim-organization-domain/index.ts
    - supabase/functions/unclaim-organization-domain/__tests__/unclaim-organization-domain.integration.test.ts
  modified:
    - .gitignore

key-decisions:
  - "admin_audit_log write omitted from both functions (plan marked it 'optional') -- the live table's target_type CHECK constraint only permits ('user','ticket','system'); 'organization'/'organization_domain' are not valid values and widening the constraint would require a migration outside this plan's declared files_modified. Writing the row as the plan's action text literally described would have produced a guaranteed-failing insert (silently swallowed, since audit failures are non-fatal by convention) -- shipping code that predictably always fails a CHECK constraint was judged worse than omitting the optional feature. Flagged below for whoever wants an org-merge/unclaim audit trail next."
  - "Self-merge (losing_organization_id === winning_organization_id) is NOT pre-validated by a Zod .refine() in the edge function -- the plan's own action text frames this as proving the underlying RPC's own rejection reaches the client end-to-end, so the edge function lets merge_organizations_atomic's 'Cannot merge an organization into itself' RAISE EXCEPTION fire and translates it through the same uniform generic-error path as any other RPC failure, rather than duplicating the business rule client-side."
  - "[Rule 1 - Bug, found via direct reproduction] Both edge functions originally used bare Deno.serve(handler), defaulting to port 8000 with no override. Running both new deploy-deferred integration-test suites in the same vitest invocation (exactly what `npm run test:integration` does) raced for port 8000: the loser crashed with AddrInUse, and -- because both functions respond identically to an OPTIONS preflight -- the loser's waitForServer() was fooled into treating the WINNER's server as its own, so its test payloads were silently cross-talking into the wrong function (proven: a merge payload landed on unclaim-organization-domain's Zod schema and got a 400 instead of the expected 200). Fixed by adding an optional LOCAL_DENO_TEST_PORT env var to both index.ts files (default 8000, unchanged everywhere the var is unset, including production) and having each test file pass its own distinct port (8031, 8032) -- also chosen to avoid Phase 35 P03's resolve-speakers.integration.test.ts, which independently hardcodes port 8000. Verified: both suites green individually AND together (9/9), zero orphaned TEST fixtures."

requirements-completed: [ORG-03]

coverage:
  - id: D1
    description: "merge-organizations edge function: verifies JWT, gates on has_role(caller,'ADMIN') (never is_organization_admin_or_owner), calls merge_organizations_atomic via service-role with p_admin_user_id=authResult.userId (never a body value), Zod-validates uuid payload (400 on invalid), generic 500 on RPC failure"
    requirement: "ORG-03"
    verification:
      - kind: integration
        ref: "VITEST_INTEGRATION_OK=true npx vitest run supabase/functions/merge-organizations/__tests__/merge-organizations.integration.test.ts -- 5/5 pass (401 no-auth, 403 non-admin no-op, 400 malformed, 200 admin merge sets canonical_organization_id/merged_at/merged_by, self-merge rejected non-2xx with no mutation) via a real `deno run` spawn of the actual index.ts over real HTTP with real signed-in JWTs against TEST"
        status: pass
      - kind: other
        ref: "grep: authenticateRequest + getCorsHeaders imported (no inline Authorization parsing, no static corsHeaders object), has_role RPC call present, p_admin_user_id: authResult.userId present, merge_organizations_atomic RPC call present"
        status: pass
    human_judgment: false
  - id: D2
    description: "unclaim-organization-domain edge function: same has_role gate, calls unclaim_organization_domain_atomic via service-role with p_admin_user_id=authResult.userId, Zod-validates uuid payload, generic 500 on RPC failure"
    requirement: "ORG-03"
    verification:
      - kind: integration
        ref: "VITEST_INTEGRATION_OK=true npx vitest run supabase/functions/unclaim-organization-domain/__tests__/unclaim-organization-domain.integration.test.ts -- 4/4 pass (401 no-auth, 403 non-admin row-survives, 400 malformed, 200 admin unclaim deletes the row) via the same deploy-deferred deno-run pattern"
        status: pass
      - kind: other
        ref: "grep: same shared-helper + has_role + p_admin_user_id + unclaim_organization_domain_atomic checks as D1, all present"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both integration suites coexist correctly in a single vitest invocation (the shape `npm run test:integration` actually runs) with zero port collision and zero orphaned TEST fixtures"
    requirement: "ORG-03"
    verification:
      - kind: integration
        ref: "VITEST_INTEGRATION_OK=true npx vitest run <both files together> -- 9/9 pass after the LOCAL_DENO_TEST_PORT fix (previously 1/9 failed with cross-talk before the fix, reproduced and documented in Deviations)"
        status: pass
      - kind: other
        ref: "Live TEST introspection: 0 orphaned phase-36-04-tagged organizations/organization_domains rows after the combined run"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-09-09
status: complete
---

# Phase 36 Plan 04: Admin Merge/Unclaim Edge Functions Summary

**has_role(ADMIN)-gated merge-organizations and unclaim-organization-domain edge functions bridging to Plan 02's service-role-only atomic RPCs, proven via deploy-deferred deno-run integration tests with real signed-in JWTs**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-09-09T05:54:00Z
- **Tasks:** 2 (both auto)
- **Files modified:** 5 (4 created, 1 modified: `.gitignore`)

## Accomplishments

- `merge-organizations` and `unclaim-organization-domain` edge functions ship as the sole sanctioned bridge to Plan 02's `merge_organizations_atomic`/`unclaim_organization_domain_atomic` -- both RPCs are `REVOKE EXECUTE`'d from every client role, so these two functions are now the only way either capability is reachable at all. Both mirror `admin-manage-user/index.ts`'s exact dual-client shape: an anon client verifies the caller's JWT via the shared `authenticateRequest` helper, then a service-role client independently checks `has_role(caller,'ADMIN')` -- the platform-scoped gate, never the org-scoped `is_organization_admin_or_owner` that would let an org's own admin/owner merge or unclaim (36-RESEARCH.md Pitfall 5; this codebase has a real shipped incident from exactly that confusion).
- `p_admin_user_id` is always the JWT-verified `authResult.userId`, never a client-supplied body value, in both functions -- confirmed by grep and by test assertion (the merged org's `merged_by` column is asserted to equal the signed-in admin's id, not anything from the request body).
- Both functions Zod-validate their payload (uuid shapes), return 400 on invalid input, and translate every RPC failure -- admin-gate rejection, self-merge rejection, chain-prevention rejection -- into one uniform generic 500 message, never echoing the RPC's raw `RAISE EXCEPTION` text to the client.
- Two deploy-deferred integration test suites (Phase 35 P03's `deno run` + real-HTTP pattern, extended with real signed-in JWTs since these functions authenticate callers, unlike `resolve-speakers`) prove the whole chain end-to-end on TEST: 401 with no Authorization header, 403 with no mutation for a non-admin caller who is deliberately a member of neither org, 400 for a malformed payload, and 200 with the correct DB-state change for a platform admin. 9/9 tests green.
- Found and fixed a real bug via direct reproduction (not speculation): both edge functions' bare `Deno.serve(handler)` calls default to port 8000, so running both new suites in one vitest invocation -- exactly what `npm run test:integration` does -- raced for the port and produced silent cross-talk between the two functions' test servers. Fixed with an optional `LOCAL_DENO_TEST_PORT` env var (default-preserving, production-inert) and distinct ports per test file.

## Task Commits

Each task was committed atomically:

1. **Task 1: merge-organizations edge function + integration test** - `70f76da2` (feat)
2. **Task 2: unclaim-organization-domain edge function + integration test** - `4cb10ee3` (feat)
3. **[Deviation] Fix port-collision bug found during combined-run verification** - `8dd2db03` (fix)

**Plan metadata commit:** pending (this commit)

## Files Created/Modified

- `supabase/functions/merge-organizations/index.ts` - has_role-gated bridge to `merge_organizations_atomic`; Zod `{losing_organization_id, winning_organization_id}` uuid schema; optional `LOCAL_DENO_TEST_PORT` override
- `supabase/functions/merge-organizations/__tests__/merge-organizations.integration.test.ts` - deploy-deferred proof: 401/403/400/200/self-merge-rejected, 5 tests
- `supabase/functions/unclaim-organization-domain/index.ts` - has_role-gated bridge to `unclaim_organization_domain_atomic`; Zod `{domain_id}` uuid schema; optional `LOCAL_DENO_TEST_PORT` override
- `supabase/functions/unclaim-organization-domain/__tests__/unclaim-organization-domain.integration.test.ts` - deploy-deferred proof: 401/403/400/200, 4 tests
- `.gitignore` - ignore `supabase/functions/deno.lock` (auto-generated by local `deno run` test invocations, not part of the `--use-api` deploy pipeline)

## Decisions Made

- **admin_audit_log write omitted (plan marked it optional):** the live table's `target_type` CHECK constraint only allows `('user','ticket','system')` -- `'organization'`/`'organization_domain'` would violate it. Adding those values requires a migration outside this plan's `files_modified`. Rather than ship an audit-log insert that predictably always fails its CHECK constraint (silently, since audit failures are treated as non-fatal by convention -- see `admin-manage-user`'s own pattern), the write was left out entirely. **Downstream flag:** if an audit trail for org merge/unclaim is wanted, a small migration widening `admin_audit_log_target_type_check` to include `'organization'` (and/or `'organization_domain'`) is a clean, additive follow-up -- not attempted here since it touches a file this plan doesn't own.
- **No client-side self-merge pre-check:** the plan's action text explicitly frames the self-merge case as proving `merge_organizations_atomic`'s own rejection reaches the caller through the edge function, so no Zod `.refine()` duplicates that business rule -- the RPC is the single source of truth, and its failure is translated through the same generic-error path as every other RPC failure.
- **[Rule 1 - Bug] Port-collision cross-talk, found via direct reproduction:** see Deviations below for the full account.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a port-collision bug between the two new deploy-deferred integration-test suites**

- **Found during:** Post-Task-2 combined verification (running both new integration test files in one `vitest run` invocation, matching the plan's own `<verification>` block and the shape of `npm run test:integration`)
- **Issue:** Both `merge-organizations/index.ts` and `unclaim-organization-domain/index.ts` used bare `Deno.serve(handler)`, which always binds Deno's default port 8000 with no override -- mirroring every other edge function in this repo. When both suites' `beforeAll` hooks spawned their own `deno run` process concurrently (as vitest's default parallel file execution does), both processes raced to bind port 8000. The loser crashed immediately with `AddrInUse: Address already in use (os error 48)` and exited. Because both functions respond identically to an `OPTIONS` preflight, the loser's `waitForServer()` polling succeeded anyway -- it was unknowingly talking to the WINNER's server. This produced a real, reproduced test failure: a merge-organizations payload (`{losing_organization_id, winning_organization_id}`) was actually delivered to unclaim-organization-domain's server, whose Zod schema (`{domain_id}`) rejected it with 400 instead of the expected 200.
- **Fix:** Added an optional `LOCAL_DENO_TEST_PORT` env var to both `index.ts` files (`Deno.serve({ port: Number(Deno.env.get('LOCAL_DENO_TEST_PORT')) || 8000 }, handler)`) -- falls back to 8000, byte-identical to prior behavior, when the var is unset (which it always is in Supabase's deployed Edge Runtime, and which is true for every OTHER existing edge function in this repo). Each test file now passes its own distinct port when spawning (`merge-organizations` -> 8031, `unclaim-organization-domain` -> 8032), also chosen to avoid colliding with Phase 35 P03's `resolve-speakers.integration.test.ts`, which independently hardcodes port 8000.
- **Files modified:** `supabase/functions/merge-organizations/index.ts`, `supabase/functions/merge-organizations/__tests__/merge-organizations.integration.test.ts`, `supabase/functions/unclaim-organization-domain/index.ts`, `supabase/functions/unclaim-organization-domain/__tests__/unclaim-organization-domain.integration.test.ts`
- **Verification:** Reproduced the failure first (1/9 failing when run together, before the fix), then confirmed both suites green individually (5/5, 4/4) AND together (9/9) after the fix, with zero orphaned TEST fixtures in either run.
- **Committed in:** `8dd2db03` (separate fix commit, since the bug was discovered after Task 1/Task 2's own commits already landed)
- **Downstream flag:** `resolve-speakers.integration.test.ts` (Phase 35 P03) still hardcodes port 8000 with no override in `resolve-speakers/index.ts` itself (out of this plan's scope to touch) -- if that suite is ever run in the same `npm run test:integration` invocation as either of this plan's two suites, it will not collide with them (8031/8032 avoid 8000), but a fourth future deploy-deferred edge-function test would need to pick yet another distinct port, or `resolve-speakers` would need the same `LOCAL_DENO_TEST_PORT` treatment retrofitted.

---

**Total deviations:** 1 auto-fixed (1 bug, self-contained to code this plan itself wrote; zero impact on any file outside this plan's scope)
**Impact on plan:** No scope creep. The bug was in code this plan itself wrote, found via direct reproduction (not speculation) during the plan's own combined verification step, fixed with a minimal and production-inert change, and re-verified green both in isolation and combined.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None - no external service configuration required. Both functions are deploy-deferred (proven on TEST only via `deno run`, never deployed to Supabase Cloud) -- prod deploy is explicitly Plan 06's job, per this plan's own `<verification>` note ("Deploy to prod happens in Plan 06, not here").

## Next Phase Readiness

- ORG-03's admin-only merge/unclaim capability is now reachable end-to-end: platform admin -> edge function (has_role gate) -> service-role-only atomic RPC (Plan 02), proven on TEST with real JWTs, real HTTP, and real DB-state assertions.
- Plan 05 (admin merge/unclaim UI) can call `supabase.functions.invoke('merge-organizations', {...})` / `supabase.functions.invoke('unclaim-organization-domain', {...})` exactly as documented in this plan's `<interfaces>` block -- both return `{success:true}` on success, `{success:false, error}` with 400/403/500 on failure, and never require or accept a client-supplied admin id.
- Plan 06 (prod apply) needs to deploy both new functions (`supabase functions deploy merge-organizations --use-api` / `... unclaim-organization-domain --use-api`) alongside whatever migrations it applies -- neither function exists in production yet.
- Downstream flags (both non-blocking, documented above): (1) an `admin_audit_log` trail for org merge/unclaim would need a small CHECK-constraint-widening migration first; (2) `resolve-speakers.integration.test.ts` (Phase 35) still hardcodes port 8000 and would need the same `LOCAL_DENO_TEST_PORT` treatment if a future deploy-deferred suite needs to run alongside it too.
- No blockers.

## Self-Check: PASSED

- `supabase/functions/merge-organizations/index.ts` -- FOUND on disk.
- `supabase/functions/merge-organizations/__tests__/merge-organizations.integration.test.ts` -- FOUND on disk.
- `supabase/functions/unclaim-organization-domain/index.ts` -- FOUND on disk.
- `supabase/functions/unclaim-organization-domain/__tests__/unclaim-organization-domain.integration.test.ts` -- FOUND on disk.
- Commit `70f76da2` (Task 1) -- FOUND in `git log`.
- Commit `4cb10ee3` (Task 2) -- FOUND in `git log`.
- Commit `8dd2db03` (deviation fix) -- FOUND in `git log`.
- `VITEST_INTEGRATION_OK=true npx vitest run supabase/functions/merge-organizations/__tests__/merge-organizations.integration.test.ts` -- 5/5 PASS.
- `VITEST_INTEGRATION_OK=true npx vitest run supabase/functions/unclaim-organization-domain/__tests__/unclaim-organization-domain.integration.test.ts` -- 4/4 PASS.
- Both suites run together in one invocation -- 9/9 PASS.
- Orphan sweep: 0 leftover organizations/organization_domains rows on TEST matching this plan's fixture tags after the combined run.
- `npm run type-check` -- 0 new errors, baseline unchanged (320/320); confirmed the new files fall outside `tsconfig.app.json`'s `include: ["src"]` scope (as does every other `supabase/functions/**` file in this repo).
- Grep confirmed on both `index.ts` files: `authenticateRequest`/`getCorsHeaders` imported (no inline boilerplate, no static `corsHeaders` object), `has_role` gate present, `p_admin_user_id: authResult.userId` present (never a body field), correct RPC name called.

---
*Phase: 36-live-organizations*
*Completed: 2026-09-09*
