# CallVault Polar.sh Payment Integration - GSD Spec

**Created:** 2026-02-14  
**Methodology:** Get Shit Done (GSD)  
**Status:** Draft - Ready for Implementation  
**Epic:** 3-Tier Billing System

---

## Executive Summary

This spec defines the complete payment integration for CallVault using Polar.sh as the payment provider. The system enables a 3-tier subscription model (Solo/Team/Business) with full lifecycle management including upgrades, downgrades, cancellations, and a customer billing portal.

**Key Objectives:**
- Enable users to subscribe to paid plans via Polar checkout
- Sync subscription state in real-time via webhooks
- Provide self-service billing management
- Track subscription status locally for access control

**Technical Approach:**
- Hybrid sync (webhooks for real-time + API for verification)
- Deno Edge Functions for all Polar interactions
- Local subscription state cache in user_profiles table
- Read-only downgrade behavior (no data loss)

---

## User Stories

### US-1: Subscribe to Paid Plan
**As a** free tier user  
**I want to** upgrade to a paid plan (Solo, Team, or Business)  
**So that** I can access premium features

**Acceptance Criteria:**
- [ ] User can view plan comparison on Settings > Billing tab
- [ ] Each plan displays features, pricing, and "Upgrade" button
- [ ] Clicking "Upgrade" redirects to Polar checkout
- [ ] After payment, user is redirected back to app
- [ ] Subscription status updates within 5 seconds of payment
- [ ] User immediately sees new plan features enabled

**Technical Notes:**
- Use `polar.checkouts.create()` to generate checkout URL
- Include `successUrl` redirect to `/settings?tab=billing`
- Link checkout to existing Polar customer via `customerExternalId`

---

### US-2: View Current Subscription
**As a** paying subscriber  
**I want to** see my current plan, billing cycle, and next payment date  
**So that** I understand my subscription status

**Acceptance Criteria:**
- [ ] Billing tab shows current plan name prominently
- [ ] Next billing date displayed
- [ ] Payment amount and billing interval visible
- [ ] "Manage Subscription" link to Polar customer portal
- [ ] Cancellation status shown if subscription is canceled

**Technical Notes:**
- Read from local `user_profiles` table fields:
  - `product_id` (maps to plan name)
  - `current_period_end` (next billing date)
  - `subscription_status` (active/canceled/etc.)

---

### US-3: Upgrade Between Paid Plans
**As a** Solo plan subscriber  
**I want to** upgrade to Team or Business  
**So that** I can access higher-tier features

**Acceptance Criteria:**
- [ ] Higher-tier plans show "Upgrade" button
- [ ] Clicking upgrade redirects to Polar checkout
- [ ] Prorated amount charged immediately
- [ ] New features enabled immediately after payment
- [ ] Existing data preserved during upgrade

**Technical Notes:**
- Same checkout flow as US-1, different `productId`
- Polar handles proration automatically
- Webhook updates subscription_id and product_id

---

### US-4: Downgrade to Lower Plan
**As a** Business plan subscriber  
**I want to** downgrade to Team or Solo plan  
**So that** I can reduce my costs

**Acceptance Criteria:**
- [ ] Lower-tier plans show "Downgrade" button
- [ ] Downgrade takes effect at end of current billing period
- [ ] User retains current plan features until period end
- [ ] Excess features become read-only (not deleted)
- [ ] Clear messaging about downgrade timing and impact

**Technical Notes:**
- Use Polar customer portal for downgrade (not in-app)
- Webhook with `subscription_status='canceled'` but keep `current_period_end`
- Access control checks `current_period_end` > now for feature access
- After period end, webhook with new subscription activates lower tier

---

### US-5: Cancel Subscription
**As a** paying subscriber  
**I want to** cancel my subscription  
**So that** I'm not charged again

**Acceptance Criteria:**
- [ ] "Cancel Subscription" link visible on billing tab
- [ ] Link opens Polar customer portal
- [ ] Cancellation confirmed with clear messaging
- [ ] User retains access until end of billing period
- [ ] Data remains accessible (read-only) after cancellation
- [ ] Can resubscribe at any time

**Technical Notes:**
- Webhook `subscription.canceled` updates status but keeps access
- When `current_period_end` passes, features become read-only
- Do NOT delete user data or recordings

---

### US-6: Reactivate Canceled Subscription
**As a** user with canceled subscription  
**I want to** reactivate before my access ends  
**So that** I don't lose my current billing rate

**Acceptance Criteria:**
- [ ] If subscription canceled but period active, show "Reactivate" option
- [ ] Clicking reactivate opens Polar portal
- [ ] Reactivation confirmed, subscription continues normally
- [ ] Next billing date preserved

**Technical Notes:**
- Polar customer portal handles reactivation
- Webhook `subscription.uncanceled` (if exists) or `subscription.active`
- Update `subscription_status` back to 'active'

---

### US-7: Access Billing Portal
**As a** paying subscriber  
**I want to** update my payment method, billing address, or view invoices  
**So that** I can manage my account details

