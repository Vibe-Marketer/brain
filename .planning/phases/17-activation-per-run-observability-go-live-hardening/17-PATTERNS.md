# Phase 17: Activation + Per-Run Observability + Go-Live Hardening - Pattern Map

**Mapped:** 2026-06-13
**Files analyzed:** 19 new/modified targets
**Analogs found:** 19 / 19

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `~/dev/autopilot/autopilot.config.ts` | config | batch | `~/dev/autopilot/autopilot.config.ts` | exact |
| `~/dev/autopilot/gate/push-gate.sh` | utility | batch | `~/dev/autopilot/gate/push-gate.sh` | exact |
| `~/dev/autopilot/gate/push-gate-test.sh` | test | batch | `~/dev/autopilot/gate/push-gate-test.sh` | exact |
| `~/dev/autopilot/gate/test-integrity-gate.*` | utility | batch | `~/dev/autopilot/gate/push-gate.sh` + `push-gate-test.sh` | role-match |
| `~/dev/autopilot/src/runner.ts` | service | batch | `~/dev/autopilot/src/runner.ts` | exact |
| `~/dev/autopilot/src/claimer.ts` | service | batch | `~/dev/autopilot/src/claimer.ts` | exact |
| `~/dev/autopilot/src/lib/approval.ts` | service | batch | `~/dev/autopilot/src/lib/approval.ts` | exact |
| `~/dev/autopilot/src/lib/claim.ts` | service | CRUD | `~/dev/autopilot/src/lib/claim.ts` | exact |
| `~/dev/autopilot/src/lib/evidence.ts` | utility | transform | `~/dev/autopilot/src/lib/evidence.ts` | exact |
| `~/dev/autopilot/src/watchdog.ts` | service | event-driven | `~/dev/autopilot/src/watchdog.ts` | exact |
| `~/dev/autopilot/launchd/com.callvault.autopilot.plist` | config | event-driven | `~/dev/autopilot/launchd/com.callvault.autopilot.plist` | exact |
| `supabase/migrations/20260613xxxxxx_create_or_extend_runner_runs.sql` | migration | CRUD | `supabase/migrations/20260611200000_autopilot_queue_runner_state.sql` | role-match |
| `src/types/supabase.ts` | generated type | transform | `src/types/supabase.ts` `runner_state` / `runner_runs` entries | exact |
| `src/services/admin-dashboard.service.ts` or `src/services/admin-runs.service.ts` | service | CRUD | `src/services/admin-dashboard.service.ts` | exact |
| `src/hooks/useAdminDashboard.ts` | hook | request-response | `src/hooks/useAdminDashboard.ts` | exact |
| `src/lib/query-config.ts` | config | request-response | `src/lib/query-config.ts` admin query keys | exact |
| `src/pages/admin/DashboardSection.tsx` | component | request-response | `src/pages/admin/DashboardSection.tsx` `RunnerOpsCard` | exact |
| `src/components/settings/TicketDetailDialog.tsx` | component | request-response | `src/components/settings/TicketDetailDialog.tsx` | exact |
| `src/components/admin/TicketEvidence.tsx` | component | transform | `src/components/admin/TicketEvidence.tsx` | exact |

## Pattern Assignments

### `~/dev/autopilot/autopilot.config.ts` (config, batch)

**Analog:** `~/dev/autopilot/autopilot.config.ts`

**Config object pattern** (lines 74-91):
```typescript
export const config: AutopilotConfig = {
  pollIntervalSec: 300,
  watchdogBudgetSec: 2400,
  maxAttempts: 4,
  staleClaimTtlSec: 2400 + 600,
  quietHours: { start: "01:00", end: "07:00" },
  maxRunsPerWindow: { windowHours: 24, maxRuns: 12 },
  concurrency: 1,
  paths: {
    cloneDir: `${ROOT}/clone`,
    worktreeBaseDir: `${ROOT}/worktrees`,
    logsDir: `${ROOT}/logs`,
    killSwitchFlagFile: `${ROOT}/KILL`,
    denylistFile: `${ROOT}/gate/denylist.txt`,
  },
  agentCommand: "claude -p",
  repoRemote: "https://github.com/Vibe-Marketer/brain.git",
};
```

**Apply:** Lower `maxRunsPerWindow.maxRuns` to the Phase 17 controlled-volume value (3-5/day) without changing `concurrency: 1`, quiet hours, paths, or secrets policy.

---

### `~/dev/autopilot/gate/push-gate.sh` (utility, batch)

**Analog:** `~/dev/autopilot/gate/push-gate.sh`

**Imports/setup pattern** (lines 17-27):
```bash
set -u

GATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTOPILOT_ROOT="$(dirname "$GATE_DIR")"
DENYLIST="${PUSH_GATE_DENYLIST:-$GATE_DIR/denylist.txt}"
ENV_FILE="$AUTOPILOT_ROOT/.env"
KILL_FLAG="${PUSH_GATE_KILL_FLAG:-$AUTOPILOT_ROOT/KILL}"

WORKTREE="${1:-}"
BASE_SHA="${2:-}"
```

**Gate ordering pattern** (lines 33-40, 73-91):
```bash
# ── Check 1: kill switch — FIRST, immediately pre-push, fail closed (ISC-108) ──

if [ -e "$KILL_FLAG" ]; then
  echo "GATE: KILL SWITCH — local flag file present at $KILL_FLAG → exit 2"
  exit 2
fi

# ── Check 2: commit-advance — HEAD exactly one commit past base (steal-list #2) ──

HEAD_SHA="$(git -C "$WORKTREE" rev-parse HEAD 2>/dev/null || true)"
PARENT_SHA="$(git -C "$WORKTREE" rev-parse HEAD~1 2>/dev/null || true)"
...
echo "GATE: commit-advance OK (HEAD $HEAD_SHA is base+1)"
```

