---
phase: 17-payments-billing
plan: 02
subsystem: payments-billing
tags: [ai-usage, enforcement, billing, edge-functions, hooks]
dependency_graph:
  requires: []
  provides: [track-ai-usage, useAiGate]
  affects: [any-ai-consuming-feature]
tech_stack:
  added: []
  patterns: [service-role-edge-function, fail-open-tracking, query-invalidation]
key_files:
  created:
    - supabase/functions/track-ai-usage/index.ts
    - src/hooks/useAiGate.ts
  modified: []
decisions:
  - track-ai-usage uses service-role client for both profile lookup and ai_usage insert — avoids RLS complexity for cross-table operations
  - useAiGate fails open on tracking errors — never blocks user due to monitoring failure
  - canUse defaults to true (optimistic) — real gate is trackAction's returned allowed value
  - 429 handling via FunctionsHttpError context.json() — Supabase JS client wraps non-2xx responses
metrics:
  duration: 235s
  completed: "2026-03-30"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 17 Plan 02: AI Usage Enforcement Layer Summary

**One-liner:** Server-side AI action tracker with 429 limit enforcement and frontend gate hook with toast notification and cache invalidation.

## What Was Built

### Task 1: track-ai-usage Edge Function

`supabase/functions/track-ai-usage/index.ts`

POST endpoint that:
- Validates actionType against the 4 allowed values (smart_import, auto_name, auto_tag, chat_message)
- Calls `get_monthly_ai_usage` RPC to get current monthly count
- Derives subscription tier from `user_profiles` (mirrors `deriveTier` from `useSubscription.ts`)
- Returns 429 `{ error, usage, limit, tier }` when `usage >= limit`
- Inserts into `ai_usage` table and returns 200 `{ success, usage, limit, remaining, tier }` on success
- Uses service-role Supabase client throughout for cross-table access

Tier limits enforced: Free=25/mo, Pro=1000/mo, Team=5000/mo.

### Task 2: useAiGate Hook

`src/hooks/useAiGate.ts`

Frontend enforcement hook that:
- Exports `AiActionType`, `AiGateResult`, `TrackActionResult` types
- `trackAction(type, opts?)` — calls `track-ai-usage` edge function with Bearer token
- On 429: shows `toast.error('Monthly AI limit reached. Upgrade for more.')`, invalidates `['ai-usage']` query cache, returns `{ allowed: false }`
- On success: invalidates `['ai-usage']` cache, returns `{ allowed: true, usage, limit, remaining }`
- On any error: fails open (returns `{ allowed: true }`) — never blocks user due to tracking failures
- Composites `useSubscription()` for `tier` and `limit` values

### PAY-02 and PAY-03 Verification

- **PAY-02 (Upgrade checkout):** `src/components/billing/UpgradeButton.tsx` + `supabase/functions/polar-checkout/index.ts` — both exist and functional. No changes needed.
- **PAY-03 (14-day Pro trial):** `handle_new_user()` trigger in `20260309000001_ai_credits_system.sql` sets `product_id='pro-trial'`, `subscription_status='trialing'`, `current_period_end=NOW()+14 days`. `useSubscription.ts` deriveTier handles pro-trial→pro mapping. No changes needed.

## Requirements Fulfilled

- **PAY-02:** Upgrade checkout flow exists and verified (UpgradeButton → polar-checkout → Polar redirect)
- **PAY-03:** 14-day Pro trial activates on signup via DB trigger
- **PAY-05:** AI usage enforcement mechanism: track-ai-usage returns 429 at limit, useAiGate blocks and notifies user

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The enforcement mechanism is complete. Actual integration of `useAiGate` into specific AI features (auto-tag, smart-import, etc.) is intentionally deferred — per the plan spec, this plan creates the enforcement mechanism only.

## Self-Check: PASSED

- `supabase/functions/track-ai-usage/index.ts` — EXISTS (verified via `ls`)
- `src/hooks/useAiGate.ts` — EXISTS (verified via TypeScript compile + `ls`)
- Task 1 commit: 478131c0
- Task 2 commit: 73c02cb2
- TypeScript: `npx tsc --noEmit` — 0 errors
