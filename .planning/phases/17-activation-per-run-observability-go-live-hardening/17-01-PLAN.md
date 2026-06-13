---
phase: 17-activation-per-run-observability-go-live-hardening
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260613090000_create_or_extend_runner_runs.sql
  - src/types/supabase.ts
  - ~/dev/autopilot/src/runner.ts
  - ~/dev/autopilot/src/lib/evidence.ts
  - ~/dev/autopilot/src/lib/evidence.test.ts
  - ~/dev/autopilot/src/lib/db.ts
autonomous: false
requirements: [ACT-01, ACT-04]
user_setup:
  - "SUPABASE_ACCESS_TOKEN must be set before the blocking schema push; if the CLI prompts interactively and cannot be suppressed, stop for manual intervention."
must_haves:
  truths:
    - "A real `public.runner_runs` table exists in the live schema; generated `src/types/supabase.ts` is not accepted as proof by itself."
    - "Every daemon run writes a DB-backed run ledger row with ticket id, status/outcome, gate verdict/stage, test result, diff stat, duration, cost display, branch, fix SHA, and detail JSON."
    - "Run ledger reads are admin-only through RLS; daemon writes use service-role only."
  artifacts:
    - path: "supabase/migrations/20260613090000_create_or_extend_runner_runs.sql"
      provides: "runner_runs table/RLS/indexes for per-run observability"
    - path: "src/types/supabase.ts"
      provides: "Regenerated Supabase types after live schema push"
    - path: "~/dev/autopilot/src/lib/evidence.ts"
      provides: "Structured run ledger fields shared by JSONL and DB writes"
    - path: "~/dev/autopilot/src/runner.ts"
      provides: "Run start/update/finalize ledger emission"
  key_links:
    - from: "~/dev/autopilot/src/runner.ts"
      to: "public.runner_runs"
      via: "service-role insert/update for each autonomous run"
      pattern: "runner_runs"
    - from: "supabase/migrations/20260613090000_create_or_extend_runner_runs.sql"
      to: "src/types/supabase.ts"
      via: "supabase db push then type generation"
      pattern: "runner_runs"
---

<objective>
Create the real per-run ledger backing ACT-04 and wire the daemon to emit to it.

Purpose: Phase 17 cannot claim per-run observability from generated types alone. This plan closes the false-positive trap by creating or extending `runner_runs`, pushing it to Supabase, regenerating types, then having the daemon persist every run.
Output: migration, live schema push evidence, regenerated types, daemon ledger emission, tests.
</objective>

## Artifacts This Phase Produces

- A live `runner_runs` table with admin-only RLS and service-role writes.
- A daemon run-ledger writer that mirrors JSONL/evidence fields into Supabase.
- Generated Supabase types that match the pushed live schema.