**Denylist pattern** (lines 93-118):
```bash
PATTERNS="$(grep -v '^#' "$DENYLIST" | grep -v '^[[:space:]]*$' || true)"
...
CHANGED="$(git -C "$WORKTREE" diff --name-only "$BASE_SHA"..HEAD)"
echo "GATE: changed files:"
echo "$CHANGED" | sed 's/^/GATE:   /'
...
echo "GATE: IN-POLICY — branch may be pushed / approval-merge may proceed → exit 0"
exit 0
```

**Apply:** Add test-integrity as another deterministic stage in this same authority boundary, after commit-advance and before or alongside denylist. Preserve fail-closed exit `1`, kill-switch exit `2`, and never add model judgment or bypass flags for production.

---

### `~/dev/autopilot/gate/push-gate-test.sh` (test, batch)

**Analog:** `~/dev/autopilot/gate/push-gate-test.sh`

**Fixture harness pattern** (lines 10-16, 18-30):
```bash
GATE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/push-gate.sh"
TMP="$(mktemp -d /tmp/push-gate-fixtures.XXXXXX)"
KILL_FLAG="$TMP/KILL-fixture"
FAILURES=0

cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

REPO="$TMP/repo"
mkdir -p "$REPO"
git -C "$REPO" init -q -b main
git -C "$REPO" config user.email fixtures@autopilot.local
git -C "$REPO" config user.name "Gate Fixtures"
...
BASE="$(git -C "$REPO" rev-parse HEAD)"
```

**Assertion pattern** (lines 43-54):
```bash
assert_exit() { # label expected
  local label="$1" expected="$2"
  PUSH_GATE_SKIP_DB=1 PUSH_GATE_KILL_FLAG="$KILL_FLAG" bash "$GATE" "$REPO" "$BASE" > "$TMP/$label.log" 2>&1
  local actual=$?
  if [ "$actual" = "$expected" ]; then
    echo "PASS  $label (exit $actual)"
  else
    echo "FAIL  $label (expected exit $expected, got $actual)"
    sed 's/^/      /' "$TMP/$label.log" | tail -5
    FAILURES=$((FAILURES + 1))
  fi
}
```

**Apply:** Add fixtures for test-file deletion, test-case count decrease, `.skip` / `.only` / `xit` / `xdescribe`, and assertion-count decrease. Keep the offline DB skip test-only and use temp repo files, not the real brain checkout.

---

### `~/dev/autopilot/gate/test-integrity-gate.*` (utility, batch)

**Analogs:** `~/dev/autopilot/gate/push-gate.sh`, `~/dev/autopilot/gate/push-gate-test.sh`

**Changed-file input pattern** (push-gate lines 102-104):
```bash
CHANGED="$(git -C "$WORKTREE" diff --name-only "$BASE_SHA"..HEAD)"
echo "GATE: changed files:"
echo "$CHANGED" | sed 's/^/GATE:   /'
```

**Default-deny missing input pattern** (push-gate lines 28-31):
```bash
if [ -z "$WORKTREE" ] || [ -z "$BASE_SHA" ]; then
  echo "GATE: usage: push-gate.sh <worktree-or-clone-path> <base-sha>"
  exit 1
fi
```

**Apply:** If implemented as a helper, accept `<worktree> <base-sha>`, print `GATE: OUT-OF-POLICY — ...`, exit `1` on any weakening or ambiguity, and be invoked by `push-gate.sh`. Do not read denylist or env from the worktree under review.

---

### `~/dev/autopilot/src/runner.ts` (service, batch)

**Analog:** `~/dev/autopilot/src/runner.ts`

**Imports / service boundaries** (lines 17-31):
```typescript
import { existsSync, readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { config } from "../autopilot.config";
import {
  createServiceClient,
  writeEvent,
  writeAgentMessage,
  updateRunnerState,
  type DbLike,
  type QueryResult,
} from "./lib/db";
import { releaseClaim } from "./lib/claim";
import { runAgent } from "./lib/agent";
import { composeBrief, VERDICT_PATTERN, type BriefTicket, type BriefMessage } from "./lib/brief";
import { assembleBundle, buildJsonlLine, detectRateLimit, type ReproReplay } from "./lib/evidence";
```

**Subprocess discipline** (lines 32-53):
```typescript
function sh(argv: string[], cwd: string): ShResult {
  const proc = Bun.spawnSync(argv, { cwd, stdout: "pipe", stderr: "pipe" });
  const out = `${proc.stdout?.toString() ?? ""}${proc.stderr?.toString() ?? ""}`;
  return { code: proc.exitCode ?? 1, out };
}

function must(argv: string[], cwd: string, label: string): string {
  const r = sh(argv, cwd);
  if (r.code !== 0) throw new Error(`${label} failed (exit ${r.code}): ${r.out.slice(0, 2000)}`);
  return r.out;
}
```

