---
phase: 19-throughput-scaleup-trust-survival-autonomy
plan: 02
subsystem: admin, edge-functions, ui
tags: [supabase, edge-functions, react, tanstack-query, autopilot, trust-ladder]

requires:
  - phase: 19-throughput-scaleup-trust-survival-autonomy
    provides: Phase 19 trust schema, category rollups, and autopilot_trust_metrics RPC
provides:
  - Admin-only trust ladder mutation Edge Function
  - Typed autopilot trust metrics service and hooks
  - Existing Admin Dashboard survival trust card with explicit promotion action
affects: [phase-19, phase-20, autopilot, admin-dashboard]

tech-stack:
  added: []
  patterns:
    - Service + hook separation for trust metrics and mutations
    - Explicit admin event required for auto rung promotion
    - Admin Dashboard operational card pattern

key-files:
  created:
    - supabase/functions/autopilot-trust-admin/index.ts
    - supabase/functions/autopilot-trust-admin/__tests__/autopilot-trust-admin.test.ts
  modified:
    - supabase/config.toml
    - src/services/admin-dashboard.service.ts
    - src/services/__tests__/admin-dashboard.service.test.ts
    - src/hooks/useAdminDashboard.ts
    - src/lib/query-config.ts
    - src/pages/admin/DashboardSection.tsx

key-decisions:
  - "Promotion to auto remains a server-side mutation guarded by autopilot_trust_metrics eligibility and ADMIN role checks."
  - "Dashboard UI surfaces eligible categories as waiting for explicit admin action; it never silently promotes."

patterns-established:
  - "autopilot-trust-admin: authenticated admin Edge Function for category rung changes with dual audit writes."
  - "AutopilotTrustCard: compact existing-dashboard surface for survival, canary, defer, and ladder state."

requirements-completed: [TRU-01, TRU-02, TRU-03]

duration: 9min
completed: 2026-06-13
---

# Phase 19 Plan 02: Admin Trust Control Surface Summary

**Admin-visible survival trust metrics with explicit audited category promotion from the existing Dashboard.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-06-13T21:19:00Z
- **Completed:** 2026-06-13T21:28:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Added `autopilot-trust-admin`, an admin-only Edge Function that verifies caller JWTs with `authenticateRequest`, checks `has_role(..., 'ADMIN')`, rejects ineligible `promote_auto` requests with 409, and writes both `autopilot_trust_events` and `admin_audit_log`.
- Added typed trust metrics and mutation helpers to the admin dashboard service, plus TanStack Query hooks that invalidate dashboard and trust metric query keys on settled mutations.
- Rendered a compact Survival Trust card on the existing Admin Dashboard showing category rung, 30-day survival, matured fixes, canary failures/due counts, and rate-limit defers, with explicit Promote/Manual actions.
- Confirmed the linked Supabase project already had the Phase 19 trust schema, regenerated `src/types/supabase.ts`, and verified live trust columns/functions.

## Task Commits

1. **Task 1: Add admin-only trust promotion Edge Function** - `7a0aef78` (`feat(19)`)
2. **Task 2: Add typed trust metrics service and mutation hooks** - `aa4a1129` (`feat(19)`)
3. **Task 3: Render compact admin trust card with explicit promotion** - `5dae4a36` (`feat(19)`)

## Files Created/Modified

- `supabase/functions/autopilot-trust-admin/index.ts` - Admin-only category promote/demote/reset handler with eligibility gate and audit writes.
- `supabase/functions/autopilot-trust-admin/__tests__/autopilot-trust-admin.test.ts` - Source-contract tests for auth, admin role, 409 guard, actor attribution, and audit writes.
- `supabase/config.toml` - Registers `autopilot-trust-admin` with in-code JWT auth.
- `src/services/admin-dashboard.service.ts` - Adds `AutopilotTrustMetric`, `getAutopilotTrustMetrics()`, `formatSurvivalRate()`, and promote/demote service helpers.
- `src/services/__tests__/admin-dashboard.service.test.ts` - Covers trust RPC mapping, null numeric values, mutation invokes, and dashboard inclusion.
- `src/hooks/useAdminDashboard.ts` - Adds trust metrics query plus promote/demote mutations with dashboard invalidation.
- `src/lib/query-config.ts` - Adds the admin trust metrics query key.
- `src/pages/admin/DashboardSection.tsx` - Adds the Survival Trust card inside the existing Admin Dashboard surface.

