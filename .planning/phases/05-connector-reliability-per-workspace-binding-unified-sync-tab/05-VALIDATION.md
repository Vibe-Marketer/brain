---
phase: 05
slug: connector-reliability-per-workspace-binding-unified-sync-tab
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-31
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest / npm build / Deno tests for Edge Functions |
| **Config file** | `vitest.config.ts`, `vite.config.ts`, Supabase function-local Deno test files |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm run build && npm run test -- src/components/connectors src/services src/hooks/useExistingTranscripts` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run the task's targeted test command plus `npm run build` when frontend/types/schema-sensitive files changed.
- **After every plan wave:** Run `npm run build` and the relevant frontend/service/Deno test subset.
- **Before `$gsd-verify-work`:** Full suite and provider matrix must be green or explicitly documented as credential-blocked.
- **Max feedback latency:** 180 seconds for local build/test feedback.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | CON-04 | T-05-01 | Existing calls are not moved by binding backfill | migration/source | `npm run build` | ✅ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | CON-04 | T-05-02 | `import_sources.workspace_id` is user-visible only through authorized rows | migration/RLS | real-Supabase RLS or migration verification | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | CON-02, CON-03 | T-05-03 | Connections UI exposes only authorized connector rows for selected workspace | component/browser | `npm run test -- src/components/connectors` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 3 | CON-01, CON-03, CON-04 | T-05-04 | Sync/webhook imports land in bound workspace or default fallback | Deno/source contract | provider-specific Deno tests | ❌ W0 | ⬜ pending |
| 05-04-01 | 04 | 3 | HRD-01 | T-05-05 | SyncTab reads canonical recordings without leaking other workspaces | service/unit | `npm run test -- src/services src/hooks/useExistingTranscripts` | ❌ W0 | ⬜ pending |
| 05-05-01 | 05 | 4 | CON-01, CON-02, CON-03, CON-04, HRD-01 | T-05-06 | Provider matrix proves no silent stale syncs or hidden drops | mixed/manual | `npm run build` plus provider matrix evidence | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Add or extend tests for `deriveConnectorStatus()` to cover workspace binding, expired tokens, reconnect-required, and multiple rows.
- [ ] Add service tests for `fetchSyncedCalls()` canonical `recordings` mapping and workspace/date filters.
- [ ] Add migration verification for `import_sources.workspace_id` backfill and multi-account preservation.
- [ ] Add provider contract tests or source-level guards proving sync/webhook functions pass bound workspace IDs into `runPipeline()`.
- [ ] Add browser/screenshot verification target for Connections and SyncTab when UI work lands.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live provider OAuth refresh for all seven connectors | CON-01 | Requires live provider credentials or deliberately expired tokens | Use test/staging credentials where available; otherwise document source-level refresh proof and credential blocker |
| Provider webhook retry exhaustion | CON-01 | Requires synthetic provider deliveries or controlled 5xx injection | Inject connector-pipeline 5xx/failure in a non-production test path and verify final Connections error state |
| PLAUD bridge management copy/actions | CON-02, CON-03 | PLAUD behavior differs from normal OAuth | Open Connections Manage for PLAUD and verify bridge-specific action labels |
| All-source SyncTab walkthrough | HRD-01 | Requires seeded recordings from all sources | Seed or locate one recording per source and verify Import Meetings Synced Transcripts lists them |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 180s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
