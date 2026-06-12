# Phase 13 — Deferred Items (out-of-scope discoveries)

## rpc-type-smoke integration test fails against the test project (discovered during 13-01 gates, 2026-06-11)

- `.env.test` appeared mid-flight (mtime 2026-06-11 12:09:16, created by a parallel actor), flipping `integrationDbReachable` to true and un-skipping `src/test/rpc-type-smoke.test.ts`.
- The test project behind `VITE_SUPABASE_TEST_URL` does not have `20260524020000_rpc_type_smoke_helper.sql` applied — the test fails at bootstrap ("verify_rpc_type_signatures not in schema cache").
- Separately, the PROD deployment of `verify_rpc_type_signatures()` currently returns **28 offending rows** — almost all SECURITY DEFINER **trigger** functions never added to `rpc_type_smoke_skip_list` (e.g. `log_ticket_status_change` from 11-02, `autogen_org_slug`/`autogen_workspace_slug`, `ensure_home_workspace`, plus two genuine 42883s: `generate_automation_webhook_secret` missing `gen_random_bytes`, `global_search` signature drift). 13-01's `enforce_runner_state_kill_switch_only` is one of the 28 (same class: trigger callback, expected per convention to be skip-listed).
- **Needed:** (a) apply repo migrations to the test project, (b) one cleanup migration inserting all SECURITY DEFINER trigger callbacks into `rpc_type_smoke_skip_list`, (c) investigate the two 42883 rows — those are real runtime bugs.
- Not fixed in 13-01: pre-existing, spans many phases' functions, and the test-project schema is owned by whoever provisioned `.env.test`.