**Run lifecycle + cleanup pattern** (lines 194-205, 207-215, 354-357):
```typescript
shSafe(["git", "worktree", "remove", "--force", worktreePath], clone);
shSafe(["git", "branch", "-D", branch], clone);
must(["git", "reset", "--hard"], clone, "clone reset");
must(["git", "clean", "-fd"], clone, "clone clean");
shSafe(["git", "worktree", "prune"], clone);
must(["git", "fetch", "origin", "main"], clone, "fetch origin main");

must(["git", "worktree", "add", worktreePath, "-b", branch, "origin/main"], clone, "worktree add");
...
await updateRunnerState(db, {
  status: "running",
  current_ticket_id: ticketId,
  run_started_at: tsStart,
  last_heartbeat: tsStart,
});
...
} finally {
  if (worktreeCreated) shSafe(["git", "worktree", "remove", "--force", worktreePath], clone);
  await updateRunnerState(db, { status: "idle", current_ticket_id: null, last_heartbeat: new Date().toISOString() });
}
```

**Evidence + JSONL pattern** (lines 231-253, 338-352):
```typescript
const logJsonl = (fields: Record<string, unknown>) => {
  appendFileSync(
    `${config.paths.logsDir}/autopilot.jsonl`,
    buildJsonlLine({
      ts_start: tsStart,
      ts_end: new Date().toISOString(),
      claude_exit: agentResult.exitCode,
      verdict,
      changed_files: changedEntries.length,
      diff_stat: "",
      migrations_touched: false,
      test_cmd: "",
      test_exit: null,
      rate_limit_suspected: detectRateLimit(transcript),
      transcript: transcriptPath,
      ticket_id: ticketId,
      branch,
      fix_sha: null,
      codex_review: null,
      ...fields,
    }) + "\n"
  );
};
...
const bundle = assembleBundle({ diffStat, testTail, codexVerdict, branch, fixSha, revertSha: baseSha, reproReplay, resolutionNote });
await writeAgentMessage(db, ticketId, bundle);
await writeEvent(db, ticketId, "fix_prepared", null, branch);
await db.from("tickets").update({ status: "awaiting_approval" }).eq("id", ticketId).select("id");
await updateRunnerState(db, { status: "awaiting_gate", last_result: `fix_prepared ${branch} ${fixSha}` });
logJsonl({ diff_stat: diffStat, migrations_touched: migrationsTouched, test_cmd: "vitest+build", test_exit: 0, fix_sha: fixSha, codex_review: codexVerdict });
```

**Apply:** Emit DB-backed run ledger rows at start/end using the same mechanical data already logged to JSONL. Add duration, gate verdict/stage, replay outcome, and cost display fields without replacing the existing evidence bundle.

---

### `~/dev/autopilot/src/claimer.ts` (service, batch)

**Analog:** `~/dev/autopilot/src/claimer.ts`

**Cycle ordering pattern** (lines 8-19):
```typescript
 *   1. Heartbeat FIRST  — the watchdog sees life even when later steps fail.
 *   2. Kill switch (DB flag column OR local flag file) → halt claiming, exit 0.
 *   3. sweepStaleClaims() — re-queue orphaned in_progress work.
 *   4. Approval-merge pass — runs BEFORE new claims (approved work ships
 *      promptly and is EXEMPT from quiet hours / budget).
 *   5. Budget guards — quiet hours OR run-count-in-window >= cap → no new claim.
 *   6. selectNextTicket → claimTicket → processTicket(); if the new head of
 *      queue is urgent, loop once more in the same invocation
 *   7. Runner state → idle with the cycle's last_result.
```

**Kill switch fail-closed pattern** (lines 96-108):
```typescript
async function killSwitchEngaged(db: DbLike): Promise<{ engaged: boolean; source: string }> {
  if (existsSync(config.paths.killSwitchFlagFile)) {
    return { engaged: true, source: `flag file ${config.paths.killSwitchFlagFile}` };
  }
  const res = (await db.from("runner_state").select("kill_switch").eq("id", 1).limit(1)) as QueryResult;
  if (res.error) {
    return { engaged: true, source: `DB unreachable (fail closed): ${res.error.message}` };
  }
  const row = res.data?.[0] as { kill_switch?: boolean } | undefined;
  if (!row) return { engaged: true, source: "runner_state row missing (fail closed)" };
  return { engaged: row.kill_switch === true, source: "runner_state.kill_switch" };
}
```

**Budget guard pattern** (lines 242-255):
```typescript
if (inQuietHours(config.quietHours.start, config.quietHours.end)) {
  const msg = `quiet hours ${config.quietHours.start}-${config.quietHours.end} — no new claims`;
  await updateRunnerState(db, { status: "idle", last_result: msg });
  return { result: "suppressed:quiet-hours", claims: 0, merges };
}
const runs = runsThisWindow();
if (runs >= config.maxRunsPerWindow.maxRuns) {
  const msg = `budget cap: ${runs}/${config.maxRunsPerWindow.maxRuns} runs in ${config.maxRunsPerWindow.windowHours}h window`;
  await updateRunnerState(db, { status: "idle", last_result: msg });
  return { result: "suppressed:budget", claims: 0, merges };
}
```

**Apply:** Keep approval merges before new claims; Phase 17 must not introduce autonomous merge. If rebase conflict retry state is tracked in tickets/context, mirror existing claim/backoff behavior and keep `concurrency: 1`.

---

### `~/dev/autopilot/src/lib/approval.ts` (service, batch)

**Analog:** `~/dev/autopilot/src/lib/approval.ts`