## Verification

- `supabase db push` - PASS; linked remote reported database up to date.
- `supabase gen types typescript --linked --schema public > src/types/supabase.ts` - PASS; no generated diff.
- `supabase db query --linked ... autopilot_category_trust columns ...` - PASS; live columns include `completed_fixes_30d`, `survived_fixes_30d`, `reopened_fixes_30d`, `survival_rate_30d`, `deferred_runs_30d`, and `last_rollup_at`.
- `supabase db query --linked ... pg_proc ...` - PASS; live functions include `autopilot_trust_metrics` and `rollup_autopilot_category_trust`.
- `npm test -- supabase/functions/autopilot-trust-admin/__tests__/autopilot-trust-admin.test.ts src/services/__tests__/admin-dashboard.service.test.ts` - PASS; 41 tests passed.
- `npm run type-check` - PASS; 0 new errors, baseline remains 346/346.
- `npm run build` - PASS; Vite built successfully with existing chunk-size/dynamic-import warnings.
- Dashboard static guards - PASS; no direct `from(`/`rpc(` calls in `DashboardSection.tsx`, and no `lucide`, `AI-powered`, or `framer-motion` matches.
- Browser screenshot attempt - PARTIAL; Playwright reached `http://127.0.0.1:3001/login` from `/admin` because this shell had no authenticated browser profile or login env keys. Screenshot saved at `/tmp/phase19-admin-dashboard.png`, but it does not prove the authenticated trust card rendering.

## Decisions Made

- Kept `promote_auto` authority in the Edge Function, not the frontend. The UI can ask; the server checks the live eligibility gate and returns 409 if survival is not good enough.
- Kept audit failure non-blocking after successful trust event write, matching the existing `ticket-approval` pattern, while trust-event failure rolls the rung back to the previous value.
- Used a separate trust metrics query hook for the card so it can render loading/error/empty states independently while dashboard stats still include trust metrics.

## Deviations from Plan

None - plan executed as specified.

## Known Stubs

None in files created or intentionally modified by this plan. Stub scan hits were legitimate empty test builders and null checks.

## Threat Flags

No unplanned threat flags. The new `autopilot-trust-admin` network endpoint is the planned `browser admin -> Edge Function` trust boundary from T-19-06 through T-19-08, mitigated with `authenticateRequest`, service-role `has_role`, 409 eligibility gating, actor-from-auth only, and dual audit writes.

## Issues Encountered

- `supabase db query` without `--linked` attempted local Postgres on `127.0.0.1:54322` and failed because no local Supabase DB was running. Reran the checks with `--linked`, which passed against project `vltmrnjsubfzrgrtdqey`.
- Browser visual verification could not reach the authenticated Admin Dashboard because no `agent-browser` binary, saved browser profile, or login env keys were available. Playwright fallback confirmed the dev route redirects to login when unauthenticated.

## User Setup Required

None for schema/types; linked schema is already live and types were regenerated. Deploying the new Edge Function was not performed in this plan run.

## Next Phase Readiness

Plan 03+ can rely on typed trust metrics and explicit admin promotion from Brain. Autopilot daemon work should call the same persisted trust state and must keep the invariant that `auto` means auto-approve only, never bypassing push-gate or ff-only merge.

## Self-Check: PASSED

- Found all key created/modified files.
- Found task commits `7a0aef78`, `aa4a1129`, and `5dae4a36`.

---
*Phase: 19-throughput-scaleup-trust-survival-autonomy*
*Completed: 2026-06-13*