**Acceptance Criteria:**
- [ ] "Manage Payment Method" button on billing tab
- [ ] Opens Polar customer portal in new tab
- [ ] Can update card, address, tax info
- [ ] Can view and download past invoices
- [ ] Changes saved and reflected in next billing cycle

**Technical Notes:**
- Use `polar.customerSessions.create()` to generate portal URL
- Session expires after 1 hour
- Portal URL includes customer token for authentication

---

### US-8: Handle Payment Failures
**As a** subscriber with failed payment  
**I want to** be notified and given a chance to update payment  
**So that** I don't lose access unexpectedly

**Acceptance Criteria:**
- [ ] Email notification sent on payment failure (Polar handles)
- [ ] App shows "Payment Failed" banner on dashboard
- [ ] Banner links to billing portal to update payment method
- [ ] Grace period of 7 days before access revoked
- [ ] Access restored immediately after successful payment

**Technical Notes:**
- Webhook `subscription.past_due` sets status
- Show banner when `subscription_status='past_due'`
- Webhook `subscription.unpaid` after grace period
- Webhook `subscription.active` when payment succeeds

---

## Technical Architecture

### Database Schema Extensions

**Table:** `user_profiles` (already exists, fields added via migration)

```sql
-- Migration: 20260131161417_add_polar_billing_fields.sql (already applied)

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS polar_customer_id UUID,
  ADD COLUMN IF NOT EXISTS polar_external_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_id UUID,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT,
  ADD COLUMN IF NOT EXISTS product_id TEXT,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

-- Constraint for valid statuses
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_subscription_status_check
  CHECK (subscription_status IS NULL OR subscription_status IN (
    'incomplete',
    'incomplete_expired',
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'revoked'
  ));

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_polar_customer_id
  ON user_profiles(polar_customer_id)
  WHERE polar_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription_status
  ON user_profiles(subscription_status)
  WHERE subscription_status IS NOT NULL;
```

**Field Definitions:**
- `polar_customer_id` - Polar's internal UUID for the customer (for API calls)
- `polar_external_id` - App's user_id sent to Polar (for linking)
- `subscription_id` - Active Polar subscription UUID (null if free tier)
- `subscription_status` - Current subscription state (null for free users)
- `product_id` - Identifies which tier (e.g., 'solo-monthly', 'team-annual')
- `current_period_end` - When subscription renews or expires

---

### API Routes (Supabase Edge Functions)

#### 1. `polar-create-customer`
**Purpose:** Create Polar customer record for new users  
**Method:** POST  
**Auth:** Required (JWT)  
**Called by:** Frontend on first billing page visit or at signup

**Request:**
```json
{}  // No body needed - uses JWT user context
```

**Response:**
```json
{
  "success": true,
  "customerId": "cus_abc123",
  "created": true  // false if already existed
}
```

**Logic:**
1. Extract user from JWT
2. Check if `polar_customer_id` already exists in profile
3. If not, call `polar.customers.create()` with:
   - email: user.email
   - name: display_name or email prefix
   - externalId: user.id (for linking)
   - organizationId: POLAR_ORGANIZATION_ID
4. Store `polar_customer_id` and `polar_external_id` in user_profiles
5. Return customer ID

**Environment Variables:**
- `POLAR_ACCESS_TOKEN` - Organization Access Token
- `POLAR_ORGANIZATION_ID` - Org ID from Polar dashboard

---

#### 2. `polar-checkout`
**Purpose:** Generate checkout URL for plan upgrade  
**Method:** POST  
**Auth:** Required (JWT)  
**Called by:** Frontend when user clicks "Upgrade" button

**Request:**
```json
{
  "productId": "prod_solo_monthly_abc123"  // Polar product ID
}
```

**Response:**
```json
{
  "checkoutUrl": "https://polar.sh/checkout/abc123"
}
```

**Logic:**
1. Validate user is authenticated
2. Get user's `polar_customer_id` from profile (create customer if needed)
3. Call `polar.checkouts.create()` with:
   - productId: from request
   - customerExternalId: user.id
   - successUrl: `${APP_URL}/settings?tab=billing&checkout=success`
4. Return checkout URL for redirect

**Environment Variables:**
- `POLAR_ACCESS_TOKEN`
- `APP_URL` - Base URL for redirect (e.g., `https://callvault.app`)

---

#### 3. `polar-customer-state`
**Purpose:** Fetch and sync current subscription state on-demand  
**Method:** POST  
**Auth:** Required (JWT)  
**Called by:** Frontend after checkout redirect or on billing page load

**Request:**
```json
{}  // No body needed
```

**Response:**
```json
{
  "subscriptionId": "sub_abc123",
  "status": "active",
  "productId": "prod_solo_monthly",
  "periodEnd": "2026-03-14T16:00:00Z",
  "synced": true  // true if DB was updated
}
```

