---
phase: 40
slug: fathom-reimport-overwrite
created: 2026-05-12
---

# Phase 40 — Validation Strategy (Nyquist)

Per `40-RESEARCH.md` §Validation Architecture. Each Dim must be covered by ≥1 test or manual verification.

| Dim | Probe | Verified By |
|-----|-------|-------------|
| 1. Inputs | `{recording_id: uuid}` body — UUID valid; recording owned by JWT user | `40-04-PLAN.md` test `validates recording UUID + ownership` |
| 2. Outputs | Updated row — title/transcript/summary/duration/synced_at changed | `40-04-PLAN.md` test `overwrites editable fields` |
| 3. Errors | 404 FATHOM_CALL_NOT_FOUND, 401 FATHOM_AUTH_EXPIRED, 429 retry, 500 generic | `40-04-PLAN.md` test `error matrix` + `40-01-PLAN.md` contract test |
| 4. Side effects | `fathom_raw_calls` re-upsert keyed on `(recording_id, user_id)` | `40-04-PLAN.md` test `re-upserts mirror` |
| 5. Invariants | UUID, org_id, owner_id, legacy_id, created_at, workspace_entries, folder_assignments, call_tag_assignments | `40-04-PLAN.md` test `preserves invariants` (the load-bearing test) |
| 6. Performance | p95 < 5s for one refresh on live Fathom | Manual dev-browser timing during operator deploy |
| 7. Concurrency | Two concurrent refreshes — last-write-wins (no deadlock) | Skipped for v1 (deferred to v2.3) |
| 8. Auth | Cross-org caller gets 404 not 200 | `40-04-PLAN.md` test `cross-org returns 404` |

## Phase pass condition

All 4 success criteria in ROADMAP.md Phase 40 PASS, and all rows in this table marked Verified By have green test or manual sign-off in `40-VERIFICATION.md`.