**Admin-authored approval guard** (lines 72-104):
```typescript
export async function qualifyEvents(
  events: RawApprovalEvent[],
  isAdmin: RoleLookup
): Promise<QualifiedApproval[]> {
  const candidates = events.filter(
    (e) =>
      e.actor_id !== null &&
      e.actor_id !== undefined &&
      (APPROVAL_EVENT_TYPES as readonly string[]).includes(e.event_type)
  );
  ...
  if (!(await isAdmin(actorId))) continue;
  out.push({
    ticketId: e.ticket_id,
    actorId,
    kind: e.event_type === "rejection" ? "rejection" : "approval",
    branch: branchForTicket(e.ticket_id),
  });
}
```

**Rebase-before-gate pattern** (lines 306-344):
```typescript
export async function runApprovalMerge(
  branch: string,
  r: MergeRunners
): Promise<MergeMechResult> {
  const currentMain = r.git(["rev-parse", "origin/main"]).out.trim();
  const branchParent = r.git(["rev-parse", `${branch}~1`]).out.trim();

  let rebased = false;
  if (currentMain !== branchParent) {
    const reb = r.git(["rebase", "origin/main", branch]);
    if (reb.code !== 0) {
      r.git(["rebase", "--abort"]);
      return { kind: "rebase-conflict", out: reb.out };
    }
    rebased = true;
  }

  const gateBase = r.git(["rev-parse", "origin/main"]).out.trim();
  const gate = r.gate(gateBase);
  if (gate.code !== 0) {
    return { kind: "gate-blocked", code: gate.code, out: gate.out };
  }

  r.git(["checkout", "main"]);
  r.git(["reset", "--hard", "origin/main"]);
  const ff = r.git(["merge", "--ff-only", branch]);
  if (ff.code !== 0) {
    return { kind: "ff-failed", out: ff.out };
  }
  const mergedSha = r.git(["rev-parse", "HEAD"]).out.trim();
  return { kind: "merged", mergedSha, rebased };
}
```

**Current conflict behavior to replace** (lines 407-410):
```typescript
case "rebase-conflict":
  await writeAgentMessage(db, appr.ticketId, `Approval-merge escalated — main moved and the fix could not be rebased cleanly:\n${tail(mech.out, 20)}`);
  await pageAdmin(db, "Autopilot rebase conflict", `Ticket ${appr.ticketId} (${branch}) needs manual merge.`);
  return { merged: false, outcome: "rebase-conflict" };
```

**Apply:** Keep the rebase-before-gate ordering. Change first conflict response to abort/destroy/requeue/release fresh attempt, cap retries at planner-chosen 2 or 3, and page only after cap. Add replay-after-rebase before gate/merge.

---

### `~/dev/autopilot/src/lib/claim.ts` (service, CRUD)

**Analog:** `~/dev/autopilot/src/lib/claim.ts`

**Atomic claim pattern** (lines 96-113):
```typescript
export async function claimTicket(
  db: DbLike,
  ticket: TicketCandidate
): Promise<TicketCandidate | null> {
  const { data, error } = await db
    .from("tickets")
    .update({ status: "in_progress", attempts: ticket.attempts + 1 })
    .eq("id", ticket.id)
    .eq("status", "new") // ← the atomicity guard
    .select("id");
  if (error || !data || data.length === 0) return null; // lost the race
  return { ...ticket, status: "in_progress", attempts: ticket.attempts + 1 };
}
```

**Retryable release pattern** (lines 128-145):
```typescript
export async function releaseClaim(
  db: DbLike,
  ticketId: string,
  attempts: number,
  reason: string,
  nowMs: number = Date.now()
): Promise<void> {
  await writeEvent(db, ticketId, "claim_released", null, reason);
  const { error } = await db
    .from("tickets")
    .update({ status: "new", next_attempt_at: nextAttemptAt(attempts, nowMs) })
    .eq("id", ticketId)
    .eq("status", "in_progress")
    .select("id");
  if (error) {
    console.error(`[autopilot] release failed for ${ticketId}: ${error.message}`);
  }
}
```

**Stale sweep pattern** (lines 156-173):
```typescript
export async function sweepStaleClaims(
  db: DbLike,
  cfg: AutopilotConfig,
  nowMs: number = Date.now()
): Promise<number> {
  const cutoff = new Date(nowMs - cfg.staleClaimTtlSec * 1000).toISOString();
  const { data, error } = await db
    .from("tickets")
    .update({ status: "new" })
    .eq("status", "in_progress")
    .lt("updated_at", cutoff)
    .select("id");
  if (error) {
    console.error(`[autopilot] stale sweep failed: ${error.message}`);
    return 0;
  }
  return data?.length ?? 0;
}
```

**Apply:** Rebase-conflict requeue should mirror this retryable defer shape, but note approval-held tickets are likely `awaiting_approval`, not `in_progress`; planner must choose the correct guarded status transition rather than reusing `.eq("status", "in_progress")` blindly.

---

### `~/dev/autopilot/src/lib/evidence.ts` (utility, transform)

**Analog:** `~/dev/autopilot/src/lib/evidence.ts`

