# Polar Billing Integration — Full Audit Report

**Audit Date:** 2026-04-16
**Auditor:** Claude (gsd-executor)
**Scope:** All Polar.sh billing code, edge functions, frontend, database, environment config

---

## Executive Summary

The billing integration is structurally complete: 5 Polar edge functions are deployed and active, the frontend renders plan cards and wires checkout/cancel flows, the database schema exists, and AI usage enforcement is live. However, **two critical blockers** prevent live billing from working:

1. **Product ID mismatch** — every checkout will fail with a 404/400 from Polar's API because symbolic IDs like `"pro-monthly"` are passed where Polar requires UUIDs.
2. **Checkout success URL mismatch** — after payment, users land on `/settings?tab=billing` but the Settings page routes via URL path segments (`/settings/billing`), so the billing tab never auto-opens.

Additionally, several spec features from PRICING-TIERS.md are not implemented (annual toggle, import enforcement, workspace limit gates, customer portal).

---

## 1. Working Correctly

The following components are implemented correctly and would function once the critical blockers are resolved.

### Edge Functions — 5 of 5 Deployed ACTIVE

| Function | Status | Last Updated |
|----------|--------|-------------|
| `polar-checkout` | ACTIVE (v78) | 2026-04-15 |
| `polar-cancel` | ACTIVE (v48) | 2026-04-15 |
| `polar-create-customer` | ACTIVE (v72) | 2026-04-15 |
| `polar-customer-state` | ACTIVE (v77) | 2026-04-15 |
| `polar-webhook` | ACTIVE (v73) | 2026-04-15 |
| `track-ai-usage` | ACTIVE (v41) | 2026-04-15 |

All 5 Polar functions follow consistent patterns: JWT auth header verification, CORS preflight handling, service-role Supabase client, structured error responses. No auth gaps or missing CORS handlers found.

### Webhook Handler (`polar-webhook/index.ts`)

Handles all 6 required event types correctly:
- `subscription.created` — updates `user_profiles` with subscription fields + auto-provisions MCP token
- `subscription.active` — updates status to `'active'` + auto-provisions MCP token
- `subscription.canceled` — sets status to `'canceled'`, preserves `subscription_id` and `current_period_end` for grace period access
- `subscription.revoked` — clears all subscription fields for immediate access loss
- `customer.created` — stores `polar_customer_id` and `polar_external_id`
- `customer.state_changed` — logs for debugging, instructs frontend to call `polar-customer-state`

`validateEvent` from `@polar-sh/sdk/webhooks` is used for signature verification. `POLAR_WEBHOOK_SECRET` is confirmed set in Supabase secrets.

The `provisionMcpTokenForUser` function calls `maybe_provision_mcp_token` RPC idempotently on subscription activation — correct design.

### AI Usage System

- `ai_usage` table: correct schema, RLS enabled, indexes on `(user_id, month_year)` and `(org_id, month_year)`
- `get_monthly_ai_usage` RPC: counts personal actions (`org_id IS NULL`) correctly
- `get_monthly_org_ai_usage` RPC: counts pooled team actions correctly
- `track-ai-usage` function: validates action type, derives tier from product_id, enforces per-tier limits, returns 429 on limit reached
- `useAiGate` hook: wired into `BulkActionToolbarEnhanced` (auto_name, auto_tag) and `SmartExportDialog` (smart_import) — all 3 AI paths gated
- `useAiUsage` hook: correct, queries RPC, combines with subscription limit from `useSubscription`
- AI action limits match across frontend and backend: Free=25, Pro=1000, Team=5000

### Cancel Flow

`polar-cancel` correctly:
- Fetches `subscription_id` from `user_profiles`
- Guards against double-cancellation
- Calls `polar.subscriptions.cancel()` at period end (not immediate)
- Updates `subscription_status='canceled'` locally
- Returns `accessUntil` date

`BillingTab` has cancel button with `AlertDialog` confirmation, handles loading state and error toast.

### Subscription State Derivation

`useSubscription.deriveTier()` correctly handles:
- `pro-trial` + `trialing` + not-expired → `'pro'`
- `pro-trial` + expired or non-trialing → `'free'`
- `pro-monthly`, `pro-annual` → `'pro'`
- `team-monthly`, `team-annual` → `'team'`
- Unknown product_id → `'free'`

Same logic mirrored correctly in `track-ai-usage` server-side.

### Signup Trigger (Auto 14-day Trial)

