---
phase: 13-strategy-pricing
plan: 02
subsystem: payments
tags: [pricing, freemium, polar, mcp, billing, saas]

# Dependency graph
requires:
  - phase: 13-strategy-pricing (Plan 01)
    provides: AI strategy and product identity documents that contextualize the pricing positioning
provides:
  - Free/Pro/Team pricing specification with exact limits, prices, and feature boundaries
  - Upgrade prompt designs for every in-context limit hit (copy, trigger, placement, behavior)
  - Trial mechanics spec (14-day opt-in, post-trial downgrade behavior, workspace selection flow)
  - Polar configuration notes and migration actions for Plan 13-03
affects:
  - 13-03-PLAN.md (Polar update — tier names and prices drive product configuration)
  - Phase 14 (Foundation — billing gating system implements these specs)
  - Phase 16 (Workspace Redesign — workspace limits inform the workspace UI)
  - Phase 19 (MCP Audit + Tokens — MCP gating at Free/paid boundary)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "UpgradeGate component pattern: wraps any feature, checks tier, shows prompt if blocked"
    - "Copy constants pattern: all upgrade prompt copy stored in src/constants/upgrade-copy.ts"
    - "Soft gate at limit hits: three-behavior pattern (explain block + show unlock + one CTA)"
    - "Trial state sourced from Polar subscription metadata, never from local state"

key-files:
  created:
    - .planning/phases/13-strategy-pricing/PRICING-TIERS.md
    - .planning/phases/13-strategy-pricing/UPGRADE-PROMPTS.md
  modified: []

key-decisions:
  - "Free tier: 10 imports/month, 1 organization, 1 workspace, no MCP — clean limits with clear rationale"
  - "MCP is the Free/paid paywall, not the Pro/Team wall — clean single-sentence gate"
  - "Team tier at $79/month flat rate (not per-seat) for early adoption phase"
  - "Pro at $29/month, Team at $79/month — annual = 2 months free (framed, not as 20% off)"
  - "Trial is opt-in at moment of intent — 14-day, no credit card, Polar handles billing mechanics"
  - "Post-trial: keep all data, read-only on premium features, workspace selection for Pro->Free downgrade"
  - "UpgradeGate component pattern for all billing gates — keeps gating logic out of individual components"

patterns-established:
  - "Upgrade prompt three-behavior pattern: explain block + show unlock + CTA + dismiss"
  - "UpgradeGate wrapper component checks tier and shows prompt instead of executing action"
  - "Copy constants file for all upgrade prompt strings — enables rapid iteration without touching components"
  - "Frontend UpgradeGate is UX layer only — backend must independently enforce all limits"

# Metrics
duration: 4min
completed: 2026-02-27
---

# Phase 13 Plan 02: Pricing Tiers + Upgrade Prompts Summary

**Free/Pro/Team pricing spec ($0/$29/$79 flat) and upgrade prompt designs for every in-context limit hit, with 14-day opt-in trial mechanics and Polar migration notes**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-27T08:30:27Z
- **Completed:** 2026-02-27T08:35:25Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- PRICING-TIERS.md written: authoritative v2 pricing reference with Free/Pro/Team tier matrix, limit rationale, price points ($29/$79), annual pricing ($23/$63), trial mechanics, upgrade triggers, and Polar configuration notes for Plan 13-03
- UPGRADE-PROMPTS.md written: design spec for every in-context upgrade prompt — import limit, workspace limit, MCP access (Free->Pro), invite/org/per-workspace token (Pro->Team), trial opt-in modal, post-trial downgrade messaging, Settings "Your Plan" section, and developer implementation notes
- All tier decisions locked: MCP as the Free/paid paywall, Team differentiator is collaboration not limits, Smart Import as never-gated table stakes, flat-rate Team pricing

## Task Commits

Each task was committed atomically:

1. **Task 1: Write Pricing Tiers Specification (STRAT-02, BILL-01, BILL-03)** - `c51f4c7` (feat)
2. **Task 2: Write Upgrade Prompts Design Document (BILL-04)** - `9baf3e6` (feat)

**Plan metadata:** (docs commit follows this summary)

## Files Created

- `.planning/phases/13-strategy-pricing/PRICING-TIERS.md` — Authoritative v2 pricing reference: 10-section spec with Free/Pro/Team tier matrix, limits with rationale, prices, annual billing, trial mechanics, upgrade triggers, never-gated features, and Polar migration notes
- `.planning/phases/13-strategy-pricing/UPGRADE-PROMPTS.md` — Upgrade prompt design spec: all 9 upgrade prompt variants, trial opt-in modal, post-trial downgrade flow, Settings "Your Plan" section, and developer implementation notes (UpgradeGate pattern, copy constants, backend vs frontend enforcement)

## Decisions Made

- **Free tier limits set at exactly 10 imports/month, 1 org, 1 workspace, no MCP.** 10 imports is enough for a new user to see value (2-3 days for an active sales rep) but not enough to solve their problem. 1 workspace triggers upgrade when the user wants to organize by client/project. No MCP is a clean single-sentence paywall.
- **MCP is the Free/paid paywall, not the Pro/Team wall.** No demo cap. Clean, simple, easy to explain and implement.
- **Team at $79/month flat rate (not per-seat).** Reduces buying friction for managers. Per-seat deferred to enterprise motion.
- **Annual pricing framed as "2 months free" not "20% off."** More concrete and compelling for the buyer.
- **Trial is opt-in at moment of intent.** User explicitly starts the 14-day window. Polar handles billing; the UX layer is a frontend pattern.
- **Post-trial workspace selection:** On Pro->Free downgrade with multiple workspaces, user picks 1 active workspace. Non-selected workspaces become read-only. Triggered via Polar webhook.
- **UpgradeGate component pattern:** All billing gates delivered through a single shared component that wraps the guarded feature. Keeps gating logic centralized, not scattered across components.
- **Copy constants file:** All upgrade prompt strings stored as importable constants for easy iteration.

## Deviations from Plan

None — plan executed exactly as written. Both documents created per specification with all required sections.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Plan 13-03 handles Polar dashboard updates.

## Next Phase Readiness

- PRICING-TIERS.md is ready as the authoritative reference for all Phase 14+ billing and gating implementation
- UPGRADE-PROMPTS.md is ready as the developer reference for Phase 14+ billing UI implementation
- Plan 13-03 (Polar Dashboard Update) can now proceed — it has explicit Polar migration instructions from PRICING-TIERS.md Section 10
- All tier names, prices, limits, and behaviors are locked and consistent across both documents

## Self-Check: PASSED

- FOUND: `.planning/phases/13-strategy-pricing/PRICING-TIERS.md`
- FOUND: `.planning/phases/13-strategy-pricing/UPGRADE-PROMPTS.md`
- FOUND: `.planning/phases/13-strategy-pricing/13-02-SUMMARY.md`
- FOUND commit: `c51f4c7` (Task 1: PRICING-TIERS.md)
- FOUND commit: `9baf3e6` (Task 2: UPGRADE-PROMPTS.md)

---
*Phase: 13-strategy-pricing*
*Completed: 2026-02-27*
