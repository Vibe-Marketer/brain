# Polar Billing Dashboard — Migration Spec

**Status:** Spec ready — awaiting human execution in Polar dashboard
**Created:** 2026-02-27
**Phase:** 13-03 (Polar Dashboard Update)
**Covers:** BILL-02

---

## Overview

This document is the authoritative spec for updating CallVault's Polar billing products from v1 identity (Solo/Team/Business with "AI-powered" messaging) to v2 identity (Pro/Team with workspace + MCP messaging, zero AI claims).

**Do not make Polar changes until you have read this entire document.**

**Key constraint:** This spec was authored based on PRICING-TIERS.md and the Polar constraints documented during Phase 13 research. The exact current state of v1 products (especially v1 Team price) must be verified in the Polar dashboard before executing any changes.

---

## 1. Current State (v1 Polar Products)

These are the v1 Polar products as understood from PROJECT.md and Phase 13 research. **Verify each in the Polar dashboard before proceeding.**

| v1 Product | Expected Price | Billing Interval | Status |
|------------|---------------|-----------------|--------|
| Solo | $29/month | Monthly | Active (rename to Pro Monthly) |
| Team | Unknown — verify in dashboard | Monthly | Verify price before action |
| Business | Unknown — verify in dashboard | Monthly or Annual | Archive (see migration plan) |

**Notes on current state:**
- v1 used the naming "Solo/Team/Business" — these predate the v2 naming decision
- v1 product descriptions likely contain "AI-powered" language (e.g., "AI-powered call intelligence") — all of this must be removed
- No annual variants exist in v1 — annual products are new and must be created from scratch
- The Free tier has no Polar product and requires no changes

**What to check in the Polar dashboard:**
1. Navigate to polar.sh → your organization → Products
2. Record the exact name, price, billing interval, and description for each active product
3. Note whether any existing subscribers are on each product (this affects the migration path)

---

## 2. Target State (v2 Polar Products)

After the migration, the Polar dashboard must contain exactly these products:

| v2 Product | Price | Billing Interval | Polar Interval Value | Status |
|------------|-------|-----------------|---------------------|--------|
| Pro Monthly | $29/month | Monthly | `month` | Active |
| Pro Annual | $278/year | Annual | `year` | Active |
| Team Monthly | $79/month | Monthly | `month` | Active |
| Team Annual | $758/year | Annual | `year` | Active |

**v1 products to archive:**
- Solo → superseded by Pro Monthly (rename in-place — no archiving needed)
- Team (v1) → superseded by Team Monthly (rename in-place if price matches; otherwise archive + create new)
- Business → archive (new purchases disabled; existing subscribers unaffected)

**Free tier:** No Polar product required. Free tier access is enforced in app logic only.

---

## 3. Migration Plan

### 3.1 Solo → Pro Monthly

**Recommended action: Rename in-place**

| Field | Current (v1) | Target (v2) | Can Change? |
|-------|-------------|-------------|-------------|
| Name | "Solo" | "Pro Monthly" | YES |
| Description | [likely "AI-powered call intelligence" variant] | See description template below | YES |
| Price | $29/month | $29/month | No change needed (matches target) |
| Billing interval | Monthly | Monthly | NO (and no change needed) |

**Action:** Rename product to "Pro Monthly". Replace description with v2 template.

**Existing subscriber impact:** None. Price unchanged. Existing Solo subscribers continue on their current subscription. They will see the new name "Pro Monthly" going forward — this is cosmetic only.

**Risk level:** Low — in-place rename with no price change.

---

### 3.2 Team (v1) → Team Monthly

**Action depends on current v1 Team price. Verify in dashboard first.**

**Scenario A: v1 Team price is $79/month**

| Field | Current (v1) | Target (v2) | Can Change? |
|-------|-------------|-------------|-------------|
| Name | "Team" | "Team Monthly" | YES |
| Description | [likely AI-powered variant] | See description template below | YES |
| Price | $79/month | $79/month | No change needed |
| Billing interval | Monthly | Monthly | NO (and no change needed) |