**Evidence bundle shape** (lines 37-80):
```typescript
export function assembleBundle(input: EvidenceBundleInput): string {
  const repro =
    input.reproReplay === null
      ? "no repro artifact on ticket — replay not applicable (ISC-110)"
      : `artifact: \`${input.reproReplay.artifact}\`\nresult: ${input.reproReplay.result}`;

  return `# Autopilot fix evidence

Branch: \`${input.branch}\` — held for approval (v1 ships nothing autonomously)
Fix SHA: \`${input.fixSha}\`

## Diff
...
## Tests
...
## Repro replay

${repro}
...
`;
}
```

**Structured JSONL type** (lines 85-105):
```typescript
export interface JsonlRunLine {
  ts_start: string;
  ts_end: string;
  claude_exit: number;
  verdict: string;
  changed_files: number;
  diff_stat: string;
  migrations_touched: boolean;
  test_cmd: string;
  test_exit: number | null;
  rate_limit_suspected: boolean;
  transcript: string;
  ticket_id: string;
  branch: string;
  fix_sha: string | null;
  codex_review: string | null;
}

export function buildJsonlLine(fields: JsonlRunLine): string {
  return JSON.stringify(fields);
}
```

**Apply:** Extend the structured run record and evidence sections in lockstep with `TicketEvidence` tests. Preserve markdown text, no HTML, no new renderer dependency.

---

### `~/dev/autopilot/src/watchdog.ts` (service, event-driven)

**Analog:** `~/dev/autopilot/src/watchdog.ts`

**Injectable tested core** (lines 24-45):
```typescript
export interface WatchdogDeps {
  readHeartbeat(): Promise<string | null>;
  page(message: string): Promise<void>;
  nowMs(): number;
  readLastPageMs(): number | null;
  writeLastPageMs(ms: number): void;
}

export type WatchdogResult = "ok" | "paged" | "suppressed";

export async function checkHeartbeat(
  deps: WatchdogDeps,
  thresholdSec: number,
  cooldownSec: number
): Promise<WatchdogResult> {
```

**Fail-loud page pattern** (lines 47-69):
```typescript
try {
  const heartbeat = await deps.readHeartbeat();
  if (heartbeat === null) {
    message = "Autopilot dispatcher has NO heartbeat ...";
  } else {
    const ageSec = Math.floor((deps.nowMs() - Date.parse(heartbeat)) / 1000);
    if (ageSec > thresholdSec) {
      message = `Autopilot dispatcher heartbeat is stale: ${ageSec}s old ...`;
    }
  }
} catch (err) {
  message = `watchdog cannot reach DB — heartbeat unknown, treating as down: ${err instanceof Error ? err.message : String(err)}`;
}
...
await deps.page(message);
deps.writeLastPageMs(deps.nowMs());
return "paged";
```

**Notification sink pattern** (lines 88-103):
```typescript
async function deliverPage(db: DbLike, message: string): Promise<void> {
  const { error } = await db.from("user_notifications").insert({
    user_id: ADMIN_USER_ID,
    type: "health_alert",
    title: "Autopilot watchdog",
    body: message,
    metadata: { source: "autopilot-watchdog", paged_at: new Date().toISOString() },
  });
  if (error) console.error(`[watchdog] user_notifications insert failed: ${error.message}`);
  const proc = Bun.spawnSync(
    ["osascript", "-e", `display notification ${JSON.stringify(message.slice(0, 200))} with title "Autopilot watchdog"`],
    {}
  );
  if ((proc.exitCode ?? 1) !== 0) console.error("[watchdog] osascript notification failed");
}
```

**Apply:** Add disk guard and aged-worktree reaper as injectable functions with tests. Page through the same `user_notifications` + `osascript` sink. Keep watchdog independent from dispatcher; do not make dispatcher monitor itself.

---

### `~/dev/autopilot/launchd/com.callvault.autopilot.plist` (config, event-driven)

**Analog:** `~/dev/autopilot/launchd/com.callvault.autopilot.plist`

**Launchd schedule + PATH pattern** (lines 21-39):
```xml
<key>ProgramArguments</key>
<array>
  <string>/Users/admin/.bun/bin/bun</string>
  <string>/Users/admin/dev/autopilot/src/claimer.ts</string>
</array>
<key>StartInterval</key>
<integer>300</integer>
<key>RunAtLoad</key>
<true/>
<key>WorkingDirectory</key>
<string>/Users/admin/dev/autopilot</string>
<key>EnvironmentVariables</key>
<dict>
  <key>PATH</key>
  <string>/Users/admin/.local/bin:/Users/admin/.bun/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
</dict>
```

**Apply:** If caffeinate is implemented at launchd level, wrap without breaking explicit PATH, working directory, log paths, or one-cycle claimer behavior. If implemented inside TS/shell, leave plist shape intact except comments/install docs.

---

### `supabase/migrations/20260613xxxxxx_create_or_extend_runner_runs.sql` (migration, CRUD)

**Analog:** `supabase/migrations/20260611200000_autopilot_queue_runner_state.sql`

**Table + singleton comments pattern** (lines 60-80):
```sql
-- Single-row dispatcher visibility table ...
CREATE TABLE public.runner_state (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  status text NOT NULL DEFAULT 'idle'
    CHECK (status IN ('idle', 'claiming', 'running', 'awaiting_gate')),
  current_ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  run_started_at timestamptz,
  last_heartbeat timestamptz,
  last_result text,
  kill_switch boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.runner_state (id) VALUES (1) ON CONFLICT DO NOTHING;
```

**RLS pattern** (lines 85-104):
```sql
ALTER TABLE public.runner_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view runner state" ON public.runner_state
  FOR SELECT
  USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Admins can update runner state" ON public.runner_state
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));
```

**Trigger guard pattern** (lines 114-135):
```sql
CREATE OR REPLACE FUNCTION public.enforce_runner_state_kill_switch_only()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.status IS DISTINCT FROM OLD.status
       ...
    THEN
      RAISE EXCEPTION 'runner_state: authenticated callers may only change kill_switch';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