<execution_context>
@$HOME/.codex/gsd-core/workflows/execute-plan.md
@$HOME/.codex/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/17-activation-per-run-observability-go-live-hardening/17-CONTEXT.md
@.planning/phases/17-activation-per-run-observability-go-live-hardening/17-RESEARCH.md
@.planning/phases/17-activation-per-run-observability-go-live-hardening/17-PATTERNS.md
@.planning/phases/17-activation-per-run-observability-go-live-hardening/17-VALIDATION.md
@CLAUDE.md
@src/CLAUDE.md
@supabase/CLAUDE.md
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create the runner_runs migration and local schema proof</name>
  <files>[brain] supabase/migrations/20260613090000_create_or_extend_runner_runs.sql, src/types/supabase.ts</files>
  <read_first>supabase/migrations/20260611200000_autopilot_queue_runner_state.sql, src/types/supabase.ts, supabase/CLAUDE.md, .planning/phases/17-activation-per-run-observability-go-live-hardening/17-RESEARCH.md</read_first>
  <behavior>
    - Migration creates or extends `public.runner_runs` with fields needed by ACT-04: ticket_id, status, outcome, started_at, finished_at, duration_sec, est_cost, gate_verdict, gate_stage, test_cmd, test_exit, diff_stat, branch, fix_sha, detail.
    - RLS allows ADMIN select and no authenticated reporter access; writes are service-role/server-side only.
    - Indexes support AdminTab list by started_at desc and per-ticket detail by ticket_id.
  </behavior>
  <action>Write an additive Supabase migration for `runner_runs`. If a local/remote table already exists with the older generated shape, use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` and preserve existing columns rather than dropping data. Add foreign key to `tickets(id)` with `ON DELETE SET NULL`, admin-only SELECT policy using `public.has_role(auth.uid(), 'ADMIN')`, indexes on `started_at desc` and `ticket_id`, and comments documenting that `est_cost` is a display/budget field, not per-token billing. Do not add npm packages, queue engines, or new Edge Functions. Do not hand-edit generated types beyond the normal Supabase type-generation output.</action>
  <verify>
    <automated>supabase db diff --local --schema public >/tmp/phase17-runner-runs-local.diff && rg -n "runner_runs|gate_verdict|duration_sec|est_cost" supabase/migrations src/types/supabase.ts</automated>
  </verify>
  <acceptance_criteria>
    - Migration file contains `runner_runs`, admin SELECT RLS, service-role-compatible writes, and the ACT-04 fields.
    - Local diff or schema inspection shows the migration is syntactically recognized by Supabase CLI.
    - No unrelated schema files are modified.
  </acceptance_criteria>
  <done>`runner_runs` has a durable migration path and local schema proof.</done>
</task>

<task type="checkpoint:human-action">
  <name>Task 2: [BLOCKING] Push schema, regenerate types, and confirm live runner_runs</name>
  <files>[brain] supabase/migrations/20260613090000_create_or_extend_runner_runs.sql, src/types/supabase.ts</files>
  <read_first>supabase/CLAUDE.md, .env.example, .env.test.example, .planning/phases/17-activation-per-run-observability-go-live-hardening/17-RESEARCH.md</read_first>
  <action>Run the required Supabase schema push after Task 1 migration files are written and before any verification claims: ensure `SUPABASE_ACCESS_TOKEN` is set, run `supabase db push`, then regenerate types into `src/types/supabase.ts` using the repo's established Supabase type-generation command. If `supabase db push` asks for an interactive prompt that cannot be suppressed in this runtime, stop and record the exact prompt in the summary; the phase cannot pass verification until the push completes. After generation, query the live linked schema for `public.runner_runs` columns; do not accept `src/types/supabase.ts` as proof.</action>
  <verify>
    <automated>test -n "$SUPABASE_ACCESS_TOKEN" && supabase db push && supabase gen types typescript --linked --schema public > src/types/supabase.ts && supabase db query "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'runner_runs' order by ordinal_position;" | rg "gate_verdict|duration_sec|est_cost|ticket_id"</automated>
  </verify>
  <acceptance_criteria>
    - `supabase db push` exits 0 in this session or the task is explicitly blocked with the non-TTY prompt captured.
    - `src/types/supabase.ts` is regenerated after the push.
    - Live schema query proves `public.runner_runs` exists with ACT-04 columns.
  </acceptance_criteria>
  <done>Live schema and generated types agree; the false-positive generated-type trap is closed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Emit run ledger rows from the daemon</name>
  <files>[autopilot] ~/dev/autopilot/src/runner.ts, ~/dev/autopilot/src/lib/evidence.ts, ~/dev/autopilot/src/lib/evidence.test.ts, ~/dev/autopilot/src/lib/db.ts</files>
  <read_first>~/dev/autopilot/src/runner.ts, ~/dev/autopilot/src/lib/evidence.ts, ~/dev/autopilot/src/lib/db.ts, ~/dev/autopilot/src/lib/evidence.test.ts, .planning/phases/17-activation-per-run-observability-go-live-hardening/17-PATTERNS.md</read_first>
  <behavior>
    - A run inserts a `runner_runs` row when it starts and updates the same row on gate failure, requeue/escalation, awaiting approval, merge, or failure.
    - Duration is derived from start/end timestamps; cost is the existing display/budget-use field and must not imply per-token billing.
    - DB ledger write failures are recorded in logs and runner_state but do not cause the daemon to merge or bypass gates.
  </behavior>
  <action>Add typed helpers in the daemon DB layer to insert/update `runner_runs`. Extend `JsonlRunLine`/evidence fields in lockstep so JSONL and DB rows share status, gate, replay, diff, test, duration, branch, fix SHA, and detail JSON. Wire runner start/finally/outcome paths so every claimed ticket produces a ledger row. Preserve the existing evidence bundle and ticket_messages writes; this plan adds observability, it does not replace the approval path. Per D-01, keep every successful fix at `awaiting_approval`; do not add autonomous merge. Per D-02, do not change concurrency or raise volume.</action>
  <verify>
    <automated>cd ~/dev/autopilot && bun test src/lib/evidence.test.ts && bun run typecheck</automated>
  </verify>
  <acceptance_criteria>
    - Tests cover run-line/ledger serialization for pass, gate-failed, requeued, and failed outcomes.
    - `runner.ts` updates `runner_runs` on all exit paths.
    - No daemon code raises `concurrency` or `maxRunsPerWindow.maxRuns`.
  </acceptance_criteria>
  <done>Daemon emits durable per-run ledger rows for AdminTab to read.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| daemon service-role -> Supabase | privileged daemon writes run internals into `runner_runs` |
| admin browser -> Supabase | admin reads operational details that reporters must not see |
| generated types -> verification | local types can be stale or ahead of migrations |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-17-01 | Information Disclosure | `runner_runs` RLS | mitigate | ADMIN-only SELECT policy; no reporter/public policy; service-role writes only |
| T-17-02 | Tampering | generated types without live table | mitigate | Blocking `supabase db push` plus live information_schema query before verification |
| T-17-03 | Repudiation | missing run record | mitigate | Insert at run start and update all terminal paths; JSONL remains secondary evidence |
| T-17-04 | Denial of Service | ledger write failure blocks cleanup | mitigate | Log ledger write failure and continue cleanup; never bypass gate/approval |
| T-17-SC | Tampering | package installs | mitigate | Zero new npm packages; no queue engine or SDK added |
</threat_model>

<verification>
- `supabase db push` exits 0 and live schema query proves `public.runner_runs`.
- `src/types/supabase.ts` regenerated after push.
- `cd ~/dev/autopilot && bun test src/lib/evidence.test.ts && bun run typecheck` exits 0.
</verification>

<success_criteria>
ACT-04 has a real database substrate and daemon emission path; generated types alone are no longer used as behavioral proof.
</success_criteria>

<output>
Create `.planning/phases/17-activation-per-run-observability-go-live-hardening/17-01-SUMMARY.md` when done.
</output>
