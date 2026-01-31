# Phase 8: Growth Infrastructure - Research

**Researched:** 2026-01-31
**Domain:** Billing (Polar), YouTube Import, Cost Tracking
**Confidence:** MEDIUM (official SDK docs verified, some patterns adapted from training data)

## Summary

This phase covers three distinct domains: subscription billing with Polar, YouTube video import with transcription, and cost tracking dashboard extension. Research confirms Polar's `@polar-sh/sdk` supports Deno runtime (v1.39+) and provides built-in webhook validation. The existing YouTube API Edge Function already handles metadata fetching and transcription via an external API. Cost tracking infrastructure exists but needs extension for admin-wide views and per-user breakdowns.

**Primary recommendation:** Use Polar SDK directly in Supabase Edge Functions with the `npm:` specifier pattern. Leverage existing `youtube-api` function patterns. Extend current `embedding_usage_logs` table and `CostDashboard` component for admin views.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@polar-sh/sdk` | Latest | Polar billing integration | Official SDK with Deno support (v1.39+), built-in webhook validation |
| YouTube Data API v3 | v3 | Video metadata fetching | Already implemented in `youtube-api` function |
| `embedding_usage_logs` | N/A (table) | Cost tracking storage | Already exists with full schema for model/feature/user tracking |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `standardwebhooks` | (via SDK) | Webhook signature verification | Polar webhook handler (SDK uses this internally) |
| Tremor charts | ^3.18.7 | Cost dashboard visualizations | Already in use in BillingTab |
| Tanstack Query | ^5.90.10 | Data fetching for admin dashboard | Existing pattern in codebase |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Polar | Stripe | Polar is explicitly chosen by user; Stripe has larger ecosystem but more complexity |
| YouTube captions API | Custom transcription (Whisper) | Captions API requires OAuth + video ownership; current `TRANSCRIPT_API_KEY` approach is simpler |
| Static pricing in code | OpenRouter pricing API | Static is more reliable; API is dynamic but adds network dependency |

**Installation (Frontend):**
```bash
# No new packages needed - all supporting libs already installed
```

**Edge Function Import:**
```typescript
// Deno runtime - use npm: specifier
import { Polar } from 'npm:@polar-sh/sdk';
import { validateEvent, WebhookVerificationError } from 'npm:@polar-sh/sdk/webhooks';
```

## Architecture Patterns

### Recommended Project Structure

```
supabase/functions/
├── polar-webhook/           # Webhook handler for subscription events
│   └── index.ts
├── polar-create-customer/   # Create Polar customer at signup
│   └── index.ts
├── polar-checkout/          # Generate checkout URLs
│   └── index.ts
├── polar-customer-state/    # On-demand state sync
│   └── index.ts
├── youtube-import/          # NEW: Process full import flow
│   └── index.ts
├── youtube-api/             # EXISTING: Low-level API calls
│   └── index.ts
└── _shared/
    └── polar-client.ts      # Shared Polar client initialization

src/
├── pages/
│   └── ManualImport.tsx     # YouTube import page
├── components/
│   ├── billing/
│   │   ├── PlanCards.tsx    # Side-by-side plan comparison
│   │   ├── UpgradeButton.tsx
│   │   └── DowngradeNotice.tsx
│   └── settings/
│       ├── AdminCostDashboard.tsx  # Extended admin view
│       └── BillingTab.tsx   # Existing, add Polar integration
└── hooks/
    ├── usePolarCustomer.ts
    ├── useSubscription.ts
    └── useAdminCosts.ts     # Admin-level cost aggregation
```

### Pattern 1: Polar SDK in Deno Edge Functions

**What:** Initialize Polar client with access token from environment
**When to use:** All Polar API interactions in Edge Functions

```typescript
// Source: https://github.com/polarsource/polar-js/blob/main/RUNTIMES.md
// Supports Deno v1.39+

import { Polar } from 'npm:@polar-sh/sdk';

const polar = new Polar({
  accessToken: Deno.env.get('POLAR_ACCESS_TOKEN')!,
});

