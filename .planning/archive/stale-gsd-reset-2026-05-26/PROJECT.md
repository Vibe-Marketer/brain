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
- `.planning/isa/connector-unification.md` — active connector-unification ISA

## Current Focus

Planning the next milestone.

## Explicitly Not Active

These ideas existed in older docs/plans and are no longer active product direction:

- Google Meet as a first-party connector
- in-app chat/RAG/embedding pipeline
- prompt-kit chat UI
- ReactFlow visual agent builder
- Content Hub / 4-agent content wizard
- coach portal / coach relationship product surface
- old Solo/Business/coach-affiliate pricing drafts
- old feature registry/roadmap/audit docs as source of truth

Historical material lives under `docs/archive/` or `.planning/archive/` and should not drive new implementation.

## Requirements

### Validated

- ✓ Every current connector has a registered adapter in `src/components/connectors/registry/` — connector-unification
- ✓ Every recording-source connector can backfill historical recordings in bulk — connector-unification
- ✓ Every recording-source connector supports future ingestion through webhook or polling when the provider makes it possible — connector-unification
- ✓ Every connector maps provider payloads into the shared canonical recording shape before insertion — connector-unification
- ✓ Downstream UI, MCP tools, title/tag/summary actions, search, and exports remain source-agnostic — connector-unification

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

---
*Last updated: 2026-05-26 after connector-unification milestone*