**Action (Scenario A):** Rename in-place to "Team Monthly". Update description. No subscriber impact.

---

**Scenario B: v1 Team price is NOT $79/month**

| Field | Current (v1) | Target (v2) | Can Change? |
|-------|-------------|-------------|-------------|
| Name | "Team" | Retire (archive) | — |
| Description | [old] | — | — |
| Price | [not $79] | Cannot change for existing subs | NO |
| Billing interval | Monthly | Monthly | — |

**Action (Scenario B):** This requires a human decision. See Section 4.

**Risk level for Scenario B:** Medium — existing Team subscribers will be on old pricing. Must decide whether to migrate them or leave them.

---

### 3.3 Business → Archive

**Recommended action: Archive**

| Field | Current (v1) | Target (v2) | Can Change? |
|-------|-------------|-------------|-------------|
| Name | "Business" | No v2 equivalent | — |
| Description | [old] | — | — |
| Price | Unknown | — | — |
| Billing interval | Unknown | — | — |

**Action:** Archive the Business product. Archiving means:
- New purchases are disabled (customers cannot subscribe to Business)
- Existing Business subscribers keep their subscription and access
- The product is hidden from your pricing page and checkout flows

**Existing subscriber impact:** Business subscribers are NOT automatically migrated. They retain their current subscription at their current price. This is a **human decision** — see Section 4 for migration options.

**Risk level:** Low (archive itself is safe) — but the subscriber impact decision requires human input.

---

### 3.4 Pro Annual → Create New

**Recommended action: Create new product**

| Field | Value |
|-------|-------|
| Name | "Pro Annual" |
| Description | See description template below |
| Price | $278/year |
| Billing interval | Annual (`year` in Polar API) |
| Trial | 14 days (same as Pro Monthly) |

**Action:** Create a new Polar product. Polar requires annual billing to be a separate product (not a toggle on the monthly product).

**Existing subscriber impact:** None — new product, no existing subscribers.

---

### 3.5 Team Annual → Create New

**Recommended action: Create new product**

| Field | Value |
|-------|-------|
| Name | "Team Annual" |
| Description | See description template below |
| Price | $758/year |
| Billing interval | Annual (`year` in Polar API) |
| Trial | None (or match Team Monthly — your call) |

**Action:** Create a new Polar product.

**Existing subscriber impact:** None — new product.

---

## 4. Decision Points for User

These items require your input before execution. Do not proceed past this point without reading them.

---

### Decision 1: What to do with existing Business subscribers

**Context:** Business product is being archived. Any users currently on Business will not be automatically migrated.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Archive Business. Leave Business subscribers on their current plan until they cancel naturally. | Zero subscriber impact. Safe. | Subscribers on legacy pricing indefinitely. Price mismatch from v2 targets. |
| B | Archive Business. Reach out to Business subscribers directly and offer migration to Team Monthly at $79/month. | Clean billing state going forward. | Requires manual outreach. Subscribers may churn if price change is unwelcome. |
| C | Archive Business. Offer Business subscribers a discounted Team price as a loyalty incentive (e.g., grandfathered at their old price). | Reduces churn risk. | More complex billing setup. |

**Recommendation:** Option A unless you have active Business subscribers who are paying significantly less than $79/month and would be upset by eventual migration pressure. For a small subscriber base, Option A is cleanest.

**Your decision:** ______

---

### Decision 2: What to do with v1 Team subscribers (if Scenario B applies)

**This decision only applies if v1 Team price ≠ $79/month.**

**Context:** If v1 Team is priced differently from $79/month, you cannot change the price for existing subscribers. You must decide:

| Option | Description | Impact |
|--------|-------------|--------|
| A | Rename v1 Team in-place to "Team Monthly". Accept that existing subs are on old price. | Existing subs on old price; new subs at $79. Price mismatch forever for existing subs. |
| B | Archive v1 Team. Create new "Team Monthly" at $79. Existing subs stay on archived product until they cancel. | Clean new product at right price; legacy subs on old product. |
| C | Rename v1 Team. Reach out to existing Team subs and offer migration. | Clean state; requires manual migration effort. |

