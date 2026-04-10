---
phase: 19-provisioning-foundation
plan: "01"
subsystem: backend
tags: [mcp, provisioning, database, polar-webhook, sql-functions]
dependency_graph:
  requires: []
  provides: [auto_provision_mcp_token, maybe_provision_mcp_token, regenerate_mcp_token, is_paid_tier, tr_auto_provision_mcp_token]
  affects: [organizations, mcp_tokens, polar-webhook]
tech_stack:
  added: []
  patterns: [SECURITY DEFINER with SET search_path, AFTER INSERT trigger, idempotent RPC pattern]
key_files:
  created:
    - supabase/migrations/20260410153126_mcp_auto_provision.sql
  modified:
    - supabase/functions/polar-webhook/index.ts
decisions:
  - "regenerate_mcp_token uses SET search_path = extensions, public (not just public) so gen_random_bytes resolves correctly in LANGUAGE sql functions"
  - "provisionMcpTokenForUser errors are logged but not thrown — billing update takes priority over MCP provision"
  - "auto_provision_mcp_token trigger fires on org creation but skips free-tier owners — upgrade path via maybe_provision_mcp_token handles them later"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-10"
  tasks_completed: 3
  files_modified: 2
requirements:
  - PROV-01
  - PROV-03
---

# Phase 19 Plan 01: Provisioning Foundation — DB Migration and Webhook Summary

**One-liner:** DB auto-provision trigger + 3 RPCs (is_paid_tier, maybe_provision, regenerate) deployed to production with Polar webhook upgrade-path hook.

## What Was Built

### Migration: `20260410153126_mcp_auto_provision.sql`

Four SQL functions and one trigger that establish the complete MCP token provisioning infrastructure:

1. **`is_paid_tier(product_id, status, period_end)`** — Pure SQL helper that ports `deriveTier()` from `useSubscription.ts`. Returns TRUE for active/trialing PRO and TEAM plans; handles `pro-trial` with period expiry check.

2. **`auto_provision_mcp_token()`** — AFTER INSERT trigger on `organizations`. Looks up the org owner's billing tier and auto-inserts an `mcp_tokens` row if the owner is PRO+ and no token exists yet. Free-tier orgs are skipped — the upgrade path handles them.

3. **`maybe_provision_mcp_token(p_org_id UUID)`** — Idempotent RPC called by polar-webhook when a subscription becomes active. Checks billing, guards against duplicate tokens. Safe to call multiple times.

4. **`regenerate_mcp_token(p_token_id UUID)`** — Atomically swaps the token hex using `gen_random_bytes(32)`. WHERE clause includes `auth.uid()` to prevent IDOR (users can only regenerate their own tokens). Returns the full updated row.

**Trigger:** `tr_auto_provision_mcp_token` fires AFTER INSERT ON organizations.

All SECURITY DEFINER functions have `SET search_path` to prevent search path injection (T-19-01, T-19-03).

### Polar Webhook: `polar-webhook/index.ts`

Added `provisionMcpTokenForUser()` helper and wired it into two handlers:

- `handleSubscriptionActive` — called after profile update on `subscription.active`
- `handleSubscriptionCreated` — called after profile update on `subscription.created`

The helper queries `organization_memberships` for all orgs owned by the upgrading user and calls `maybe_provision_mcp_token` for each. RPC errors are logged but do not throw — the billing update is the primary concern; MCP provision is best-effort.

`handleSubscriptionRevoked` was NOT modified — tokens survive downgrades per D-10; plan gating at runtime handles access rejection.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `gen_random_bytes` schema resolution in `regenerate_mcp_token`**
- **Found during:** Task 3 (db push)
- **Issue:** `LANGUAGE sql` function with `SET search_path = public` could not resolve `gen_random_bytes` because pgcrypto lives in the `extensions` schema on Supabase Cloud. Error: `function gen_random_bytes(integer) does not exist`.
- **Fix:** Changed `SET search_path = public` to `SET search_path = extensions, public` in `regenerate_mcp_token` only. The three plpgsql functions are unaffected because they inherit the extension schema via the session search_path at runtime.
- **Files modified:** `supabase/migrations/20260410153126_mcp_auto_provision.sql`
- **Commit:** `add05355`

## Deployment Status

- `supabase db push` — Applied migration `20260410153126_mcp_auto_provision.sql` to production. All 4 functions and trigger created.
- `supabase functions deploy polar-webhook --use-api` — Deployed successfully to project `vltmrnjsubfzrgrtdqey`.

## Known Stubs

None — all functions are fully wired and deployed.

## Threat Flags

No new threat surface beyond what was planned in the plan's `<threat_model>`. All mitigations applied:

| Flag | File | Status |
|------|------|--------|
| T-19-01: search_path injection | auto_provision_mcp_token | SET search_path = public |
| T-19-02: IDOR on regenerate | regenerate_mcp_token | WHERE user_id = auth.uid() |
| T-19-03: duplicate provisioning | maybe_provision_mcp_token | IF NOT EXISTS guard |
| T-19-04: webhook signature | polar-webhook | validateEvent() before any processing |

## Self-Check: PASSED

- [x] `supabase/migrations/20260410153126_mcp_auto_provision.sql` — exists, deployed
- [x] `supabase/functions/polar-webhook/index.ts` — modified, deployed
- [x] Commit `2fe5f2b1` — Task 1 migration
- [x] Commit `ee2d0996` — Task 2 polar-webhook
- [x] Commit `add05355` — Rule 1 bug fix (search_path)
