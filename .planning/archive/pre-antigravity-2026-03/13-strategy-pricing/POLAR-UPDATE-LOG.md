# Polar Billing Dashboard — Clean v2 Setup

**Status:** COMPLETE — 4 v2 products live in Polar
**Created:** 2026-02-27
**Phase:** 13-03 (Polar Dashboard Update)
**Covers:** BILL-02

---

## Overview

This document is the authoritative spec for setting up CallVault's v2 Polar billing products (Pro/Team with workspace + MCP messaging, zero AI claims).

**Current subscriber state:** As of 2026-02-27 there are **0 paying subscribers** on any Polar product. All current CallVault users are effectively on a free tier enforced in-app. This means we treat the Polar setup as a **clean install** rather than a true migration — no subscriber impact analysis needed, no grandfathering, no legacy pricing concerns.

---

## 1. Current State (v1 Polar Products)

v1 Polar products (Solo/Team/Business) may exist as stubs. **0 active subscribers on any of them.**

| v1 Product | Subscribers | Action |
|------------|-------------|--------|
| Solo | 0 | Rename to "Pro Monthly" or archive + create fresh |
| Team | 0 | Archive |
| Business | 0 | Archive |

Since there are no subscribers, there is no migration risk. Either rename or archive+recreate — both are equally safe.

---

## 2. Target State (v2 Polar Products)

After setup, the Polar dashboard must contain exactly these 4 active products:

| v2 Product | Price | Billing Interval | Polar Interval Value |
|------------|-------|-----------------|---------------------|
| Pro Monthly | $29/month | Monthly | `month` |
| Pro Annual | $278/year | Annual | `year` |
| Team Monthly | $79/month | Monthly | `month` |
| Team Annual | $758/year | Annual | `year` |

Any v1 stubs (Solo/Team/Business) should be archived or deleted. **Free tier** has no Polar product — enforced in app logic only.

---

## 3. Setup Plan

Since there are 0 subscribers, this is a clean setup, not a migration.

### Step 1: Clean up v1 stubs

- If "Solo" exists with 0 subs → either rename to "Pro Monthly" and update description, OR archive it and create fresh (both are fine with 0 subs)
- If "Team" exists with 0 subs → archive it
- If "Business" exists with 0 subs → archive it
- Delete any obviously test products you know you'll never use

### Step 2: Create v2 products (fresh)

| Product | Price | Interval | Description |
|---------|-------|----------|-------------|
| Pro Monthly | $29/month | Monthly | See Section 5 template |
| Pro Annual | $278/year | Annual | See Section 5 template |
| Team Monthly | $79/month | Monthly | See Section 5 template |
| Team Annual | $758/year | Annual | See Section 5 template |

### Step 3: Record product IDs

Fill in Section 9 with the four v2 product IDs for Phase 14 billing integration.

---

## 4. Decisions (Resolved)

All decisions are trivial with 0 subscribers.

**Decision 1: Business subscribers** — There are **0 Business subscribers**. Archive Business. No-op in practice.

**Decision 2: v1 Team subscribers** — There are **0 Team subscribers**. Archive v1 Team and create a fresh "Team Monthly" at $79. No migrations required.

**Decision 3: Annual products** — Create Pro Annual and Team Annual now, alongside monthly products, so Phase 14 can integrate against a stable set of four product IDs.

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

- [ ] Zero active Polar products contain "AI-powered" in name or description
- [ ] "Pro Monthly" exists at $29/month with v2 description
- [ ] "Pro Annual" exists at $278/year with v2 description
- [ ] "Team Monthly" exists at $79/month with v2 description
- [ ] "Team Annual" exists at $758/year with v2 description
- [ ] Any v1 stubs (Solo/Team/Business) are archived or deleted
- [ ] Product IDs recorded in Section 9

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

**1. Discovery**
- [ ] Log into Polar → Products
- [ ] Delete or archive any test/v1 products (Solo, Team, Business) — all have 0 subs

**2. Create v2 products (fresh)**
- [ ] Pro Monthly — $29/month, description from Section 5
- [ ] Pro Annual — $278/year, description from Section 5
- [ ] Team Monthly — $79/month, description from Section 5
- [ ] Team Annual — $758/year, description from Section 5

**3. Record IDs**
- [ ] Fill in Section 9 product ID table

**4. Verify**
- [ ] Run Section 6 checklist

---

## 9. Product IDs to Record

After execution, record the Polar product IDs here for use in Phase 14 billing integration.

| Product | Polar Product ID |
|---------|-----------------|
| Pro Monthly | 30020903-fa8f-4534-9cf1-6e9fba26584c |
| Pro Annual | 9ff62255-446c-41fe-a84d-c04aed23725c |
| Team Monthly | 88f3f07e-afa3-4cb1-ac9d-d2429a1ce1b7 |
| Team Annual | 6a1bcf14-86b4-4ec9-bcbe-660bb714b19f |

These IDs will be referenced in:
- `src/constants/billing.ts` (Phase 14)
- Tier detection logic: product_id prefix → tier mapping
- Checkout session creation parameters

---

*Created: 2026-02-27*
*Updated: 2026-02-27 — simplified to clean setup (0 subscribers, no migration needed)*
*Status: COMPLETE — 4 v2 products created in Polar, IDs recorded*
*Completed: 2026-02-27*
