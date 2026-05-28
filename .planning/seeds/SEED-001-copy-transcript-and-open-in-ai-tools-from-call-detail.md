---
id: SEED-001
status: dormant
planted: 2026-05-28
planted_during: Self-Serve Public Launch — Phase 2 (MCP Monolith Refactor)
trigger_when: when relevant
scope: unknown
---

# SEED-001: the ability to actually copy your transcript from within callvault and open the tools you choose directly from the app/detail page making it possible for you to actually jump from callvault to claude, chatgpt, etc. with a specific transcript already loaded to talk to/about etc. Similar to the grain feature added a couple months back -- see loom inside callvault for more details.

## Why This Matters

_To be filled in. Run `/gsd:capture --seed --enrich SEED-001` to add context._

## When to Surface

**Trigger:** when relevant

This seed will surface during `/gsd:new-milestone` when the milestone scope matches.

## Scope Estimate

**Unknown** — run `/gsd:capture --seed --enrich SEED-001` to estimate effort.

## Breadcrumbs

- **Overlaps significantly with backlog item 999.1** — `.planning/phases/999.1-ai-ready-export-menu-and-transcript-metadata-enrichment/REFERENCE.md` (the Grain AI-export feature audit + 9-feature distillation captured 2026-05-27). When promoting this seed, consider whether to merge with 999.1 or treat as a sub-scope of it.
- Loom captured at: `https://www.loom.com/share/c7e53b7384d745f68c45e0e200e3a47c` (Grain's Jeff demoing the feature)
- Likely surface area on CallVault side:
  - `src/components/call-detail/` — per-call dropdown action menu in the detail header
  - `src/lib/recording-source-url.ts` — already has `resolveShareUrl()` for the source-link pattern
  - `supabase/functions/mcp-server/tools/read/` — `get_transcript`-style MCP tool already exists; the "Open in Claude" path can leverage MCP for context fetching
  - `src/stores/preferencesStore.ts` — sticky-default action preference would live here
- Active Phase 4 (MCP AI Write Tools) ships `ingest_transcript` — the schema/shape from that work should align with what the "Copy for AI" formatter produces here (single Markdown source of truth)

## Notes

_Captured via one-shot seed capture. Enrich with trigger, why, and scope at your convenience._

**Cross-reference at planning time:**
- 999.1 = backlog item (this feature, captured as a full audit on 2026-05-27)
- SEED-001 = forward-looking trigger-based capture (will auto-surface at next milestone)
- MCP-04 (Phase 4) = the write-tool side that should share the AI-ready transcript shape