**Logic:**
1. Extract user from JWT
2. Get `polar_external_id` from profile (user.id)
3. Call `polar.customers.getStateExternal({ externalId })` 
4. Extract active subscription from response
5. Compare with local DB state
6. If different, update user_profiles with new state
7. Return current subscription info

**Purpose of This Endpoint:**
- Handles race condition where checkout completes before webhook arrives
- Provides verification mechanism for critical operations
- Allows frontend to immediately show correct plan after payment

---

#### 4. `polar-webhook`
**Purpose:** Receive and process Polar webhook events  
**Method:** POST  
**Auth:** Webhook signature validation  
**Called by:** Polar servers (configure endpoint in Polar dashboard)

**Request:** (Raw webhook payload from Polar)
```json
{
  "type": "subscription.active",
  "data": {
    "subscription": { ... },
    "customer": { ... }
  }
}
```

**Response:**
```json
{
  "received": true
}
```

**Logic:**
1. Validate webhook signature using `validateEvent()` from SDK
2. Extract event type and data
3. Route to appropriate handler based on event type
4. Update user_profiles using `polar_customer_id` as lookup
5. Log event for debugging
6. Return 200 OK (400/500 on error)

**Event Handlers:**

**`subscription.created`**
```typescript
// Store new subscription details
UPDATE user_profiles SET
  subscription_id = data.subscription.id,
  subscription_status = 'incomplete',  // or data.subscription.status
  product_id = data.subscription.productId,
  current_period_end = data.subscription.currentPeriodEnd
WHERE polar_customer_id = data.customer.id;
```

**`subscription.active`**
```typescript
// Mark subscription as active
UPDATE user_profiles SET
  subscription_status = 'active',
  subscription_id = data.subscription.id,
  product_id = data.subscription.productId,
  current_period_end = data.subscription.currentPeriodEnd
WHERE polar_customer_id = data.customer.id;
```

**`subscription.canceled`**
```typescript
// User canceled but retains access until period end
UPDATE user_profiles SET
  subscription_status = 'canceled'
  -- Keep subscription_id and current_period_end
WHERE polar_customer_id = data.customer.id;
```

**`subscription.revoked`**
```typescript
// Immediate loss of access (payment failure, fraud, etc.)
UPDATE user_profiles SET
  subscription_status = 'revoked',
  subscription_id = NULL,
  product_id = NULL,
  current_period_end = NULL
WHERE polar_customer_id = data.customer.id;
```

**`subscription.updated`**
```typescript
// Subscription details changed (upgrade, downgrade at period end)
UPDATE user_profiles SET
  product_id = data.subscription.productId,
  current_period_end = data.subscription.currentPeriodEnd,
  subscription_status = data.subscription.status
WHERE polar_customer_id = data.customer.id;
```

**`customer.created`**
```typescript
// Store polar_customer_id (usually done in create-customer, but webhook is backup)
UPDATE user_profiles SET
  polar_customer_id = data.customer.id,
  polar_external_id = data.customer.externalId
WHERE user_id = data.customer.externalId;
```

**Environment Variables:**
- `POLAR_WEBHOOK_SECRET` - Secret for signature validation
- `SUPABASE_URL` - For service role client
- `SUPABASE_SERVICE_ROLE_KEY` - For bypassing RLS

---

#### 5. `polar-portal-session`
**Purpose:** Generate customer portal session URL  
**Method:** POST  
**Auth:** Required (JWT)  
**Called by:** Frontend when user clicks "Manage Subscription"

**Request:**
```json
{}  // No body needed
```

**Response:**
```json
{
  "portalUrl": "https://polar.sh/portal/abc123"
}
```

**Logic:**
1. Get user's `polar_customer_id` from profile
2. Call `polar.customerSessions.create()` with:
   - customerId: polar_customer_id
3. Return session URL (expires in 1 hour)
4. Frontend opens URL in new tab

---

### Polar Product Configuration

**Products to Create in Polar Dashboard:**

| Product Name | Product Key | Price (Monthly) | Price (Annual) | Features |
|--------------|-------------|-----------------|----------------|----------|
| CallVault Solo | `solo` | $19/month | $190/year | 100 calls/month, basic AI, 1 user |
| CallVault Team | `team` | $49/month | $490/year | 500 calls/month, advanced AI, 5 users |
| CallVault Business | `business` | $99/month | $990/year | Unlimited calls, custom AI, unlimited users |

**Environment Variables to Set:**
```bash
# Polar API Configuration
POLAR_ACCESS_TOKEN=polar_oat_xxxxxxxxxxxxx
POLAR_ORGANIZATION_ID=org_xxxxxxxxxxxxx
POLAR_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# Product IDs (from Polar dashboard)
POLAR_PRODUCT_SOLO_MONTHLY=prod_xxxxxxxxxxxxx
POLAR_PRODUCT_SOLO_ANNUAL=prod_xxxxxxxxxxxxx
POLAR_PRODUCT_TEAM_MONTHLY=prod_xxxxxxxxxxxxx
POLAR_PRODUCT_TEAM_ANNUAL=prod_xxxxxxxxxxxxx
POLAR_PRODUCT_BUSINESS_MONTHLY=prod_xxxxxxxxxxxxx
POLAR_PRODUCT_BUSINESS_ANNUAL=prod_xxxxxxxxxxxxx

# App Configuration
APP_URL=https://callvault.app
```