```

**Apply:** First verify whether `runner_runs` exists live/local. If adding/extending it, use admin-only SELECT RLS and service-role writes. Do not expose runner internals to reporters. Add indexes for `started_at desc` and `ticket_id` if run lists/detail read by AdminTab.

---

### `src/types/supabase.ts` (generated type, transform)

**Analog:** `src/types/supabase.ts`

**Current generated `runner_runs` type warning** (lines 2845-2870):
```typescript
runner_runs: {
  Row: {
    detail: Json | null
    finished_at: string | null
    id: string
    outcome: string | null
    started_at: string
    tickets_processed: number
  }
  Insert: {
    detail?: Json | null
    finished_at?: string | null
    id?: string
    outcome?: string | null
    started_at?: string
    tickets_processed?: number
  }
  Update: {
    detail?: Json | null
    finished_at?: string | null
    id?: string
    outcome?: string | null
    started_at?: string
    tickets_processed?: number
  }
  Relationships: []
}
```

**Current `runner_state` type** (lines 2872-2911):
```typescript
runner_state: {
  Row: {
    current_ticket_id: string | null
    id: number
    kill_switch: boolean
    last_heartbeat: string | null
    last_result: string | null
    run_started_at: string | null
    status: string
    updated_at: string
  }
  ...
  Relationships: [
    {
      foreignKeyName: "runner_state_current_ticket_id_fkey"
      columns: ["current_ticket_id"]
      isOneToOne: false
      referencedRelation: "tickets"
      referencedColumns: ["id"]
    },
  ]
}
```

**Apply:** Regenerate after migration/schema verification. Do not hand-edit except through generated-type workflow if the project requires generated types.

---

### `src/services/admin-dashboard.service.ts` or `src/services/admin-runs.service.ts` (service, CRUD)

**Analog:** `src/services/admin-dashboard.service.ts`

**Import + type pattern** (lines 14-19, 97-107):
```typescript
import { supabase } from "@/integrations/supabase/client";
import type {
  TicketRow,
  TicketStatus,
} from "@/services/tickets.service";

export type RunnerStatus = "idle" | "claiming" | "running" | "awaiting_gate";

