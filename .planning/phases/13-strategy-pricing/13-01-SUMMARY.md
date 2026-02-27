---
phase: 13-strategy-pricing
plan: 01
subsystem: docs
tags: [product-identity, ai-strategy, mcp, positioning, strategy]

# Dependency graph
requires: []
provides:
  - "AI-STRATEGY.md: Definitive MCP-first strategy with Smart Import + bridge chat scope"
  - "PRODUCT-IDENTITY.md: One-page product identity for B2B sales teams / RevOps primary buyer"
affects:
  - "Phase 14-22: All v2 development phases reference these documents for AI constraints and product messaging"
  - "13-02: Pricing tiers must align with product identity (B2B teams, not solo reps)"
  - "13-03: Polar dashboard update must remove AI-powered language per AI-STRATEGY.md"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Decisional brief format: open with answer, justify, close with finality statement"
    - "Anti-identity as top-half document section (not buried at end)"
    - "Marketing angle: outcome-led (benefit) / MCP one layer down (mechanism)"

key-files:
  created:
    - ".planning/phases/13-strategy-pricing/AI-STRATEGY.md"
    - ".planning/phases/13-strategy-pricing/PRODUCT-IDENTITY.md"
  modified: []

key-decisions:
  - "CallVault is MCP-first: stores/organizes calls, hands them to user's existing AI via MCP"
  - "Smart Import is the only in-app AI: auto-title, action items, tags, sentiment at import time — named feature, no AI label"
  - "Drop entirely: RAG pipeline, embeddings, vector search, Content Hub, Langfuse, semantic search"
  - "Marketing tagline locked: AI-ready not AI-powered"
  - "Primary buyer locked: Heads of Sales / RevOps at B2B companies with 5-50 reps"
  - "Competitive framing locked: Gong is the coach, CallVault is the film room and wiring"
  - "One-liner locked: Close more deals from the calls you are already having"
  - "Category line locked: The operating system for your sales calls"

patterns-established:
  - "Strategy docs use finality statement: This document is not open for revisiting"
  - "Product identity docs place anti-identity in top half, before features"

# Metrics
duration: 2min
completed: 2026-02-27
---

# Phase 13 Plan 01: Strategy + Positioning Summary

**MCP-first AI strategy and B2B sales team product identity locked before v2 development begins — no hedging, no alternatives, no AI-powered claims**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-27T08:30:24Z
- **Completed:** 2026-02-27T08:32:04Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- AI-STRATEGY.md written as a decisional brief: MCP-first is the decision, not a recommendation. Smart Import scoped as the only enrichment feature. RAG, embeddings, vector search, and Content Hub explicitly dropped. "AI-ready, not AI-powered" locked as the marketing tagline.
- PRODUCT-IDENTITY.md written as a one-page reference (596 words, under 2 minutes): Primary buyer is Heads of Sales / RevOps at B2B companies with 5-50 reps. Anti-identity (five hard stops) placed prominently in section 3. "Film room and wiring" competitive framing establishes a different category from Gong, not a cheaper alternative.
- Both documents cross-reference each other: AI-STRATEGY's "AI-ready, not AI-powered" is anti-identity point 5 in PRODUCT-IDENTITY.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write AI Strategy Document (STRAT-01)** - `0d46861` (docs)
2. **Task 2: Write Product Identity Document (STRAT-03)** - `61ae54b` (docs)

## Files Created/Modified

- `.planning/phases/13-strategy-pricing/AI-STRATEGY.md` - Definitive AI strategy: MCP-first with bridge chat optional, Smart Import kept, all RAG dropped. Includes Decision Confidence finality statement.
- `.planning/phases/13-strategy-pricing/PRODUCT-IDENTITY.md` - One-page product reference: primary buyer, prominent anti-identity, messaging hierarchy, competitive positioning.

## Decisions Made

- CallVault is MCP-first: call organization + MCP delivery, user provides their own AI
- Smart Import is the named in-app enrichment feature: one-time at import, no AI label in-product, "Auto-generated — edit anytime"
- RAG pipeline, embeddings, vector search, Content Hub, Langfuse all dropped from v2 permanently
- "AI-ready, not AI-powered" is the locked marketing tagline — "AI-powered" never appears positively
- Primary buyer: Heads of Sales and RevOps at B2B companies with 5-50 reps (not solo reps, not coaches as primary)
- Coaches and consultants are secondary / tactical: early adopters, testimonials, referral channels
- Competitive framing: "Gong is the coach. CallVault is the film room and wiring." — different category, not diet Gong
- One-liner: "Close more deals from the calls you're already having."
- Category positioning: "The operating system for your sales calls."

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- AI-STRATEGY.md is referenced by AI-02 constraint: no RAG code in new repo, ever
- PRODUCT-IDENTITY.md is the source of truth for all v2 copy, naming decisions, and persona references
- Plan 13-02 (Pricing Tiers) can proceed immediately — pricing must align with B2B sales team / RevOps primary buyer from PRODUCT-IDENTITY.md
- Plan 13-03 (Polar Dashboard Update) must remove "AI-powered" language per AI-STRATEGY.md

---
*Phase: 13-strategy-pricing*
*Completed: 2026-02-27*

## Self-Check: PASSED

- FOUND: `.planning/phases/13-strategy-pricing/AI-STRATEGY.md`
- FOUND: `.planning/phases/13-strategy-pricing/PRODUCT-IDENTITY.md`
- FOUND: `.planning/phases/13-strategy-pricing/13-01-SUMMARY.md`
- FOUND: commit `0d46861` (AI-STRATEGY.md)
- FOUND: commit `61ae54b` (PRODUCT-IDENTITY.md)
