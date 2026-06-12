---
phase: 05
slug: connector-reliability-per-workspace-binding-unified-sync-tab
status: partial
verified: 2026-06-12
verifier: Codex retroactive milestone audit follow-up
---

# Phase 05 — Verification

> Phase 05 has code/test/build and provider-matrix evidence, but is not fully live-provider verified. Provider OAuth refresh, webhook retry exhaustion, and all-source authenticated browser walkthrough remain credential/seed dependent.

## Success Criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Seven connectors have unhappy-path handling for refresh, errors, partial sync, and webhook failure semantics | partial | `05-VERIFICATION-MATRIX.md` records provider-by-provider source/test evidence and explicit credential/webhook blockers. |
| 2 | Unified per-workspace Connections surface exists | passed_code_verified | `05-05-SUMMARY.md` records `ConnectionsPanel scope="global"` mounted on Settings -> Integrations and covered by component tests. |
| 3 | Disconnect/reconnect polish is proven | human_needed | CON-03 remains traceability-pending; no live credential walkthrough was available in the phase artifacts. |
| 4 | Connector instances are workspace-bound | passed_code_verified | 05-01/05-03 summaries record workspace binding and bound-workspace sync/webhook routing; validation notes migration/RLS checks as required. |
| 5 | SyncTab lists canonical all-source synced transcripts | passed_code_verified | 05-04/05-05 summaries record canonical `recordings` migration and `sync-tab.service` tests. |
| 6 | Webhook retry exhaustion surfaces as connection error state | human_needed | Requires synthetic provider deliveries or controlled 5xx injection; documented as manual-only in `05-VALIDATION.md`. |

## Commands From Phase Evidence

| Command | Result |
|---|---|
| `npm test -- --run src/components/connectors/__tests__/ConnectionsPanel.test.tsx src/services/__tests__/sync-tab.service.test.ts && deno test --allow-env --allow-read supabase/functions/_shared/__tests__/connector-function-utils.test.ts && npm run build` | passed in 05-05: Vitest 8 tests, Deno 13 tests, build passed |
| `npm test -- --run src/components/settings/__tests__/IntegrationsTab.test.tsx src/components/connectors/__tests__/ConnectionsPanel.test.tsx src/services/__tests__/sync-tab.service.test.ts` | passed in 05-05: 11 tests |
| Browser attempt at `/settings?tab=integrations` | redirected to `/login`; screenshot captured; authenticated seeded browser verification blocked |

## Gaps

- CON-03/CON-04 traceability still needs reconciliation in `REQUIREMENTS.md`.
- Live provider OAuth refresh and reconnect tests need credentials.
- All-source SyncTab browser walkthrough needs seeded provider recordings.
- Webhook retry exhaustion needs a synthetic provider delivery or controlled 5xx test path.

## Sign-off

- [x] Phase-level evidence record now exists.
- [x] Code/test/build evidence exists.
- [ ] Live provider/browser verification complete.