export interface RunnerState {
  status: RunnerStatus;
  current_ticket_id: string | null;
  run_started_at: string | null;
  last_heartbeat: string | null;
  last_result: string | null;
  kill_switch: boolean;
}
```

**Graceful read pattern** (lines 130-149):
```typescript
export async function getRunnerState(): Promise<RunnerState | null> {
  try {
    const { data, error } = await supabase
      .from("runner_state")
      .select(
        "status, current_ticket_id, run_started_at, last_heartbeat, last_result, kill_switch"
      )
      .eq("id", 1)
      .maybeSingle();

    if (error || !data) return null;
    return data as RunnerState;
  } catch {
    return null;
  }
}
```

**Mutation error pattern** (lines 157-164):
```typescript
export async function setKillSwitch(value: boolean): Promise<void> {
  const { error } = await supabase
    .from("runner_state")
    .update({ kill_switch: value })
    .eq("id", 1);
  if (error) {
    throw new Error(`Failed to update kill switch: ${error.message}`);
  }
}
```

**Apply:** Add `getRunnerRuns()` / `getRunnerRunDetail(ticketId)` as pure async service functions. Keep components free of direct Supabase calls. Return null/empty arrays gracefully only for order-tolerant deployment gaps; throw labeled errors for real failed mutations.

---

### `src/hooks/useAdminDashboard.ts` (hook, request-response)

**Analog:** `src/hooks/useAdminDashboard.ts`

**Polling hook pattern** (lines 30-38):
```typescript
/** Live runner_state read for the /admin runner card (14-02). */
export function useRunnerState() {
  return useQuery({
    queryKey: queryKeys.admin.runner(),
    queryFn: getRunnerState,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
```

**Mutation invalidation + toast pattern** (lines 45-70):
```typescript
export function useSetKillSwitch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (value: boolean) => setKillSwitch(value),
    onSuccess: (_data, value) => {
      if (value) {
        toast.warning("Autopilot paused", {
          description: "The runner stops claiming tickets within one poll cycle (~5 min). Anything mid-fix finishes.",
        });
      } else {
        toast.success("Autopilot armed", {
          description: "The runner claims its first ticket on the next check (~5 min). Each fix still waits for your approval.",
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.runner() });
    },
  });
}
```

**Apply:** Add run list/detail hooks using `queryKeys.admin.runnerRuns(...)`; poll active/recent runs at the same 30s cadence as runner state. Invalidate run list when kill-switch or approval actions change visible state.

---

### `src/lib/query-config.ts` (config, request-response)

**Analog:** `src/lib/query-config.ts`

**Query-key factory pattern** (lines 1-6, 202-207):
```typescript
/**
 * Centralized Query Keys for TanStack Query
 * Using factory pattern for type-safe, consistent query keys
 */

export const queryKeys = {
  ...
  admin: {
    dashboard: () => ['admin', 'dashboard'] as const,
    needsYou: () => ['admin', 'needs-you'] as const,
    runner: () => ['admin', 'runner'] as const,
  },
```

**Apply:** Add stable keys such as `runnerRuns: () => ['admin','runner','runs'] as const` and `runnerRunDetail: (ticketId: string) => ['admin','runner','runs',ticketId] as const`. Keep factory keys centralized.

---

### `src/pages/admin/DashboardSection.tsx` (component, request-response)

**Analog:** `src/pages/admin/DashboardSection.tsx` `RunnerOpsCard`

**Imports / allowed icons pattern** (lines 1-40):
```typescript
import React from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  useAdminDashboard,
  useNeedsYou,
  useRunnerState,
  useSetKillSwitch,
} from "@/hooks/useAdminDashboard";
...
import {
  RiCheckboxCircleLine,
  RiAlarmWarningLine,
  RiEyeLine,
  RiRobot2Line,
  RiTimeLine,
  RiPlayCircleFill,
  RiPauseCircleFill,
} from "@remixicon/react";
```

**Embedded card pattern** (lines 178-227):
```typescript
function RunnerOpsCard() {
  const { data: runner, isLoading } = useRunnerState();
  const { isAdmin } = useUserRole();
  const killSwitchMutation = useSetKillSwitch();
  const openTicket = useAdminDetailStore((s) => s.openTicket);
  const navigate = useNavigate();
  const [confirmTarget, setConfirmTarget] = React.useState<boolean | null>(null);

  const armed = runner ? !runner.kill_switch : false;
  const offline = runner ? isRunnerOffline(runner.last_heartbeat) : false;
  const mode: "on" | "paused" | "offline" = !armed
    ? "paused"
    : offline
      ? "offline"
      : "on";

  ...
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>
          <SectionHeading>Autopilot</SectionHeading>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
```

**Current ticket navigation pattern** (lines 290-317):
```typescript
<div className="space-y-2 px-1">
  <div className="flex items-center justify-between text-sm">
    <span className="text-muted-foreground">Current ticket</span>
    {runner.current_ticket_id ? (
      <button
        type="button"
        onClick={() => {
          openTicket(runner.current_ticket_id!);
          navigate("/admin/tickets");
        }}
        className="font-mono text-xs font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange rounded-sm"
      >
        {runner.current_ticket_id.slice(0, 8)}
      </button>
    ) : (
      <span className="text-xs font-medium text-muted-foreground">none</span>
    )}
  </div>
```

**Apply:** Hang compact run list/timeline off `RunnerOpsCard`; do not add a top-level tab. At-a-glance fields: status, gate verdict/stage, duration, cost display, pass/fail. Drill-down should route to existing ticket detail/evidence, not a parallel modal.

---

### `src/components/settings/TicketDetailDialog.tsx` (component, request-response)

**Analog:** `src/components/settings/TicketDetailDialog.tsx`

**Admin evidence mount pattern** (lines 216-223, 407-412):
```typescript
const hasAgentEvidence = (detail?.messages ?? []).some(
  (message) => message.author_type === "agent",
);
const isAwaitingApproval = ticket?.status === "awaiting_approval";
const showApprovalBar = isAdmin && isAwaitingApproval;

...
{hasAgentEvidence && (
  <TicketEvidence messages={detail.messages} events={detail.events} />
)}
```

**Approval bar pattern** (lines 356-389):
```typescript
{showApprovalBar && (
  <div className="rounded-lg border border-border bg-muted/30 p-3">
    {approvalRecorded ? (
      <p className="flex items-center gap-2 text-xs text-foreground">
        <RiCheckLine className="h-4 w-4 text-vibe-orange" aria-hidden="true" />
        Approval recorded — dispatcher merges on next poll (≤5 min). Status updates
        when the merge lands.
      </p>
    ) : (
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="default" size="sm" onClick={() => setApproveOpen(true)} disabled={approveTicket.isPending}>
          <RiCheckLine className="mr-1 h-4 w-4" aria-hidden="true" />
          APPROVE FIX
        </Button>
        ...
      </div>
    )}
  </div>
)}
```

**Apply:** Fold per-ticket run detail into this existing evidence area. Preserve admin-only controls, reporter-safe read-only rendering, and no fake optimistic resolve.

---

### `src/components/admin/TicketEvidence.tsx` (component, transform)

**Analog:** `src/components/admin/TicketEvidence.tsx`

**Security/rendering contract** (lines 19-27):
```typescript
 * SECURITY (T-14-12): every string renders as a React text node or inside a
 * <pre>. No dangerouslySetInnerHTML, no markdown-to-HTML library, no new deps —
 * hostile ticket/repo content in the bundle can never become live DOM.
 */
import { useState } from "react";
import { RiArrowGoBackLine, RiFileCopyLine } from "@remixicon/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { TicketEvent, TicketMessage } from "@/services/tickets.service";
```

**Known sections pattern** (lines 38-49):
```typescript
const EVIDENCE_HEADER = "# Autopilot fix evidence";

const KNOWN_SECTIONS = [
  "Diff",
  "Tests",
  "Repro replay",
  "Codex review",
  "Revert",
  "Deploy",
] as const;
```

**Tolerant parser pattern** (lines 156-185):
```typescript
function parseBundle(body: string): ParsedBundle {
  const lines = body.split("\n");
  const sections: ParsedSection[] = [];
  const preambleLines: string[] = [];
  let current: ParsedSection | null = null;

  for (const line of lines) {
    const headerMatch = /^##\s+(.+?)\s*$/.exec(line);
    if (headerMatch) {
      if (current) sections.push(current);
      current = { heading: headerMatch[1], body: "" };
    } else if (current) {
      current.body += (current.body ? "\n" : "") + line;
    } else {
      preambleLines.push(line);
    }
  }
  if (current) sections.push(current);

  return {
    preamble: preambleLines.join("\n").trim(),
    sections: sections.map((s) => ({ heading: s.heading, body: s.body.trim() })),
  };
}
```

**Safe expander + fallback pattern** (lines 202-221, 293-305):
```typescript
function EvidenceExpander({ summary, content, defaultOpen = false }: { summary: string; content: string; defaultOpen?: boolean; }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer select-none text-xs text-muted-foreground">
        {summary}
      </summary>
      <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap">
        {tail(stripAnsi(content))}
      </pre>
    </details>
  );
}

if (!isBundle) {
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <EvidenceExpander summary="View agent message" content={body} />
    </div>
  );
}
```

**Apply:** Add `Gate`, `Rebase`, `Replay`, `Duration`, or run-ledger fields as text/`pre` renderers only. Update tests in lockstep with `assembleBundle` headers. No markdown-to-HTML, no new deps.

## Shared Patterns

### Service + Hook Separation
**Source:** `src/services/admin-dashboard.service.ts`, `src/hooks/useAdminDashboard.ts`
**Apply to:** AdminTab run reads and mutations
```typescript
export async function getRunnerState(): Promise<RunnerState | null> {
  const { data, error } = await supabase.from("runner_state").select(...).eq("id", 1).maybeSingle();
  if (error || !data) return null;
  return data as RunnerState;
}

