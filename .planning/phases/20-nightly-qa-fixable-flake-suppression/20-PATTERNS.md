# Phase 20: Nightly QA -> Fixable Tickets + Flake Suppression - Pattern Map

**Mapped:** 2026-06-13
**Files analyzed:** 12
**Analogs found:** 12 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/20260613xxxx_create_qa_findings_and_ingest_qa_ticket.sql` | migration/RPC/model | request-response + CRUD + audit | `supabase/migrations/20260612130000_sentry_ticket_ingestion.sql` | exact |
| `supabase/migrations/20260613xxxx_create_qa_findings_and_ingest_qa_ticket.sql` (`qa_findings`) | migration/model | CRUD + event ledger | `supabase/migrations/20260612150000_create_qa_runs.sql` | role-match |
| `supabase/functions/sentry-webhook/__tests__/qa-ticket-ingestion.integration.test.ts` or `src/test/qa-ticket-ingestion.integration.test.ts` | test | real-DB RPC integration | `supabase/functions/sentry-webhook/__tests__/sentry-webhook.integration.test.ts` | exact |
| `/Users/admin/dev/autopilot/qa/triage.ts` | service/utility | batch + transform + request-response | `/Users/admin/dev/autopilot/qa/triage.ts` current direct insert path | exact |
| `/Users/admin/dev/autopilot/qa/triage.test.ts` | test | unit + static assertions | `/Users/admin/dev/autopilot/qa/triage.test.ts` | exact |
| `/Users/admin/dev/autopilot/qa/nightly-crawl.sh` | script/config | batch + file I/O + subprocess | `/Users/admin/dev/autopilot/qa/nightly-crawl.sh` | exact |
| `/Users/admin/dev/autopilot/src/qa-poller.ts` | service/daemon | queue claim + subprocess + file I/O | `/Users/admin/dev/autopilot/src/qa-poller.ts` | exact |
| `/Users/admin/dev/autopilot/src/lib/claim.ts` | service/queue utility | CRUD + request-response | `/Users/admin/dev/autopilot/src/lib/claim.ts` | exact |
| `/Users/admin/dev/autopilot/src/claimer.ts` | controller/daemon | batch + budget gate + queue claim | `/Users/admin/dev/autopilot/src/claimer.ts` | exact |
| `/Users/admin/dev/autopilot/autopilot.config.ts` | config | config | `/Users/admin/dev/autopilot/autopilot.config.ts` | exact |
| `src/services/qa.service.ts` | service | CRUD read | `src/services/qa.service.ts` | exact |
| `src/hooks/useQaRuns.ts`, `src/pages/admin/QaSection.tsx` | hook/component | request-response UI read | `src/hooks/useQaRuns.ts`, `src/pages/admin/QaSection.tsx` | exact |

## Pattern Assignments

### `supabase/migrations/20260613xxxx_create_qa_findings_and_ingest_qa_ticket.sql` (migration/RPC, request-response + CRUD)

**Analog:** `supabase/migrations/20260612130000_sentry_ticket_ingestion.sql`

**RPC ownership and safety pattern** (lines 45-57):
```sql
-- SECURITY DEFINER + SET search_path = public follows the
-- log_ticket_status_change hardening idiom (20260611000002). Execution is
-- revoked from anon/authenticated below — service-role only.
CREATE OR REPLACE FUNCTION public.ingest_sentry_ticket(
  p_fingerprint TEXT,
  p_severity public.ticket_severity,
  p_context JSONB,
  p_notify_title TEXT,
  p_notify_body TEXT
)
RETURNS TABLE (ticket_id UUID, occurrence_count INTEGER, created BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
```

**Atomic dedup pattern** (lines 63-81):
```sql
INSERT INTO public.tickets (
  reporter_id, type, severity, status, source,
  fingerprint, context, occurrence_count, last_seen_at
)
VALUES (
  NULL, 'bug', p_severity, 'new', 'sentry',
  p_fingerprint, p_context, 1, NOW()
)
ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL
DO UPDATE SET
  occurrence_count = tickets.occurrence_count + 1,
  last_seen_at = NOW()
RETURNING tickets.id, tickets.occurrence_count
INTO v_ticket_id, v_occurrence_count;

v_created := (v_occurrence_count = 1);
```

**Audit event pattern** (lines 83-110):
```sql
IF v_created THEN
  INSERT INTO public.ticket_events (ticket_id, actor_id, event_type, new_value)
  VALUES (v_ticket_id, NULL, 'created', 'new');
ELSE
  INSERT INTO public.ticket_events (ticket_id, actor_id, event_type, new_value)
  VALUES (v_ticket_id, NULL, 'occurrence', v_occurrence_count::text);
END IF;
```

**Privileges pattern** (lines 120-126):
```sql
REVOKE ALL ON FUNCTION public.ingest_sentry_ticket(TEXT, public.ticket_severity, JSONB, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_sentry_ticket(TEXT, public.ticket_severity, JSONB, TEXT, TEXT)
  TO service_role;
```

**Apply to QA:** create `ingest_qa_ticket` as service-role-only, stamp `source='nightly_qa'` inside SQL, never accept source from caller, write `ticket_messages` evidence on create, write `ticket_events` for created/occurrence/promoted. Keep dedup DB-owned via `ON CONFLICT`; do not SELECT-then-INSERT in `triage.ts`.

### `qa_findings` ledger in same migration (migration/model, CRUD + event ledger)

**Analog:** `supabase/migrations/20260612150000_create_qa_runs.sql`

**Append-only/admin-visible ledger pattern** (lines 1-8, 14-25):
```sql
-- QA crawler run ledger. The nightly crawler (autopilot qa/) writes one summary
-- row per crawl via the service-role client; the Admin Center QA section reads
-- them (admin-only SELECT).
CREATE TABLE IF NOT EXISTS public.qa_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    status text NOT NULL DEFAULT 'completed'
        CHECK (status IN ('running', 'completed', 'failed')),
    routes_crawled integer NOT NULL DEFAULT 0,
    findings_count integer NOT NULL DEFAULT 0,
    critical_count integer NOT NULL DEFAULT 0,
    report jsonb NOT NULL DEFAULT '{}'::jsonb,
    triggered_by text NOT NULL DEFAULT 'nightly',
    created_at timestamptz NOT NULL DEFAULT now()
);
```

**RLS/read pattern** (lines 28-37):
```sql
ALTER TABLE public.qa_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read qa runs"
    ON public.qa_runs FOR SELECT
    USING (public.has_role(auth.uid(), 'ADMIN'));

-- No INSERT/UPDATE/DELETE policies on purpose: the crawler writes with the
-- service-role key (RLS-exempt). No client-reachable path may forge a run row.
```

**Admin request exception pattern** (request rows only, lines 36-45 of `20260613130000_qa_runs_request_queue.sql`):
```sql
CREATE POLICY "Admins can queue a qa run request"
  ON public.qa_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'ADMIN')
    AND status = 'requested'
    AND triggered_by = 'admin-request'
  );
