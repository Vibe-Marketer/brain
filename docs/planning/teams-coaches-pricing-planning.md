# Teams & Coaches Pricing & Implementation Planning

**Date Created**: 2026-01-10
**Status**: Planning Phase
**Owner**: TBD
**Priority**: High

---

## Executive Summary

CallVault has fully implemented Teams and Coaching features at the code level, but the database schema has not been applied to production, and there is no pricing model or monetization strategy in place. This document outlines the key decisions, questions, and implementation steps needed to launch these premium collaboration features.

---

## Table of Contents

1. [Current Status](#current-status)
2. [Immediate Blockers](#immediate-blockers)
3. [Pricing Strategy Questions](#pricing-strategy-questions)
4. [Feature Architecture](#feature-architecture)
5. [Technical Implementation Checklist](#technical-implementation-checklist)
6. [Recommended Pricing Model](#recommended-pricing-model)
7. [Go-To-Market Considerations](#go-to-market-considerations)
8. [Open Questions & Decisions Needed](#open-questions--decisions-needed)

---

## Current Status

### ✅ What's Complete

**Coaching Feature**:
- [x] Full UI implementation in `CoachesTab.tsx`
- [x] React hooks for all operations (`useCoachRelationships.ts`)
- [x] Database schema defined (`20260108000002_create_coach_access_tables.sql`)
- [x] Row-level security policies
- [x] Invitation workflow (email + link-based)
- [x] Private notes system
- [x] Granular sharing (folder, tag, or all calls)

**Team Feature**:
- [x] Full UI implementation in `TeamTab.tsx`
- [x] React hooks for team operations
- [x] Database schema defined (`20260108000003_create_team_access_tables.sql`)
- [x] Hierarchy management (managers + reports)
- [x] Auto-sharing for manager access

**Navigation & Layout**:
- [x] CollaborationPage with 3-pane layout
- [x] Routing configured in App.tsx
- [x] Sidebar navigation working

### ❌ What's Missing

**Critical Blockers**:
- [ ] Database migrations NOT applied to production
  - Coach tables: `coach_relationships`, `coach_shares`, `coach_notes`
  - Team tables: `teams`, `team_members`, `team_shares`
  - **Error**: `"Could not find the table 'public.coach_relationships' in the schema cache"`

**Monetization Infrastructure**:
- [ ] No pricing tiers defined
- [ ] No feature gates implemented
- [ ] No Stripe integration
- [ ] No subscription management
- [ ] No upgrade prompts/CTAs
- [ ] No billing UI

**Product Questions**:
- [ ] Who can use coaching for free vs paid?
- [ ] What are the limits for each tier?
- [ ] How do we handle team size scaling?
- [ ] Self-serve vs sales-assisted pricing?

---

## Immediate Blockers

### 🚨 Priority 1: Apply Database Migrations

**Problem**: Coaching and team features are broken because tables don't exist.

**Solution**: Apply the migrations to production Supabase database.

**Migration Files**:
1. `/supabase/migrations/20260108000002_create_coach_access_tables.sql`
2. `/supabase/migrations/20260108000003_create_team_access_tables.sql`

**How to Apply**:

**Option A: Supabase Dashboard (Recommended)**
1. Go to https://supabase.com/dashboard/project/vltmrnjsubfzrgrtdqey/sql/new
2. Copy SQL from migration file
3. Execute
4. Verify tables exist

**Option B: Supabase CLI**
```bash
# Fix migration history sync issue first
supabase migration repair --status applied 20260110

# Then push
supabase db push --linked
```

**Verification**:
```sql
-- Run in Supabase SQL Editor
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('coach_relationships', 'coach_shares', 'coach_notes', 'teams', 'team_members');
```

---

## Pricing Strategy Questions

### Core Business Model Questions

#### 1. **What is the primary monetization driver?**
   - [ ] Per-seat pricing (standard SaaS)
   - [ ] Per-feature pricing (feature gating)
   - [ ] Hybrid (seats + features)
   - [ ] Usage-based (calls, AI interactions)

   **Recommendation**: Hybrid - base on seats, gate premium features

#### 2. **What's the pricing psychology?**
   - [ ] Value-based (charge for outcomes)
   - [ ] Cost-plus (cover costs + margin)
   - [ ] Competitive (match market rates)
   - [ ] Freemium (free tier drives upgrades)

   **Recommendation**: Value-based with freemium entry point

#### 3. **Target customer segments?**
   - [ ] Individual contributors (coaches, sales reps)
   - [ ] Small teams (2-10 people)
   - [ ] Mid-market (10-100 people)
   - [ ] Enterprise (100+ people)

   **Recommendation**: All segments, but optimize for mid-market B2B

---

### Feature Gating Questions

#### Coaching Features

**Q1: Should Solo users have ANY coaching access?**
- Option A: No coaching on free/solo tier (hard paywall)
- Option B: 1 coach relationship on solo, unlimited on paid
- Option C: View-only coaching on solo, full features on paid

**Recommendation**: Option B - 1 coach relationship for Solo tier, creates upgrade pressure

**Q2: What are the coaching limits per tier?**

| Tier | Max Coaches (as coachee) | Max Coachees (as coach) | Notes Limit |
|------|-------------------------|------------------------|-------------|
| Solo | 1 | 1 | 10 per call |
| Team | 2 | 3 | Unlimited |
| Business | 5 | 10 | Unlimited |
| Enterprise | Unlimited | Unlimited | Unlimited |

**Q3: Can free users accept coaching invites?**
- If a paid user invites a free user as coachee, does it work?
- Does the inviter's tier determine limits, or the invitee's?

**Recommendation**: Inviter's tier determines limits (encourages paid accounts)

#### Team Features

**Q4: Is Teams feature available at all on Solo tier?**
- Option A: Teams is Business+ only (hard gate)
- Option B: Teams available on Team tier (name aligned)
- Option C: Basic teams on Team tier, advanced on Business+

**Recommendation**: Option B - Teams on Team tier, makes naming intuitive

**Q5: How does team size map to pricing?**
- Option A: Fixed seats per tier (5, 20, unlimited)
- Option B: Flexible seat count with per-seat pricing
- Option C: Tiered seat bundles (1-5, 6-20, 21-50, etc.)

**Recommendation**: Option A for simplicity, with add-on seats available

**Q6: What features are team-tier-gated?**

| Feature | Solo | Team | Business | Enterprise |
|---------|------|------|----------|------------|
| Team hierarchy | ❌ | ✅ | ✅ | ✅ |
| Manager auto-access | ❌ | ✅ | ✅ | ✅ |
| Shared folders | ❌ | ✅ | ✅ | ✅ |
| Coaching (basic) | 1/1 | 2/3 | 5/10 | ∞/∞ |
| Team admin controls | ❌ | ❌ | ✅ | ✅ |
| SSO/SAML | ❌ | ❌ | ❌ | ✅ |

---

### Pricing Tier Questions

#### Q7: What's the entry price point?**
- Current assumption: $29/mo for Solo
- Is this too high? Too low?
- Should there be a true free tier (0 users, limited features)?

**Market Comparison**:
- Gong: $200+/user/mo (enterprise only)
- Chorus.ai: $100+/user/mo
- Fireflies.ai: $10-39/user/mo
- Otter.ai: $8.33-20/user/mo

**Recommendation**: $29/mo Solo is competitive for the value

#### Q8: What's the Team tier structure?**
- Proposed: $99/mo for 5 users
- Is this enough to cover costs?
- Should it be per-seat from the start? ($19.99/user/mo = $99.95 for 5)

**Analysis**:
- 5 users × $29 Solo = $145 potential revenue if they don't bundle
- Offering $99 = $46 discount = 32% off
- Creates incentive to upgrade to Team tier

**Recommendation**: $99/mo flat for up to 5 users, clear value prop

#### Q9: Enterprise tier - when to engage sales?**
- At what company size do we require "Contact Sales"?
- Should Enterprise have public pricing at all?

**Recommendation**:
- Public pricing for Solo/Team/Business (self-serve)
- Enterprise (20+ seats) requires sales contact for custom pricing

---

### Payment & Billing Questions

#### Q10: Payment provider?**
- [ ] Stripe (standard, most integrations)
- [ ] Paddle (merchant of record, handles tax)
- [ ] Chargebee (subscription management)

**Recommendation**: Stripe - easiest integration with Vercel ecosystem

#### Q11: Billing frequency?**
- [ ] Monthly only
- [ ] Monthly + Annual (with discount)
- [ ] Quarterly option?

**Recommendation**: Monthly + Annual (save 20% = 2 months free)

**Pricing**:
| Tier | Monthly | Annual (20% off) |
|------|---------|------------------|
| Solo | $29/mo | $23.20/mo ($278/yr) |
| Team | $99/mo | $79.20/mo ($950/yr) |
| Business | $249/mo | $199.20/mo ($2,390/yr) |

#### Q12: Seat overages - how to handle?**
- What happens when a Team tier customer adds a 6th user?
- Auto-upgrade to next tier?
- Charge per additional seat ($15/seat/mo)?
- Block and require manual upgrade?

**Recommendation**: Allow add-on seats at $15/mo/seat, suggest upgrade when near next tier

---

## Feature Architecture

### Database Schema (Already Implemented)

#### Coach Tables

**`coach_relationships`**
```sql
- id (uuid, PK)
- coach_user_id (uuid, FK to auth.users)
- coachee_user_id (uuid, FK to auth.users)
- status (pending | active | paused | revoked)
- invited_by (coach | coachee)
- invite_token (varchar(32), nullable)
- invite_expires_at (timestamptz, nullable)
- created_at, accepted_at, ended_at
- UNIQUE(coach_user_id, coachee_user_id)
```

**`coach_shares`**
```sql
- id (uuid, PK)
- relationship_id (uuid, FK to coach_relationships)
- share_type (folder | tag | all)
- folder_id (uuid, FK to folders, nullable)
- tag_id (uuid, FK to call_tags, nullable)
- created_at
- CHECK constraints for share_type validation
```

**`coach_notes`**
```sql
- id (uuid, PK)
- relationship_id (uuid, FK to coach_relationships)
- call_recording_id (bigint)
- user_id (uuid)
- note (text)
- created_at, updated_at
- FK (call_recording_id, user_id) to fathom_calls
```

#### Team Tables (Need Verification)

**`teams`** - Expected structure (verify in migration)
**`team_members`** - Expected structure (verify in migration)
**`team_shares`** - Expected structure (verify in migration)

### Frontend Components (Already Implemented)

**Collaboration Navigation**:
- `/src/pages/CollaborationPage.tsx` - 3-pane layout container
- `/src/components/panes/CollaborationCategoryPane.tsx` - Category selector
- `/src/components/settings/CoachesTab.tsx` - Coaching UI
- `/src/components/settings/TeamTab.tsx` - Team management UI

**Hooks & State Management**:
- `/src/hooks/useCoachRelationships.ts` - All coach CRUD operations
- `/src/hooks/useUserRole.ts` - Role-based access control

**Routing**:
- `/team` → CollaborationPage (Team category)
- `/coaches` → CollaborationPage (Coaches category)

---

## Technical Implementation Checklist

### Phase 1: Database & Core Infrastructure (Week 1)

- [ ] **Day 1: Apply Migrations**
  - [ ] Run coach_access_tables migration in production
  - [ ] Run team_access_tables migration in production
  - [ ] Verify all tables created successfully
  - [ ] Test RLS policies work correctly

- [ ] **Day 2: Create Pricing Infrastructure**
  - [ ] Define Stripe products and prices
  - [ ] Create subscription tiers in Stripe
  - [ ] Set up webhooks for subscription events

- [ ] **Day 3: User Subscription Model**
  - [ ] Add `subscriptions` table to Supabase
    ```sql
    CREATE TABLE subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      stripe_customer_id text,
      stripe_subscription_id text,
      tier text CHECK (tier IN ('solo', 'team', 'business', 'enterprise')),
      status text CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
      current_period_start timestamptz,
      current_period_end timestamptz,
      cancel_at_period_end boolean DEFAULT false,
      created_at timestamptz DEFAULT NOW(),
      updated_at timestamptz DEFAULT NOW()
    );
    ```
  - [ ] Add indexes for subscription lookups
  - [ ] Create RLS policies

- [ ] **Day 4-5: Stripe Integration**
  - [ ] Create Edge Function for Stripe webhooks
  - [ ] Handle subscription.created
  - [ ] Handle subscription.updated
  - [ ] Handle subscription.deleted
  - [ ] Handle payment_intent.succeeded/failed
  - [ ] Create Stripe Customer Portal integration

### Phase 2: Feature Gates & Limits (Week 2)

- [ ] **Day 6: Feature Gate Infrastructure**
  - [ ] Create `useSubscription` hook
  - [ ] Create `useFeatureGate` hook
  - [ ] Define feature flags per tier
    ```typescript
    type FeatureGates = {
      maxCoachAsCoachee: number;
      maxCoachAsCoach: number;
      canUseTeams: boolean;
      maxTeamMembers: number;
      canUseSharedFolders: boolean;
      canUseAdvancedSharing: boolean;
    };
    ```

- [ ] **Day 7: Implement Coach Limits**
  - [ ] Check max coaches before creating relationship
  - [ ] Show upgrade prompt when limit reached
  - [ ] Display current usage in UI (e.g., "2/5 coaches used")

- [ ] **Day 8: Implement Team Limits**
  - [ ] Check max team members before adding
  - [ ] Show upgrade prompt when limit reached
  - [ ] Display seat usage in UI

- [ ] **Day 9-10: Upgrade Prompts & CTAs**
  - [ ] Create UpgradeDialog component
  - [ ] Add "Upgrade" buttons throughout UI
  - [ ] Create comparison table component
  - [ ] Design paywall modals for gated features

### Phase 3: Billing UI & User Flows (Week 3)

- [ ] **Day 11-12: Billing Settings Page**
  - [ ] Create BillingTab component
  - [ ] Show current plan and usage
  - [ ] Add upgrade/downgrade buttons
  - [ ] Integrate Stripe Customer Portal
  - [ ] Show invoices and payment history

- [ ] **Day 13-14: Checkout Flow**
  - [ ] Create PricingPage component
  - [ ] Implement Stripe Checkout integration
  - [ ] Handle success/cancel redirects
  - [ ] Send confirmation emails

- [ ] **Day 15: Testing & Edge Cases**
  - [ ] Test upgrade flow (Solo → Team → Business)
  - [ ] Test downgrade flow
  - [ ] Test cancellation
  - [ ] Test payment failures
  - [ ] Test proration logic

### Phase 4: Launch Preparation (Week 4)

- [ ] **Day 16-17: Marketing & Content**
  - [ ] Write pricing page copy
  - [ ] Create comparison table
  - [ ] Add FAQ section
  - [ ] Create upgrade announcement

- [ ] **Day 18: Analytics & Tracking**
  - [ ] Add analytics events for feature gates
  - [ ] Track upgrade button clicks
  - [ ] Monitor conversion funnel
  - [ ] Set up revenue dashboards

- [ ] **Day 19: Documentation**
  - [ ] Update user docs with pricing info
  - [ ] Create billing support articles
  - [ ] Document upgrade/downgrade policies
  - [ ] Create internal runbook for billing issues

- [ ] **Day 20: Soft Launch**
  - [ ] Enable for beta users only
  - [ ] Gather feedback
  - [ ] Fix critical bugs
  - [ ] Prepare for public launch

---

## Recommended Pricing Model

### Tier Structure

| Tier | Monthly | Annual | Users | Key Features |
|------|---------|--------|-------|--------------|
| **Solo** | $29 | $278/yr (save $70) | 1 | Unlimited calls, AI chat, 1 coach relationship, basic features |
| **Team** | $99 | $950/yr (save $238) | Up to 5 | + Team hierarchy, manager access, 2/3 coach relationships, shared folders |
| **Business** | $249 | $2,390/yr (save $598) | Up to 20 | + 5/10 coach relationships, advanced team controls, priority support |
| **Enterprise** | Custom | Custom | Unlimited | + Unlimited coaches, SSO, dedicated success manager, SLA |

### Add-Ons (Available on Team & Business tiers)

| Add-On | Price |
|--------|-------|
| Additional seat (beyond tier limit) | $15/mo per seat |
| Extra storage (per 100GB) | $10/mo |
| Advanced analytics | $49/mo |

### Feature Matrix

| Feature | Solo | Team | Business | Enterprise |
|---------|------|------|----------|------------|
| **Core Features** |
| Unlimited call recordings | ✅ | ✅ | ✅ | ✅ |
| AI transcription | ✅ | ✅ | ✅ | ✅ |
| AI chat assistant | ✅ | ✅ | ✅ | ✅ |
| Folders & tags | ✅ | ✅ | ✅ | ✅ |
| **Collaboration** |
| Coaches (as coachee) | 1 | 2 | 5 | Unlimited |
| Coachees (as coach) | 1 | 3 | 10 | Unlimited |
| Coach notes | 10/call | Unlimited | Unlimited | Unlimited |
| Team hierarchy | ❌ | ✅ | ✅ | ✅ |
| Manager auto-access | ❌ | ✅ | ✅ | ✅ |
| Shared folders | ❌ | ✅ | ✅ | ✅ |
| **Advanced** |
| Team admin controls | ❌ | Basic | Advanced | Full |
| Custom roles | ❌ | ❌ | ❌ | ✅ |
| SSO/SAML | ❌ | ❌ | ❌ | ✅ |
| API access | ❌ | ❌ | Limited | Full |
| Priority support | ❌ | Email | Chat | Phone + Slack |
| Dedicated CSM | ❌ | ❌ | ❌ | ✅ |

### Revenue Projections

**Assumptions**:
- 1,000 total users at launch
- 70% Solo, 20% Team, 8% Business, 2% Enterprise

**Monthly Recurring Revenue (MRR)**:
- 700 Solo × $29 = $20,300
- 40 Team accounts (200 users) × $99 = $3,960
- 8 Business accounts (80 users) × $249 = $1,992
- 2 Enterprise accounts × $1,500 avg = $3,000
- **Total MRR: $29,252**
- **Annual Run Rate (ARR): $351,024**

**Growth Scenario (Year 1)**:
- Month 6: 3,000 users → $85k MRR
- Month 12: 5,000 users → $140k MRR
- **Year 1 ARR: $1.68M**

---

## Go-To-Market Considerations

### Positioning

**Value Proposition by Tier**:

**Solo**: "Your personal AI sales coach"
- Target: Individual contributors, freelancers, consultants
- Message: Improve every call with AI insights and coaching
- Objection: "Why pay when others are free?"
- Answer: "Professional features for serious professionals"

**Team**: "Empower your sales team"
- Target: Small teams, sales managers with 2-5 reps
- Message: Give your team the tools to win together
- Objection: "Can we just use multiple Solo accounts?"
- Answer: "Team features (shared folders, manager access) only on Team tier"

**Business**: "Scale coaching across your organization"
- Target: Mid-market sales orgs, 10-50 reps
- Message: Systematic coaching drives consistent results
- Objection: "Why not enterprise if we're growing?"
- Answer: "Try Business first, upgrade when you need SSO and unlimited seats"

**Enterprise**: "Enterprise-grade call intelligence"
- Target: Large orgs, 50+ reps, IT/security requirements
- Message: Security, compliance, and scale for the enterprise
- Lead with: Sales consultation required

### Migration Strategy

**Existing Users (Pre-Pricing)**:
1. **Grandfather Policy**: All existing users get Solo tier free for 6 months
2. **Email Sequence**:
   - Week 1: Announce pricing, highlight new features
   - Week 8: "2 months left on grandfathered plan"
   - Week 20: "Last week of free access"
   - Week 24: Convert to paid or downgrade
3. **Discount Offer**: 20% off first year for early adopters

**Free Trial Strategy**:
- 14-day trial of Team tier (no credit card required)
- Auto-downgrade to Solo after trial (not block access)
- Email sequence to convert during trial

### Launch Timeline

**Week -2**:
- Soft launch to beta users
- Gather pricing feedback
- A/B test pricing page

**Week 0**:
- Public launch announcement
- Email existing users
- Social media campaign

**Week +2**:
- Analyze conversion rates
- Adjust pricing if needed
- Fix critical bugs

**Week +4**:
- Publish case studies
- Start outbound sales for Enterprise

---

## Open Questions & Decisions Needed

### Critical Path Decisions (Block Launch)

1. **Database Migration Timing**
   - ⚠️ **Decision Needed**: When to apply coach/team migrations to production?
   - **Blocker**: Yes - features completely broken without this
   - **Owner**: DevOps/Database admin
   - **Deadline**: ASAP

2. **Pricing Final Approval**
   - ⚠️ **Decision Needed**: Approve tier pricing ($29/$99/$249) or adjust?
   - **Blocker**: No - can launch with different prices
   - **Owner**: CEO/Founder
   - **Deadline**: Before marketing materials created

3. **Feature Gate Limits**
   - ⚠️ **Decision Needed**: Approve coaching limits (1/1, 2/3, 5/10, unlimited)?
   - **Blocker**: Yes - affects engineering implementation
   - **Owner**: Product Manager
   - **Deadline**: Before Phase 2 starts

4. **Grandfathering Policy**
   - ⚠️ **Decision Needed**: How long to grandfather existing users?
   - **Blocker**: No - can notify users later
   - **Owner**: CEO/Customer Success
   - **Deadline**: Before public announcement

### Secondary Decisions (Important but not blocking)

5. **Team Admin Controls**
   - What can team admins do that members can't?
   - Who can invite new team members?
   - Who can remove members?

6. **Billing Grace Periods**
   - How long to allow failed payments before downgrade?
   - Email notification schedule for payment failures?
   - Immediate downgrade or feature lockout?

7. **Seat Management**
   - Can team admins add seats without upgrading tier?
   - What's the maximum add-on seats before forcing tier upgrade?
   - Who gets notified when seats are added?

8. **Coach Invitation Limits**
   - Should there be a rate limit on sending invites?
   - What happens if a coach declines an invite?
   - Can users block coaching invites?

9. **Data Retention on Downgrade**
   - What happens to team data when downgrading from Team → Solo?
   - Do coaching relationships persist if user downgrades below limit?
   - Archive vs delete vs block access?

10. **Analytics & Reporting**
    - What metrics to track for pricing optimization?
    - How to measure feature gate effectiveness?
    - Dashboard for subscription health monitoring?

---

## Next Steps

### Immediate Actions (This Week)

1. **Apply database migrations** - Critical blocker
2. **Get pricing approval** - CEO sign-off needed
3. **Create Stripe account** - Set up payment infrastructure
4. **Define feature gate limits** - Engineering needs this to start Phase 2

### Phase 1 Kickoff (Next Week)

1. **Assign ownership** - Who owns billing implementation?
2. **Create project timeline** - Map 4-week sprint
3. **Set up dev environment** - Stripe test mode, local subscriptions table
4. **Write technical spec** - Detailed implementation plan for engineers

### Documentation Needs

- [ ] Create billing implementation spec (detailed technical doc)
- [ ] Write pricing page copy
- [ ] Create upgrade prompt messaging guide
- [ ] Document subscription webhook handling
- [ ] Create billing support runbook

---

## Appendix

### A. Competitor Pricing Research

| Product | Entry Tier | Mid Tier | Enterprise |
|---------|-----------|----------|------------|
| Gong | N/A | $200+/user/mo | Custom |
| Chorus.ai | N/A | $100+/user/mo | Custom |
| Fireflies.ai | Free | $10-39/user/mo | Custom |
| Otter.ai | Free | $8.33-20/user/mo | $20+/user/mo |
| **CallVault** | **$29/mo** | **$99/mo (5 users)** | **$249/mo (20 users)** |

**Positioning**: Premium pricing, but all-in-one value prop justifies it.

### B. Feature Gate Implementation Examples

```typescript
// Example: useFeatureGate hook
export function useFeatureGate() {
  const { subscription } = useSubscription();

  const gates = {
    maxCoachAsCoachee: {
      solo: 1,
      team: 2,
      business: 5,
      enterprise: Infinity,
    },
    maxCoachAsCoach: {
      solo: 1,
      team: 3,
      business: 10,
      enterprise: Infinity,
    },
    canUseTeams: {
      solo: false,
      team: true,
      business: true,
      enterprise: true,
    },
  };

  return {
    canUseFeature: (feature: string) => {
      return gates[feature]?.[subscription.tier] ?? false;
    },
    getLimit: (feature: string) => {
      return gates[feature]?.[subscription.tier] ?? 0;
    },
  };
}

// Usage in CoachesTab
const { canUseFeature, getLimit } = useFeatureGate();
const maxCoaches = getLimit('maxCoachAsCoachee');

if (currentCoaches >= maxCoaches) {
  // Show upgrade prompt
  <UpgradeDialog
    feature="coaching"
    currentLimit={maxCoaches}
    nextTier="business"
  />
}
```

### C. Database Migration Files

**Coach Tables**: `/supabase/migrations/20260108000002_create_coach_access_tables.sql`
**Team Tables**: `/supabase/migrations/20260108000003_create_team_access_tables.sql`

**Verification Query**:
```sql
-- Run this after applying migrations to verify
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE columns.table_name = tables.table_name) as column_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('coach_relationships', 'coach_shares', 'coach_notes', 'teams', 'team_members')
ORDER BY table_name;
```

### D. Stripe Product Setup Checklist

- [ ] Create Stripe account or use existing
- [ ] Enable test mode for development
- [ ] Create products:
  - [ ] Solo Tier (Monthly)
  - [ ] Solo Tier (Annual)
  - [ ] Team Tier (Monthly)
  - [ ] Team Tier (Annual)
  - [ ] Business Tier (Monthly)
  - [ ] Business Tier (Annual)
  - [ ] Additional Seat (Monthly addon)
- [ ] Configure webhooks:
  - [ ] `customer.subscription.created`
  - [ ] `customer.subscription.updated`
  - [ ] `customer.subscription.deleted`
  - [ ] `invoice.payment_succeeded`
  - [ ] `invoice.payment_failed`
- [ ] Set up Customer Portal
- [ ] Test checkout flow end-to-end

---

**END OF DOCUMENT**