// Create customer with external ID (app's user ID)
const customer = await polar.customers.create({
  email: user.email,
  name: user.display_name,
  externalId: user.id,  // Maps to polar_external_id in profiles
  organizationId: Deno.env.get('POLAR_ORGANIZATION_ID')!,
});
```

### Pattern 2: Polar Webhook Validation

**What:** Validate incoming webhooks using SDK's built-in validation
**When to use:** `polar-webhook` Edge Function

```typescript
// Source: https://raw.githubusercontent.com/polarsource/polar-js/main/src/webhooks.ts
import { validateEvent, WebhookVerificationError } from 'npm:@polar-sh/sdk/webhooks';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await req.text();
  const secret = Deno.env.get('POLAR_WEBHOOK_SECRET')!;
  
  // Headers object for validation
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  try {
    const event = validateEvent(body, headers, secret);
    
    switch (event.type) {
      case 'subscription.created':
        await handleSubscriptionCreated(event.data);
        break;
      case 'subscription.active':
        await handleSubscriptionActive(event.data);
        break;
      case 'subscription.canceled':
        await handleSubscriptionCanceled(event.data);
        break;
      case 'subscription.revoked':
        await handleSubscriptionRevoked(event.data);
        break;
      case 'customer.created':
        await handleCustomerCreated(event.data);
        break;
      case 'customer.state_changed':
        await handleCustomerStateChanged(event.data);
        break;
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      return new Response('Invalid signature', { status: 403 });
    }
    throw error;
  }
});
```

### Pattern 3: Customer State API (Hybrid Sync)

**What:** Fetch current customer state on-demand to supplement webhooks
**When to use:** Before displaying billing page, after checkout completes

```typescript
// Source: https://raw.githubusercontent.com/polarsource/polar-js/main/docs/sdks/customers/README.md

// By external ID (app's user ID)
const state = await polar.customers.getStateExternal({
  externalId: userId,
});

// Returns: { activeSubscriptions, activeOrders, activeEntitlements }
// Use to verify subscription status and update local DB if needed
```

### Pattern 4: YouTube Import Flow

**What:** Multi-step import with progress tracking
**When to use:** Manual import page

```typescript
// Frontend progress states
type ImportStep = 'idle' | 'fetching' | 'transcribing' | 'processing' | 'done' | 'error';

// Existing youtube-api function handles:
// - 'video-details': Get metadata (title, thumbnail, channel, description, publishedAt)
// - 'transcript': Get transcript via external API

// New youtube-import function orchestrates:
// 1. Validate YouTube URL, extract video ID
// 2. Fetch video details via youtube-api
// 3. Fetch transcript via youtube-api
// 4. Create call record in fathom_calls with source='youtube'
// 5. Create transcript chunks and embeddings
// 6. Return call ID for redirect
```

### Pattern 5: Admin Cost Dashboard Extension

**What:** Aggregate costs across all users for admin view
**When to use:** Settings > Admin tab for ADMIN role users

```typescript
// Existing table: embedding_usage_logs
// Existing columns: user_id, operation_type, model, cost_cents, created_at