export function useRunnerState() {
  return useQuery({
    queryKey: queryKeys.admin.runner(),
    queryFn: getRunnerState,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
```

### Deterministic Authority Boundary
**Source:** `~/dev/autopilot/gate/push-gate.sh`
**Apply to:** ACT-05, ACT-06 approval merge checks
```bash
# Order remains mechanical and non-LLM:
# kill switch → commit-advance → test-integrity → denylist → exit 0
# Fail closed with exit 1 for policy/verification failures; exit 2 only for kill switch.
```

### Argv-Array Shelling
**Source:** `~/dev/autopilot/src/runner.ts`, `~/dev/autopilot/src/lib/approval.ts`
**Apply to:** All daemon subprocess work
```typescript
const proc = Bun.spawnSync(argv, { cwd, stdout: "pipe", stderr: "pipe" });
```
Never pass ticket text, DB text, or evidence output through a shell string.

### Retryable Defer
**Source:** `~/dev/autopilot/src/lib/claim.ts`
**Apply to:** Rebase conflict requeue and verification failures
```typescript
await writeEvent(db, ticketId, "claim_released", null, reason);
await db
  .from("tickets")
  .update({ status: "new", next_attempt_at: nextAttemptAt(attempts, nowMs) })
  .eq("id", ticketId)
  .eq("status", "in_progress")
  .select("id");
```
For approval conflicts, adjust the guarded status from `in_progress` if the held fix is `awaiting_approval`.

### Safe Evidence Rendering
**Source:** `src/components/admin/TicketEvidence.tsx`
**Apply to:** All per-run drill-down output
```typescript
<pre className="mt-1 max-h-64 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap">
  {tail(stripAnsi(content))}
</pre>
```
No `dangerouslySetInnerHTML`, no markdown renderer, no new dependencies.

### Admin-Only Runner Visibility
**Source:** `supabase/migrations/20260611200000_autopilot_queue_runner_state.sql`
**Apply to:** `runner_runs` migration/RLS
```sql
ALTER TABLE public.runner_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view runner state" ON public.runner_state
  FOR SELECT
  USING (public.has_role(auth.uid(), 'ADMIN'));
```
Run-ledger rows should be admin-readable and service-role writable; reporters should see no runner internals.

### Test Patterns
**Source:** service/component/Bun/shell tests
**Apply to:** New Phase 17 coverage
```typescript
// Frontend service Supabase mock:
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn() } }));

// Autopilot pure injectable runner:
const res = await runApprovalMerge("fix/ticket-abc12345", makeRunners(w));

// Watchdog injectable deps:
const result = await checkHeartbeat(deps, THRESHOLD_SEC, COOLDOWN_SEC);
```
```bash
PUSH_GATE_SKIP_DB=1 PUSH_GATE_KILL_FLAG="$KILL_FLAG" bash "$GATE" "$REPO" "$BASE" > "$TMP/$label.log" 2>&1
```

## No Analog Found

No target is completely without an analog. The weakest match is optional `~/dev/autopilot/gate/test-integrity-gate.*`: use `push-gate.sh` for gate semantics and `push-gate-test.sh` for fixture style.

## Warnings for Planner

- `src/types/supabase.ts` includes `runner_runs`, but `rg "runner_runs" supabase/migrations` found no migration. Treat schema verification or migration creation as Wave 0 before AdminTab UI.
- Phase 17 activation means autonomous claim/fix on real tickets only. Every merge still requires AdminTab approval.
- Do not raise volume toward 25-30/day; keep Phase 17 cap in the 3-5/day band.
- Do not create a new AdminTab top-level tab; extend `RunnerOpsCard` and `TicketDetailDialog` / `TicketEvidence`.
- Do not add packages, secrets, chart libraries, Lucide, `framer-motion`, or frontend AI.

## Metadata

**Analog search scope:** `/Users/admin/dev/brain/src`, `/Users/admin/dev/brain/supabase/migrations`, `/Users/admin/dev/autopilot`
**Files scanned:** 458 brain admin/schema files by `rg --files`; 17 autopilot `.ts` / `.sh` / `.plist` files by `find`; targeted analog reads listed above
**Pattern extraction date:** 2026-06-13
