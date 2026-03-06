---
phase: 08-growth-infrastructure
plan: 02
subsystem: payments
tags: [polar, billing, subscriptions, webhooks, edge-functions]

# Dependency graph
requires:
  - phase: 08-01
    provides: Database schema for billing fields, Polar SDK client module
provides:
  - Webhook handler for real-time subscription state updates
  - Checkout URL generation for plan upgrades
  - Customer creation at signup/first billing access
  - On-demand state sync to handle webhook delays
affects: [08-03]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Webhook signature validation with validateEvent()", "Customer externalId linkage pattern"]

key-files:
  created:
    - supabase/functions/polar-webhook/index.ts
    - supabase/functions/polar-checkout/index.ts
    - supabase/functions/polar-create-customer/index.ts
    - supabase/functions/polar-customer-state/index.ts
  modified: []

key-decisions:
  - "Webhook validates signature before processing, returns 403 on invalid"
  - "Customer lookup by externalId first, fallback to polar_customer_id"
  - "Canceled subscriptions keep access until period end, revoked clear immediately"
  - "Customer state function handles race condition after checkout redirect"

patterns-established:
  - "getPolarClient() for SDK access in checkout/customer functions"
  - "Service role key bypass RLS for webhook updates"
  - "externalId = user.id for customer linkage"

# Metrics
duration: 3min
completed: 2026-01-31
---

# Phase 8 Plan 2: Polar Edge Functions Summary

**4 Edge Functions for complete subscription lifecycle: webhooks, checkout, customer creation, and on-demand state sync**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-31T16:23:41Z
- **Completed:** 2026-01-31T16:26:20Z
- **Tasks:** 3
- **Files created:** 4

## Accomplishments

- Created webhook handler processing 6 event types (subscription.created/active/canceled/revoked, customer.created/state_changed)
- Implemented checkout URL generation with customerExternalId linkage
- Built customer creation function that checks for existing customer before creating
- Developed on-demand state sync to handle webhook delivery delays

## Task Commits

Each task was committed atomically:

1. **Task 1: Create polar-webhook Edge Function** - `c9ef340` (feat)
2. **Task 2: Create polar-checkout and polar-create-customer functions** - `5910338` (feat)
3. **Task 3: Create polar-customer-state function** - `b47bdf0` (feat)

## Files Created/Modified

- `supabase/functions/polar-webhook/index.ts` - Webhook handler validates signatures, processes subscription lifecycle events, updates user_profiles
- `supabase/functions/polar-checkout/index.ts` - Generates checkout URLs via polar.checkouts.create() with customerExternalId
- `supabase/functions/polar-create-customer/index.ts` - Creates Polar customer with externalId = user.id, stores IDs in profile
- `supabase/functions/polar-customer-state/index.ts` - Fetches Polar state, compares with DB, syncs if different

## Decisions Made

1. **Webhook doesn't use getPolarClient:** Only validates and updates DB, doesn't call Polar API
2. **Dual customer lookup:** Check externalId first (fast path), fallback to polar_customer_id query
3. **Canceled vs revoked handling:** Canceled keeps access until period_end, revoked clears all fields immediately
4. **Customer state accepts GET and POST:** Flexibility for frontend calling patterns

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

**External services require manual configuration.** The following environment variables must be set in Supabase secrets:

| Variable | Source |
|----------|--------|
| `POLAR_ACCESS_TOKEN` | Polar Dashboard -> Settings -> Access Tokens |
| `POLAR_ORGANIZATION_ID` | Polar Dashboard -> Settings -> Organization ID |
| `POLAR_WEBHOOK_SECRET` | Polar Dashboard -> Settings -> Webhooks -> Create webhook |

**To set secrets:**
```bash
supabase secrets set POLAR_ACCESS_TOKEN=<your-token>
supabase secrets set POLAR_ORGANIZATION_ID=<your-org-id>
supabase secrets set POLAR_WEBHOOK_SECRET=<your-webhook-secret>
```

**Webhook endpoint URL:** Configure in Polar Dashboard to point to:
`https://<project-ref>.supabase.co/functions/v1/polar-webhook`

## Next Phase Readiness

- All 4 Edge Functions ready for 08-03 (Billing UI integration)
- Webhook handler ready to receive events once configured in Polar Dashboard
- Customer state function enables immediate plan display after checkout

---
*Phase: 08-growth-infrastructure*
*Completed: 2026-01-31*