---

### Frontend Components

#### 1. `BillingTab` (Settings Page)
**Location:** `src/pages/Settings.tsx` (existing, extend billing tab)

**Components to Add:**
- `<PlanComparison />` - Side-by-side cards for Solo/Team/Business
- `<CurrentPlan />` - Display active subscription details
- `<UpgradeButton />` - Redirects to checkout
- `<ManageSubscriptionButton />` - Opens Polar portal
- `<SubscriptionStatus />` - Shows status, next billing, cancel notice

**Logic:**
- Fetch subscription state from `user_profiles` table
- Call `polar-customer-state` on mount to verify sync
- Show loading state during checkout redirect
- Poll for state changes after redirect (query param `?checkout=success`)

---

#### 2. `PlanComparisonCards`
**Purpose:** Display all available plans with features and pricing

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  Solo             Team              Business                │
│  $19/mo          $49/mo             $99/mo                   │
│  ────────────    ────────────       ────────────            │
│  ✓ 100 calls     ✓ 500 calls       ✓ Unlimited calls       │
│  ✓ Basic AI      ✓ Advanced AI     ✓ Custom AI             │
│  ✓ 1 user        ✓ 5 users         ✓ Unlimited users       │
│  ✓ Email sup.    ✓ Priority sup.   ✓ Dedicated support     │
│                                                              │
│  [Upgrade]       [Current Plan]    [Upgrade]                │
└─────────────────────────────────────────────────────────────┘
```

**Button States:**
- Current plan: Disabled button showing "Current Plan"
- Higher tier: "Upgrade" button (redirects to checkout)
- Lower tier: "Downgrade" link (opens portal with downgrade flow)
- Free user: All show "Upgrade"

---

#### 3. `SubscriptionStatusBanner`
**Purpose:** Show important subscription notices

**Conditions:**
- `subscription_status='past_due'` → "Payment Failed" banner with link to update payment
- `subscription_status='canceled'` → "Subscription Canceled" notice with period end date
- `current_period_end` < 7 days → "Renewing Soon" notice with date
- `subscription_status='trialing'` → "Trial Active" with days remaining

---

### Access Control Implementation

**Helper Function:** `getUserPlanTier(userId: string): Promise<PlanTier>`

```typescript
type PlanTier = 'free' | 'solo' | 'team' | 'business';

async function getUserPlanTier(userId: string): Promise<PlanTier> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('subscription_status, product_id, current_period_end')
    .eq('user_id', userId)
    .single();

  // No subscription = free tier
  if (!profile?.subscription_id) {
    return 'free';
  }

  // Canceled but still in period = keep current tier
  const periodActive = profile.current_period_end && 
    new Date(profile.current_period_end) > new Date();

  // Active or canceled-but-in-period = check product_id
  if (profile.subscription_status === 'active' || 
      (profile.subscription_status === 'canceled' && periodActive)) {
    
    if (profile.product_id?.includes('solo')) return 'solo';
    if (profile.product_id?.includes('team')) return 'team';
    if (profile.product_id?.includes('business')) return 'business';
  }

  // Revoked, unpaid, or period expired = free
  return 'free';
}
```

**Feature Gating:**
```typescript
const PLAN_LIMITS = {
  free: { calls: 10, users: 1, ai: 'basic' },
  solo: { calls: 100, users: 1, ai: 'basic' },
  team: { calls: 500, users: 5, ai: 'advanced' },
  business: { calls: Infinity, users: Infinity, ai: 'custom' },
};

async function canAccessFeature(
  userId: string, 
  feature: keyof typeof PLAN_LIMITS.free
): Promise<boolean> {
  const tier = await getUserPlanTier(userId);
  const limit = PLAN_LIMITS[tier][feature];
  
  // Check current usage against limit
  // Return true if within limit, false otherwise
}
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal:** Database schema and Polar customer creation

**Tasks:**
1. ✅ Verify migration `20260131161417_add_polar_billing_fields.sql` applied
2. ⬜ Create `supabase/functions/_shared/polar-client.ts`
   - Export `getPolarClient()` function
   - Handle sandbox vs production based on env
3. ⬜ Implement `polar-create-customer` Edge Function
   - Customer creation logic
   - Store polar_customer_id in user_profiles
4. ⬜ Add environment variables to Supabase project
   - POLAR_ACCESS_TOKEN (sandbox initially)
   - POLAR_ORGANIZATION_ID
5. ⬜ Test customer creation manually via Postman/curl

**Success Criteria:**
- Can call `polar-create-customer` and get customer ID back
- `polar_customer_id` stored in user_profiles table
- Customer visible in Polar sandbox dashboard

