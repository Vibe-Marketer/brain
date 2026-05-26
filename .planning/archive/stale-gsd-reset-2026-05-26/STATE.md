---
gsd_state_version: 1.0
milestone: connector-unification
milestone_name: Source Connector Unification
status: Awaiting next milestone
last_updated: "2026-05-26T21:04:58.196Z"
last_activity: 2026-05-26 — Milestone connector-unification completed and archived
---

# Project State

## Current Position

Phase: Milestone connector-unification complete
Plan: —
Status: Awaiting next milestone
Last activity: 2026-05-26 — Milestone connector-unification completed and archived

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

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-05-26:

| Category | Item | Status |
|----------|------|--------|
| debug | account-switching-member-issues | investigating |
| debug | callvault-uuid-and-jwt-errors | awaiting_human_verify |
| debug | contacts-import-broken | awaiting_human_verify |
| debug | fathom-call-not-auto-added | fixed |
| debug | fathom-delete-not-clearing-dedup | awaiting_human_verify |
| debug | fathom-import-failed | awaiting_human_verify |
| debug | fathom-import-wrong-workspace | awaiting_human_verify |
| debug | fathom-sync-not-pulling | verified |
| debug | invite-link-broken | awaiting_human_verify |
| debug | knowledge-base | unknown |
| debug | mcp-oauth-consent-error | investigating |
| debug | org-switching-bugs | awaiting_human_verify |
| debug | share-link-no-feedback | investigating |
| debug | stale-cache-on-account-switch | awaiting_human_verify |
| debug | zoom-no-calls-after-connect | awaiting_human_verify |
| debug | zoom-recording-data-gaps | awaiting_human_verify |
| debug | zoom-webhook-not-auto-syncing | awaiting_human_verify |
| quick_task | 260404-0wz-redesign-account-settings-page-with-stan | missing |
| quick_task | 260416-u43-audit-polar-sh-billing-setup-identify-re | missing |
| quick_task | 260421-dw8-standardize-pane-headers-across-all-pane | missing |
| quick_task | 260421-ejo-add-standardized-pane-footers-across-all | missing |
| quick_task | 260421-hoi-standardize-icon-boxes-active-indicators | missing |
| quick_task | 260421-itf-standardize-icons-selection-switches | missing |
| quick_task | 260507-kgl-apply-phase-26-breakpoint-fixes-1-5-host | missing |

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
