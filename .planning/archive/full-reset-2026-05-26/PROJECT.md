# CallVault (brain)

## What This Is

CallVault is a private, organization-scoped transcript infrastructure app. Users connect recording sources, import transcripts into a normalized `recordings` library, organize calls with workspaces/folders/tags/routing rules, share selected calls, and expose the corpus to external AI tools through MCP.

## Current Product Truth

Current app-visible connectors are defined in `src/components/connectors/registry/connectorRegistry.ts`:
- Fathom
- Zoom
- Fireflies
- Plaud
- YouTube
- File Upload

Current canonical product/docs sources:
- `README.md` — repo onboarding and current feature summary
- `CLAUDE.md` — AI-agent operating rules and hard constraints
- `.github/copilot-instructions.md` — concise coding-agent guide
- `docs/product-overview.md` — current product/positioning truth
- `docs/source-connector-spec.md` — connector contract truth
- `docs/source-connector-gap-analysis.md` — current connector contract gaps
- `docs/vendor-matrix.md` — vendor/source viability tracking
- `docs/integrations/` — integration SOP and platform notes

## Current Focus

Re-initializing planning scope to define the next active milestone.

## Explicitly Not Active

These ideas existed in older docs/plans and are no longer active product direction:
- Google Meet as a first-party connector (removed from v2 entirely)
- In-app chat/RAG/embedding pipeline
- Prompt-kit chat UI
- ReactFlow visual agent builder
- Content Hub / 4-agent content wizard
- Coach portal / coach relationship product surface
- Old Solo/Business/coach-affiliate pricing drafts
- Old feature registry/roadmap/audit docs as source of truth

Historical material lives under `docs/archive/` or `.planning/archive/` and should not drive new implementation.

## Requirements

### Validated

- ✓ **Unified Connector Registry:** Every current connector has a registered adapter in `src/components/connectors/registry/` — connector-unification
- ✓ **Unified Setup UI:** settings, onboarding (`/setup`), and import pages use the unified `<ConnectorSetupCluster>` UI and `useConnector` hook — connector-unification
- ✓ **Bulk Backfill:** Every recording-source connector can backfill historical recordings in bulk — connector-unification
- ✓ **Future Ingestion:** Every recording-source connector supports future ingestion through webhook or polling when the provider makes it possible — connector-unification
- ✓ **Payload Normalization:** Every connector maps provider payloads into the shared canonical recording shape before insertion — connector-unification
- ✓ **Source-Agnostic Core:** Downstream UI, MCP tools, title/tag/summary actions, search, and exports remain source-agnostic — connector-unification

### Ongoing Invariants

#### Security and data boundaries
- [ ] Organization boundaries remain hard tenant walls.
- [ ] Source credentials stay server-side or encrypted at rest; frontend never stores provider secrets.
- [ ] Webhook receivers fail closed on invalid signatures.
- [ ] RLS regression tests stay part of verification for auth/data-scope changes.

#### Active docs hygiene
- [ ] New work updates the canonical docs listed above, not archived feature registries.
- [ ] Completed research/plans are archived once implementation truth exists in code/docs.
- [ ] Generated debug artifacts stay untracked or are deleted after use.

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-26 after planning reset*