```

**Apply to QA:** `qa_findings` should be durable and admin-readable. Prefer no browser INSERT/UPDATE path. If an admin action is added later, constrain it like `qa_runs` request rows. Use `lane`/`status` checks for `quarantined`, `qa_review`, `promoted`, and avoid putting non-reproduced findings into `tickets.status='new'`.

### `supabase/functions/sentry-webhook/__tests__/qa-ticket-ingestion.integration.test.ts` or `src/test/qa-ticket-ingestion.integration.test.ts` (test, real-DB RPC integration)

**Analog:** `supabase/functions/sentry-webhook/__tests__/sentry-webhook.integration.test.ts`

**Safety contract pattern** (lines 19-27):
```typescript
 * HARD CONTRACT (supabase/CLAUDE.md "Running integration tests safely"):
 *   - TEST project only — *_TEST_* env vars, no prod fallback (integration-setup
 *     throws if they equal prod).
 *   - describe.skipIf cleanly skips when the env is unset.
 *   - Every created row is cleaned up in afterAll, each step wrapped in
 *     try/catch; the suite is idempotent across reruns (unique fingerprint).
 *
 * Run: npm run test:integration -- sentry-webhook
```

**RPC availability guard pattern** (lines 57-81):
```typescript
describe.skipIf(!integrationDbReachable)(
  `${SUITE_TAG} ingest_sentry_ticket dedup + notification semantics`,
  () => {
    const svc: SupabaseClient = makeIntegrationClient();
    let rpcAvailable = true;

    beforeAll(async () => {
      const { error } = await svc.rpc("ingest_sentry_ticket", {
        p_fingerprint: `sentry:test-probe-${RUN_ID}`,
        p_severity: "low",
        p_context: context(),
        p_notify_title: "probe",
        p_notify_body: "probe",
      });
      if (error) {
        rpcAvailable = false;
        console.warn(`${SUITE_TAG} ingest_sentry_ticket unavailable...`);
        return;
      }
```

**Dedup assertions pattern** (lines 123-190):
```typescript
const { data: first, error: e1 } = await svc.rpc("ingest_sentry_ticket", {
  p_fingerprint: FINGERPRINT,
  p_severity: "medium",
  p_context: context({ marker: "first" }),
  p_notify_title: "Sentry: first",
  p_notify_body: "first body",
});
expect(e1).toBeNull();
expect(row1.created).toBe(true);
expect(row1.occurrence_count).toBe(1);

const { data: second, error: e2 } = await svc.rpc("ingest_sentry_ticket", {
  p_fingerprint: FINGERPRINT,
  p_severity: "high",
  p_context: context({ marker: "second" }),
  p_notify_title: "Sentry: second",
  p_notify_body: "second body",
});
expect(row2.created).toBe(false);
expect(row2.occurrence_count).toBe(2);
expect(row2.ticket_id).toBe(ticketId);
```

**Apply to QA:** prove `ingest_qa_ticket` creates `source='nightly_qa'`, dedups by fingerprint, increments `occurrence_count`, preserves first severity/context on dedup, writes evidence message/event, and is invisible to non-admin users. Add service-role-only RPC behavior where feasible.

### `/Users/admin/dev/autopilot/qa/triage.ts` (service/utility, batch + transform + request-response)

**Analog:** current `/Users/admin/dev/autopilot/qa/triage.ts`

**Input/env pattern** (lines 22-65):
```typescript
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "fs";
import { dirname, join } from "path";

const QA_DIR = dirname(new URL(import.meta.url).pathname);
const REPO_ENV = "/Users/admin/dev/brain/.env";
const REPO_ENV_LOCAL = "/Users/admin/dev/brain/.env.local";
const KNOWN_PATH = join(QA_DIR, "known-fingerprints.json");
const RUNS_LOG = join(QA_DIR, "runs.log");

const reportPath = arg("--report") ?? "/Users/admin/dev/brain/qa-report.json";
const crawlExit = arg("--crawl-exit") ?? "?";
const dryRun = process.argv.includes("--dry-run");
const record = process.argv.includes("--record");
```

**Current hard-noise filter pattern** (lines 93-105):
```typescript
const SENTRY_ENVELOPE = /ingest(?:\.[a-z]{2})?\.sentry\.io\/api\/\d+\/envelope/i;

function isNoise(f: Finding): boolean {
  if (f.type !== "network") return false;
  const msg = f.message;
  if (SENTRY_ENVELOPE.test(msg)) return true;
  if (/^Request failed:/i.test(msg) && /net::ERR_ABORTED/i.test(msg)) return true;
  return false;
}
```

**Current message/evidence shape** (lines 156-171):
```typescript
export function buildMessage(report: Report, f: Finding): string {
  return [
    `[qa-nightly-crawler] Automated finding from the nightly QA crawl of ${report.app_url}.`,
    "",
    `Class: ${f.type} (${ticketSeverity(f)})`,
    `Route: ${f.route}`,
    f.selector ? `Selector: ${f.selector}` : null,
    `Occurrences this run: ${f.occurrences ?? 1}`,
    `Fingerprint: ${f.fingerprint}`,
    "",
    "Detail:",
    f.message,
  ]
    .filter((l): l is string => l !== null)
    .join("\n")
    .slice(0, 5000);
}
```

**Replace this direct REST insert pattern** (lines 195-235):
```typescript
async function fileTicket(report: Report, f: Finding): Promise<string> {
  const tickets = await postRestRows<{ id?: string }>("tickets", buildQaTicketInsert(report, f), "id");
  const ticketId = tickets[0]?.id;
  if (!ticketId) throw new Error("tickets insert returned no id");

  await postRestRows("ticket_messages", {
    ticket_id: ticketId,
    author_type: "agent",
    author_id: null,
    body: buildMessage(report, f),
    attachments: [],
  });
```

**With this Sentry RPC call shape** (`supabase/functions/sentry-webhook/index.ts` lines 147-164):
```typescript
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const { data, error } = await supabase.rpc("ingest_sentry_ticket", {
  p_fingerprint: fingerprint,
  p_severity: severity,
  p_context: context,
  p_notify_title: `Sentry: ${title}`,
  p_notify_body: notifyBody,
});

if (error) {
  console.error("ingest_sentry_ticket failed:", error.message);
  return json({ error: "ingestion failed" }, 500);
}
```

**Apply to QA:** add `ingestQaTicket()` using Supabase JS RPC, `upsertQaFinding()` for quarantine/review ledger, `rerunFinding()` using fresh crawler route runs, and gate `fresh` findings through reproducibility and severity before RPC. Stop using `known-fingerprints.json` as canonical state after DB ledger lands.

### `/Users/admin/dev/autopilot/qa/nightly-crawl.sh` (script/config, batch + file I/O + subprocess)

**Analog:** `/Users/admin/dev/autopilot/qa/nightly-crawl.sh`

**Current nightly orchestration** (lines 23-47):
```bash
# Crawler resolves .env/.env.local and routes.manifest relative to cwd.
cd "$REPO" || exit 1

QA_APP_URL="https://app.callvaultai.com" npx tsx scripts/qa/qa-crawler.ts
CRAWL_EXIT=$?
echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] crawler exited $CRAWL_EXIT"

if [ ! -f "$REPO/qa-report.json" ]; then
  echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] FATAL: qa-report.json missing — skipping triage" >&2
  echo "$(date '+%Y-%m-%dT%H:%M:%S%z') | crawl_exit=$CRAWL_EXIT | FATAL no qa-report.json — triage skipped" >> "$QA_DIR/runs.log"
  exit 1
fi

"$BUN" "$QA_DIR/triage.ts" --report "$REPO/qa-report.json" --crawl-exit "$CRAWL_EXIT" --record
```

**Apply to QA:** keep this shell as the top-level nightly path. If rerun-quarantine is invoked inside `triage.ts`, pass no new shell state unless needed. If adding flags (`--repro-reruns 2`, `--recurrence-threshold 3`), preserve launchd-safe bare environment and the `qa-report.json` missing guard.

### `/Users/admin/dev/autopilot/src/qa-poller.ts` (service/daemon, queue claim + subprocess + file I/O)

**Analog:** `/Users/admin/dev/autopilot/src/qa-poller.ts`

**Atomic request claim pattern** (lines 88-113):
```typescript
export async function findOldestRequested(db: DbLike): Promise<QaRunRow | null> {
  const res = (await db
    .from("qa_runs")
    .select("id, status, triggered_by")
    .eq("status", "requested")
    .order("started_at", { ascending: true })
    .limit(1)) as QueryResult;
  if (res.error) throw new Error(`findOldestRequested: ${res.error.message}`);
  return (res.data?.[0] as QaRunRow | undefined) ?? null;
}

export async function claim(db: DbLike, id: string): Promise<QaRunRow | null> {
  const res = (await db
    .from("qa_runs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "requested")
    .select("id, status, triggered_by")) as QueryResult;
```

**Crawler subprocess pattern** (lines 241-255):
```typescript
const proc = Bun.spawnSync(
  [BUN, "run", "qa:crawl", "--max-routes", String(ON_DEMAND_MAX_ROUTES)],
  {
    cwd: BRAIN_REPO,
    env: {
      ...process.env,
      QA_APP_URL: APP_URL,
    },
    stdout: "pipe",
    stderr: "pipe",
    timeout: CRAWL_TIMEOUT_MS,
    killSignal: "SIGKILL",
  },
);
```

**Failure finalization pattern** (lines 302-336):
```typescript
if (!existsSync(REPORT_PATH)) {
  const reason =
    exitCode === 124
      ? `crawl exceeded ${CRAWL_TIMEOUT_MS / 1000}s and was killed before writing a report`
      : `crawler exited ${exitCode} without writing qa-report.json${stderr ? ` — ${stderr}` : ""}`;
  await finalize(db, claimed.id, {
    status: "failed",
    routes_crawled: 0,
    findings_count: 0,
    critical_count: 0,
    report: { error: reason.slice(0, 1500), app_url: APP_URL, crawl_exit: exitCode, triggered_by_poller: true },
  });
  return { kind: "failed", id: claimed.id, reason };
}
```

**Apply to QA:** implement route-specific fresh reruns with the same `Bun.spawnSync` + `cwd: BRAIN_REPO` + hard timeout pattern. Prefer `scripts/qa/qa-crawler.ts --route <route>` for reproducibility probes. Record every rerun exit/report/matched fingerprint in `qa_findings.repro_attempts`.

### `/Users/admin/dev/autopilot/src/lib/claim.ts` (service/queue utility, CRUD + request-response)

**Analog:** `/Users/admin/dev/autopilot/src/lib/claim.ts`

**Candidate shape and ordering** (lines 29-55):
```typescript
export interface TicketCandidate {
  id: string;
  status: string;
  severity: Severity;
  urgent: boolean;
  priority: number;
  attempts: number;
  created_at: string;
  next_attempt_at?: string | null;
}

export function compareTickets(a: TicketCandidate, b: TicketCandidate): number {
  return (
    Number(b.urgent) - Number(a.urgent) ||
    b.priority - a.priority ||
    SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
    a.created_at.localeCompare(b.created_at)
  );
}
```

**Selection query pattern** (lines 74-91):
```typescript
export async function selectNextTicket(
  db: DbLike,
  cfg: AutopilotConfig,
  nowMs: number = Date.now()
): Promise<TicketCandidate | null> {
  const nowIso = new Date(nowMs).toISOString();
  const { data, error } = await db
    .from("tickets")
    .select("id, status, severity, urgent, priority, attempts, created_at, next_attempt_at")
    .eq("status", "new")
    .lt("attempts", cfg.maxAttempts)
    .or(`next_attempt_at.is.null,next_attempt_at.lt.${nowIso}`)
    .limit(50);
```

**Atomic claim guard** (lines 101-112):
```typescript
const { data, error } = await db
  .from("tickets")
  .update({ status: "in_progress", attempts: ticket.attempts + 1 })
  .eq("id", ticket.id)
  .eq("status", "new") // ← the atomicity guard
  .select("id");
if (error || !data || data.length === 0) return null;
```

**Apply to QA:** add `source` to `TicketCandidate`, select it from `tickets`, and support an excluded-source or source-budget filter before `pickNext`. Do not encode `qa_review` as `status='new'`; if a review ticket exists at all, ensure selection ignores it.

### `/Users/admin/dev/autopilot/src/claimer.ts` and `autopilot.config.ts` (controller/config, budget gate + queue claim)

**Analog:** `/Users/admin/dev/autopilot/src/claimer.ts`

**Existing total budget pattern** (lines 137-170):
```typescript
export function countRunsInWindow(
  jsonlText: string,
  windowHours: number,
  nowMs: number = Date.now()
): number {
  const cutoff = nowMs - windowHours * 3600 * 1000;
  let count = 0;
  for (const line of jsonlText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const rec = JSON.parse(trimmed) as { ts_start?: string };
      if (rec.ts_start && Date.parse(rec.ts_start) >= cutoff) count++;
    } catch {
      /* skip malformed line */
    }
  }
  return count;
}
```

**Suppression gate pattern** (lines 176-195):
```typescript
export function evaluateClaimSuppression(
  runs: number,
  now: Date = new Date()
): ClaimSuppression {
  if (inQuietHours(config.quietHours.start, config.quietHours.end, now)) {
    return {
      suppressed: true,
      result: "suppressed:quiet-hours",
      message: `quiet hours ${config.quietHours.start}-${config.quietHours.end} — no new claims`,
    };
  }
  if (runs >= config.maxRunsPerWindow.maxRuns) {
    return {
      suppressed: true,
      result: "suppressed:budget",
      message: `budget cap: ${runs}/${config.maxRunsPerWindow.maxRuns} runs in ${config.maxRunsPerWindow.windowHours}h window`,
    };
  }
  return { suppressed: false };
}
```

**Config knob pattern** (`autopilot.config.ts` lines 22-31, 120-128):
```typescript
export interface RunBudget {
  /** Size of the rolling window, in hours. */
  windowHours: number;
  /** Maximum fix runs allowed inside one window (subscription budget). */
  maxRuns: number;
}

export const config: AutopilotConfig = {
  pollIntervalSec: 300,
  watchdogBudgetSec: 2400,
  maxAttempts: 4,
  quietHours: { start: "01:00", end: "07:00" },
  maxRunsPerWindow: { windowHours: 24, maxRuns: 4 },
```

**Apply to QA:** add a conservative `sourceBudgets` or `qaMaxShare` config. Enforce QA budget in `claimAndRun` by filtering QA candidates when QA runs have reached `floor(maxRuns * 0.5)`, while still allowing non-QA tickets if total budget remains. Do not raise `maxRunsPerWindow.maxRuns` or `concurrency`.

### `src/services/qa.service.ts` and `src/hooks/useQaRuns.ts` (service/hook, CRUD read)

**Analog:** current QA service/hook

**Service query pattern** (`src/services/qa.service.ts` lines 22-31):
```typescript
export async function fetchQaRuns(limit = 20): Promise<QaRun[]> {
  const { data, error } = await supabase
    .from("qa_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as QaRun[];
}
```

**Request mutation pattern** (`src/services/qa.service.ts` lines 40-47):
```typescript
export async function requestQaRun(): Promise<void> {
  const { error } = await supabase.from("qa_runs").insert({
    status: "requested",
    triggered_by: "admin-request",
  });

  if (error) throw error;
}
```

**Hook separation pattern** (`src/hooks/useQaRuns.ts` lines 6-24):
```typescript
export function useQaRuns(limit = 20) {
  return useQuery({
    queryKey: [...queryKeys.admin.qaRuns(), limit] as const,
    queryFn: () => fetchQaRuns(limit),
  });
}

export function useRequestQaRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: requestQaRun,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.qaRuns() });
```

**Apply to QA:** add pure service functions such as `fetchQaFindings()` / `fetchQaFindingSummary()` in `qa.service.ts`, then expose through hooks in `useQaRuns.ts` or `useQaFindings.ts`. Components must use hooks, not call services directly.

### `src/pages/admin/QaSection.tsx` (component, request-response UI read)

**Analog:** current `QaSection`

**Defensive report parsing pattern** (lines 107-130):
```tsx
interface QaFinding {
  route: string;
  type: string;
  severity: string;
  message: string;
  selector: string | null;
}

function parseFindings(report: Record<string, unknown> | null): QaFinding[] {
  if (!report) return [];
  const raw = report.findings;
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const f = (entry ?? {}) as Record<string, unknown>;
    return {
      route: typeof f.route === "string" ? f.route : "(unknown route)",
      type: typeof f.type === "string" ? f.type : "finding",
      severity: typeof f.severity === "string" ? f.severity : "unknown",
      message: typeof f.message === "string" ? f.message : "",
      selector: typeof f.selector === "string" ? f.selector : null,
    };
  });
}
```

**Existing surface pattern** (lines 241-318):
```tsx
return (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <h2 className="font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground">
        QA Crawler
      </h2>
      <RequestScanButton />
    </div>

    {latest && (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <SectionHeading>Latest Run</SectionHeading>
            {statusBadge(latest.status)}
```

**Findings list pattern** (lines 376-420):
```tsx
<Card>
  <CardHeader className="pb-3">
    <CardTitle>
      <SectionHeading>
        Findings{selected ? ` — ${relativeTime(selected.started_at)}` : ""}
      </SectionHeading>
    </CardTitle>
  </CardHeader>
  <CardContent>
    {findings.length === 0 ? (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <p className="text-sm text-muted-foreground">
          No findings in this run's report.
        </p>
      </div>
    ) : (
      <div className="divide-y divide-border">
```

**Apply to QA:** add review/quarantine/promoted counts and list rows inside this QA surface. Use existing cards/tables/badges. Avoid a new dashboard or settings-only flow. Do not expose raw high/critical errors as operator-facing problems; label the lane as review/audit state.

### `src/components/settings/TicketTable.tsx` and `src/services/tickets.service.ts` (component/service, ticket source display/filter)

**Analog:** ticket source filter/list grouping

**Source filter pattern** (`src/services/tickets.service.ts` lines 45-96):
```typescript
export interface TicketFilters {
  view?: TicketView
  status?: TicketStatus | 'all'
  severity?: TicketSeverity | 'all'
  source?: TicketSource | 'all'
}

if (filters.source && filters.source !== 'all') {
  query = query.eq('source', filters.source)
}
```

**Source display/grouping pattern** (`src/components/settings/TicketTable.tsx` lines 80-105, 152-164):
```tsx
<TableCell className="hidden md:table-cell py-0.5 whitespace-nowrap text-sm text-muted-foreground">
  {ticketSourceLabel(ticket.source)}
</TableCell>

const groupedTickets = React.useMemo(() => {
  if (!groupBySource) return [];
  return TICKET_SOURCE_ORDER
    .map((source) => {
      const rows = sortedTickets.filter((ticket) => ticket.source === source);
      return { source, label: ticketSourceLabel(source), rows };
    })
    .filter((group) => group.rows.length > 0);
}, [groupBySource, sortedTickets]);
```

**Apply to QA:** if Phase 20 surfaces promoted QA tickets in ticket lists, reuse source filtering/grouping. Keep `qa_review` non-claimable; do not make it just a `source='nightly_qa'` + `status='new'` row unless claimer filters prove it cannot be claimed.

## Shared Patterns

### Cross-Repo Ownership

**Source:** `docs/architecture/autopilot-brain-ownership.md`

Brain owns schema, Edge Functions, and admin UI. Autopilot owns crawler, triage, claimer, runner, launchd scheduling. The only integration contract is Supabase rows/RPCs. For Phase 20, this means:

- `brain`: migrations for `qa_findings` and `ingest_qa_ticket`, generated types if required, QA service/UI visibility.
- `autopilot`: `triage.ts`, rerun subprocess, recurrence promotion, source-budget claim filtering, nightly shell/poller wiring.
- No shared code between repos; coordinate through DB schema and RPC signatures.

### Service-Role Only Writes

**Sources:** `supabase/migrations/20260612150000_create_qa_runs.sql`, `/Users/admin/dev/autopilot/src/lib/db.ts`

Use service-role for crawler/daemon writes. `qa_runs` has admin-only SELECT and no client write path except a constrained request placeholder. `autopilot/src/lib/db.ts` creates a service-role Supabase client with no token refresh/session persistence and typed writer helpers.

### Review Lane Must Not Be Claimable

**Sources:** `20-CONTEXT.md`, `/Users/admin/dev/autopilot/src/lib/claim.ts`

`selectNextTicket` currently claims `tickets.status='new'` rows source-agnostically. Therefore review/quarantine records should live in `qa_findings` or a non-`new` ticket status. If planner chooses a ticket-based lane, add tests proving `qa_review` records cannot reach `claimTicket`.

### Fresh Rerun, Not Static Replay

**Sources:** `scripts/qa/qa-crawler.ts`, `/Users/admin/dev/autopilot/src/qa-poller.ts`

The crawler accepts `--route` and writes a fresh `qa-report.json`; `qa-poller.ts` shows the safe Bun subprocess pattern with `cwd: BRAIN_REPO`, explicit `QA_APP_URL`, timeout, and stale-report deletion. Use that for reproduce-before-file.

### Test Strategy

**Sources:** `supabase/CLAUDE.md`, Sentry integration test, autopilot Bun tests, QA React tests

- Brain RPC integration: real Supabase TEST project only, clean skip if env is absent.
- Autopilot logic: Bun tests with injected mock DB/client and static source assertions.
- Brain service/UI: Vitest with mocked Supabase and mocked hooks.
- Never mock Supabase for integration semantics; use unit mocks only for pure service/UI logic.