**Recommendation:** If v1 Team price is close to $79 (within $10), rename in-place (Option A). If significantly different, archive + create new (Option B).

**Your decision:** ______

---

### Decision 3: Annual products — create now or defer?

**Context:** Pro Annual and Team Annual do not exist in v1 Polar. They need to be created fresh.

**Options:**

| Option | When to create |
|--------|---------------|
| A | Create now alongside the rename/archive operations | Annual options available immediately when Phase 14 builds checkout flows |
| B | Defer to Phase 14 | Annual creation happens closer to frontend billing implementation |

**Recommendation:** Create now (Option A). Phase 14 builds checkout flows against Polar products — having the annual products exist in advance avoids rework. Creating them now costs 5 minutes and has no subscriber impact.

**Your decision:** ______

---

## 5. Description Templates

These are the v2 description templates ready to paste into Polar. **Zero "AI-powered" language.** Use exactly as written, or adjust wording — but the constraint is absolute: do not add any claim about AI, intelligence, or automation.

---

### Pro Monthly

**Short description (for product card):**
> Organized call workspace for serious professionals. Unlimited imports, multiple workspaces, full MCP access. Your calls, ready for any AI.

**Full description (for product detail page):**
> Pro removes every limit and connects your call library to the AI you already use.
>
> What you get:
> - Unlimited imports every month — no counters, no caps
> - Multiple workspaces to organize calls by client, project, or deal stage
> - Full MCP access — connect Claude, ChatGPT, Gemini, or any MCP-compatible AI to your call library
> - Full import routing rules — auto-assign calls to the right workspace at import
>
> Your calls, organized and wired to your AI. That's it.

---

### Pro Annual

**Short description:**
> Everything in Pro Monthly, billed annually. Save 2 months.

**Full description:**
> Same as Pro Monthly — unlimited imports, multiple workspaces, full MCP access — billed annually at $278/year (equivalent to $23/month, saving you 2 months vs monthly billing).

---

### Team Monthly

**Short description (for product card):**
> Call workspace for your entire team. Everything in Pro, plus shared workspaces, roles and permissions, per-workspace MCP tokens, and an admin dashboard. Your team's calls, organized and connected.

**Full description (for product detail page):**
> Team is qualitatively different from Pro — not higher limits, but collaboration powers Pro doesn't have.
>
> Everything in Pro, plus:
> - Shared workspaces — multiple team members access, contribute to, and search the same workspace
> - Roles and permissions — Viewer (read-only), Member (add/edit calls), Admin (manage members and workspace)
> - Per-workspace MCP tokens — each workspace gets its own MCP connection with scoped access
> - Shared import routing rules — one admin configures, all members benefit
> - Admin dashboard — member management, workspace overview, usage summary
> - Consolidated billing — one invoice, all team members covered
>
> Flat rate, not per-seat. One monthly price regardless of team size.

---

### Team Annual

**Short description:**
> Everything in Team Monthly, billed annually. Save 2 months.

**Full description:**
> Same as Team Monthly — shared workspaces, roles and permissions, per-workspace MCP tokens, admin dashboard — billed annually at $758/year (equivalent to $63/month, saving you 2 months vs monthly billing).

---

## 6. Post-Update Verification Checklist

After executing all changes in Polar, verify each item below. Do not mark Phase 13 Plan 03 complete until all boxes are checked.