The `handle_new_user()` trigger (migration `20260403190000_fix_signup_trigger.sql`) is the canonical version:
- Sets `subscription_status='trialing'`, `product_id='pro-trial'`, `current_period_end=NOW()+14 days`
- The trigger is re-attached to `auth.users` (the April 3 fix migration explicitly drops and recreates `on_auth_user_created`)

### MCP Gating by Tier

`MCPTab.tsx` correctly gates MCP token creation behind `isProPlus = isPaid`. Free users see a locked state with an upgrade prompt. The MCP gate is the only upgrade-trigger gate that is implemented.

### Environment Secrets

All 3 required Polar secrets are confirmed set in Supabase:
- `POLAR_ACCESS_TOKEN` — set
- `POLAR_ORGANIZATION_ID` — set
- `POLAR_WEBHOOK_SECRET` — set
- `SITE_URL` — set (used as checkout success redirect base)

`PUBLIC_SITE_URL` is NOT set but is checked first; `SITE_URL` is the fallback and is present.

### Database Schema

`user_profiles` billing columns all exist:
- `polar_customer_id UUID`
- `polar_external_id TEXT`
- `subscription_id UUID`
- `subscription_status TEXT` (with CHECK constraint covering all valid Polar statuses)
- `product_id TEXT`
- `current_period_end TIMESTAMPTZ`

Indexes on `polar_customer_id` and `subscription_status` (both partial on non-null).

### Customer Management

`polar-create-customer` correctly creates Polar customer with `externalId=user.id`, stores `polar_customer_id` in `user_profiles`, and is idempotent (returns existing ID if present). `usePolarCustomer` hook correctly lazy-creates on first checkout attempt.

`polar-customer-state` correctly syncs Polar subscription state to local DB when out of sync (post-checkout race condition handler).

---

## 2. Critical Blockers

### BLOCKER-01: Product ID Mismatch — Every Checkout Will Fail

**Severity:** P0 — Billing is 100% broken until this is fixed.

**What happens:** Every click of an "Upgrade to Pro" button results in Polar's API returning an error because the product ID is not a valid UUID.

**Root cause:**

`PlanCards.tsx` defines:
```typescript
productIdMonthly: 'pro-monthly',  // symbolic name
productIdAnnual: 'pro-annual',
```

`BillingTab.tsx` also hardcodes:
```tsx
<UpgradeButton productId="pro-monthly" className="mt-2">
```

`MCPTab.tsx` also hardcodes:
```tsx
<UpgradeButton productId="pro-monthly" className="mt-2">
```

These symbolic names flow through `UpgradeButton` → `polar-checkout` → `polar.checkouts.create({ productId })`. Polar's API expects a UUID like `30020903-fa8f-4534-9cf1-6e9fba26584c`.

**Actual Polar product UUIDs** (from POLAR-UPDATE-LOG.md Section 9):

| Product | UUID |
|---------|------|
| Pro Monthly | `30020903-fa8f-4534-9cf1-6e9fba26584c` |
| Pro Annual | `9ff62255-446c-41fe-a84d-c04aed23725c` |
| Team Monthly | `88f3f07e-afa3-4cb1-ac9d-d2429a1ce1b7` |
| Team Annual | `6a1bcf14-86b4-4ec9-bcbe-660bb714b19f` |

**No mapping layer exists anywhere.** Confirmed by searching the entire codebase — no `src/constants/billing.ts`, no UUID mapping in `_shared/`, no environment variables holding UUIDs.

The POLAR-UPDATE-LOG.md Section 9 specifically called for a `src/constants/billing.ts` file to hold these IDs. That file was never created.

**Fix required:** Create `src/constants/billing.ts` with the product UUIDs and update all `productId` hardcodings in `PlanCards.tsx`, `BillingTab.tsx`, and `MCPTab.tsx`.

---

### BLOCKER-02: Checkout Success URL Mismatch — Billing Tab Never Auto-Opens After Payment

**Severity:** P1 — Users complete checkout, return to app, and see the wrong page. They have to manually navigate to billing.

**What happens:**

`polar-checkout` constructs the success URL as:
```typescript
const successUrl = `${baseUrl}/settings?tab=billing`;
```

After Polar checkout completes, users are redirected to `/settings?tab=billing`.

But `Settings.tsx` reads the category from the URL **path segment**, not a query parameter:
```typescript
const { category: urlCategory } = useParams<{ category?: string }>();
// Route is /settings/:category
```

