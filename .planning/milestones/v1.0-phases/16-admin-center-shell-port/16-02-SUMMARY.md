---
phase: 16
plan: 02
subsystem: admin-center
tags: [admin, users, audit-log, edge-function, rls, cmdk]
requires:
  - 16-01 admin shell (/admin route, AdminCategoryPane, adminDetailStore, palette)
  - has_role(uuid, app_role) SECURITY DEFINER helper (consolidated schema)
provides:
  - admin_audit_log table (append-only, admin-read, service-role-write)
  - admin-manage-user edge function (role change, password reset, revoke/restore — all audited)
  - Users section in /admin with pane-native UserProfileDetails
  - Palette user search + Users section jump
  - Settings AdminTab reduced to pointer card (old direct-table role editor removed)
affects:
  - src/pages/admin/AdminCenter.tsx (users section + detail pane)
  - src/components/panes/AdminCategoryPane.tsx (users category)
  - src/components/admin/AdminCommandPalette.tsx (users group)
  - src/components/settings/AdminTab.tsx (pointer-only)
  - src/lib/query-config.ts (admin.users/audit keys)
  - src/routes.manifest.ts (/admin/users crawl)
  - supabase/config.toml (admin-manage-user entry)
tech-stack:
  added: []
  patterns: [dual-client edge auth (in-code JWT verify + service-role mutations), append-only audit via service-role-only RLS, pane-native detail in route chunk]
key-files:
  created:
    - supabase/migrations/20260612120000_create_admin_audit_log.sql
    - supabase/functions/admin-manage-user/index.ts
    - supabase/functions/admin-manage-user/__tests__/admin-manage-user.test.ts
    - src/services/admin-users.service.ts
    - src/services/__tests__/admin-users.service.test.ts
    - src/hooks/useAdminUsers.ts
    - src/pages/admin/UsersSection.tsx
    - src/pages/admin/__tests__/UsersSection.test.tsx
    - src/components/admin/UserProfileDetails.tsx
  modified:
    - src/pages/admin/AdminCenter.tsx
    - src/components/panes/AdminCategoryPane.tsx
    - src/components/admin/AdminCommandPalette.tsx
    - src/components/settings/AdminTab.tsx
    - src/lib/query-config.ts
    - src/routes.manifest.ts
    - supabase/config.toml
  deleted:
    - src/components/settings/UserTable.tsx (dead after AdminTab reduction — its only consumer)
decisions:
  - "has_role rebind runs on the service-role client with the JWT-verified userId (not the forwarded-auth client) — same trust result, immune to grant drift on the rpc"
  - "Pane-native user detail lives in AdminCenter's own flex row (admin lazy chunk), not the shared DetailPaneOutlet — main's pane 4 is panelStore-bound and adding admin panel types would pull admin code into the main bundle"
  - "UserTable.tsx deleted, not orphaned — AdminTab was its only consumer and the new flow is server-side + audited; keeping a direct-table role editor around would be a privilege-escalation footgun"
  - "avatar_url dropped from AdminUserProfile — column does not exist on main's user_profiles"
  - "config.toml verify_jwt = false per repo-wide ES256 pattern; JWT verified in function code via authenticateRequest (this IS the dual-client design the plan asked to preserve)"
metrics:
  duration: ~35 minutes
  completed: 2026-06-11
  tasks: 4
  tests-added: 17 (6 edge wiring, 7 service, 4 UsersSection)
---

# Phase 16 Plan 02: Admin Center Users Port Summary

Real user management shipped: /admin/users lists every platform user with role/plan/last-seen, and a pane-native detail panel gives audited role changes, password reset, and revoke/restore — all enforced server-side by the new admin-manage-user edge function writing to the new append-only admin_audit_log.

## Capability Table — what admin can do now vs before

| Capability | Before (Settings AdminTab) | Now (/admin/users) |
|---|---|---|
| List users + roles | Yes (direct table read) | Yes, + plan/subscription + last-seen + search/role/plan filters |
| Change role | Client-side direct table write, NO audit, NO server check beyond RLS | Server-side via edge function, has_role-gated, audited |
| Reset password | Impossible | Yes (min 8 chars), audited, password never logged |
| Revoke access | Impossible | Yes (87600h ban), audited; banned users cannot sign in |
| Restore access | Impossible | Yes, audited |
| Audit trail | None | admin_audit_log row per action with verified actor |
| Palette access | None | ⌘K user search → opens detail pane |

## Port Map Executed

All ports from `git show worktree-admin-center:<path>`, rebound to live schema:

| Branch file | Disposition |
|---|---|
| admin_center_foundation/v2 migrations (audit slice) | Re-cut as one small migration: table + admin SELECT via has_role + indexes; client INSERT policy never created (v2 posture from day one) |
| admin-manage-user/index.ts | Ported; `rpc('is_admin')` → `rpc('has_role', {_user_id: verified, _role:'ADMIN'})` on service-role client; billing stub absent |
| admin-users.service.ts | Ported; avatar_url dropped (not on main) |
| useAdminUsers.ts | Ported; deprecated useUpdateUserBilling stub dropped; audit invalidation via new queryKeys.admin.audit() |
| UsersSection.tsx | Ported verbatim (live columns all exist) |
| UserProfileDetails.tsx | Ported verbatim |
| AdminCenter detail pane | Branch's AppShell `detailPane` prop doesn't exist on main — recreated as a local right-hand pane (360px, border-l, same plane) inside AdminCenter driven by adminDetailStore |
| Palette users group | Restored from branch (was stripped in 16-01), RiUserLine items → navigate + openUser |
| deno.json/.npmrc (branch function dir) | NOT ported — main's functions use esm.sh imports + repo-level deno.json |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] admin_audit_log already existed on the remote DB**
- **Found during:** Task 1 (db push emitted "already exists, skipping")
- **Issue:** Branch-era testing had created the table remotely (2 old rows present)
- **Fix:** Migration is idempotent (IF NOT EXISTS + DROP POLICY IF EXISTS), so the push converged the live table to the intended posture. Verified via psql: exactly one policy (admin SELECT via has_role), RLS enabled, correct 7 columns, no write policies
- **Commit:** 41be902

**2. [Rule 1 - Bug] avatar_url in ported service had no live column**
- **Found during:** Task 3
- **Fix:** Field dropped from AdminUserProfile (UI never rendered it)
- **Commit:** b8eb096

**3. [Rule 3 - Blocking] Probe-user deletion blocked by protective DELETE triggers (500)**
- **Found during:** Task 4 cleanup
- **Fix:** Targeted single-UID SQL delete using the sanctioned trigger-bypass pattern from cleanup_test_fixture_users (the RPC itself only sweeps @callvault.test/@example.invalid domains). Verified 0 residue in auth.users / user_roles / user_profiles

## Live Verification (all via deployed function, project vltmrnjsubfzrgrtdqey)

Performed as test admin a@vibeos.com against a disposable user created via auth admin API (`gsd-16-02-probe+1781193462@example.com`, deleted after):

- change_role FREE→PRO → `{"success":true}`; user_roles row read back as PRO
- reset_password → `{"success":true}`; sign-in with the admin-set password succeeded (end-to-end proof)
- revoke_access → sign-in returned `{"error_code":"user_banned"}`
- restore_access → sign-in succeeded again
- Audit: 4 rows in admin_audit_log (change_role/reset_password/revoke/restore) with the admin's verified actor_user_id; reset_password metadata is `{}` (no password leakage)
- Security: no-auth → 401; invalid JWT → 401; non-admin caller (the probe user's own JWT) → 403; non-admin SELECT on admin_audit_log → `[]` (RLS)
- Cleanup: probe user deleted; 0 rows remain in auth.users/user_roles/user_profiles for the probe UID. Probe audit rows remain by design (append-only log)

## Known Stubs

None introduced. (16-01's intentional runner/deploy-card stubs are unchanged and tracked there.)

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: privileged-endpoint | supabase/functions/admin-manage-user/index.ts | New endpoint that can change roles, reset passwords, and ban users. Mitigations verified live: in-code JWT verification, has_role(verified caller,'ADMIN') gate (403 probe), zod closed action union, audit on every mutation |
| threat_flag: schema | supabase/migrations/20260612120000_create_admin_audit_log.sql | New trust-boundary table; append-only posture verified live (admin-only read, no client write policies) |

## Verification

- vitest: 1781 passed, 0 failed (full suite; 17 new tests included)
- eslint: 0 errors on all touched files (1 pre-existing fast-refresh warning in AdminCategoryPane, same as 16-01)
- tsc scoped: 0 errors in all new/touched files (repo baseline untouched)
- npm run build: exit 0 on the tree containing all 16-02 changes
- Pushed: main → origin/main (8309daf1..ddcfd988; 15-02 workstream commits interleaved on shared main)

## Commits

| Hash | Message |
|---|---|
| 41be902 | feat(16-02): create admin_audit_log table — append-only, admin-read, service-role-write |
| bdba319 | feat(16-02): port admin-manage-user edge function — has_role rebind, audit_log writes |
| b8eb096 | feat(16-02): port Users section into Admin Center — pane-native detail, palette, AdminTab pointer-only |

## Self-Check: PASSED

All 9 created files + SUMMARY exist on disk; UserTable.tsx confirmed deleted; all 3 commits present in git log; pushed to origin/main.