// New RPC function for admin aggregation:
CREATE OR REPLACE FUNCTION public.get_admin_cost_summary(
  p_period TEXT DEFAULT 'month'  -- 'month', 'last_month', 'all'
)
RETURNS TABLE (
  -- By model
  model_breakdown JSONB,
  -- By feature (operation_type)
  feature_breakdown JSONB,
  -- By user (top consumers)
  user_breakdown JSONB,
  -- Totals
  total_cost_cents NUMERIC,
  total_tokens BIGINT,
  total_requests BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER  -- Bypass RLS for admin aggregation
AS $$
  -- Implementation aggregates from embedding_usage_logs
$$;
```

### Anti-Patterns to Avoid

- **Direct Supabase calls for billing state:** Always sync through webhooks + local DB. Never query Polar API on every page load.
- **Storing full Polar response objects:** Only store the fields defined in CONTEXT.md (`polar_customer_id`, `subscription_id`, etc.)
- **Using YouTube OAuth for public videos:** The Data API with API key is simpler for public video metadata.
- **Fetching YouTube captions directly:** Requires video ownership. Use external transcript service (already implemented).
- **Real-time OpenRouter pricing API calls:** Static pricing table is more reliable and already exists in `usage-tracker.ts`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Webhook signature verification | HMAC validation logic | `validateEvent()` from SDK | Uses standardwebhooks library, handles edge cases |
| Subscription state machine | Custom status tracking | Polar's webhook events + Customer State API | Polar handles trial, grace periods, proration |
| YouTube video ID extraction | Regex parsing | Existing `youtube-api` function | Already handles various URL formats |
| Cost calculation from tokens | Custom math | Existing `calculateCostCents()` in `usage-tracker.ts` | Already maps models to pricing |
| Plan comparison UI | Custom cards | Extend existing `BillingTab.tsx` pattern | Consistent with current design system |

**Key insight:** Polar SDK handles the complexity of billing state management. The hybrid approach (webhooks for real-time + API for verification) prevents sync issues without over-engineering.

## Common Pitfalls

### Pitfall 1: Missing Webhook Events

**What goes wrong:** Not handling all subscription lifecycle events leads to stale local state
**Why it happens:** Only implementing `subscription.created` and ignoring uncanceled, revoked, etc.
**How to avoid:** Handle ALL events listed in CONTEXT.md: created, active, canceled, revoked, plus customer events
**Warning signs:** Users complaining about access after cancellation, or missing access after resubscription

### Pitfall 2: Race Condition Between Checkout and Webhook

**What goes wrong:** User redirected to app before webhook arrives, sees wrong plan
**Why it happens:** Webhook delivery can be delayed by seconds
**How to avoid:** After checkout redirect, call `getStateExternal()` to verify and update local DB
**Warning signs:** Users see "Free" plan immediately after paying, then it updates moments later

### Pitfall 3: YouTube Import Without Source Tracking

**What goes wrong:** YouTube imports mixed with call recordings, confusing UX
**Why it happens:** Not marking imports distinctly in database
**How to avoid:** Add `source` column to calls table (values: 'fathom', 'zoom', 'google-meet', 'youtube')
**Warning signs:** Filter confusion, inability to manage YouTube imports separately

### Pitfall 4: Admin Cost Query Performance

**What goes wrong:** Admin dashboard slow with thousands of usage logs
**Why it happens:** Full table scans without proper filtering
**How to avoid:** Use existing indexes, add composite index for admin queries if needed
**Warning signs:** Dashboard taking >2s to load, timeouts on large datasets

### Pitfall 5: Downgrade Feature Gating

**What goes wrong:** Users lose access to data when downgrading instead of read-only
**Why it happens:** Blocking access entirely instead of allowing view-only
**How to avoid:** Implement read-only mode for excess features (per CONTEXT.md decision)
**Warning signs:** User complaints about data loss after downgrade

## Code Examples

### Polar Customer Creation at Signup

```typescript
// supabase/functions/polar-create-customer/index.ts
// Source: Adapted from SDK docs + CONTEXT.md decisions

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Polar } from 'npm:@polar-sh/sdk';
import { getCorsHeaders } from '../_shared/cors.ts';