The path `/settings?tab=billing` has no `:category` param. The `tab=billing` query string is completely ignored. Users land on the Settings page with no category pre-selected.

**Fix required:** Change the success URL in `polar-checkout` to `${baseUrl}/settings/billing` (path-based), OR add `useSearchParams()` handling to `Settings.tsx` for the `?tab=` query parameter.

---

### BLOCKER-03: Trial is Auto-Assigned (Spec Says Opt-In)

**Severity:** P2 — Functional but wrong product behavior. Trial starts on signup without user consent.

**What happens:** The `handle_new_user()` trigger immediately sets `subscription_status='trialing'` and `product_id='pro-trial'` with `current_period_end=NOW()+14 days`. Every new user starts a 14-day Pro trial the moment they sign up, with no confirmation.

**Spec requirement (PRICING-TIERS.md Section 10):**
> The 14-day trial is opt-in. The user explicitly starts it. The trial is not automatically applied at signup.
> The user chooses when to burn the trial window. A user who sees the upgrade prompt but clicks "Maybe later" does not start the trial. Their 14 days begin only when they explicitly confirm.

**Current behavior vs. spec:** Auto-assigned on signup vs. explicitly started by user when hitting a limit.

**Impact:** Users who sign up and don't use the product "burn" their 14-day trial window without getting value. The conversion moment the spec was designed around — "the user has seen enough value to want to pay" — is bypassed.

The 17-VERIFICATION.md states PAY-03 is "VERIFIED" and explicitly says: "DB trigger `handle_new_user()` sets `product_id='pro-trial'`, `subscription_status='trialing'`." This was accepted as the implementation. But it contradicts the opt-in spec.

**Note:** This may be an intentional deviation from the spec accepted during Phase 17 execution. If auto-assigning was a deliberate product decision, this should be documented. If it was an oversight, it needs a fix.

---

## 3. Missing but Planned

Features in PRICING-TIERS.md that are NOT implemented.

### MISS-01: Annual/Monthly Toggle (PlanCards)

`PlanCards` has a `showAnnual?: boolean` prop and full logic to switch between monthly/annual pricing and product IDs. However, `showAnnual` is **never passed as `true`** anywhere in the codebase — it always defaults to `false`.

There is no toggle UI in `BillingTab`. Users see monthly prices only. Annual products (`pro-annual`, `team-annual`) can never be purchased through the UI.

**Impact:** Annual revenue option (which would lock in customers for a year) is completely unavailable to users.

### MISS-02: Import Limit Enforcement

`IMPORT_LIMITS` is defined in `useSubscription.ts` (`{ free: 10, pro: null, team: null }`) and exposed as `importLimit` in the hook's return value. However, `importLimit` is **never consumed anywhere in the codebase** beyond its definition.

No import gate component exists. No enforcement happens at the 11th import. The 10/month Free tier limit is purely advisory and not enforced.

**Impact:** Free users can import unlimited calls. The primary Free→Pro upgrade trigger (hitting 10/month) never fires.

### MISS-03: Workspace Limit Enforcement

The spec defines: Free tier = 1 workspace, Pro = multiple workspaces. There is no workspace count check in the "Create Workspace" flow. Free users can create multiple workspaces.

**Impact:** The second workspace creation upgrade trigger never fires.

### MISS-04: Customer Portal Link

No "Manage payment method", "Update card", or "View invoices" link exists in `BillingTab`. Polar provides a customer portal URL. Users have no way to update payment methods or view billing history from within the app.