**Verification:**
```bash
# Test customer creation
curl -X POST https://[project].supabase.co/functions/v1/polar-create-customer \
  -H "Authorization: Bearer [jwt-token]"

# Should return:
# { "success": true, "customerId": "cus_xxx", "created": true }

# Verify in database:
SELECT polar_customer_id, polar_external_id 
FROM user_profiles 
WHERE user_id = '[test-user-id]';
```

---

### Phase 2: Checkout Flow (Week 1-2)
**Goal:** Users can initiate checkout and complete payment

**Tasks:**
1. ⬜ Create products in Polar sandbox dashboard
   - Solo Monthly/Annual
   - Team Monthly/Annual
   - Business Monthly/Annual
2. ⬜ Add product IDs to environment variables
3. ⬜ Implement `polar-checkout` Edge Function
   - Generate checkout URL
   - Link to existing customer
4. ⬜ Build `PlanComparisonCards` component
   - Display all plans side-by-side
   - Feature lists, pricing
   - Upgrade buttons
5. ⬜ Add checkout flow to Settings > Billing tab
   - Show plan cards
   - Click upgrade → call `polar-checkout` → redirect
6. ⬜ Add success redirect handling
   - Handle `?checkout=success` query param
   - Show success message

**Success Criteria:**
- User can click "Upgrade" and reach Polar checkout
- After payment, redirected back to app
- Can complete test payment in sandbox

**Verification:**
```bash
# Test checkout URL generation
curl -X POST https://[project].supabase.co/functions/v1/polar-checkout \
  -H "Authorization: Bearer [jwt-token]" \
  -H "Content-Type: application/json" \
  -d '{"productId":"prod_solo_monthly_xxx"}'

# Should return:
# { "checkoutUrl": "https://sandbox.polar.sh/checkout/xxx" }

# Complete payment in browser, verify redirect works
```

---

### Phase 3: Webhook Integration (Week 2)
**Goal:** Subscription state syncs automatically via webhooks

**Tasks:**
1. ⬜ Implement `polar-webhook` Edge Function
   - Webhook signature validation
   - Event type routing
   - All 6 event handlers (see architecture section)
2. ⬜ Deploy webhook function to Supabase
3. ⬜ Configure webhook endpoint in Polar sandbox
   - URL: `https://[project].supabase.co/functions/v1/polar-webhook`
   - Secret: Store in POLAR_WEBHOOK_SECRET
   - Events: All subscription + customer events
4. ⬜ Test webhook delivery
   - Create subscription in sandbox
   - Verify webhook received
   - Check database updated correctly
5. ⬜ Add webhook event logging for debugging

**Success Criteria:**
- Webhook events received and validated
- Database updates for all event types
- Can see event logs in Supabase logs

**Verification:**
```bash
# After creating test subscription in Polar:
# Check webhook logs in Supabase Functions dashboard

# Verify subscription in database:
SELECT subscription_id, subscription_status, product_id, current_period_end
FROM user_profiles
WHERE polar_customer_id = '[test-customer-id]';

# Should show: active subscription with correct product_id
```

---

### Phase 4: State Sync & Verification (Week 2-3)
**Goal:** Handle webhook delays and provide verification mechanism

**Tasks:**
1. ⬜ Implement `polar-customer-state` Edge Function
   - Fetch state from Polar API
   - Compare with local DB
   - Update if different
2. ⬜ Add frontend polling after checkout
   - On `?checkout=success`, poll `polar-customer-state`
   - Update UI when subscription confirmed
   - Show loading state during verification
3. ⬜ Add manual "Refresh Status" button on billing tab
   - Calls `polar-customer-state`
   - Shows last sync time
4. ⬜ Add subscription state to React Query cache
   - Hook: `useSubscription()`
   - Auto-refetch on window focus
   - Cache subscription details

**Success Criteria:**
- After checkout, subscription shows within 5 seconds
- Manual refresh updates state correctly
- UI reflects current subscription without page reload

**Verification:**
```typescript
// Test state sync after webhook delay
// 1. Create subscription in Polar
// 2. Immediately call polar-customer-state
// 3. Verify it fetches and updates local state

const { data } = await supabase.functions.invoke('polar-customer-state');
console.log(data.synced); // Should be true if state was different
```

---

### Phase 5: Customer Portal (Week 3)
**Goal:** Users can self-service manage subscription

**Tasks:**
1. ⬜ Implement `polar-portal-session` Edge Function
   - Generate portal URL
   - Handle session expiration
2. ⬜ Add "Manage Subscription" button to billing tab
   - Opens portal in new tab
   - Show portal features (update payment, view invoices, cancel)
3. ⬜ Add cancel flow messaging
   - Explain cancellation timing
   - Show "access until" date for canceled subs
4. ⬜ Add reactivation option for canceled subs
   - Detect `subscription_status='canceled'` + period still active
   - Show "Reactivate" button
   - Links to portal

**Success Criteria:**
- User can open customer portal
- Can update payment method
- Can cancel subscription
- Can reactivate canceled subscription

