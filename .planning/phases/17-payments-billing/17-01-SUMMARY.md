---
phase: 17-payments-billing
plan: "01"
subsystem: billing
tags: [billing, subscription, ai-usage, polar]
dependency_graph:
  requires: []
  provides:
    - AI usage data hook and service layer
    - Cancel subscription edge function
    - Updated BillingTab with usage meter and cancel flow
  affects:
    - src/components/settings/BillingTab.tsx
    - Billing settings UX for paid users
tech_stack:
  added: []
  patterns:
    - Service + Hook separation for AI usage data
    - AlertDialog for destructive confirmation
    - Supabase Edge Function for Polar API cancel call
key_files:
  created:
    - src/services/ai-usage.service.ts
    - src/hooks/useAiUsage.ts
    - supabase/functions/polar-cancel/index.ts
  modified:
    - src/components/settings/BillingTab.tsx
decisions:
  - Cancel button is link-style (text-sm text-muted-foreground hover:text-destructive) not a red button — avoids alarming free/trial users
  - polar-cancel updates subscription_status immediately but retains subscription_id and current_period_end so access continues until period end
  - AI usage section placed between Current Plan and All Plans for natural flow
  - AlertDialogAction uses onClick not form submit — simpler for async edge function call
metrics:
  duration: 231s
  completed: "2026-03-30"
  tasks_completed: 2
  files_changed: 4
---

# Phase 17 Plan 01: Billing Settings — AI Usage + Cancel Subscription Summary

AI usage meter and cancel subscription button added to BillingTab, backed by a new service/hook layer and Polar edge function.

## What Was Built

**AI Usage Service + Hook (PAY-06)**
- `src/services/ai-usage.service.ts`: pure async function `getMonthlyAiUsage()` — calls `get_monthly_ai_usage` RPC with current user ID and YYYY-MM month string
- `src/hooks/useAiUsage.ts`: `useAiUsage()` hook combining RPC result with `useSubscription().aiActionsLimit` — returns `{ used, limit, percentUsed, isLoading, error }` with 30s staleTime

**polar-cancel Edge Function (PAY-04)**
- `supabase/functions/polar-cancel/index.ts`: POST endpoint following polar-checkout pattern exactly
- Reads user's `subscription_id` from `user_profiles`, calls `polar.subscriptions.cancel()`, updates `subscription_status = 'canceled'` while keeping `subscription_id` and `current_period_end` intact
- Returns `{ success: true, accessUntil: string | null }`

**BillingTab Updates (PAY-01, PAY-04, PAY-06)**
- New AI Usage section with inline progress bar (div-based, h-2 bg-primary fill) showing used/limit count
- Warning at >=90% ("approaching monthly limit") and error at 100% ("AI features are paused") using `RiErrorWarningLine`
- Cancel subscription button (link-style) for paid users with AlertDialog confirmation
- Dialog shows access-until date, two buttons: "Keep subscription" and "Cancel subscription" (destructive)
- Already-canceled state shows message instead of button
- All existing plan display and UpgradeButton preserved (PAY-01 preserved)

## Verification

- TypeScript: `npx tsc --noEmit` passes with zero errors
- All acceptance criteria checked via grep — all pass
- Edge function follows polar-checkout pattern exactly (getCorsHeaders, getPolarClient, JWT auth flow)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data is wired to real sources (ai_usage table via RPC, Polar API via edge function).

## Self-Check: PASSED
