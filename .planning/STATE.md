---
gsd_state_version: 1.0
milestone: connector-unification
milestone_name: Source Connector Unification
status: active
last_updated: "2026-05-25"
---

# Project State

## Current Position

CallVault is past the v2.0/v2.1/v2.2 milestone sequence. Those milestone artifacts are historical and should not be treated as active requirements.

The active workstream is source connector unification: make current and future recording-source integrations follow the same connector lifecycle and downstream contract.

## Active Tracking Surface

Keep these current:

- `.planning/PROJECT.md`
- `.planning/STATE.md`
- `.planning/ROADMAP.md`
- `.planning/isa/connector-unification.md`
- `.planning/connector-setup-cluster-prd.md`
- `docs/product-overview.md`
- `docs/source-connector-spec.md`
- `docs/source-connector-gap-analysis.md`
- `docs/vendor-matrix.md`
- `docs/integrations/`
- `README.md`
- `CLAUDE.md`
- `.github/copilot-instructions.md`

Everything under `docs/archive/`, `.planning/archive/`, `scripts/archive/`, and old milestone phase directories is historical context only.

## Current Code Truth

- App routes: `src/App.tsx`
- Connector registry: `src/components/connectors/registry/connectorRegistry.ts`
- Connector types: `src/components/connectors/registry/types.ts`
- Connector ingestion docs: `docs/source-connector-spec.md`
- Edge functions: `supabase/functions/`
- Database history: `supabase/migrations/` — migrations are historical ledger entries and should not be deleted just because an old feature was retired.

## Active Implementation Plans

- `.planning/connector-setup-cluster-prd.md` — PRD and staged implementation plan for the reusable connector setup cluster across Settings, Import, and Onboarding.

## Connector Template Status

- The canonical provider template is now the connector registry plus `ConnectorSetupCluster`, backed by shared edge-function pipeline helpers.
- Fathom, Zoom, Fireflies, and Plaud are the active hardening targets.
- Read.ai and Grain have been ported as Beta template connectors so future providers can be tested against the same setup contract before production launch.
- Rollback SQL lives under `supabase/revert/`; only forward migrations belong in `supabase/migrations/`.
- Current code must not require Composio schema fields until the Composio integration is intentionally introduced.

## Cleanup Done 2026-05-23

Moved stale active-surface docs out of the way:

- old feature registry/audit/roadmap docs
- old pricing drafts
- old chat/RAG/embedding docs
- old 3-pane/layout implementation docs
- old completed implementation plans
- stale troubleshooting directory
- stale script docs and RAG/chat/performance helper scripts
- stale tracked `tmp/` debug artifacts

Updated active docs to point at current product truth and connector truth.