**Verification:**
```bash
# Test portal session creation
curl -X POST https://[project].supabase.co/functions/v1/polar-portal-session \
  -H "Authorization: Bearer [jwt-token]"

# Should return:
# { "portalUrl": "https://sandbox.polar.sh/portal/xxx" }

# Open URL, verify can access subscription details
```

---

### Phase 6: Access Control & Feature Gating (Week 3-4)
**Goal:** Features properly gated based on subscription tier

**Tasks:**
1. ⬜ Create `getUserPlanTier()` utility function
   - Check subscription_status and current_period_end
   - Return tier: free/solo/team/business
2. ⬜ Define plan limits constant
   - Calls per month
   - Users per account
   - AI features enabled
3. ⬜ Implement feature checks in relevant components
   - Call creation (check call limit)
   - User invitations (check user limit)
   - AI analysis (check AI tier)
4. ⬜ Add "upgrade to unlock" messaging
   - Show on feature limit hits
   - Link to billing tab with plan highlighted
5. ⬜ Implement downgrade read-only mode
   - Excess calls/features become view-only
   - Clear messaging about limitation

**Success Criteria:**
- Free users limited to 10 calls
- Solo users limited to 100 calls, 1 user
- Upgrade prompts show at limits
- Downgraded users can view but not create

**Verification:**
```typescript
// Test plan tier detection
const tier = await getUserPlanTier(testUserId);
expect(tier).toBe('solo');

// Test feature gating
const canCreate = await canAccessFeature(testUserId, 'calls');
expect(canCreate).toBe(false); // If at limit

// Test downgrade behavior
// 1. Create 150 calls on team plan
// 2. Downgrade to solo (100 call limit)
// 3. Verify first 100 calls editable, remaining 50 read-only
```

---

### Phase 7: UI Polish & Edge Cases (Week 4)
**Goal:** Production-ready billing experience

**Tasks:**
1. ⬜ Add subscription status banners
   - Payment failed (past_due)
   - Subscription canceled (show end date)
   - Trial active (show days remaining)
   - Renewing soon (within 7 days)
2. ⬜ Add loading states
   - During checkout redirect
   - While verifying subscription
   - While generating portal session
3. ⬜ Error handling
   - Webhook validation failures
   - API timeout handling
   - Graceful degradation if Polar unavailable
4. ⬜ Add analytics events
   - Checkout initiated
   - Checkout completed
   - Subscription canceled
   - Upgrade/downgrade events
5. ⬜ Add email notifications (optional, Polar handles most)
   - Subscription activated confirmation
   - Downgrade scheduled notification
6. ⬜ Accessibility audit
   - Keyboard navigation for billing tab
   - Screen reader labels for plan cards
   - ARIA labels for subscription status

**Success Criteria:**
- All edge cases handled gracefully
- Clear user feedback for all actions
- Accessible billing interface
- Analytics tracking all key events

---

### Phase 8: Testing & Production Deploy (Week 4-5)
**Goal:** Thoroughly tested, ready for production

**Tasks:**
1. ⬜ End-to-end testing checklist
   - [ ] Signup → create customer
   - [ ] Upgrade to Solo → payment → activation
   - [ ] Upgrade Solo → Team → proration
   - [ ] Downgrade Team → Solo → at period end
   - [ ] Cancel subscription → retain access
   - [ ] Subscription expires → read-only mode
   - [ ] Payment failure → retry → restore access
   - [ ] Reactivate canceled subscription
   - [ ] Portal session access
   - [ ] Webhook for every event type
2. ⬜ Create production Polar products
   - Mirror sandbox products
   - Set actual pricing
3. ⬜ Update environment variables for production
   - POLAR_ACCESS_TOKEN (production)
   - Product IDs (production)
   - APP_URL (production domain)
4. ⬜ Configure production webhook endpoint
   - Update URL in Polar dashboard
   - Test webhook delivery
5. ⬜ Deploy frontend changes
   - Environment-based product IDs
   - Production checkout flow
6. ⬜ Monitoring setup
   - Webhook event failures
   - Checkout completion rate
   - Subscription churn tracking

**Success Criteria:**
- All test scenarios pass in sandbox
- Production environment configured
- Webhooks delivering to production
- First real subscription successful

**Go-Live Checklist:**
- [ ] All edge functions deployed to production
- [ ] Environment variables set in production Supabase project
- [ ] Polar products created and active
- [ ] Webhook endpoint configured and tested
- [ ] Frontend billing UI deployed
- [ ] Test account completes full checkout flow
- [ ] Monitoring alerts configured
- [ ] Rollback plan documented

---

## Success Criteria

### Phase 1: Foundation
- [ ] Polar customer created for test user
- [ ] `polar_customer_id` stored in database
- [ ] Customer visible in Polar sandbox

### Phase 2: Checkout Flow
- [ ] User can click "Upgrade" button
- [ ] Redirects to Polar checkout page
- [ ] Can complete test payment
- [ ] Redirected back to app after payment

