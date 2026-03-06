---
phase: 08-growth-infrastructure
plan: 01
subsystem: payments
tags: [polar, billing, subscriptions, database, sdk]

# Dependency graph
requires:
  - phase: 07-differentiators
    provides: Core features ready for monetization
provides:
  - Database schema for Polar billing integration
  - Shared Polar SDK client module for Edge Functions
  - TypeScript types for billing fields
affects: [08-02, 08-03]

# Tech tracking
tech-stack:
  added: ["@polar-sh/sdk (npm: specifier in Deno)"]
  patterns: ["Lazy singleton for SDK client", "getPolarClient() factory pattern"]

key-files:
  created:
    - supabase/migrations/20260131161417_add_polar_billing_fields.sql
    - supabase/functions/_shared/polar-client.ts
  modified:
    - src/integrations/supabase/types.ts

key-decisions:
  - "6 billing fields in user_profiles: polar_customer_id, polar_external_id, subscription_id, subscription_status, product_id, current_period_end"
  - "CHECK constraint for valid subscription_status values"
  - "Partial indexes for non-null billing fields (optimized for mostly-free users)"
  - "Lazy singleton pattern for Polar SDK client"
  - "POLAR_ORG_ID as both constant and function for flexibility"

patterns-established:
  - "npm:@polar-sh/sdk import pattern for Deno Edge Functions"
  - "getPolarClient() factory for centralized SDK initialization"
  - "Type exports from shared module for webhook handling"

# Metrics
duration: 4min
completed: 2026-01-31
---

# Phase 8 Plan 1: Polar Billing Infrastructure Summary

**Database schema and SDK client foundation for 3-tier billing system (Solo/Team/Business) using Polar as payment provider**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-31T16:13:56Z
- **Completed:** 2026-01-31T16:17:41Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Added 6 Polar billing columns to user_profiles table with proper constraints and indexes
- Created shared polar-client.ts module for centralized SDK initialization in Edge Functions
- Updated TypeScript types to include new billing fields with JSDoc documentation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create database migration** - `657bacf` (feat)
2. **Task 2: Create Polar SDK client module** - `2f87a32` (feat)
3. **Task 3: Update TypeScript types** - `b7bc978` (feat)

## Files Created/Modified

- `supabase/migrations/20260131161417_add_polar_billing_fields.sql` - Migration adding 6 billing columns to user_profiles
- `supabase/functions/_shared/polar-client.ts` - Shared Polar SDK client with getPolarClient() and type exports
- `src/integrations/supabase/types.ts` - TypeScript types updated with billing fields in Row/Insert/Update interfaces

## Decisions Made

1. **6 billing fields chosen per CONTEXT.md:** polar_customer_id (UUID), polar_external_id (TEXT), subscription_id (UUID), subscription_status (TEXT), product_id (TEXT), current_period_end (TIMESTAMPTZ)
2. **CHECK constraint for subscription_status:** Validates 8 Polar status values (active, canceled, revoked, incomplete, incomplete_expired, trialing, past_due, unpaid)
3. **Partial indexes:** Created on polar_customer_id and subscription_status WHERE NOT NULL - optimized for free tier users
4. **Lazy singleton pattern:** getPolarClient() returns cached instance, avoids re-initialization
5. **Error messages include fix instructions:** Tell users exactly how to set missing env vars

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

**External services require manual configuration.** The following environment variables must be added to Supabase secrets before using Polar Edge Functions:

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

**Dashboard configuration:**
- Create 3 products in Polar: Solo ($29/mo), Team ($99/mo), Business ($249/mo)
- Configure webhook endpoint URL pointing to your Edge Function

## Next Phase Readiness

- Schema ready for Polar webhook handling (08-02)
- SDK client ready for use in subscription Edge Functions
- Types ready for frontend billing UI (08-03)

---
*Phase: 08-growth-infrastructure*
*Completed: 2026-01-31*
