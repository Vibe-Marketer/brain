# Phase 36 — Deferred Items

Out-of-scope discoveries surfaced during execution, logged per the Scope Boundary rule
(only auto-fix issues directly caused by the current task's changes — pre-existing
failures in unrelated files are logged here, not fixed).

## 36-06 Task 1 — Full TEST verification gate (2026-09-09)

### 1. 12 pre-existing unit-test failures, unrelated to Phase 36

`npm run test` (full suite): 255 test files passed, 4 failed (12/2383 individual tests
failed). All 4 failing files confirmed via `git log --oneline -- <file>` to have zero
commits from any Phase 36 plan — every recent commit on each predates this phase by
multiple phases:

| File | Failing tests | Most recent commit (pre-Phase-36) |
|------|---------------|-----------------------------------|
| `src/pages/admin/__tests__/AuditSection.test.tsx` | 4 | `5089c664` (fix(admin): render Audit log as a paginated, clickable table) |
| `src/pages/admin/__tests__/DashboardSection.recurrence.test.tsx` | 5 | `7317a5f3` (feat(admin): rebuild autopilot dashboard) |
| `src/components/support/__tests__/SupportTicketDialog.test.tsx` | 2 | `b57776db` (feat(support): convey AI-agent turnaround on ticket submit) |
| `supabase/functions/mcp-server/__tests__/sec-jwt-fix.test.ts` | 1 | `bd93635d` (test(06.1-sec-jwt-fix): add failing tests for ISC-8-12) |

Matches the exact precedent already logged in Phase 32's own deferred-items ("13
pre-existing full-suite test failures (admin UI x3, rpc-type-smoke, mcp-server JWT
auth) confirmed unrelated to this plan"). Not fixed — out of scope for a prod-apply
verification gate. Andrew should triage separately.

### 2. Cross-file integration-test race re-confirmed (known repo-wide pattern, not a Phase 36 bug)

Running all four Phase 36 integration suites together in one vitest invocation
(`claim-organization-domain-rpc`, `org-merge-unclaim-rpc`, `merge-organizations`,
`unclaim-organization-domain` — the shape `npm run test:integration` actually runs)
produced one transient failure: `org-merge-unclaim-rpc.integration.test.ts`'s
"unclaim_organization_domain_atomic: platform admin succeeds, row deleted" test got
`Access denied: platform admin required` for a user whose `has_role(...,'ADMIN')` grant
had, up to that point in the same run, worked correctly (used successfully earlier in
the same file for `merge_organizations_atomic`).

Root cause (re-confirmed, already diagnosed in Phase 31 P02 per STATE.md: "Root-caused
the cross-file integration-test race... `cleanup_test_fixture_users(p_max_age_minutes:
0)`... confirmed via a direct 23503 FK-violation trace, logged with two remediation
options, out of scope to fix (repo-wide pattern)"): `cleanup_test_fixture_users`'s
`p_max_age_minutes` default (60) exists specifically to protect in-flight sibling
suites, but `merge-organizations.integration.test.ts` and
`unclaim-organization-domain.integration.test.ts` (both deploy-deferred `deno run`
suites, finish in ~1-2s) call it with `p_max_age_minutes: 0` in their own `afterAll`
(`v_age_cutoff = NOW() - 0 minutes = NOW()`, matching literally every existing
`%@callvault.test` row regardless of age). When both finish first and their `afterAll`
fires while the slower, sequential `org-merge-unclaim-rpc.integration.test.ts`
(~7 `it` blocks, several hundred ms total) is still mid-run, the fast suites' cleanup
deletes the still-in-flight suite's `@callvault.test` fixture `auth.users` rows
(cascading to `user_roles`), which is exactly what happened to `platformAdminUserId`
here.

**Verification that this is the race, not a real bug:** re-ran
`org-merge-unclaim-rpc.integration.test.ts` alone (no sibling files) — 7/7 green,
matching `36-02-SUMMARY.md`'s own documented "7/7 PASS" result exactly. The RPC/
migration code is correct; the failure was a test-harness artifact of concurrent
`afterAll` cleanup, already a known, out-of-scope, repo-wide pattern predating this
phase. Not fixed here (same scope-boundary reasoning as Phase 31 P02's own logging of
this issue) — flagged as a third confirmed occurrence for whoever eventually builds
the shared test-cleanup helper Phase 36 P02's own summary already proposed.
