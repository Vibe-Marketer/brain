---
plan: 36-07
phase: 36
title: QA Fold-Ins — Notes & Deferrals
date: 2026-05-12
---

# Phase 36-07 — Notes & Deferrals

## QA-14 — Call Detail Pane 4 refactor (RESOLVED — MODAL STAYS CANONICAL)

**Status:** RESOLVED 2026-05-12 by Andrew. Call Detail stays a modal — no Pane 4 refactor.

**Decision (Andrew, 2026-05-12):** "this call detail always stays a modal". Phase 11 Decision D-07 is reaffirmed. The CLAUDE.md root rule about "no drawer overlays, no covering content" is amended in spirit: Call Detail is an explicit, intentional exception to the all-panes-same-plane rule because the depth of inspection (multiple tabs, transcript, participants, edits) warrants a focused overlay. Other Pane 4 surfaces (Workspace Detail, Folder Detail, Settings Help) continue to shrink Pane 3 and operate on the same plane.

**Reason (original):** Decision D-07 (Phase 11) explicitly chose the modal-overlay pattern for Call Detail. `src/pages/CallDetailPage.tsx` documents this:

> Per Phase 11 Decision D-07: Call detail must open as a modal overlay
> (CallDetailDialog), not as a standalone page. Bookmarked URLs and shared
> links still work — they are redirected to the Calls page, which then opens
> the modal for the specified call.

The Phase 29 QA-14 finding flagged that this contradicts the CLAUDE.md root rule:

> AppShell: Pane 4 slides in and Pane 3 shrinks to make room. All panes
> operate on the same plane/z-index — no drawer overlays, no covering content.

Resolving this conflict requires:
1. A product decision (modal vs Pane 4) — needs Andrew's input on which architecture wins
2. Significant refactor of `CallDetailDialog.tsx` → `CallDetailPanel.tsx` (Pane 4 component)
3. Migration of every tab inside Call Detail (Overview, Transcript, Invitees, Participants, Edit segment, Trim segment, Speaker change, Resync, Split, Notes) to the Pane 4 layout — which may require different sizing, scroll behavior, and close-button placement
4. Updating every entry point (home row click, share-link target, deep-link redirect) to use the new pattern
5. Visual QA across all four panes to confirm Pane 3 shrinking works without breaking the table layout

This work is too large to land cleanly inside Phase 36's bug-sweep scope. A dedicated mini-phase (e.g., Phase 36.5 or a Phase 42 entry in v2.3) should:

- Resolve the modal vs Pane 4 product decision with the user
- If Pane 4 wins, update D-07 to reflect the reversal
- Build the panel component and migrate entry points in a single atomic PR

**Workaround for v2.2:** Modal remains the canonical Call Detail surface. Deep-link works (QA-05 fix). No regression.

## QA-08 — Analytics rebuild (PARTIAL)

**Status:** Stub language updated, full rebuild deferred to v2.3.

**Done in Phase 36:** Replaced "Analytics content for {category} coming soon" placeholder with an honest "Analytics is being rebuilt for v2.3" message. Confused users no longer see broken charts.

**Deferred:** Actual analytics rebuild (real charts, working KPI cards with date-range filters, match-Home counts). Tracked as a dedicated v2.3 phase.

## QA-13 — Cmd+K search perf (PARTIAL)

**Status:** Client-side improvements applied. Server-side index work deferred.

**Done in Phase 36:**
- Debounce 300 → 200ms
- `placeholderData: keepPreviousData` keeps prior results visible during refetch

**Deferred:**
- Server-side full-text search index (pg_trgm or tsvector) on `recordings.full_transcript`. Currently using `ilike` on a large text field — fundamentally O(n) table scan. Deferred to Phase 38 (Frontend Security & RLS Audit, which already touches search performance).
- AbortController on stale in-flight requests (TanStack Query's built-in cancellation should already handle this via the queryKey change, but explicit AbortController could be added if perf testing shows it's needed).