### Phase 3: Webhook Integration
- [ ] Webhooks received from Polar
- [ ] Signature validation working
- [ ] Database updates for all event types
- [ ] Event logs visible for debugging

### Phase 4: State Sync
- [ ] Post-checkout polling updates UI within 5 seconds
- [ ] Manual refresh works correctly
- [ ] React Query cache populated with subscription

### Phase 5: Customer Portal
- [ ] Portal session URL generated
- [ ] User can update payment method
- [ ] User can cancel subscription
- [ ] Reactivation works for canceled subs

### Phase 6: Access Control
- [ ] Free users limited to 10 calls
- [ ] Solo users limited to 100 calls
- [ ] Upgrade prompts show at limits
- [ ] Downgraded features become read-only

### Phase 7: UI Polish
- [ ] All status banners display correctly
- [ ] Loading states smooth and informative
- [ ] Errors handled gracefully
- [ ] Analytics tracking complete

### Phase 8: Production Ready
- [ ] All test scenarios pass
- [ ] Production environment configured
- [ ] First real subscription successful
- [ ] Monitoring and alerts active

---

## Testing Checklist

### Unit Tests
- [ ] `getUserPlanTier()` returns correct tier for all statuses
- [ ] Webhook signature validation rejects invalid signatures
- [ ] Product ID mapping works for all plans
- [ ] Feature gating checks work for all limits

### Integration Tests
- [ ] Customer creation API call succeeds
- [ ] Checkout URL generation includes correct params
- [ ] Webhook updates database correctly
- [ ] Portal session creation returns valid URL

### End-to-End Tests
- [ ] Complete signup → upgrade → payment → activation flow
- [ ] Upgrade between tiers preserves data
- [ ] Downgrade at period end works correctly
- [ ] Cancellation retains access until period end
- [ ] Payment failure shows banner and allows retry
- [ ] Feature limits enforced at boundaries
- [ ] Read-only mode works for downgraded features

### Manual Testing Scenarios
1. **Happy Path - Solo Monthly**
   - Signup as new user
   - View billing tab
   - Click "Upgrade to Solo"
   - Complete payment in Polar checkout
   - Verify redirect back to app
   - Confirm subscription shows as active
   - Create 50 calls (within limit)

2. **Upgrade Path - Solo to Team**
   - Start with active Solo subscription
   - Click "Upgrade to Team"
   - Verify prorated charge shown
   - Complete payment
   - Confirm Team features immediately available
   - Verify next billing date updated

3. **Downgrade Path - Team to Solo**
   - Start with active Team subscription (with 150 calls)
   - Open customer portal
   - Cancel/downgrade to Solo
   - Verify "downgrade scheduled" message
   - Confirm access until period end
   - After period end, verify calls 101-150 read-only

4. **Cancellation Path**
   - Start with active subscription
   - Open customer portal
   - Cancel subscription
   - Verify "Subscription Canceled" banner
   - Confirm period end date shown
   - Verify access still works
   - After period end, verify read-only mode

5. **Payment Failure Path**
   - Trigger payment failure in Polar (use test card)
   - Verify "Payment Failed" banner shows
   - Click "Update Payment Method"
   - Update to valid card
   - Verify banner disappears
   - Confirm subscription restored

6. **Reactivation Path**
   - Cancel active subscription
   - Before period end, click "Reactivate"
   - Open customer portal
   - Reactivate subscription
   - Verify status back to "active"
   - Confirm next billing date unchanged

---

## Rollback Plan

### If Webhooks Fail
1. Disable webhook endpoint in Polar dashboard
2. Switch to manual state polling (call `polar-customer-state` more frequently)
3. Add cron job to sync all active subscriptions daily
4. Fix webhook issues offline
5. Re-enable webhooks when validated

### If Checkout Fails
1. Disable "Upgrade" buttons in UI
2. Add "Contact Support" message with alternative payment method
3. Process subscriptions manually via Polar dashboard
4. Fix checkout flow
5. Re-enable buttons after testing

### If Database Updates Fail
1. Queue failed webhook events for retry
2. Add manual sync button for affected users
3. Run database migration to fix schema issues
4. Replay failed events from logs
5. Validate all subscriptions manually

### Complete Rollback
1. Disable all Polar Edge Functions
2. Hide billing tab from UI (show "Coming Soon")
3. Set all users to free tier temporarily
4. Fix issues in staging environment
5. Redeploy and test thoroughly before re-enabling

---

## Monitoring & Alerts

### Key Metrics to Track
1. **Checkout Completion Rate**
   - (Successful payments / Checkout initiated) × 100
   - Target: >80%

2. **Webhook Delivery Success Rate**
   - (Webhooks processed / Webhooks received) × 100
   - Target: >99%

3. **Subscription Sync Accuracy**
   - (Correctly synced subs / Total subs) × 100
   - Target: 100%

4. **Average Sync Delay**
   - Time from webhook to DB update
   - Target: <2 seconds

5. **Customer Portal Session Success**
   - (Successful portal opens / Portal attempts) × 100
   - Target: >95%

