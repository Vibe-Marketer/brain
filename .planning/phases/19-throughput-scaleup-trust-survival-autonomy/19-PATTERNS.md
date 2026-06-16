# Phase 19: Throughput Scale-Up + Trust, Survival & Autonomy - Pattern Map

**Mapped:** 2026-06-13
**Files analyzed:** 14 new/modified targets
**Analogs found:** 14 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/20260613xxxx_phase19_autopilot_trust.sql` | migration/model/RPC | CRUD + aggregate rollup + audit | `supabase/migrations/20260613090000_create_or_extend_runner_runs.sql`, `20260613180500_source_attribution_backfill_metrics.sql`, `20260612120000_create_admin_audit_log.sql` | exact |
| `supabase/functions/autopilot-trust-admin/index.ts` | Edge Function/controller | request-response admin mutation | `supabase/functions/ticket-approval/index.ts` | exact |
| `src/services/admin-dashboard.service.ts` | service | request-response reads + RPC mapping | same file runner/source metrics sections | exact |
| `src/hooks/useAdminDashboard.ts` | hook | request-response cache + mutation invalidation | same file runner hooks and kill-switch mutation | exact |
| `src/pages/admin/DashboardSection.tsx` | component | request-response UI surfacing | same file `RunnerOpsCard` and source metrics card patterns | exact |
| `src/services/__tests__/admin-dashboard.service.test.ts` | test | mocked request-response | same file RPC/runner tests | exact |
| `/Users/admin/dev/autopilot/autopilot.config.ts` | config | scheduler/cap config | same file `RunBudget`, `quietHours`, `concurrency: 1` | exact |
| `/Users/admin/dev/autopilot/src/claimer.ts` | daemon route/controller | scheduled one-cycle + budget guard + approval pass | same file `runCycle()` | exact |
| `/Users/admin/dev/autopilot/src/lib/claim.ts` | service/utility | atomic CRUD + retry/backoff | same file `claimTicket()`, `releaseClaim()`, `sweepStaleClaims()` | exact |
| `/Users/admin/dev/autopilot/src/lib/trust.ts` | service/utility | RPC reads + transform + ladder decision | `/Users/admin/dev/autopilot/src/lib/approval.ts`, `src/lib/db.ts` | role-match |
| `/Users/admin/dev/autopilot/src/lib/approval.ts` | service/controller | approval recognition + merge request-response | same file `qualifyEvents()`, `findApprovals()`, `executeApproval()` | exact |
| `/Users/admin/dev/autopilot/src/lib/canary.ts` | service/utility | scheduled batch + regression reopen | `src/lib/approval.ts` repro replay, `src/watchdog.ts` one-cycle service-role writes, `src/lib/evidence.ts` safe replay | role-match |
| `/Users/admin/dev/autopilot/src/runner.ts` | daemon controller | worktree lifecycle + run ledger + rate-limit defer | same file release/requeue branches and `finishRun()` | exact |
| `/Users/admin/dev/autopilot/src/*.{test.ts}` | test | mocked request-response + pure state machine | `claim.test.ts`, `approval.test.ts`, `evidence.test.ts` | exact |

## Cross-Repo Ownership Boundary

**Source:** `docs/architecture/autopilot-brain-ownership.md`

Brain owns product UI, admin observability UI, DB schema, RLS, RPCs, and Edge Functions. Autopilot owns the autonomous daemon, scheduling, claim/fix/gate/merge mechanics, push-gate, QA/canary execution, and worktree isolation. The repos share no code; the integration contract is only Supabase rows: `tickets`, `runner_state`, `runner_runs`, `qa_runs`, plus Phase 19 trust tables/columns.

Planner consequence: schema/RPC/admin mutation lands in `brain`; daemon enforcement/claim/rate-limit/canary lands in `/Users/admin/dev/autopilot`; do not import code across repos.

## Pattern Assignments

### `supabase/migrations/20260613xxxx_phase19_autopilot_trust.sql` (migration/model/RPC, CRUD + aggregate rollup + audit)

**Analogs:** `supabase/migrations/20260613090000_create_or_extend_runner_runs.sql`, `supabase/migrations/20260613180500_source_attribution_backfill_metrics.sql`, `supabase/migrations/20260612120000_create_admin_audit_log.sql`

**Ledger extension pattern** (`runner_runs`, lines 10-29, 67-75):
```sql
CREATE TABLE IF NOT EXISTS public.runner_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.runner_runs
  ADD COLUMN IF NOT EXISTS ticket_id uuid,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz,
  ADD COLUMN IF NOT EXISTS detail jsonb;

ALTER TABLE public.runner_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view runner runs" ON public.runner_runs
  FOR SELECT
  USING (public.has_role(auth.uid(), 'ADMIN'));
```

**FK/index repair pattern** (`runner_runs`, lines 31-65):
```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'runner_runs_ticket_id_fkey'
      AND conrelid = 'public.runner_runs'::regclass
  ) THEN
    ALTER TABLE public.runner_runs
      ADD CONSTRAINT runner_runs_ticket_id_fkey
      FOREIGN KEY (ticket_id)
      REFERENCES public.tickets(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_runner_runs_started_at_desc
  ON public.runner_runs (started_at DESC);
```

**Admin-only RPC pattern** (`ticket_source_metrics`, lines 34-85):
```sql
CREATE OR REPLACE FUNCTION public.ticket_source_metrics()
RETURNS TABLE (
  source public.ticket_source,
  volume BIGINT,
  resolved BIGINT,
  fix_rate NUMERIC,
  avg_cycle_time_hours NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH first_resolved_events AS (
    SELECT ticket_id, MIN(created_at) AS resolved_at
    FROM public.ticket_events
    WHERE event_type = 'status_change'
      AND new_value = 'resolved'
    GROUP BY ticket_id
  )
  SELECT t.source, COUNT(*) AS volume, COUNT(*) FILTER (WHERE t.status = 'resolved') AS resolved
  FROM public.tickets t
  LEFT JOIN first_resolved_events fre ON fre.ticket_id = t.id
  GROUP BY t.source;
END;
$function$;

REVOKE ALL ON FUNCTION public.ticket_source_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ticket_source_metrics() TO authenticated;
```

**Append-only audit table pattern** (`admin_audit_log`, lines 12-31):
```sql
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    action text NOT NULL,
    target_type text NOT NULL CHECK (target_type IN ('user', 'ticket', 'system')),
    target_id uuid,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read admin audit log"
    ON public.admin_audit_log FOR SELECT
    USING (public.has_role(auth.uid(), 'ADMIN'));

-- No INSERT/UPDATE/DELETE policies on purpose: service-role writes only.
```

**Apply to Phase 19:**
- Add queryable trust columns to `runner_runs` with `ADD COLUMN IF NOT EXISTS`, check constraints, FK to `ticket_events(id)` where needed, and comments.
- Add `autopilot_category_trust` for rung/state and `autopilot_trust_events` for append-only trust/audit events.
- Add `autopilot_trust_metrics()` as `SECURITY DEFINER`, admin-gated with `has_role(auth.uid(), 'ADMIN')`, `REVOKE` public/anon, `GRANT` authenticated.
- Survival denominator must require merged/fix identity and exclude rate-limit defers.

### `supabase/functions/autopilot-trust-admin/index.ts` (Edge Function/controller, request-response admin mutation)

**Analog:** `supabase/functions/ticket-approval/index.ts`

**Imports and validation pattern** (lines 22-41):
```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

const payloadSchema = z
  .object({
    ticket_id: z.string().uuid(),
    action: z.enum(['approve', 'reject']),
    reason: z.string().max(2000, 'Reason must be 2000 characters or fewer').optional(),
  })
```

**Auth/admin/service-role pattern** (lines 58-84):
```typescript
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const authResult = await authenticateRequest(req, supabase, corsHeaders);
if (authResult instanceof Response) return authResult;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: isAdmin, error: adminCheckError } = await supabaseAdmin.rpc('has_role', {
  _user_id: authResult.userId,
  _role: 'ADMIN',
});
if (adminCheckError || !isAdmin) {
  return new Response(JSON.stringify({ success: false, error: 'Admin access required' }), {
    status: 403,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

**Guard before privileged write** (lines 98-127):
```typescript
const { data: ticket, error: ticketError } = await supabaseAdmin
  .from('tickets')
  .select('id, status')
  .eq('id', ticket_id)
  .maybeSingle();

if (!ticket) {
  return new Response(JSON.stringify({ success: false, error: 'Ticket not found' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
if (ticket.status !== 'awaiting_approval') {
  return new Response(JSON.stringify({ success: false, error: 'ticket_not_awaiting_approval' }), {
    status: 409,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

**Audit-write pattern** (lines 193-204):
```typescript
const { error: auditError } = await supabaseAdmin.from('admin_audit_log').insert({
  actor_user_id: authResult.userId,
  action: `ticket_${action}`,
  target_type: 'ticket',
  target_id: ticket_id,
  metadata: action === 'reject' ? { reason: reason!.trim() } : {},
});
if (auditError) {
  console.error('AUDIT LOG WRITE FAILED for ticket-approval:', auditError);
}
```

**Apply to Phase 19:**
- Use this for explicit admin promotion/demotion of category trust rungs.
- `actor_id`/admin user must come from `authenticateRequest`, never request body.
- Write both `autopilot_category_trust` and append-only trust/admin audit events with the service-role client.
- Return `409` when promotion is attempted while the computed eligibility gate is not met.

### `src/services/admin-dashboard.service.ts` (service, request-response reads + RPC mapping)

**Analog:** same file runner ledger and source metrics sections

**Runner ledger query pattern** (lines 196-220):
```typescript
export type RunnerRun = Database["public"]["Tables"]["runner_runs"]["Row"];

const RUNNER_RUN_COLUMNS =
  "id, ticket_id, status, outcome, gate_verdict, gate_stage, duration_sec, est_cost, branch, fix_sha, diff_stat, test_cmd, test_exit, detail, started_at, finished_at, tickets_processed";

export async function fetchRunnerRuns(limit = 10): Promise<RunnerRun[]> {
  const { data, error } = await supabase
    .from("runner_runs")
    .select(RUNNER_RUN_COLUMNS)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as RunnerRun[];
}
```

**RPC type/mapping pattern** (lines 247-305):
```typescript
type TicketSourceMetricsRpcRow =
  Database["public"]["Functions"]["ticket_source_metrics"]["Returns"][number];

export interface TicketSourceMetrics {
  source: TicketSource;
  volume: number;
  resolved: number;
  fixRate: number;
  averageCycleTimeHours: number | null;
}

function mapTicketSourceMetricsRow(row: TicketSourceMetricsRpcRow): TicketSourceMetrics {
  return {
    source: row.source,
    volume: row.volume,
    resolved: row.resolved,
    fixRate: row.fix_rate,
    averageCycleTimeHours: row.avg_cycle_time_hours,
  };
}

export async function getTicketSourceMetrics(): Promise<TicketSourceMetrics[]> {
  const { data, error } = await supabase.rpc("ticket_source_metrics");
  if (error) {
    throw new Error(`Failed to fetch ticket source metrics: ${error.message}`);
  }
  return ((data ?? []) as TicketSourceMetricsRpcRow[]).map(mapTicketSourceMetricsRow);
}
```

**Dashboard composition pattern** (lines 365-385):
```typescript
const [sourceMetrics, runner, deploy] = await Promise.all([
  getTicketSourceMetrics(),
  fetchRunnerCard(),
  fetchDeployInfo(),
]);

return {
  usersByRole,
  totalUsers: totalUsers ?? 0,
  ticketsByStatus,
  totalTickets,
  ticketsLast7d: ticketsLast7d ?? 0,
  sourceMetrics,
  runner,
  deploy,
  health: { db: dbRoundTripMs, appVersion: getAppVersion() ?? "dev" },
};
```

**Apply to Phase 19:**
- Add `AutopilotTrustMetricsRpcRow`, `AutopilotTrustMetric`, `getAutopilotTrustMetrics()`, formatters for survival/rung/canary status.
- Include trust metrics in `AdminDashboardStats` via `Promise.all`.
- Keep service pure async; no React calls.

### `src/hooks/useAdminDashboard.ts` (hook, request-response cache + mutation invalidation)

**Analog:** same file admin dashboard hooks

**Polling query pattern** (lines 13-20, 42-49):
```typescript
export function useAdminDashboard() {
  return useQuery({
    queryKey: queryKeys.admin.dashboard(),
    queryFn: fetchDashboardStats,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useRunnerRuns(limit = 10) {
  return useQuery({
    queryKey: queryKeys.admin.runnerRuns(),
    queryFn: () => fetchRunnerRuns(limit),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
```

**Mutation/toast/invalidation pattern** (lines 70-95):
```typescript
export function useSetKillSwitch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (value: boolean) => setKillSwitch(value),
    onSuccess: (_data, value) => {
      if (value) {
        toast.warning("Autopilot paused", { description: "The runner stops claiming tickets within one poll cycle (~5 min)." });
      } else {
        toast.success("Autopilot armed", { description: "The runner claims its first ticket on the next check (~5 min)." });
      }
    },
    onError: (err) => {
      toast.error("Couldn't change autopilot", {
        description: err instanceof Error ? err.message : "Try again in a moment.",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.runner() });
    },
  });
}
```

**Apply to Phase 19:**
- Add `useAutopilotTrustMetrics()` if metrics are separate from dashboard, or rely on `useAdminDashboard()` if included.
- Add `usePromoteAutopilotCategory()` / `useDemoteAutopilotCategory()` mutation that calls the Edge Function through service code and invalidates `queryKeys.admin.dashboard()` plus any trust-specific key.

### `src/pages/admin/DashboardSection.tsx` (component, request-response admin surfacing)

**Analog:** same file `RunnerOpsCard`

**Imports pattern** (lines 1-44):
```typescript
import React from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useAdminDashboard, useNeedsYou, useRunnerRuns, useRunnerState } from "@/hooks/useAdminDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RiCheckboxCircleLine, RiAlarmWarningLine, RiEyeLine } from "@remixicon/react";
```

**Status card loading/empty/action pattern** (lines 223-307):
```tsx
function RunnerOpsCard() {
  const { data: runner, isLoading } = useRunnerState();
  const { data: runs, isLoading: runsLoading } = useRunnerRuns(5);
  const { isAdmin } = useUserRole();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>
          <SectionHeading>Autopilot</SectionHeading>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : !runner ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RiRobot2Line className="h-4 w-4" />
            not deployed yet
          </div>
        ) : (
          <>
            <div className={`flex items-center gap-3 rounded-lg border p-4 ${banner.box}`}>
              <banner.Icon className={`h-9 w-9 shrink-0 ${banner.tone}`} />
              <div className="min-w-0">
                <span className={`font-montserrat text-lg font-extrabold uppercase tracking-wide ${banner.tone}`}>
                  {banner.title}
                </span>
              </div>
            </div>
```

**Apply to Phase 19:**
- Add a compact trust/survival card under existing Autopilot admin surface, not a new product area.
- Use Remix icons only.
- Surface survival rate, matured fix count, rung (`manual` / `eligible` / `auto`), canary failures, and defer count.
- Promotion action should be explicit and admin-gated; do not auto-promote in UI.

### `/Users/admin/dev/autopilot/autopilot.config.ts` (config, scheduler/cap config)

**Analog:** same file

**Config type pattern** (lines 15-27, 52-74):
```typescript
export interface QuietHours {
  start: string;
  end: string;
}

export interface RunBudget {
  windowHours: number;
  maxRuns: number;
}

export interface AutopilotConfig {
  pollIntervalSec: number;
  watchdogBudgetSec: number;
  maxAttempts: number;
  staleClaimTtlSec: number;
  quietHours: QuietHours;
  maxRunsPerWindow: RunBudget;
  concurrency: 1;
}
```

**Current conservative default pattern** (lines 88-107):
```typescript
export const config: AutopilotConfig = {
  pollIntervalSec: 300,
  watchdogBudgetSec: 2400,
  maxAttempts: 4,
  staleClaimTtlSec: 2400 + 600,
  quietHours: { start: "01:00", end: "07:00" },
  maxRunsPerWindow: { windowHours: 24, maxRuns: 4 },
  worktreeReaper: { maxAgeHours: 6 },
  diskGuard: { minFreeGb: 10 },
  concurrency: 1,
  agentCommand: "claude -p",
  repoRemote: "https://github.com/Vibe-Marketer/brain.git",
};
```

**Apply to Phase 19:**
- Add cap/cadence knobs conservatively; do not flip live volume to 25-30/day in this phase.
- Keep `concurrency: 1` as a literal type and runtime guard.
- If adding canary/tier-2 cadence config, follow small interfaces and defaults here; scheduler plist can carry interval but code reads operational values from this config.

### `/Users/admin/dev/autopilot/src/claimer.ts` (daemon route/controller, scheduled one-cycle + budget guard + approval pass)

**Analog:** same file

**One-cycle + concurrency lock pattern** (lines 1-18, 73-92, 284-315):
```typescript
// launchd provides the schedule; this entry point runs ONE cycle and exits.
const LOCKDIR = `${config.paths.logsDir}/../.dispatcher.lock`;

function acquireLock(): boolean {
  try {
    mkdirSync(LOCKDIR);
    return true;
  } catch {
    return false;
  }
}

if (!acquireLock()) {
  console.log("[claimer] another cycle holds the lockdir — exiting (concurrency 1)");
  process.exit(0);
}

runCycle(db, dryRun)
  .then((res) => {
    releaseLock();
    console.log(`[claimer] cycle complete: ${res.result} (claims=${res.claims}, merges=${res.merges})`);
    process.exit(0);
  })
```

**Approval-before-claim pattern** (lines 228-240):
```typescript
let merges = 0;
const approvals = await findApprovals(db);
for (const appr of approvals) {
  if (dryRun) {
    console.log(`[claimer] DRY-RUN would ${appr.kind} ticket ${appr.ticketId}`);
    continue;
  }
  const r = await executeApproval(db, appr);
  if (r.merged) merges++;
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

**Apply to Phase 19:**
- Claim cadence/cap changes belong here/config/plist; never add worker concurrency.
- Replace `findApprovals()` with a trust-aware candidate source or wrap it with ladder-gated auto-approval candidates.
- Canary and tier-2 should copy the one-cycle launchd shape and lockdir, not run as infinite loops.

### `/Users/admin/dev/autopilot/src/lib/claim.ts` (service/utility, atomic CRUD + retry/backoff)

**Analog:** same file

**Atomic claim pattern** (lines 96-113):
```typescript
export async function claimTicket(db: DbLike, ticket: TicketCandidate): Promise<TicketCandidate | null> {
  const { data, error } = await db
    .from("tickets")
    .update({ status: "in_progress", attempts: ticket.attempts + 1 })
    .eq("id", ticket.id)
    .eq("status", "new")
    .select("id");
  if (error || !data || data.length === 0) return null;
  return { ...ticket, status: "in_progress", attempts: ticket.attempts + 1 };
}
```

**Backoff/release pattern** (lines 117-145):
```typescript
export function nextAttemptAt(attempts: number, nowMs: number = Date.now()): string {
  const minutes = 15 * Math.pow(4, attempts);
  return new Date(nowMs + minutes * 60 * 1000).toISOString();
}

export async function releaseClaim(db: DbLike, ticketId: string, attempts: number, reason: string, nowMs = Date.now()): Promise<void> {
  await writeEvent(db, ticketId, "claim_released", null, reason);
  const { error } = await db
    .from("tickets")
    .update({ status: "new", next_attempt_at: nextAttemptAt(attempts, nowMs) })
    .eq("id", ticketId)
    .eq("status", "in_progress")
    .select("id");
  if (error) console.error(`[autopilot] release failed for ${ticketId}: ${error.message}`);
}
```

**Non-failed requeue pattern** (`sweepStaleClaims`, lines 173-197):
```typescript
export async function sweepStaleClaims(db: DbLike, cfg: AutopilotConfig, nowMs = Date.now()): Promise<number> {
  const cutoff = new Date(nowMs - cfg.staleClaimTtlSec * 1000).toISOString();
  const { data, error } = await db
    .from("tickets")
    .update({ status: "new" })
    .eq("status", "in_progress")
    .lt("updated_at", cutoff)
    .select("id");
  if (error) return 0;
  return data?.length ?? 0;
}
```

**Apply to Phase 19:**
- Add `releaseClaimForRateLimit()` or a defer helper that copies status guards but records `rate_limit_defer`, jitter/backoff, and does not poison survival/failure metrics.
- Avoid decrementing `attempts` unless planner proves race safety. Safer pattern: add separate defer count/event and exclude from fix-attempt rollups.

### `/Users/admin/dev/autopilot/src/lib/trust.ts` (service/utility, RPC reads + ladder decision)

**Analogs:** `/Users/admin/dev/autopilot/src/lib/approval.ts`, `/Users/admin/dev/autopilot/src/lib/db.ts`

**Pure reducer/lookup pattern** (`approval.ts`, lines 60-107):
```typescript
export type RoleLookup = (userId: string) => Promise<boolean>;

export async function qualifyEvents(events: RawApprovalEvent[], isAdmin: RoleLookup): Promise<QualifiedApproval[]> {
  const candidates = events.filter(
    (e) =>
      e.actor_id !== null &&
      e.actor_id !== undefined &&
      (APPROVAL_EVENT_TYPES as readonly string[]).includes(e.event_type)
  );
  const newest = new Map<string, RawApprovalEvent>();
  for (const e of candidates) {
    const prev = newest.get(e.ticket_id);
    if (!prev || Date.parse(e.created_at) > Date.parse(prev.created_at)) {
      newest.set(e.ticket_id, e);
    }
  }
  const out: QualifiedApproval[] = [];
  for (const e of newest.values()) {
    const actorId = e.actor_id as string;
    if (!(await isAdmin(actorId))) continue;
    out.push({ ticketId: e.ticket_id, actorId, kind: e.event_type === "rejection" ? "rejection" : "approval", branch: branchForTicket(e.ticket_id) });
  }
  return out;
}
```

**Service-role structural DB pattern** (`db.ts`, lines 38-79):
```typescript
export interface DbLike {
  from(table: string): QueryBuilder;
}

export function createServiceClient(): DbLike {
  const url = process.env.SUPABASE_URL?.trim() || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  const client = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client as unknown as DbLike;
}
```

**Apply to Phase 19:**
- New trust helper should be pure-first: `computeEligibility(metrics)` and `canAutoApprove(categoryTrust)` unit-tested without DB.
- DB wiring should read `autopilot_category_trust` / RPC through `DbLike` and fail closed to manual.
- Do not forge admin `approval` rows for auto categories; write distinct trust/system events and use existing merge mechanics.

### `/Users/admin/dev/autopilot/src/lib/approval.ts` (service/controller, approval recognition + merge)

**Analog:** same file

**Manual approval recognition boundary** (lines 1-11, 128-165):
```typescript
/**
 * Approval-merge path ... v1 ships NOTHING autonomously: a merge happens
 * only on an explicit admin-authored `approval` row in ticket_events.
 */