**Impact:** Payment method updates require contacting support or going to Polar directly (which most users won't know how to do).

### MISS-05: Upgrade Prompts at Limit Boundaries

Spec Section 6 defines 6 upgrade trigger flows with specific prompt copy. Only one is implemented (MCP access gated in MCPTab). Missing:
- Import limit prompt (11th import for Free users)
- Workspace limit prompt (2nd workspace creation for Free users)
- Pro→Team: invite teammate (no invite flow yet)
- Pro→Team: multiple organizations
- Pro→Team: per-workspace MCP token

### MISS-06: Downgrade Handling

Spec Section 10 defines: on downgrade from Pro to Free, user picks 1 "active" workspace; others become read-only. MCP configs stay visible but blocked. No downgrade handling code exists. Subscription cancellation just sets status to `'canceled'` — no workspace/MCP read-only enforcement.

---

## 4. Dashboard Verification Needed

The following cannot be verified from code and require manual inspection of the Polar dashboard.

| Item | What to Check |
|------|--------------|
| **Products exist and are active** | Confirm all 4 products (Pro Monthly/Annual, Team Monthly/Annual) are present and not archived in Polar → Products |
| **Product IDs match** | Confirm the 4 UUIDs in POLAR-UPDATE-LOG.md Section 9 match what's in the Polar dashboard. If products were recreated, IDs may have changed. |
| **Webhook endpoint configured** | Polar → Webhooks: endpoint must be `https://vltmrnjsubfzrgrtdqey.supabase.co/functions/v1/polar-webhook` |
| **Webhook events subscribed** | Confirm all 6 events: `subscription.created`, `subscription.active`, `subscription.canceled`, `subscription.revoked`, `customer.created`, `customer.state_changed` |
| **Webhook active** | Confirm webhook is enabled (not paused) |
| **Pro Monthly trial configured** | Polar product settings: 14-day free trial enabled on Pro Monthly (no credit card required) |
| **Test event delivery** | Send a test event from Polar dashboard; confirm `user_profiles` updates correctly |

---

## 5. Nice-to-Have Improvements

Non-blocking improvements that would improve the billing UX and reliability.

### NTH-01: `PUBLIC_SITE_URL` Secret

The checkout function checks `PUBLIC_SITE_URL` first, then falls back to `SITE_URL`. Adding `PUBLIC_SITE_URL` explicitly would make the intent clearer and avoid any edge case where the env var name changes. Low priority — `SITE_URL` works.

### NTH-02: `polar-customer-state` Not Called After Checkout Return

After the user returns from checkout, the app relies on the webhook to update subscription state. If the webhook is delayed, the user sees "Free" tier for a few seconds. `polar-customer-state` exists precisely for this race condition but is never called. Calling it on the `/settings/billing` page load (if `subscriptionId` is null but a checkout session is expected) would make the post-checkout experience instant.

### NTH-03: `customer.state_changed` Handler is a No-Op

The webhook handler logs `customer.state_changed` but takes no action. Per its design, the frontend should call `polar-customer-state` in response. Since the handler does nothing server-side, state changes to Polar subscriptions that aren't explicitly handled by other events may not sync. This is low risk given the other 5 event handlers cover the main lifecycle, but worth noting.

### NTH-04: Subscription Query Stale Time

`useSubscription` has `staleTime: 60000` (1 minute). If a webhook fires and updates `user_profiles`, the frontend won't see the change for up to 1 minute. For a post-checkout flow, this compounds BLOCKER-02. After fixing the success URL, consider adding a forced refetch when landing on `/settings/billing`.

### NTH-05: Track-AI-Usage: No Org Pooling for Team Tier

`track-ai-usage` derives tier from `user_profiles.product_id` (user-level). For Team users, usage is tracked per-user (`org_id` is passed optionally). The `get_monthly_org_ai_usage` RPC exists for pooled Team usage, but `track-ai-usage` does not use it — it checks per-user limits even for Team users. A Team of 3 users could each use 5,000 actions (15,000 total) instead of 5,000 pooled. This is generous for now (no active Team subscribers) but will need fixing.

### NTH-06: Signup Backfill Gap

The `20260403190000_fix_signup_trigger.sql` backfill creates `user_profiles` for users who signed up while the trigger was dead, but does NOT backfill `subscription_status='trialing'`/`product_id='pro-trial'` for those users. They have profiles but are on Free tier. If the auto-trial was intentional, these users missed their trial and should either be manually credited or have the backfill updated.

---

## 6. Prioritized Checklist of Remaining Work

Ordered by impact and blocking dependency.

### P0 — Must fix before any live checkout

- [ ] **BLOCKER-01** Create `src/constants/billing.ts` with the 4 Polar product UUIDs and update all `productId` references in `PlanCards.tsx`, `BillingTab.tsx`, `MCPTab.tsx` to use the constants (not symbolic names)
- [ ] **BLOCKER-02** Fix checkout success URL: change `polar-checkout` to redirect to `${baseUrl}/settings/billing` (not `?tab=billing`), and redeploy the function
- [ ] **Dashboard** Verify all 4 products exist in Polar with matching UUIDs from POLAR-UPDATE-LOG.md. Verify webhook is configured and all 6 event types are subscribed.

### P1 — Should fix before launch

- [ ] **BLOCKER-03** Decide: keep auto-trial or implement opt-in trial. Document the decision. If keeping auto-trial, update PRICING-TIERS.md to reflect the actual behavior.
- [ ] **MISS-01** Add annual/monthly toggle UI to `BillingTab`. Wire `showAnnual` prop through `PlanCards`. Annual plan UUIDs need to be correct constants (from BLOCKER-01 fix).
- [ ] **MISS-02** Implement import limit enforcement: check `importLimit` in the import flow (Smart Import and manual upload); show upgrade prompt at 11th import for Free users.
- [ ] **NTH-02** Call `polar-customer-state` on `/settings/billing` page load to sync post-checkout state without waiting for webhook.
- [ ] **Dashboard** Run a test Polar checkout end-to-end and verify webhook fires, `user_profiles` updates, and the frontend shows the correct tier.

### P2 — Important for complete product

- [ ] **MISS-04** Add customer portal link in `BillingTab` (Polar API provides a portal URL endpoint).
- [ ] **MISS-03** Implement workspace limit enforcement: gate "Create workspace" for Free users (max 1), show upgrade prompt.
- [ ] **NTH-05** Fix Team pooled AI usage counting: use `get_monthly_org_ai_usage` for Team users in `track-ai-usage`.

### P3 — Post-launch cleanup

- [ ] **MISS-05** Implement remaining upgrade prompts at limit boundaries (workspace, invite teammate, per-workspace MCP token).
- [ ] **MISS-06** Implement downgrade handling (workspace read-only, MCP config visible but blocked).
- [ ] **NTH-06** Decide whether to backfill trial for users who signed up while trigger was dead.
- [ ] **NTH-03** Implement actual state sync in `customer.state_changed` webhook handler.
- [ ] **NTH-04** Add forced subscription refetch on `/settings/billing` page load.

---

## Appendix: File Map

| File | Role | Status |
|------|------|--------|
| `supabase/functions/polar-checkout/index.ts` | Generate checkout URL | Deployed ACTIVE — passes symbolic productId (broken) |
| `supabase/functions/polar-cancel/index.ts` | Cancel subscription | Deployed ACTIVE — correct |
| `supabase/functions/polar-create-customer/index.ts` | Create Polar customer | Deployed ACTIVE — correct |
| `supabase/functions/polar-customer-state/index.ts` | Sync state from Polar | Deployed ACTIVE — never called from frontend |
| `supabase/functions/polar-webhook/index.ts` | Process subscription events | Deployed ACTIVE — correct |
| `supabase/functions/track-ai-usage/index.ts` | Track and enforce AI limits | Deployed ACTIVE — correct (Team pooling not implemented) |
| `supabase/functions/_shared/polar-client.ts` | Polar SDK client singleton | Correct — reads from env vars |
| `src/constants/billing.ts` | Product ID constants | DOES NOT EXIST — must be created |
| `src/components/settings/BillingTab.tsx` | Main billing UI | Correct structure — hardcoded symbolic productId |
| `src/components/billing/PlanCards.tsx` | Plan comparison cards | Correct structure — hardcoded symbolic productIds, no showAnnual toggle |
| `src/components/billing/UpgradeButton.tsx` | Checkout CTA | Correct — passes productId to edge function |
| `src/hooks/useSubscription.ts` | Subscription state derivation | Correct — IMPORT_LIMITS defined but never consumed |
| `src/hooks/usePolarCustomer.ts` | Polar customer management | Correct |
| `src/hooks/useAiUsage.ts` | AI usage display | Correct |
| `src/hooks/useAiGate.ts` | AI enforcement | Correct — wired to 3 AI paths |
| `src/services/ai-usage.service.ts` | AI usage data fetching | Correct |
| `src/components/settings/MCPTab.tsx` | MCP access settings | Correct gating — hardcoded symbolic productId |
| `supabase/migrations/20260131161417_add_polar_billing_fields.sql` | user_profiles billing columns | Applied |
| `supabase/migrations/20260309000001_ai_credits_system.sql` | ai_usage table + RPCs + trial trigger | Applied |
| `supabase/migrations/20260403190000_fix_signup_trigger.sql` | Trigger fix + backfill | Applied |

---

*Audit completed 2026-04-16. Next action: fix BLOCKER-01 (product ID constants file) and BLOCKER-02 (success URL) before attempting any live checkout test.*