### Alerts to Configure
- Webhook signature validation failure (immediate)
- Webhook processing error (immediate)
- Checkout initiated but no subscription created within 10 minutes
- Subscription status mismatch detected by state sync
- Payment failure rate >5% of active subscriptions
- Edge function error rate >1%

### Logging Requirements
- All webhook events (type, customer_id, timestamp)
- All database updates (before/after state)
- All Edge function calls (user_id, action, result)
- All checkout URLs generated (user_id, product_id)
- All portal sessions created (customer_id, timestamp)

---

## Environment Variables Reference

```bash
# Required for all Polar functions
POLAR_ACCESS_TOKEN=polar_oat_xxxxxxxxxxxxx  # Organization Access Token
POLAR_ORGANIZATION_ID=org_xxxxxxxxxxxxx     # From Polar dashboard
POLAR_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx    # For webhook validation

# Product IDs (get from Polar dashboard after creating products)
POLAR_PRODUCT_SOLO_MONTHLY=prod_xxxxxxxxxxxxx
POLAR_PRODUCT_SOLO_ANNUAL=prod_xxxxxxxxxxxxx
POLAR_PRODUCT_TEAM_MONTHLY=prod_xxxxxxxxxxxxx
POLAR_PRODUCT_TEAM_ANNUAL=prod_xxxxxxxxxxxxx
POLAR_PRODUCT_BUSINESS_MONTHLY=prod_xxxxxxxxxxxxx
POLAR_PRODUCT_BUSINESS_ANNUAL=prod_xxxxxxxxxxxxx

# App configuration
APP_URL=https://callvault.app  # Base URL for checkout redirects

# Supabase (already configured)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxxxxxxxxxxx

# Optional: Different keys for sandbox vs production
POLAR_ENV=sandbox  # or 'production'
```

---

## API Reference Quick Links

- **Polar API Docs:** https://polar.sh/docs/api-reference
- **TypeScript SDK:** https://polar.sh/docs/integrate/sdk/typescript
- **Webhook Events:** https://polar.sh/docs/integrate/webhooks/delivery
- **Customer Portal:** https://polar.sh/docs/api-reference/customer-portal
- **Sandbox Environment:** https://polar.sh/docs/integrate/sandbox

---

## Glossary

- **OAT (Organization Access Token):** Server-side API key for Polar API calls
- **External ID:** App's user ID sent to Polar (maps auth.users.id)
- **Customer ID:** Polar's internal UUID for the customer
- **Product ID:** Identifies a specific plan (e.g., Solo Monthly)
- **Subscription ID:** Unique ID for an active subscription
- **Current Period End:** When subscription renews or expires
- **Proration:** Partial charge when upgrading mid-cycle
- **Sandbox:** Test environment for Polar integration
- **Webhook:** Server-to-server event notification
- **Customer Portal:** Self-service subscription management page
- **Service Role Key:** Supabase key that bypasses RLS

---

## Appendix A: Polar API Examples

### Create Customer
```typescript
const customer = await polar.customers.create({
  email: 'user@example.com',
  name: 'John Doe',
  externalId: 'user_123',  // Your app's user ID
  organizationId: 'org_abc',
});
// Returns: { id: 'cus_xyz', ... }
```

### Generate Checkout URL
```typescript
const checkout = await polar.checkouts.create({
  productId: 'prod_solo_monthly',
  customerExternalId: 'user_123',
  successUrl: 'https://app.example.com/settings?tab=billing',
});
// Returns: { url: 'https://polar.sh/checkout/...' }
```

### Get Customer State
```typescript
const state = await polar.customers.getStateExternal({
  externalId: 'user_123',
});
// Returns: { activeSubscriptions: [...], activeOrders: [...] }
```

### Create Portal Session
```typescript
const session = await polar.customerSessions.create({
  customerId: 'cus_xyz',
});
// Returns: { url: 'https://polar.sh/portal/...', expiresAt: '...' }
```

### Validate Webhook
```typescript
import { validateEvent } from '@polar-sh/sdk/webhooks';

const event = validateEvent(
  requestBody,       // Raw request body string
  requestHeaders,    // Headers object
  webhookSecret      // Your webhook secret
);
// Returns validated event or throws WebhookVerificationError
```

---

## Appendix B: Subscription Status States

| Status | Meaning | User Access | Next Action |
|--------|---------|-------------|-------------|
| `incomplete` | Payment pending | No | Wait for payment |
| `incomplete_expired` | Payment failed | No | Retry or cancel |
| `trialing` | In trial period | Yes | Wait for trial end |
| `active` | Subscription active | Yes | Normal operation |
| `past_due` | Payment failed, in grace period | Yes (7 days) | Update payment |
| `unpaid` | Grace period expired | No | Pay or cancel |
| `canceled` | User canceled, period active | Yes (until period end) | Wait for period end |
| `revoked` | Immediate access loss | No | Admin action or fraud |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-14 | AI Subagent | Initial draft - complete GSD spec |

---

**End of Document**
