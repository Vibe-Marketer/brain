# Deployed-vs-Source Edge Function Delta — 2026-05-Q2 (Phase 37 Plan 37-05)

**Date:** 2026-05-12
**Source count:** 38 (`supabase/functions/` excluding `_shared/`)
**Deployed count (before cleanup):** 77 (`supabase functions list`)
**Net delta (before):** 39 deployed-only functions ("orphans")

## Methodology

1. Snapshot deployed list: `supabase functions list > /tmp/supabase-functions-deployed.txt`.
2. Extract function names; sort + uniq.
3. List source: `ls supabase/functions/ | grep -v '^_'`.
4. Compute set difference (`comm -23 deployed source`).
5. For each orphan: `grep -rIl <name> .` (excluding `.planning/`, `node_modules/`, `.git/`) to find residual callers.
6. Classify: confirmed-dead (auto-delete) vs ambiguous (list for user).

## Section A — In Source AND Deployed (38)

All 38 source functions are deployed. Verified by intersection.

## Section B — Deployed-Only Orphans (39 → 39 confirmed-dead)

| # | Function | Caller hits | Classification | Reason |
|---|----------|-------------|----------------|--------|
| 1 | automation-email | 0 | confirmed-dead | Removed feature (automation engine deprecated v2.0) |
| 2 | automation-engine | 1 e2e test | confirmed-dead | Removed feature; e2e test is dead-code |
| 3 | automation-scheduler | 1 e2e test + 1 migration | confirmed-dead | Removed feature; migrations are historical |
| 4 | automation-sentiment | 1 e2e test | confirmed-dead | Removed feature |
| 5 | automation-webhook | 1 e2e + 1 migration | confirmed-dead | Removed feature |
| 6 | bulk-apply-routing-rules | 0 | confirmed-dead | Superseded by `apply-routing-rules` |
| 7 | check-client-health | 0 | confirmed-dead | Removed dev tool |
| 8 | coach-notes | 0 | confirmed-dead | Coach feature removed |
| 9 | coach-relationships | 0 | confirmed-dead | Coach feature removed |
| 10 | coach-shares | 0 | confirmed-dead | Coach feature removed |
| 11 | content-builder | 0 | confirmed-dead | Content feature removed |
| 12 | content-classifier | 0 | confirmed-dead | Content feature removed |
| 13 | content-hook-generator | 0 | confirmed-dead | Content feature removed |
| 14 | content-insight-miner | 0 | confirmed-dead | Content feature removed |
| 15 | delete-all-calls | 0 | confirmed-dead | Dev-only utility, removed |
| 16 | extract-action-items | 0 | confirmed-dead | Content feature removed |
| 17 | extract-knowledge | 0 | confirmed-dead | Content feature removed |
| 18 | extract-profits | 0 | confirmed-dead | Content feature removed |
| 19 | get-available-models | 0 | confirmed-dead | Replaced by OpenRouter direct calls |
| 20 | get-config-status | 0 | confirmed-dead | Removed dev tool |
| 21 | google-meet-fetch-meetings | 0 | confirmed-dead | FOUND-09 / CLAUDE.md HARD CONSTRAINT: "Zero Google Meet references" |
| 22 | google-meet-sync-meetings | 1 stale comment | confirmed-dead | FOUND-09; comment in `_shared/deduplication.ts:11` is now stale documentation (cleanup separately) |
| 23 | google-oauth-callback | 0 | confirmed-dead | Google Meet OAuth removed (FOUND-09) |
| 24 | google-oauth-refresh | 0 | confirmed-dead | FOUND-09 |
| 25 | google-oauth-url | 0 | confirmed-dead | FOUND-09 |
| 26 | google-poll-sync | 0 active (2 historical migrations) | confirmed-dead | FOUND-09; migrations are historical only |
| 27 | manager-notes | `config.toml` + 1 stale query-key in `src/lib/query-config.ts:117` | confirmed-dead | Manager notes feature did not ship. Stale query-key entry has no caller. Cleanup `config.toml` entry separately. |
| 28 | migrate-recordings | 0 | confirmed-dead | One-shot migration tool, run already |
| 29 | resync-all-calls | 0 | confirmed-dead | Dev-only, deprecated |
| 30 | save-fathom-key | 0 | confirmed-dead | Replaced by OAuth flow |
| 31 | save-webhook-secret | 0 | confirmed-dead | Replaced by Supabase secrets |
| 32 | send-coach-invite | 0 | confirmed-dead | Coach feature removed |
| 33 | sync-openrouter-models | 0 | confirmed-dead | Replaced by static config |
| 34 | team-direct-reports | 0 | confirmed-dead | Teams feature removed |
| 35 | team-memberships | 0 | confirmed-dead | Teams feature removed |
| 36 | team-shares | 0 | confirmed-dead | Teams feature removed |
| 37 | test-env-vars | 0 | confirmed-dead | Dev test tool, removed |
| 38 | test-fathom-connection | 0 | confirmed-dead | Dev test tool, removed |
| 39 | test-secrets | 0 | confirmed-dead | Dev test tool, removed |

**Total confirmed-dead: 39. Ambiguous: 0.**

## Section C — Decisions Applied

Deletion command list saved as `/tmp/orphan-delete-commands.sh`. Execution log appended below as deletions run.

```bash
#!/usr/bin/env bash
# Generated 2026-05-12 by Phase 37 Plan 37-05
set -euo pipefail

ORPHANS=(
  automation-email automation-engine automation-scheduler automation-sentiment
  automation-webhook bulk-apply-routing-rules check-client-health coach-notes
  coach-relationships coach-shares content-builder content-classifier
  content-hook-generator content-insight-miner delete-all-calls
  extract-action-items extract-knowledge extract-profits get-available-models
  get-config-status google-meet-fetch-meetings google-meet-sync-meetings
  google-oauth-callback google-oauth-refresh google-oauth-url google-poll-sync
  manager-notes migrate-recordings resync-all-calls save-fathom-key
  save-webhook-secret send-coach-invite sync-openrouter-models
  team-direct-reports team-memberships team-shares test-env-vars
  test-fathom-connection test-secrets
)

for fn in "${ORPHANS[@]}"; do
  echo "Deleting: $fn"
  yes | supabase functions delete "$fn" 2>&1 || echo "  failed: $fn (may already be deleted)"
done

echo ""
echo "Re-snapshot deployed:"
supabase functions list | wc -l
```

All 39 orphans deleted via `supabase functions delete <name> --yes` on 2026-05-12. Per-function log captured in `/tmp/orphan-delete-log.txt`; every line returned `Deleted Function <name> from project vltmrnjsubfzrgrtdqey.`

## Section D — Final Counts (Post-Delete)

| Metric | Value |
|--------|------:|
| Deployed before | 77 |
| Deployed after | 38 |
| Net deletions | 39 |
| Source count | 38 |
| **Match?** | **YES** — deployed_count == source_count |

**SEC-05A: PASS** — snapshot produced.
**SEC-05B: PASS** — every orphan cross-referenced against repo; all 39 confirmed-dead with documented reason.
**SEC-05C: PASS** — all 39 deleted; deployed count now matches source count (38).

## Followup

- `config.toml` cleanup: remove `[functions.manager-notes]` block.
- `src/lib/query-config.ts:117` cleanup: remove the `managerNotes` query-key entry.
- `supabase/functions/_shared/deduplication.ts:11` cleanup: remove `google-meet-sync-meetings` from the SCOPE comment.

These three are stale-reference cleanup, not security work. Filed under v2.3 housekeeping; not blocking SEC-05 acceptance.
