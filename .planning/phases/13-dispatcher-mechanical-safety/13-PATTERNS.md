# Phase 13: Dispatcher + Mechanical Safety - Pattern Map

**Mapped:** 2026-06-11
**Files analyzed:** 13 (1 repo-side migration + 12 daemon-pack files outside repo)
**Analogs found:** 11 / 13

> Special note: most Phase 13 code lives OUTSIDE this repo at `~/dev/autopilot/`. The closest analogs are therefore (a) live repo migrations for the repo-side artifact, (b) dead-branch reference code accessed via `git show worktree-admin-center:<path>` (branch exists in this repo's git history), and (c) the spike harness at `/Users/admin/dev/autopilot-spike/` (DESIGN reference only — DO-NOT-PROMOTE contract; copy mechanics conceptually, re-implement, never copy spike code verbatim into production).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/<ts>_autopilot_queue_runner_state.sql` (repo) | migration | CRUD/DDL | `supabase/migrations/20260611000002_create_ticket_tables.sql` + `20260611140000_tighten_ticket_messages_author_type.sql` | exact (same tables, same RLS idioms) |
| `~/dev/autopilot/src/claimer.ts` | service (daemon entry) | event-driven poll | `worktree-admin-center:scripts/admin/autonomous-resolver.ts` main() | exact |
| `~/dev/autopilot/src/lib/claim.ts` | service | CRUD | resolver processTicket() step 1 + selection query in main() | exact |
| `~/dev/autopilot/src/runner.ts` | service | file-I/O + subprocess | resolver processTicket() steps 2-8 + spike dispatcher.sh run protocol | exact |
| `~/dev/autopilot/src/lib/agent.ts` | utility (security) | subprocess | resolver runAgent() + AGENT_BINARY_ALLOWLIST | exact — port verbatim |
| `~/dev/autopilot/src/lib/db.ts` | service (client) | CRUD | resolver writeEvent()/releaseClaim() + `scripts/verify-connectors-live.ts` (repo service-role client conventions) | role-match |
| `~/dev/autopilot/src/lib/evidence.ts` | service | CRUD | resolver step 8 evidence-pack event sequence | exact (rebind events→messages+events) |
| `~/dev/autopilot/src/watchdog.ts` | service (daemon) | event-driven | none (dead branch had none — dispatcher self-reported) | no analog — build from RESEARCH.md Pattern + tools-health.sh contract |
| `~/dev/autopilot/gate/push-gate.sh` | script (authority gate) | batch | spike dispatcher.sh evidence-capture section (L169-192) + resolver commit-advance (step 7) | role-match (logic verified, shape new) |
| `~/dev/autopilot/gate/push-gate-test.sh` | test | batch | none | no analog — fixture harness from scratch |
| `~/dev/autopilot/launchd/com.callvault.autopilot.plist` | config | — | `/Users/admin/dev/autopilot-spike/harness/com.callvault.autopilot-spike.plist` (proven live) + `worktree-admin-center:scripts/admin/com.callvault.admin-runner.plist` (documented template) | exact |
| `~/dev/autopilot/launchd/com.callvault.autopilot-watchdog.plist` | config | — | same plist analogs (second-agent pattern documented in dead-branch plist comments) | exact |
| `~/dev/autopilot/autopilot.config.ts` + `.env` | config | — | resolver DEFAULT_SETTINGS + dotenv loading (L33-35) | role-match |

## Pattern Assignments

### Repo migration (`supabase/migrations/<ts>_autopilot_queue_runner_state.sql`)

**Analog:** `supabase/migrations/20260611000002_create_ticket_tables.sql` (live, applied)

**Header comment convention** (lines 1-10): purpose block citing requirement IDs + phase/plan author + date.

**RLS idiom — admin gating via SECURITY DEFINER has_role** (lines from live migration):
```sql
CREATE POLICY "Admins can update tickets" ON public.tickets
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));
```
Apply for: admin-only UPDATE on `priority`/`urgent` (column-level enforcement needs either a dedicated policy + trigger check or a `WITH CHECK` that constrains non-priority columns — simplest live-consistent approach: keep the existing admin UPDATE policy (already admin-only for tickets) and note reporters have NO ticket UPDATE policy at all, so priority/urgent are automatically admin+service-role only. Verify, don't assume.)

**Policy-recreate idiom** (from `20260611140000`): `DROP POLICY IF EXISTS "..." ON public.x;` then `CREATE POLICY` with full new predicate + `COMMENT ON POLICY` explaining the hardening.

**Comment idiom:** every new table/column gets `COMMENT ON` (see live migration's COMMENTS section).

**New-table RLS skeleton for `runner_state`:** copy the live migration's ENABLE ROW LEVEL SECURITY + SELECT-policy shape; runner_state SELECT restricted to `public.has_role(auth.uid(), 'ADMIN')`; no authenticated INSERT/DELETE; admin UPDATE limited to kill_switch (per RESEARCH Open Question 2 recommendation); service-role bypasses RLS for daemon writes.

**Columns to add to `tickets`:** `priority integer NOT NULL DEFAULT 0`, `urgent boolean NOT NULL DEFAULT false`, `attempts integer NOT NULL DEFAULT 0`, `next_attempt_at timestamptz` (rebind map: dead branch had attempts/next_attempt_at on support_tickets — live tickets table lacks them).

### `src/claimer.ts` / `src/lib/claim.ts`

**Analog:** `worktree-admin-center:scripts/admin/autonomous-resolver.ts`

**Atomic claim** (resolver processTicket step 1 — port with rebinds `support_tickets`→`tickets`, `open`→`new`, `investigating`→`in_progress`):
```typescript
const { data: claimed, error } = await db
  .from("support_tickets")
  .update({ status: "investigating", attempts: ticket.attempts + 1 })
  .eq("id", ticket.id)
  .eq("status", "open")
  .select("id");
if (error || !claimed || claimed.length === 0) return "skipped"; // lost the race
```

**Backoff** (resolver `nextAttemptAt`):
```typescript
function nextAttemptAt(attempts: number): string {
  const minutes = 15 * Math.pow(4, attempts);
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}
```

**Selection query** (resolver main — rebind ordering to: urgent DESC, priority DESC, severity RANK (enum! see RESEARCH Pitfall 1), created_at ASC; add stale-sweep before selection):
```typescript
query = query
  .eq("status", "open")
  .lt("attempts", settings.max_attempts)
  .or(`next_attempt_at.is.null,next_attempt_at.lt.${new Date().toISOString()}`)
```

### `src/runner.ts`

**Analogs:** resolver steps 2-8 (worktree lifecycle, no-changes/NOTES.md check, verification, commit, evidence) + spike dispatcher.sh (spawn protocol, watchdog kill, verdict capture).

**Worktree lifecycle with finally-cleanup** (resolver):
```typescript
shSafe(`git worktree remove --force ${worktreePath}`, repoRoot); // clear leftovers
shSafe(`git branch -D ${branch}`, repoRoot);
sh(`git worktree add ${worktreePath} -b ${branch} main`, repoRoot);
worktreeCreated = true;
try { /* ... */ } finally {
  if (worktreeCreated) shSafe(`git worktree remove --force ${worktreePath}`, repoRoot);
}
```
Plus spike learning #3 — `git reset --hard && git clean -fd` on the clone BEFORE checkout/worktree-add.

**No-changes / NOTES.md protocol** (resolver step 5):
```typescript
const changedEntries = shSafe("git status --porcelain", worktreePath)
  .trim().split("\n").filter(Boolean)
  .filter((line) => !line.endsWith("NOTES.md"));   // NOTES.md alone = explanation, not fix
if (!diffStat && changedEntries.length === 0) { /* read NOTES.md, release/escalate with note */ }
```

**Commit-advance assertion** (resolver step 7 — gate also re-checks this):
```typescript
const baselineSha = sh("git rev-parse main", worktreePath).trim();
if (fixSha === baselineSha || revertSha !== baselineSha) { /* refuse to claim a fix exists */ }
```

**Spawn + watchdog kill** (spike dispatcher.sh L143-165, re-implement in TS): background `env -u CLAUDECODE claude -p "$PROMPT" --dangerously-skip-permissions`, transcript to `logs/runs/<id>-<epoch>.txt`, TERM at 2400s then KILL after 10s grace.

**Verdict capture** (spike L170-175): last `VERDICT: (FIXED|ESCALATE|DIVERT)` line from transcript, fallback substring grep, `NONE` if absent.

### `src/lib/agent.ts`

**Analog:** resolver `runAgent` — **port verbatim** (security-reviewed code):
```typescript
const AGENT_BINARY_ALLOWLIST = new Set(["claude", "codex", "gemini"]);
const AGENT_ARG_PATTERN = /^[-a-zA-Z0-9_=.@/]+$/;
// tokenize → allowlist binary → regex-validate every flag and the model string →
// execFile(binary, [...flags, brief], { cwd, timeout, maxBuffer }) — never a shell string
```

### `src/lib/db.ts` / `src/lib/evidence.ts`

**Analogs:** resolver `writeEvent`/`releaseClaim` + repo `scripts/verify-connectors-live.ts` (service-role client conventions: `dotenv/config` import, `SUPABASE_URL || VITE_SUPABASE_URL` fallback, `SUPABASE_SERVICE_ROLE_KEY`).

**Client init** (resolver main):
```typescript
const db = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
```

**Event write — REBIND REQUIRED:** resolver wrote `{ ticket_id, type, actor, payload }` to dead-branch schema. Live `ticket_events` columns are `(ticket_id, actor_id, event_type, old_value, new_value)` — no payload JSONB. Rich evidence goes to `ticket_messages` (author_type='agent', service-role only per 20260611140000); events carry lifecycle markers only. Status transitions are auto-logged by the live `ticket_status_audit` trigger — do NOT hand-write status_change events.

### `gate/push-gate.sh`

**Analogs:** spike evidence-capture (deterministic git interrogation judged by exit codes) + resolver commit-advance. No production analog exists — this is new authority-boundary code; keep it dependency-free bash (or bun script) with its own fixture tests. Core checks: kill-switch (DB via service-role curl/bun + flag file), denylist grep over `git diff --name-only base..HEAD`, commit-advance, v1 hold-everything (branch push + PR only; merge path only on approval event).

### launchd plists

**Analog (proven live):** `/Users/admin/dev/autopilot-spike/harness/com.callvault.autopilot-spike.plist`:
```xml
<key>ProgramArguments</key>
<array><string>/bin/bash</string><string>/Users/admin/dev/autopilot-spike/harness/dispatcher.sh</string></array>
<key>StartInterval</key><integer>4500</integer>
<key>EnvironmentVariables</key>
<dict><key>PATH</key><string>/Users/admin/.local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
<key>StandardOutPath</key><string>.../logs/launchd.out.log</string>
<key>StandardErrorPath</key><string>.../logs/launchd.err.log</string>
```
Explicit PATH including `~/.local/bin` (claude) and `/opt/homebrew/bin` (bun/git) is the load-bearing detail (RESEARCH Pitfall 3). Dead-branch plist documents the install/uninstall/log commands and the "one schedule per agent → second plist for second job" rule (watchdog gets its own plist).

## Shared Patterns

### Service-role client + env loading
**Source:** resolver L33-35 + `scripts/verify-connectors-live.ts` L1-20
**Apply to:** db.ts, watchdog.ts, push-gate kill-check
```typescript
import "dotenv/config";
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
```

### Subprocess discipline
**Source:** resolver `sh`/`shSafe` (execFileSync via `/bin/sh -c` for fixed strings; execFile argv for anything DB-sourced)
**Apply to:** runner.ts, agent.ts, push-gate. Rule: fixed-literal commands may use a shell; any string that originated in the DB or a ticket NEVER reaches a shell.

### Structured JSONL run log
**Source:** spike soak.jsonl schema (`ts_start, ts_end, claude_exit, verdict, changed_files, diff_stat, migrations_touched, test_cmd, test_exit, rate_limit_suspected, transcript`)
**Apply to:** runner.ts log writer — keep field names; add `ticket_id, branch, fix_sha, codex_review`.

### Guards-at-entry
**Source:** spike dispatcher.sh L54-77 (whoami check, workspace-exists check, lockdir concurrency)
**Apply to:** claimer.ts and watchdog.ts entry points (rebind: user `admin`, root `~/dev/autopilot`, clone present, config parseable).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/watchdog.ts` | daemon | event-driven | Dead branch had no independent watchdog (resolver self-reported via runner_runs); build from ISC-109 + `/Users/admin/dev/autopilot-tools-health.sh` contract (exits non-zero on any failure, one line per check) |
| `gate/push-gate-test.sh` | test | batch | No fixture harness exists for gates; new (pattern: synthetic git repos with planted diffs) |

## Metadata

**Analog search scope:** `supabase/migrations/`, `scripts/`, dead branch `worktree-admin-center` (scripts/admin/, supabase/migrations/), `/Users/admin/dev/autopilot-spike/harness/`
**Files scanned:** 9 read in full or targeted ranges
**Pattern extraction date:** 2026-06-11