- [ ] Zero Polar products contain "AI-powered" in name or description
- [ ] Zero Polar products contain "AI-powered call intelligence" or similar v1 claims
- [ ] "Pro Monthly" product exists at $29/month with v2 description
- [ ] "Pro Annual" product exists at $278/year with v2 description
- [ ] "Team Monthly" product exists at $79/month with v2 description
- [ ] "Team Annual" product exists at $758/year with v2 description
- [ ] Old "Solo" product is renamed to "Pro Monthly" (not archived, not a new product)
- [ ] Old "Business" product is archived (visible in archived products, not in active products)
- [ ] Existing subscribers on Solo (now Pro Monthly) are unaffected
- [ ] Existing subscribers on Business retain access (Polar shows subscription still active)
- [ ] Product IDs for Pro Monthly and Team Monthly are stable (no new IDs created for in-place renames)
- [ ] New annual product IDs are recorded for Phase 14 billing integration

---

## 7. Polar Constraints Reference

For reference during execution — these constraints were confirmed during Phase 13 research.

| Constraint | Detail |
|-----------|--------|
| Name and description | CAN be edited at any time. No subscriber impact. |
| Billing interval | CANNOT be changed after product creation. Monthly and annual must be separate products. |
| Price (fixed-price products) | Changes apply to NEW subscriptions only. Existing subscribers keep their original price forever. |
| Product deletion | NOT possible. Products can only be archived. Archiving disables new purchases; existing subscribers unaffected. |
| Annual billing | Must be a SEPARATE Polar product. Polar interval value: `year` (not `annual`). |
| Free tier | No Polar product required. Free access is enforced in app logic. |
| Trial period | Configured per product in Polar. 14-day trial on Pro Monthly — no credit card required. |

---

## 8. Execution Checklist

Work through this in order to ensure nothing is missed.

**Before starting:**
- [ ] Log into Polar dashboard (https://polar.sh)
- [ ] Navigate to Products
- [ ] Record actual current prices for all v1 products (Solo, Team, Business)
- [ ] Note number of active subscribers per product
- [ ] Make decisions from Section 4 (decisions 1-3)

**Step 1: Solo → Pro Monthly (rename in-place)**
- [ ] Find "Solo" product
- [ ] Edit name to "Pro Monthly"
- [ ] Replace description with Pro Monthly template from Section 5
- [ ] Verify price is still $29/month (no change)
- [ ] Save

**Step 2: Business → Archive**
- [ ] Find "Business" product
- [ ] Click Archive
- [ ] Confirm archive action
- [ ] Verify product appears in archived state (not in active products)
- [ ] Confirm existing Business subscribers still show active subscriptions

**Step 3: Team (v1) → Team Monthly (rename in-place OR archive + create)**
- [ ] Apply Scenario A or B based on Decision 2
- [ ] If rename: Update name to "Team Monthly", replace description with Team Monthly template
- [ ] If archive + create: Archive old Team; create new Team Monthly at $79/month with v2 description

**Step 4: Create Pro Annual**
- [ ] Click "Create product"
- [ ] Name: "Pro Annual"
- [ ] Price: $278
- [ ] Billing interval: Annual (yearly)
- [ ] Description: Pro Annual template from Section 5
- [ ] Save and record new product ID

**Step 5: Create Team Annual**
- [ ] Click "Create product"
- [ ] Name: "Team Annual"
- [ ] Price: $758
- [ ] Billing interval: Annual (yearly)
- [ ] Description: Team Annual template from Section 5
- [ ] Save and record new product ID

**Step 6: Verification**
- [ ] Run through Section 6 checklist
- [ ] Confirm zero "AI-powered" language across all active products

---

## 9. Product IDs to Record

After execution, record the Polar product IDs here for use in Phase 14 billing integration.

| Product | Polar Product ID |
|---------|-----------------|
| Pro Monthly | ______________________ |
| Pro Annual | ______________________ |
| Team Monthly | ______________________ |
| Team Annual | ______________________ |

These IDs will be referenced in:
- `src/constants/billing.ts` (Phase 14)
- Tier detection logic: product_id prefix → tier mapping
- Checkout session creation parameters

---

*Created: 2026-02-27*
*Status: Spec complete — awaiting user execution in Polar dashboard*
*Next: User executes changes, confirms in checkpoint, Phase 13 Plan 03 complete*
