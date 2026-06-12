---
phase: 14-in-app-approval-loop
plan: 01
subsystem: backend
tags: [supabase, edge-function, approval-loop, audit, autopilot]

# Dependency graph
requires:
  - phase: 16-admin-center
    provides: dual-client pattern (admin-manage-user), admin_audit_log table, authenticateRequest helper
  - phase: 11-ticketing
    provides: tickets/ticket_events/ticket_messages schema, has_role(), service-role-only event INSERT posture
provides:
  - "DEPLOYED ticket-approval Edge Function — the ONLY authenticated writer of admin-authored approval/rejection ticket_events rows"
  - "Approval contract satisfied: event_type='approval', actor_id = JWT-verified admin, NO status change (dispatcher merges then advances)"
  - "Rejection contract: rejection event + reason posted as admin ticket_message + status 'rejected'"
  - "admin_audit_log row per mutation (ticket_approve / ticket_reject)"
  - "scripts/qa/probe-ticket-approval.ts — repeatable live 401/403/409 gating probe with zero-residue guarantee"
affects: [14-04, 13-04, 13-05, 13-07]

# Tech tracking
tech-stack:
  added: []
  patterns: ["dual-client edge auth (anon client verifies JWT, service-role client mutates)", "409 status guard before any write", "probe users on @callvault.test for RPC-sweepable cleanup"]

key-files:
  created:
    - supabase/functions/ticket-approval/index.ts
    - supabase/functions/ticket-approval/__tests__/ticket-approval.test.ts
    - scripts/qa/probe-ticket-approval.ts
  modified:
    - supabase/config.toml

key-decisions:
  - "approve writes the approval event and does NOT touch tickets.status — dispatcher recognition requires status still awaiting_approval at poll time (13-RESEARCH ~307)"
  - "reject sets status 'rejected' directly; the status_change audit trigger firing on that UPDATE is expected and additive"
  - "Wiring tests are static source assertions mirroring admin-manage-user's harness (repo pattern), runtime gating proven by live probes instead of mocked clients"
  - "Probe users use @callvault.test emails so cleanup_test_fixture_users can sweep them when protective DELETE triggers block auth.admin.deleteUser"

requirements-completed: [APPR-02 (server half)]

# Metrics
duration: ~12min
completed: 2026-06-11
---

# Phase 14 Plan 01: ticket-approval Edge Function Summary

**Deployed the authenticated admin approval/rejection bridge — dual-client Edge Function writing dispatcher-recognized approval events with verified admin actor, live-probed 401/403/409 with zero event contamination**

## Performance

- **Duration:** ~12 min (started 2026-06-11T16:41:57Z)
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `ticket-approval` deployed and ACTIVE (version 1, 2026-06-11 16:44:51) — copied admin-manage-user's dual-client shape: `authenticateRequest` in-code JWT verify, `has_role(verifiedUserId,'ADMIN')` on the service-role client, zod payload with reject-requires-reason refinement (max 2000 chars)
- approve: service-role INSERT `{event_type:'approval', old_value:'awaiting_approval', new_value:'approved', actor_id: verified admin}` — NO status change (only one `tickets.update` exists in the file and it's the reject branch, pinned by test)
- reject: rejection event + `ticket_messages` admin-authored reason (`Rejected by admin: ...`) + status → 'rejected'
- Both actions audit to `admin_audit_log` (`ticket_approve`/`ticket_reject`, target_type 'ticket', verified actor_user_id; reason in metadata, never secrets)
- `config.toml`: `[functions.ticket-approval]` with `verify_jwt = false` (repo ES256 pattern)
- 8 wiring tests pass; ordering assertion proves the 409 guard precedes the first event INSERT

## Live Probe Results (one-liners)

- No auth → `401 {"error":"No authorization header"}`
- Non-admin JWT (disposable probe user) → `403 {"success":false,"error":"Admin access required"}`
- Admin JWT, ticket status='new' → `409 {"success":false,"error":"ticket_not_awaiting_approval","status":"new"}`
- approval/rejection event count before=0, after=0 (delta=0) — zero contamination of live ticket_events
- Probe user residue rows: 0; probe user deleted (via cleanup_test_fixture_users after rename to @callvault.test — see deviations)
- `supabase functions list` → ticket-approval ACTIVE v1

## Task Commits

1. **Task 1: Edge Function + config** — `52758da4` feat(14-01): ticket-approval Edge Function — authenticated admin approval/rejection bridge
2. **Task 2: Tests + deploy + probes** — `de98c099` test(14-01): ticket-approval wiring tests + live gating probe script

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Probe-user deletion blocked by protective DELETE triggers**
- **Found during:** Task 2 live probe cleanup
- **Issue:** `auth.admin.deleteUser` failed ("Database error deleting user") — repo's protective triggers block direct user deletes; `cleanup_test_fixture_users` RPC only sweeps `%@callvault.test` / `%@example.invalid` / `qa-sweep-%@vibeos.com` emails and my probe used @example.com
- **Fix:** Renamed the probe user to @callvault.test and swept via the RPC (`users_deleted: 1`, 0 remaining); patched probe script to mint @callvault.test probe users from the start
- **Files modified:** scripts/qa/probe-ticket-approval.ts
- **Commit:** de98c099

### Noted (not code deviations)

- Deploy used `--use-api` (Docker not running — supabase/CLAUDE.md hard rule); plan's bare deploy command would have hung.
- Test harness: plan said "mocked clients"; the admin-manage-user harness the plan instructs to copy is static source-assertion wiring tests, not mocked runtime clients. Followed the repo harness exactly; runtime behavior proven by the live probes instead.

## Gates

- **Target vitest:** 8/8 pass
- **Full suite:** 1847 pass / 1 fail / 45 skipped — the single failure is `rpc-type-smoke` (28 pre-existing SECURITY DEFINER offenders spanning phases 06–12, already diagnosed and logged in `.planning/phases/13-dispatcher-mechanical-safety/deferred-items.md`; not caused by 14-01 files, which are Deno edge sources outside that checker's surface)
- **Build:** `npm run build` exit 0

## Threat Flags

None — all new surface is covered by the plan's threat register (T-14-01..05) and proven by the probes: actor spoofing (actor_id always verified userId, pinned by test), privilege escalation (403 live probe), wrong-status writes (409 live probe before any write), repudiation (audit row), injection (zod max-length, plain-text storage).

## Known Stubs

None.

## Next Phase Readiness

- 14-04 can mount Approve/Reject UI calling `functions/v1/ticket-approval` — contract: POST `{ticket_id, action: 'approve'|'reject', reason?}`, 200 `{success,action,ticket_id}`
- 13-04/13-05 dispatcher poll path has its recognized event vocabulary live
- 13-07 E2E: Andrew's in-app click now has a deployed server half

## Self-Check: PASSED
