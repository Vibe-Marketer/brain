# Requirements: CallVault — v2.1 Import/Sync Rebuild

**Defined:** 2026-06-18
**Core Value:** Importing calls from any provider is a durable, observable, trustworthy resource — selection, progress, and partial-failure survive navigation, and "sync all" actually syncs all.

> v2.0 Autonomous Operations requirements shipped 2026-06-15 (see MILESTONES.md + PROJECT.md → Validated).

## v2.1 Requirements

Requirements for the Import/Sync Rebuild milestone. Each maps to exactly one roadmap phase. Provider-agnostic from day one (all connectors benefit; webhook-only providers opt out of sync-all by design).

### Sync-status foundation & idempotency (IMP)

- [x] **IMP-01**: A single canonical, provider-agnostic "is this call synced?" reader on `recordings.(source_app, source_call_id)` (TEXT, no numeric coercion) — replacing the Fathom-only `fathom_calls`/`parseInt` path so every provider reports synced status correctly
- [x] **IMP-02**: Org-scoped unique constraint `(organization_id, source_app, source_call_id)` so the same provider call can never be double-imported
- [x] **IMP-03**: Additive (`ADD COLUMN IF NOT EXISTS`) `sync_jobs` migration adding the columns a resumable sync-all needs (`source_app`, org/workspace, `mode`, date range, `provider_cursor`), plus org-scoped RLS, `CROSS_ORG_TABLES` registration, and Realtime publication whitelist
- [x] **IMP-04**: Reconciliation of legacy `fathom_calls` into `recordings` status truth, verified by a real-DB test (not mocked)

### Durable selection (SEL)

