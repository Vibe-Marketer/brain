---
phase: 08-growth-infrastructure
plan: 03
subsystem: billing-ui
tags: [polar, billing, subscription, react, hooks]

dependency_graph:
  requires: [08-02]
  provides:
    - useSubscription hook for tier-aware components
    - usePolarCustomer hook for customer management
    - PlanCards component for plan comparison
    - UpgradeButton component for checkout flow
    - BillingTab with Polar integration
  affects: [any-component-needing-billing-state]

tech_stack:
  added: []
  patterns:
    - "TanStack Query for subscription state"
    - "UpgradeButton handles full checkout internally"
    - "Tier derivation from product_id"

file_tracking:
  created:
    - src/hooks/useSubscription.ts
    - src/hooks/usePolarCustomer.ts
    - src/components/billing/PlanCards.tsx
    - src/components/billing/UpgradeButton.tsx
  modified:
    - src/components/settings/BillingTab.tsx

decisions:
  - id: tier-derivation
    choice: "Derive tier from product_id prefix (solo-monthly -> solo)"
    rationale: "Product IDs follow predictable format, no extra API calls needed"
  - id: upgrade-button-self-contained
    choice: "UpgradeButton handles entire checkout flow internally"
    rationale: "Encapsulates ensureCustomer + checkout + redirect - reusable anywhere"
  - id: subscription-in-query
    choice: "Use TanStack Query for subscription state (not Zustand)"
    rationale: "Server state belongs in React Query, auto-refetches after checkout"

metrics:
  duration: "~30 minutes"
  completed: "2026-01-31"
---

# Phase 08 Plan 03: Polar Billing UI Summary

**One-liner:** React hooks and components for Polar subscription management with working checkout flow.

## What Was Built

### Task 1: Subscription and Customer Hooks

**useSubscription.ts** (162 lines)
- Queries `user_profiles` for billing fields: `subscription_id`, `subscription_status`, `product_id`, `current_period_end`
- Derives tier from product_id prefix: `solo-monthly` -> `solo`, `team-annual` -> `team`, etc.
- Calculates `canUpgrade`/`canDowngrade` from tier hierarchy
- Returns `isPaid` boolean for active/trialing subscriptions
- Uses TanStack Query with 1-minute stale time

**usePolarCustomer.ts** (124 lines)
- Queries `polar_customer_id` from user profile
- Provides `ensureCustomer()` async function for lazy creation
- Calls `polar-create-customer` Edge Function if customer doesn't exist
- Caches customer ID in React Query

### Task 2: PlanCards and UpgradeButton Components

**PlanCards.tsx** (250 lines)
- Side-by-side comparison of Solo ($29/mo), Team ($99/mo), Business ($249/mo)
- Shows feature lists with checkmarks for each tier
- Highlights current plan with badge and ring
- "Most Popular" badge on Team tier
- Downgrade notice: "Excess features become read-only"
- Uses UpgradeButton internally for all plan actions

**UpgradeButton.tsx** (123 lines)
- Standalone upgrade CTA component
- Flow: `ensureCustomer()` -> `polar-checkout` Edge Function -> redirect to Polar
- Loading states with Sonner toasts
- Error handling with descriptive messages
- Reusable anywhere (header, billing page, modals)

### Task 3: BillingTab Integration

**BillingTab.tsx** (updated)
- Replaced `useUserRole` with `useSubscription` hook
- Current Plan section now shows:
  - Real tier name from subscription
  - Status badge (Active/Canceled/Trial/Past Due)
  - Period end date for paid subscriptions
  - Upgrade CTA for free users
- All Plans section replaced with PlanCards component
- Removed "Coming Soon - Stripe Integration" badge
- Kept AI Usage section unchanged (useEmbeddingCosts)
- Enterprise callout below PlanCards

## Key Implementation Details

### Tier Hierarchy
```
free (0) < solo (1) < team (2) < business (3)
```

### Status Badge Variants
| Status | Variant | Display |
|--------|---------|---------|
| active | default | Active |
| trialing | outline | Trial |
| canceled | destructive | Canceled |
| past_due | destructive | Past Due |
| free/null | outline | Free |

### Checkout Flow
1. User clicks upgrade button in PlanCards
2. UpgradeButton calls `ensureCustomer()` (creates if needed)
3. Invokes `polar-checkout` Edge Function with productId
4. Redirects to Polar hosted checkout
5. After payment, webhook updates subscription status
6. User returns, useSubscription refetches new state

## Commits

| Hash | Type | Description |
|------|------|-------------|
| bf56d08 | feat | Create subscription and customer hooks |
| 5698ca7 | feat | Create PlanCards and UpgradeButton components |
| f08d38d | feat | Integrate Polar billing into BillingTab |

## Verification Checklist

- [x] useSubscription returns correct tier derived from product_id
- [x] usePolarCustomer creates customer on demand
- [x] PlanCards displays all 3 tiers with correct pricing
- [x] UpgradeButton initiates checkout flow
- [x] BillingTab shows current subscription status
- [x] "Coming Soon" badge removed
- [x] No TypeScript/ESLint errors

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Dependencies satisfied:**
- 08-02 Edge Functions (polar-webhook, polar-checkout, polar-create-customer, polar-customer-state)
- All billing UI components and hooks complete

**Ready for:**
- End-to-end billing flow testing
- Phase 8 completion (08-04, 08-05, 08-06 already done)

---

*Completed: 2026-01-31*
*Plan: .planning/phases/08-growth-infrastructure/08-03-PLAN.md*
