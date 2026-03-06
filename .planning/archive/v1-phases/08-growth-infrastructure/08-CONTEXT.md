# Phase 8: Growth Infrastructure - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Post-launch features to support user acquisition and monetization:
- 3-tier billing (Solo/Team/Business) with upgrade/downgrade
- YouTube video import as call transcripts
- Cost tracking dashboard for admins

**Note:** Slack notification action (GROW-04) deferred per user request.

</domain>

<decisions>
## Implementation Decisions

### Billing tiers & upgrade flow
- **Access:** Both Settings > Billing tab AND header upgrade button for free users
- **Plan display:** Side-by-side cards showing Solo/Team/Business with feature lists
- **Payment provider:** Polar (not Stripe/Paddle)
- **Downgrade behavior:** Allowed immediately, excess features become read-only (no blocking)

### Polar integration
- **SDK:** Use `@polar-sh/sdk` directly in Edge Functions (not `@polar-sh/supabase` convenience wrapper — that's for Next.js/Express)
- **Customer creation:** Everyone becomes a Polar customer at signup (including free tier)
- **Subscription sync:** Webhooks for real-time updates + Customer State API for on-demand checks (hybrid approach)
- **Local storage fields in profiles table:**
  - `polar_customer_id` (UUID): Polar's internal ID for API calls
  - `polar_external_id` (string): App's user ID (unique per org)
  - `subscription_id` (UUID): Active sub ID (null if none)
  - `subscription_status` (enum: 'active', 'canceled', 'revoked', etc.)
  - `product_id` or `product_key` (string): Identifies tier (e.g., 'solo-monthly')
  - `current_period_end` (timestamp): Renewal date for trial/expiration checks

### YouTube import experience
- **Location:** Separate 'Manual Import' page (not on Sync page with OAuth integrations)
- **Progress feedback:** Step-by-step progress (Fetching -> Transcribing -> Processing -> Done)
- **Metadata imported:** Full details (title, thumbnail, channel, description, publish date)
- **Display treatment:** Separate filterable section — YouTube imports have their own category (not mixed with Zoom/Meet calls)

### Cost tracking dashboard
- **Access:** Admin-only (not team owners)
- **Metrics:** Full breakdown by model, by feature (chat, analysis, automation), by user
- **Time ranges:** This month, last month, all-time total
- **Location:** Settings > Admin tab (extend existing cost tracking already there)

### Claude's Discretion
- Card styling and layout details for plan comparison
- Exact step names/timing for YouTube import progress
- Chart/visualization choices for cost dashboard
- Error handling patterns (use established codebase conventions)

</decisions>

<specifics>
## Specific Ideas

### Polar Edge Function pattern
```typescript
// Deno Edge Function pattern (not Next.js handlers)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { Polar } from 'npm:@polar-sh/sdk';

const polar = new Polar({ accessToken: Deno.env.get('POLAR_ACCESS_TOKEN')! });

serve(async (req) => {
  if (req.method === 'POST') {
    const payload = await req.json();
    // Verify webhook signature manually
    // Sync to Supabase
    return new Response('OK');
  }
});
```

### Webhook handlers needed
- `onSubscriptionCreated` - New subscription
- `onSubscriptionActive` - Subscription becomes active
- `onSubscriptionCanceled` - Subscription canceled
- `onSubscriptionRevoked` - Subscription revoked
- `onCustomerCreated` - New customer at signup
- `onCustomerStateChanged` - State change triggers sync

### Polar Supabase example
Reference implementation: https://github.com/polarsource/examples/tree/main/with-react-router-supabase
(Adapt patterns for Deno Edge Functions)

</specifics>

<deferred>
## Deferred Ideas

- **GROW-04: Slack notification action** — User requested to push this to later, not part of this phase
- Slack OAuth flow, channel selection, message formatting all deferred

</deferred>

---

*Phase: 08-growth-infrastructure*
*Context gathered: 2026-01-31*