- [x] **SEL-01**: Selected calls persist across navigation, unmount, date-range change, and OAuth return — backed by a persistent client store (Zustand `persist`) keyed by provider + date range
- [x] **SEL-02**: User can select all calls matching the current filter (not just what's loaded on screen), as the client-side twin of server-side sync-all

### Unified import surface (TBL)

- [x] **TBL-01**: One shared `<ImportSurface>` built on the dense `TranscriptTable`, used in both the Import tab and the Sync tab (one paging model, one selection store, one progress UI)
- [x] **TBL-02**: A provider-agnostic "already imported" status overlay so all 7 connectors grey out already-synced rows correctly (moved out of per-adapter search)
- [x] **TBL-03**: Remove the forked `ConnectorImportWizard` (custom checkbox list + manual cursor paging) and the duplicate `useSyncTab*` hooks once both surfaces share the new component
- [x] **TBL-04**: A fast dense table — virtualized rows, larger page sizes, and background prefetch — eliminating the "Load 10 at a time" experience

### Browse vs. find/import separation (BROWSE)

- [x] **BROWSE-01**: Browsing already-synced calls (cheap, durable DB reads) is cleanly separated from finding/importing new calls (live provider API), presented as two stacked sections in one surface with already-synced de-emphasized inline

### Observable jobs (JOB)

- [x] **JOB-01**: A shared `sync_jobs`-backed progress hook (`useSyncJobs`) on every import surface, so job status is visible wherever import was triggered
- [x] **JOB-02**: Heartbeat + zombie-job reaper — jobs stuck "processing" are detected and recovered instead of vanishing silently (27-02: reaper fn + cron + heartbeat writes + real-DB test; 27-04: LIVE on PROD+TEST — sync-jobs-reaper cron active, reap fn present, reaper proven 5/5 on real TEST DB, sync-meetings heartbeat deployed)
- [x] **JOB-03**: Remove the unconditional 8-second auto-dismiss; job status (including failures) persists until the user resolves it
- [x] **JOB-04**: Live progress pushed to the UI via Supabase Realtime (`postgres_changes`) with the existing polling as fallback
- [x] **JOB-05**: A persistent per-provider status indicator — "Last synced X · N new available · M failed"

### Partial-success & retry (FAIL)

- [ ] **FAIL-01**: Partial-success surfaced where the import was triggered — "18 of 30 imported, 12 failed" — reading `completed_with_errors`/`failed_ids`, not a vanishing success toast
- [ ] **FAIL-02**: Retry only the failures (retry set = requested − synced), wired to the existing single-call retry path

### Server-side sync-all (SYNC)

- [ ] **SYNC-01**: A resumable, checkpoint/resume "Sync all from this provider" job — one provider page per invocation, persisting `provider_cursor` to `sync_jobs`, self-chaining with a `pg_cron` heartbeat (NOT one long background batch loop)
- [ ] **SYNC-02**: An optional `syncAll` entry in the provider adapter contract — implemented by every list-API provider (Fathom, Zoom, Fireflies, Grain, Read.ai, **Plaud** — Phase 28 spike confirmed Plaud ships a paginated, date-filtered list endpoint; the earlier "webhook-only/impossible" classification was a factual error); left undefined only for YouTube + file-upload (no list endpoint)
- [ ] **SYNC-03**: Sync-all is idempotent on `source_call_id` and safe to run concurrently with selective import (no duplicates)

## Future Requirements

Deferred to a later milestone. Tracked but not in this roadmap.

### Auto-sync & advanced selection

- **AUTO-01**: Scheduled auto-sync (periodic reconciliation poll) — deferred. Webhooks cover go-forward new calls; on-demand sync-all covers historical backfill and catch-up. Revisit ONLY if the rebuilt observable jobs surface real webhook-delivery gaps in production.
- **SEL-03**: Range-select (shift-click) — nice-to-have, defer.

## Out of Scope

Explicitly excluded for v2.1. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| External job-queue vendor (Inngest / Trigger.dev / QStash / BullMQ/Redis) | Breaks the customer-owned-infrastructure principle; adds a vendor, secret, and egress. Supabase-native (claim-table / pgmq + Realtime + Zustand + TanStack Query) covers 100% of the need. |
| Forced pgmq adoption | The in-repo claim-table pattern (`embedding_queue`) already does what the single pager needs. pgmq is an optional upgrade decided at the SYNC phase, not a requirement. |
| Realtime Broadcast (vs `postgres_changes`) | Scale-only optimization; per-user `postgres_changes` + polling fallback is correct at current scale. |
| Sync-all for YouTube + file-upload | No provider list endpoint exists to page; server-side sync-all is technically impossible for these. (Plaud was previously listed here in error — it DOES have a list endpoint and is now in SYNC-02 scope.) |
| Two separate import "apps" / screens | The named anti-feature. One surface with a browse/find split (stacked sections) is the correct model. |
| Scheduled auto-sync | See Future Requirements — webhooks + on-demand sync-all cover v2.1; revisit on evidence of webhook gaps. |

## Traceability

Which phases cover which requirements. Filled by the roadmapper. (Phase numbering continues from v2.0, which ended at Phase 23.)

| Requirement | Phase | Status |
|-------------|-------|--------|
| IMP-01 | Phase 24 | Complete |
| IMP-02 | Phase 24 | Complete |
| IMP-03 | Phase 24 | Complete |
| IMP-04 | Phase 24 | Complete |
| SEL-01 | Phase 25 | Complete (25-01 store + 25-02 synced-auto-drop reconciliation) |
| SEL-02 | Phase 25 | Complete (25-01 descriptor; 25-02 hook exposes count="all") |
| TBL-01 | Phase 26 | Complete |
| TBL-02 | Phase 26 | Complete |
| TBL-03 | Phase 26 | Complete |
| TBL-04 | Phase 26 | Complete |
| BROWSE-01 | Phase 26 | Complete |
| JOB-01 | Phase 27 | Complete (27-01) |
| JOB-02 | Phase 27 | Complete — LIVE in PROD+TEST (27-04 push) |
| JOB-03 | Phase 27 | Complete (27-01) |
| JOB-04 | Phase 27 | Complete (27-01) |
| JOB-05 | Phase 27 | Complete |
| SYNC-01 | Phase 28 | Pending |
| SYNC-02 | Phase 28 | Pending |
| SYNC-03 | Phase 28 | Pending |
| FAIL-01 | Phase 29 | Pending |
| FAIL-02 | Phase 29 | Pending |

**Coverage:**
- v2.1 requirements: 19 total
- Mapped to phases: 19 (Phases 24–29)
- Unmapped: 0 — 100% coverage, no orphans, no duplicates

---
*Requirements defined: 2026-06-18*
*Last updated: 2026-06-18 — traceability filled by roadmapper (Phases 24–29, 19/19 mapped)*