const polar = new Polar({
  accessToken: Deno.env.get('POLAR_ACCESS_TOKEN')!,
});

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin'));
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token!);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if customer already exists
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('polar_customer_id')
      .eq('user_id', user.id)
      .single();

    if (profile?.polar_customer_id) {
      return new Response(JSON.stringify({ 
        success: true, 
        customerId: profile.polar_customer_id 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Polar customer
    const customer = await polar.customers.create({
      email: user.email!,
      name: user.user_metadata?.display_name || user.email!.split('@')[0],
      externalId: user.id,  // App's user ID
      organizationId: Deno.env.get('POLAR_ORGANIZATION_ID')!,
    });

    // Store in profiles table
    await supabase
      .from('user_profiles')
      .update({
        polar_customer_id: customer.id,
        polar_external_id: user.id,
      })
      .eq('user_id', user.id);

    return new Response(JSON.stringify({ 
      success: true, 
      customerId: customer.id 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Polar customer creation error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

### Webhook Handler Subscription Sync

```typescript
// supabase/functions/polar-webhook/index.ts (partial)
// Source: SDK webhooks.ts + CONTEXT.md decisions

async function handleSubscriptionActive(
  supabase: SupabaseClient,
  data: any  // WebhookSubscriptionActivePayload['data']
) {
  const { subscription, customer } = data;
  
  // Update profiles table with subscription info
  await supabase
    .from('user_profiles')
    .update({
      subscription_id: subscription.id,
      subscription_status: 'active',
      product_id: subscription.productId,
      current_period_end: subscription.currentPeriodEnd,
    })
    .eq('polar_customer_id', customer.id);

  console.log(`Subscription activated for customer ${customer.id}`);
}

async function handleSubscriptionCanceled(
  supabase: SupabaseClient,
  data: any
) {
  const { subscription, customer } = data;
  
  // Update status but don't clear subscription_id yet
  // User keeps access until current_period_end
  await supabase
    .from('user_profiles')
    .update({
      subscription_status: 'canceled',
      // Keep current_period_end - they have access until then
    })
    .eq('polar_customer_id', customer.id);
}

async function handleSubscriptionRevoked(
  supabase: SupabaseClient,
  data: any
) {
  const { subscription, customer } = data;
  
  // Immediate loss of access
  await supabase
    .from('user_profiles')
    .update({
      subscription_status: 'revoked',
      subscription_id: null,
      product_id: null,
      current_period_end: null,
    })
    .eq('polar_customer_id', customer.id);
}
```

### YouTube Import Orchestration

```typescript
// supabase/functions/youtube-import/index.ts (partial)
// Source: Existing youtube-api patterns + CONTEXT.md decisions

interface ImportRequest {
  videoUrl: string;
}

async function importYouTubeVideo(
  supabase: SupabaseClient,
  userId: string,
  videoUrl: string
): Promise<{ callId: number; status: string }> {
  // 1. Extract video ID
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }

  // 2. Fetch video details (existing function)
  const detailsResponse = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/youtube-api`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        action: 'video-details',
        params: { videoId },
      }),
    }
  );
  const { data: details } = await detailsResponse.json();

  // 3. Fetch transcript (existing function)
  const transcriptResponse = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/youtube-api`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        action: 'transcript',
        params: { videoId },
      }),
    }
  );
  const { data: transcriptData } = await transcriptResponse.json();

  // 4. Create call record with source='youtube'
  const { data: call, error } = await supabase
    .from('fathom_calls')
    .insert({
      user_id: userId,
      title: details.title,
      full_transcript: transcriptData.transcript,
      recording_start_time: new Date(details.publishedAt).toISOString(),
      source: 'youtube',  // Distinguish from other sources
      metadata: {
        youtube_video_id: videoId,
        youtube_channel_id: details.channelId,
        youtube_channel_title: details.channelTitle,
        youtube_description: details.description,
        youtube_thumbnail: details.thumbnails?.high?.url,
        youtube_duration: details.duration,
      },
    })
    .select('recording_id')
    .single();

  if (error) throw error;

  // 5. Trigger embedding pipeline (existing flow)
  // The process-embeddings function will handle chunking and embedding

  return { callId: call.recording_id, status: 'processing' };
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,  // Direct video ID
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
```

### Admin Cost Dashboard Query

```typescript
// src/hooks/useAdminCosts.ts
// Source: Existing useAICosts pattern + admin requirements

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AdminCostPeriod = 'month' | 'last_month' | 'all';

interface AdminCostData {
  byModel: { model: string; costCents: number; requests: number; tokens: number }[];
  byFeature: { feature: string; costCents: number; requests: number }[];
  byUser: { userId: string; email: string; costCents: number; requests: number }[];
  totals: { costCents: number; tokens: number; requests: number };
}

export function useAdminCosts(period: AdminCostPeriod) {
  return useQuery({
    queryKey: ['admin-costs', period],
    queryFn: async (): Promise<AdminCostData> => {
      // Date range based on period
      let startDate: Date;
      const now = new Date();
      
      switch (period) {
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'last_month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          break;
        case 'all':
          startDate = new Date(0);
          break;
      }

      // Aggregate by model
      const { data: byModel } = await supabase
        .from('embedding_usage_logs')
        .select('model, cost_cents, total_tokens')
        .gte('created_at', startDate.toISOString());

      // Aggregate by operation type (feature)
      const { data: byFeature } = await supabase
        .from('embedding_usage_logs')
        .select('operation_type, cost_cents')
        .gte('created_at', startDate.toISOString());

      // Aggregate by user with email lookup
      const { data: byUser } = await supabase
        .from('embedding_usage_logs')
        .select(`
          user_id,
          cost_cents,
          user_profiles!inner(email)
        `)
        .gte('created_at', startDate.toISOString());

      // Process aggregations...
      return {
        byModel: aggregateByModel(byModel || []),
        byFeature: aggregateByFeature(byFeature || []),
        byUser: aggregateByUser(byUser || []),
        totals: calculateTotals(byModel || []),
      };
    },
    staleTime: 1000 * 60 * 5,  // 5 minutes
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stripe checkout sessions | Polar checkout links | User decision | Simpler integration, fewer webhooks |
| YouTube OAuth for captions | External transcript API | Already implemented | No OAuth flow needed for imports |
| Per-request pricing lookup | Static pricing table | Already implemented | Faster, more reliable cost calculation |

**Deprecated/outdated:**
- `@polar-sh/supabase` wrapper: This is for Next.js/Express, not Deno Edge Functions. Use `@polar-sh/sdk` directly.
- YouTube `sync` parameter for captions: Deprecated March 2024 per Google docs

## Open Questions

1. **Polar Product IDs Configuration**
   - What we know: Need product_key like 'solo-monthly' to identify tiers
   - What's unclear: Exact product IDs in Polar dashboard (need to be created)
   - Recommendation: Create products in Polar, then add IDs to environment variables

2. **Checkout Link vs Session Creation**
   - What we know: SDK has both `checkoutLinks` and `checkouts` APIs
   - What's unclear: Which is better for SaaS upgrade flow
   - Recommendation: Use `checkouts.create()` for dynamic pricing, `checkoutLinks` for static upgrade buttons

3. **Transcript API Rate Limits**
   - What we know: External API (`api.youdotcom/v1/transcript`) is used
   - What's unclear: Rate limits, pricing, reliability
   - Recommendation: Add rate limiting + queue for bulk imports, handle failures gracefully

## Sources

### Primary (HIGH confidence)
- GitHub `polarsource/polar-js` README.md - SDK installation, webhook validation pattern
- GitHub `polarsource/polar-js/RUNTIMES.md` - Deno v1.39+ support confirmed
- GitHub `polarsource/polar-js/docs/sdks/customers/README.md` - Customer API: create, getState, getStateExternal
- GitHub `polarsource/polar-js/docs/sdks/subscriptions/README.md` - Subscription API patterns
- GitHub `polarsource/polar-js/src/webhooks.ts` - All webhook event types and validation
- Google YouTube Data API v3 docs - Videos and Captions endpoints

### Secondary (MEDIUM confidence)
- Existing codebase patterns: `youtube-api/index.ts`, `usage-tracker.ts`, `CostDashboard.tsx`
- CONTEXT.md decisions - User-confirmed choices for Polar integration details

### Tertiary (LOW confidence)
- Polar organization ID and product ID configuration - Requires setup in Polar dashboard
- External transcript API reliability - Limited documentation available

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - SDK docs verified, Deno support confirmed
- Architecture: MEDIUM - Patterns adapted from SDK examples, some extrapolation
- Pitfalls: MEDIUM - Based on general webhook/billing best practices + training data

**Research date:** 2026-01-31
**Valid until:** 2026-03-01 (Polar SDK may update; YouTube API stable)