export async function findApprovals(db: DbLike): Promise<QualifiedApproval[]> {
  const tRes = await db.from("tickets").select("id").eq("status", "awaiting_approval").limit(100);
  const ticketIds = (tRes.data ?? []).map((r) => (r as { id: string }).id);
  if (ticketIds.length === 0) return [];
  const collected: RawApprovalEvent[] = [];
  for (const tid of ticketIds) {
    const eRes = await db
      .from("ticket_events")
      .select("ticket_id, actor_id, event_type, created_at")
      .eq("ticket_id", tid)
      .or("event_type.eq.approval,event_type.eq.rejection")
      .order("created_at", { ascending: false })
      .limit(20);
    for (const row of eRes.data ?? []) collected.push(row as RawApprovalEvent);
  }
  return qualifyEvents(collected, makeRoleLookup(db));
}
```

**Merge mechanics order pattern** (lines 416-461):
```typescript
export async function runApprovalMerge(branch: string, r: MergeRunners): Promise<MergeMechResult> {
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

  const replay = r.replay?.() ?? null;
  if (replay && replay.code !== 0) return { kind: "repro-replay-failed", out: replay.out };

  const gateBase = r.git(["rev-parse", "origin/main"]).out.trim();
  const gate = r.gate(gateBase);
  if (gate.code !== 0) return { kind: "gate-blocked", code: gate.code, out: gate.out };

  r.git(["checkout", "main"]);
  r.git(["reset", "--hard", "origin/main"]);
  const ff = r.git(["merge", "--ff-only", branch]);
  if (ff.code !== 0) return { kind: "ff-failed", out: ff.out };
  return { kind: "merged", mergedSha: r.git(["rev-parse", "HEAD"]).out.trim(), rebased, replayed: replay !== null };
}
```

**Apply to Phase 19:**
- Insert ladder gate before a candidate reaches `executeApproval()`.
- Auto-approved category should produce a `QualifiedApproval`-compatible merge action, but with explicit `kind/source` metadata if type changes are needed.
- Keep rebase → replay → gate → ff-only → push → deploy verify order unchanged.

### `/Users/admin/dev/autopilot/src/lib/canary.ts` (service/utility, scheduled batch + regression reopen)

**Analogs:** `approval.ts` repro replay, `watchdog.ts` service-role scheduled job, `evidence.ts` safe replay

**Safe repro replay pattern** (`evidence.ts`, lines 85-161):
```typescript
const REPLAY_COMMAND_ALLOWLIST = new Set(["bun", "npm", "node"]);
const SHELL_METACHAR_PATTERN = /[\0\r\n;&|`$<>]/;

function safeArgv(value: unknown, replayRoot?: string): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 16) return null;
  const argv = value.map((entry) => (typeof entry === "string" ? entry.trim() : ""));
  if (argv.some((entry) => entry.length === 0 || SHELL_METACHAR_PATTERN.test(entry))) return null;
  if (!REPLAY_COMMAND_ALLOWLIST.has(argv[0]!)) return null;
  return argv;
}

export function findReproReplay(context: unknown, _messageBodies: string[], replayRoot?: string): ReproReplay | null {
  const record = asRecord(context);
  return replayFromRecord(record?.repro_replay, replayRoot);
}
```

**Scheduled one-cycle/page/write pattern** (`watchdog.ts`, lines 24-70, 164-180):
```typescript
export interface WatchdogDeps {
  readHeartbeat(): Promise<string | null>;
  page(message: string): Promise<void>;
  nowMs(): number;
  readLastPageMs(): number | null;
  writeLastPageMs(ms: number): void;
}

export async function checkHeartbeat(deps: WatchdogDeps, thresholdSec: number, cooldownSec: number): Promise<WatchdogResult> {
  let message: string | null = null;
  try {
    const heartbeat = await deps.readHeartbeat();
    if (heartbeat === null) message = "Autopilot dispatcher has NO heartbeat";
  } catch (err) {
    message = `watchdog cannot reach DB — heartbeat unknown: ${err instanceof Error ? err.message : String(err)}`;
  }
  if (message === null) return "ok";
  await deps.page(message);
  deps.writeLastPageMs(deps.nowMs());
  return "paged";
}

async function deliverPage(db: DbLike, message: string): Promise<void> {
  const { error } = await db.from("user_notifications").insert({
    user_id: ADMIN_USER_ID,
    type: "health_alert",
    title: "Autopilot watchdog",
    body: message,
    metadata: { source: "autopilot-watchdog", paged_at: new Date().toISOString() },
  });
  if (error) console.error(`[watchdog] user_notifications insert failed: ${error.message}`);
}
```

**Apply to Phase 19:**
- Canary job should select `runner_runs` rows with `canary_next_run_at <= now()` and merged/fix identity.
- Reopen the originating `tickets.id`; do not create a new ticket.
- Write `ticket_events`, `ticket_messages`, `runner_runs.reopened_event_id`, `survival_status='reopened'`, `canary_status='failed'`, and a trust event.
- Keep operator-facing copy solution-shaped per `.planning/design/escalation-tier2-solutions-not-problems.md`.

### `/Users/admin/dev/autopilot/src/runner.ts` (daemon controller, worktree lifecycle + run ledger + rate-limit defer)

**Analog:** same file

**Run ledger finish pattern** (lines 258-333):
```typescript
const finishRun = async (status: RunLedgerStatus, outcome: string, fields = {}) => {
  const tsEnd = new Date().toISOString();
  const ledgerFields = buildRunLedgerFields({
    ts_start: tsStart,
    ts_end: tsEnd,
    status,
    outcome,
    claude_exit: agentResult.exitCode,
    verdict,
    changed_files: changedEntries.length,
    rate_limit_suspected: detectRateLimit(transcript),
    transcript: transcriptPath,
    ticket_id: ticketId,
    branch,
    fix_sha: fields.fix_sha ?? null,
    detail: fields.detail ?? {},
  });
  appendFileSync(`${config.paths.logsDir}/autopilot.jsonl`, buildJsonlLine(ledgerFields) + "\n");
  if (runnerRunId) await updateRunnerRun(db, runnerRunId, row);
};
```

**Existing release/requeue branch pattern** (lines 393-414):
```typescript
if (vitest.code !== 0 || build.code !== 0) {
  const attempts = await fetchAttempts(db, ticketId);
  if (attempts >= config.maxAttempts) {
    await escalate(db, ticketId, `Autopilot verification failed after ${attempts} attempts`);
    await finishRun("gate_failed", "escalated:verification-max-attempts", {
      gate_verdict: "fail",
      gate_stage: "verification",
      detail: { reason: "verification-max-attempts", attempts },
    });
    return "escalated:verification-max-attempts";
  }
  await releaseClaim(db, ticketId, attempts, `In-worktree verification failed (backoff applies):\n${testTail}`);
  await finishRun("requeued", "released:verification-failed", {
    gate_verdict: "fail",
    gate_stage: "verification",
    detail: { reason: "verification-failed", attempts },
  });
  return "released:verification-failed";
}
```

**Current catch path to fix** (lines 522-569):
```typescript
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const ledgerFields = buildRunLedgerFields({
    status: "failed",
    outcome: `failed:${message.slice(0, 120)}`,
    gate_verdict: "fail",
    gate_stage: "runner",
    rate_limit_suspected: false,
    detail: { error: message },
  });
  appendFileSync(`${config.paths.logsDir}/autopilot.jsonl`, buildJsonlLine(ledgerFields) + "\n");
  if (runnerRunId) await updateRunnerRun(db, runnerRunId, { status: ledgerFields.status, outcome: ledgerFields.outcome });
  throw error;
}
```

**Apply to Phase 19:**
- Add rate-limit branch immediately after transcript capture and before verdict/no-diff failure mapping.
- In catch path, if transcript exists and `detectRateLimit(transcript)` is true, release/defer instead of failed.
- Status/outcome should be `requeued` / `deferred:rate-limit` or the schema-approved equivalent, with `gate_verdict: "skipped"` and `gate_stage: "rate_limit"`.
- `finally` already destroys worktree and idles runner; keep that cleanup path.

### `/Users/admin/dev/autopilot/src/*.{test.ts}` and `src/services/__tests__/admin-dashboard.service.test.ts` (tests)

**Analogs:** `claim.test.ts`, `approval.test.ts`, `evidence.test.ts`, `admin-dashboard.service.test.ts`

**Autopilot mocked DB pattern** (`claim.test.ts`, lines 24-60):
```typescript
interface RecordedCall {
  table: string;
  method: string;
  args: unknown[];
}

function makeMockDb(results: QueryResult[]): { db: DbLike; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  let chain = 0;
  const db: DbLike = {
    from(table: string) {
      const idx = chain++;
      const result = results[Math.min(idx, results.length - 1)] ?? { data: [], error: null };
      const builder: Record<string, unknown> = {};
      const record = (method: string) => (...args: unknown[]) => {
        calls.push({ table, method, args });
        return builder;
      };
      for (const m of ["select", "update", "insert", "eq", "lt", "or", "limit", "order"]) builder[m] = record(m);
      builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
      return builder as unknown as ReturnType<DbLike["from"]>;
    },
  };
  return { db, calls };
}
```

**Pure state machine test pattern** (`approval.test.ts`, lines 76-132):
```typescript
describe("qualifyEvents — merge-authority recognition", () => {
  test("admin-authored approval on awaiting_approval → qualifies", async () => {
    const q = await qualifyEvents([evt({})], roleLookup);
    expect(q).toHaveLength(1);
    expect(q[0]!.kind).toBe("approval");
  });

  test("NULL actor_id (trigger/service-role) → NEVER qualifies", async () => {
    const q = await qualifyEvents([evt({ actor_id: null })], roleLookup);
    expect(q).toHaveLength(0);
  });
});
```

**Rate-limit detector test pattern** (`evidence.test.ts`, lines 249-257):
```typescript
describe("detectRateLimit", () => {
  test("true on spike rate-limit patterns, false otherwise", () => {
    expect(detectRateLimit("... rate limit exceeded ...")).toBe(true);
    expect(detectRateLimit("You have hit your usage limit")).toBe(true);
    expect(detectRateLimit("HTTP 429 Too Many Requests")).toBe(true);
    expect(detectRateLimit("all tests passed, nothing to see")).toBe(false);
  });
});
```

**Brain RPC service test pattern** (`admin-dashboard.service.test.ts`, lines 412-510):
```typescript
describe("getTicketSourceMetrics", () => {
  it("maps ticket_source_metrics RPC rows to the typed service contract", async () => {
    mockRpc({ data: [{ source: "manual", volume: 12, resolved: 8, fix_rate: 0.6667, avg_cycle_time_hours: 6.4 }], error: null });
    const metrics = await getTicketSourceMetrics();
    expect(supabase.rpc).toHaveBeenCalledWith("ticket_source_metrics");
    expect(metrics).toEqual([{ source: "manual", volume: 12, resolved: 8, fixRate: 0.6667, averageCycleTimeHours: 6.4 }]);
  });

  it("throws a labeled error when the metrics RPC fails", async () => {
    mockRpc({ data: null, error: { message: "forbidden" } });
    await expect(getTicketSourceMetrics()).rejects.toThrow("Failed to fetch ticket source metrics: forbidden");
  });
});
```

**Apply to Phase 19:**
- Add Autopilot `trust.test.ts` for ladder eligibility, fail-closed manual default, explicit promotion event recognition, automatic demotion decision.
- Add `canary.test.ts` for selecting due canaries and reopening the originating ticket only.
- Add claim/runner tests for rate-limit defer not failure.
- Add Brain service tests for `autopilot_trust_metrics` mapping and formatter behavior.

## Shared Patterns

### Service-Role Writes, Admin-Only Reads

Use service-role writers for daemon and privileged admin mutations. Browser/admin sessions read through RLS or admin-only RPCs. Do not add client-reachable insert/update/delete policies for audit/trust events.

### Fail Closed

Existing daemon patterns fail closed on unknown role, DB-unreachable kill switch, missing runner state, disk guard, and missing gate. Trust ladder reads should fail to `manual`, never `auto`.

### No Cross-Repo Code Sharing

Brain migration/RPC/function defines the schema contract. Autopilot imports nothing from Brain; it uses Supabase tables via `DbLike` and service-role key.

### Rate-Limit Defers Are Not Failures

Current `detectRateLimit()` exists, but `runner.ts` currently only stores it as ledger metadata. Phase 19 must turn it into a distinct release/defer branch that excludes the run from failed-fix and survival denominators.

### Canary Regression Attribution

Canary failure must update the original ticket and originating run. Pattern sources are `runner_runs.ticket_id`, `ticket_events` lifecycle rows, `writeAgentMessage()`, and approval replay mechanics.

### Operator Surfaces Show Solutions, Not Raw Problems

Tier-2/operator digest surfaces must follow `.planning/design/escalation-tier2-solutions-not-problems.md`: 1-2 sentence what/why plus 2-3 simple decisions with a recommended path. Avoid raw stack traces/problem dumps in UI copy.
