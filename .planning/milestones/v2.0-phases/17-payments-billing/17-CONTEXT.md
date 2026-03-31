# Phase 17: Payments & Billing - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the existing Polar.sh billing integration fully functional: plan tiers display correctly, upgrade/cancel works, trial activates for new signups, AI usage is visible and enforced, and webhooks process subscription events. Most code exists — this is repair and completion work.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — repair/completion phase. Key known state from codebase audit:
- Polar.sh billing already integrated — PlanCards.tsx, BillingTab.tsx, useSubscription.ts exist
- Missing: cancel subscription button, AI usage display
- usage-tracker.ts edge function exists for tracking AI usage
- Webhook processing exists but needs E2E verification
- 3 tiers: Free (25 AI credits/mo), Pro (1000), Team (5000)
- 14-day Pro trial for new signups

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/billing/PlanCards.tsx` — Plan tier display
- `src/components/settings/BillingTab.tsx` — Billing settings tab
- `src/hooks/useSubscription.ts` — Subscription state management
- `supabase/functions/_shared/usage-tracker.ts` — AI credit tracking

### Integration Points
- BillingTab in Settings page
- Polar checkout redirect for upgrades
- Polar customer portal for cancel
- Webhook endpoint for subscription events

</code_context>

<specifics>
## Specific Ideas

No specific requirements — repair/completion phase

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>

---

*Phase: 17-payments-billing*
*Context gathered: 2026-03-30 via infrastructure skip*
