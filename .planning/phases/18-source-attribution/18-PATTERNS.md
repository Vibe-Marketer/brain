# Phase 18: Source Attribution - Pattern Map

**Mapped:** 2026-06-13
**Files analyzed:** 15
**Analogs found:** 15 / 15

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/YYYYMMDDHHMMSS_source_attribution.sql` | migration | transform + request-response RPC | `supabase/migrations/20260612130000_sentry_ticket_ingestion.sql` | exact |
| `src/types/supabase.ts` | model/type contract | transform | existing generated enum rows in `src/types/supabase.ts` | exact |
| `supabase/functions/send-support-ticket/index.ts` | controller / Edge Function | request-response + CRUD | same file | exact |
| `/Users/admin/dev/autopilot/src/watchdog.ts` | controller / daemon intake | event-driven + CRUD | same file + `/Users/admin/dev/autopilot/src/lib/db.ts` | exact |
| `/Users/admin/dev/autopilot/qa/triage.ts` | controller / daemon intake | batch + request-response + CRUD | same file + `supabase/migrations/20260612130000_sentry_ticket_ingestion.sql` | role-match |
| `src/services/tickets.service.ts` | service | CRUD + transform | same file | exact |
| `src/hooks/useTickets.ts` | hook | request-response cache | same file | exact |
| `src/lib/ticket-display.ts` | utility | transform | same file | exact |
| `src/pages/admin/TicketsSection.tsx` | component | request-response UI | same file | exact |
| `src/components/settings/TicketTable.tsx` | component | transform UI | same file | exact |
| `src/services/admin-dashboard.service.ts` | service | aggregate CRUD + transform | same file | exact |
| `src/hooks/useAdminDashboard.ts` | hook | request-response cache | same file | exact |
| `src/pages/admin/DashboardSection.tsx` | component | aggregate UI | same file | exact |
| `src/services/__tests__/tickets.service.test.ts` | test | mocked CRUD | same file | exact |
| `src/services/__tests__/admin-dashboard.service.test.ts` | test | mocked aggregate CRUD | same file | exact |

## Pattern Assignments

### `supabase/migrations/YYYYMMDDHHMMSS_source_attribution.sql` (migration, transform + request-response RPC)

**Analog:** `supabase/migrations/20260612130000_sentry_ticket_ingestion.sql`

**Enum/base table pattern** (from `supabase/migrations/20260611000002_create_ticket_tables.sql` lines 33-49):
```sql
-- 'sentry' ships now for Phase 12 ingestion forward-compat.
CREATE TYPE public.ticket_source AS ENUM ('manual', 'sentry');

CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.ticket_type NOT NULL,
  severity public.ticket_severity NOT NULL DEFAULT 'medium',
  status public.ticket_status NOT NULL DEFAULT 'new',
  source public.ticket_source NOT NULL DEFAULT 'manual',
  fingerprint TEXT,
```

**SECURITY DEFINER RPC pattern** (from `supabase/migrations/20260612130000_sentry_ticket_ingestion.sql` lines 48-57, 120-126):
```sql
CREATE OR REPLACE FUNCTION public.ingest_sentry_ticket(
  p_fingerprint TEXT,
  p_severity public.ticket_severity,
  p_context JSONB,
  p_notify_title TEXT,
  p_notify_body TEXT
)
RETURNS TABLE (ticket_id UUID, occurrence_count INTEGER, created BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public

REVOKE ALL ON FUNCTION public.ingest_sentry_ticket(TEXT, public.ticket_severity, JSONB, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_sentry_ticket(TEXT, public.ticket_severity, JSONB, TEXT, TEXT)
  TO service_role;
```

**Ticket insert + event audit pattern** (from `supabase/migrations/20260612130000_sentry_ticket_ingestion.sql` lines 66-87):
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

INSERT INTO public.ticket_events (ticket_id, actor_id, event_type, new_value)
VALUES (v_ticket_id, NULL, 'created', 'new');
```

**Planner note:** Add enum values additively (`unknown`, `nightly_qa`, `internal`), preserve `manual`, use targeted backfill predicates only, and guard any metrics RPC with admin/service-role access. Do not blanket-convert `manual`.

---

### `src/types/supabase.ts` (model/type contract, transform)

**Analog:** existing generated enum entries in `src/types/supabase.ts`

**Enum union pattern** (lines 5310 and 5450):
```typescript
ticket_source: "manual" | "sentry"
ticket_source: ["manual", "sentry"],
```

**Planner note:** Prefer regenerating types from the migrated test/linked DB. If regeneration is impossible during execution, the planner must explicitly document a temporary manual type update and verify it is kept in sync with the migration.

---

### `supabase/functions/send-support-ticket/index.ts` (controller, request-response + CRUD)

**Analog:** same file.

**Imports and validation pattern** (lines 1-34):
```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { escapeHtml } from '../_shared/html-escape.ts';

const supportTicketSchema = z.object({
  message: z.string().trim().min(1).max(5000),
  type: z.enum(['bug', 'suggestion', 'question', 'task']).default('bug'),
  severity: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
```

**Auth + method guard pattern** (lines 111-145):
```typescript
Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const authResult = await authenticateRequest(req, supabase, corsHeaders);
    if (authResult instanceof Response) return authResult;
```

**Trusted source stamping pattern** (lines 163-196):
```typescript
// DB is the system of record. reporter_id comes EXCLUSIVELY from the authenticated JWT.
const admin = createClient(supabaseUrl, supabaseServiceKey);

const { data: ticket, error: ticketError } = await admin
  .from('tickets')
  .insert({
    reporter_id: userId,
    type: payload.type,
    severity: payload.severity,
    source: 'manual',
    context,
  })
  .select('id')
  .single();
```

**Planner note:** Keep browser/person reports as `manual` unless a trusted server-only path is added. Do not accept arbitrary `source` from the request body.

---

### `/Users/admin/dev/autopilot/src/watchdog.ts` (controller, event-driven + CRUD)

**Analog:** same file.

**Service-role client pattern** (from `/Users/admin/dev/autopilot/src/lib/db.ts` lines 62-79):
```typescript
export function createServiceClient(): DbLike {
  const url = process.env.SUPABASE_URL?.trim() || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required — copy .env.example to .env (chmod 600)"
    );
  }
  const client = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client as unknown as DbLike;
}
```

**Dedupe + ticket insert pattern** (from `/Users/admin/dev/autopilot/src/watchdog.ts` lines 267-299):
```typescript
const fingerprint = healthFingerprint(failing.length > 0 ? failing : ["tools-health nonzero exit"]);
const existing = (await db
  .from("tickets")
  .select("id, status")
  .eq("context->>watchdog_fingerprint", fingerprint)
  .limit(50)) as QueryResult;
const open = (existing.data ?? []).filter((r) => {
  const row = r as { status?: string };
  return !["resolved", "closed", "wont_fix"].includes(row.status ?? "");
});
if (open.length > 0) return;
const { error } = await db.from("tickets").insert({
  reporter_id: ADMIN_USER_ID,
  type: "bug",
  severity: "high",
  status: "new",
  source: "manual",
  context: {
    origin: "autopilot-watchdog",
    watchdog_fingerprint: fingerprint,
```

**Planner note:** Change only the source stamp to `internal` for watchdog-created tickets after the enum/type contract exists. Preserve dedupe, severity, reporter, and context.

---

### `/Users/admin/dev/autopilot/qa/triage.ts` (controller, batch + request-response + CRUD)

**Analog:** same file for batching and current filing; Sentry RPC migration for source-specific service-role intake.

**Current password-grant + Edge Function path** (lines 150-200):
```typescript
async function passwordGrant(): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: LOGIN, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`password grant failed: HTTP ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("password grant returned no access_token");
  return json.access_token;
}

async function fileTicket(token: string, f: Finding): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-support-ticket`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: ANON_KEY,
      "Content-Type": "application/json",
    },
```

**Batch persistence pattern** (lines 307-325):
```typescript
for (const f of fresh) {
  try {
    const ticketId = await fileTicket(token, f);
    filed.push(ticketId);
    known[f.fingerprint] = {
      firstSeen: new Date().toISOString(),
      ticketId,
      route: f.route,
      type: f.type,
      message: f.message.slice(0, 200),
    };
  } catch (e) {
    failures.push(f.fingerprint.slice(0, 12));
  }
}
writeFileSync(KNOWN_PATH, JSON.stringify(known, null, 2) + "\n");
```

**Planner note:** The minimal Phase 18 fix should stop calling person-report intake for QA tickets. Use a service-role direct insert/RPC that stamps `nightly_qa`, but keep full Phase 20 flake suppression / `ingest_qa_ticket` scope out.

---

### `src/services/tickets.service.ts` (service, CRUD + transform)

**Analog:** same file.

**Typed DB contract pattern** (lines 1-15, 45-51):
```typescript
import { supabase } from '@/integrations/supabase/client'
import type { Database } from '@/types/supabase'

export type TicketStatus = Database['public']['Enums']['ticket_status']
export type TicketSeverity = Database['public']['Enums']['ticket_severity']
export type TicketSource = Database['public']['Enums']['ticket_source']
export type TicketType = Database['public']['Enums']['ticket_type']

export interface TicketFilters {
  view?: TicketView
  status?: TicketStatus | 'all'
  severity?: TicketSeverity | 'all'
  source?: TicketSource | 'all'
}
```

**Bounded list + source filter pattern** (lines 72-100):
```typescript
export async function getTickets(
  filters: TicketFilters = {},
  pagination: TicketPagination = {},
): Promise<TicketPage> {
  const limit = pagination.limit ?? TICKETS_PAGE_SIZE
  const offset = pagination.offset ?? 0

  let query = supabase
    .from('tickets')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (filters.source && filters.source !== 'all') {
    query = query.eq('source', filters.source)
  }

  const { data, error, count } = await query
  if (error) throw new Error(`Failed to fetch tickets: ${error.message}`)
```

**Reporter resolution pitfall** (lines 102-125):
```typescript
const rows = (data ?? []) as TicketRow[]
const reporterIds = [...new Set(rows.map((row) => row.reporter_id))]
const reporterMap = new Map<string, string>()

const tickets = rows.map((row) => ({
  ...row,
  reporter: reporterMap.get(row.reporter_id) ?? row.reporter_id,
}))
```

**Planner note:** Make reporter IDs null-safe when adding system sources. Use `ticketSourceLabel(row.source)` or similar for reporter fallback when `reporter_id` is null.

---

### `src/hooks/useTickets.ts` (hook, request-response cache)

**Analog:** same file.

**List query pattern** (lines 19-30):
```typescript
export function useTickets(
  filters: TicketFilters = {},
  page = 1,
  pageSize = TICKETS_PAGE_SIZE,
) {
  const { session } = useAuth()
  return useQuery<TicketPage>({
    queryKey: ['tickets', filters, page, pageSize],
    queryFn: () =>
      getTickets(filters, { limit: pageSize, offset: (page - 1) * pageSize }),
    enabled: !!session,
  })
}
```

**Mutation invalidation pattern** (lines 57-66, 69-80):
```typescript
export function useCreateTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: CreateTicketParams) => createTicket(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      toast.success('Ticket created')
    },
    onError: () => toast.error('Ticket could not be created'),
  })
}
```

**Planner note:** A separate `useTicketSourceMetrics` hook is acceptable if metrics are not bundled into existing dashboard stats. Keep service calls out of components.

---

### `src/lib/ticket-display.ts` (utility, transform)

**Analog:** same file.

**Plain-English doctrine + fallback pattern** (lines 43-62):
```typescript
/* Plain-English humanizers (READABILITY DOCTRINE)
 * Everything outward-facing in tickets/admin must read like plain English
 * to a 9th grader — no enums, no code, no jargon.
 */
function prettify(value: string): string {
  const spaced = value.replace(/[_-]+/g, " ").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : value;
}
```

**Source label pattern** (lines 105-115):
```typescript
/** Where a ticket came from, in human terms — never "manual"/"sentry". */
export function ticketSourceLabel(source: string | null | undefined): string {
  switch (source) {
    case "manual":
      return "Reported by a person";
    case "sentry":
      return "Found automatically";
    default:
      return source ? prettify(source) : "—";
  }
}
```

**Planner note:** Extend this first. Required labels: `manual` -> "Reported by a person", `sentry` -> "Found by Sentry", `nightly_qa` -> "Found by nightly QA", `internal` -> "Internal watchdog", `unknown` -> "Unknown source".

---

### `src/pages/admin/TicketsSection.tsx` (component, request-response UI)

**Analog:** same file.

**State + query pattern** (lines 42-70):
```tsx
const [view, setView] = useState<TicketView>("open");
const [severityFilter, setSeverityFilter] = useState<TicketSeverity | "all">("all");
const [sourceFilter, setSourceFilter] = useState<TicketSource | "all">("all");
const [page, setPage] = useState(1);
const [pageSize, setPageSize] = useState(TICKETS_PAGE_SIZE);

const { data: ticketPageData, isLoading, isError } = useTickets(
  { view, severity: severityFilter, source: sourceFilter },
  page,
  pageSize,
);
const tickets = ticketPageData?.tickets ?? [];
const totalCount = ticketPageData?.totalCount ?? 0;
```

**Filter Select pattern** (lines 186-203):
```tsx
<Label htmlFor="admin-ticket-source-filter">Source</Label>
<Select
  value={sourceFilter}
  onValueChange={(value) => {
    setSourceFilter(value as TicketSource | "all");
    setPage(1);
  }}
>
  <SelectTrigger id="admin-ticket-source-filter" className="mt-2">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All Sources</SelectItem>
    <SelectItem value="manual">Manual</SelectItem>
    <SelectItem value="sentry">Sentry</SelectItem>
  </SelectContent>
</Select>
```

**Legend pattern** (lines 144-150):
```tsx
<div className="border-t border-border pt-2">
  <span className="font-medium text-foreground">Where tickets come from:</span>
  <ul className="mt-1 space-y-0.5">
    <li><span className="font-medium text-foreground">Manual</span> — a person filed it (you or a teammate).</li>
    <li><span className="font-medium text-foreground">Sentry</span> — the error monitor caught a crash in production automatically.</li>
  </ul>
</div>
```

**Planner note:** Keep this inside the existing Tickets section. If adding grouping, use a compact summary strip above the table and keep pagination/list behavior.

---

### `src/components/settings/TicketTable.tsx` (component, transform UI)

**Analog:** same file.

**Imports and source column pattern** (lines 14-20, 83-88, 122-124):
```tsx
import {
  ticketStatusBadge,
  ticketSeverityBadge,
  ticketTypeMeta,
  ticketSourceLabel,
} from "@/lib/ticket-display";
import type { Ticket } from "@/services/tickets.service";

<TableHead className="hidden md:table-cell min-w-[90px] h-10 md:h-12 whitespace-nowrap text-xs md:text-sm">
  <SortButton field="source">SOURCE</SortButton>
</TableHead>

<TableCell className="hidden md:table-cell py-0.5 whitespace-nowrap text-sm text-muted-foreground">
  {ticketSourceLabel(ticket.source)}
</TableCell>
```

**Empty/filter state pattern** (lines 53-67):
```tsx
if (tickets.length === 0) {
  return (
    <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border rounded-xl">
      <RiTicketLine className="h-12 w-12 text-muted-foreground mb-4" />
      {hasActiveFilters ? (
        <p className="text-sm text-muted-foreground">No tickets match your filters</p>
      ) : (
```

**Planner note:** The table already delegates source display to `ticketSourceLabel()`. Avoid raw enum labels in the column.

---

### `src/services/admin-dashboard.service.ts` (service, aggregate CRUD + transform)

**Analog:** same file.

**Stats service contract pattern** (lines 246-259):
```typescript
export interface AdminDashboardStats {
  usersByRole: { ADMIN: number; TEAM: number; PRO: number; FREE: number };
  totalUsers: number;
  ticketsByStatus: Record<TicketStatus, number>;
  totalTickets: number;
  ticketsLast7d: number;
  runner: RunnerCard;
  deploy: DeployInfo;
  health: {
    db: number;
    appVersion: string;
  };
}
```

**Count aggregation pattern** (lines 300-312):
```typescript
const { data: statusRows, error: statusError } = await supabase
  .from("tickets")
  .select("status");
if (statusError) throw statusError;

const ticketsByStatus = emptyStatusCounts();
for (const row of (statusRows ?? []) as Array<{ status: TicketStatus }>) {
  if (row.status in ticketsByStatus) {
    ticketsByStatus[row.status] += 1;
  }
}
const totalTickets = (statusRows ?? []).length;
```

**Graceful side-card pattern** (lines 322-337):
```typescript
const [runner, deploy] = await Promise.all([fetchRunnerCard(), fetchDeployInfo()]);

return {
  usersByRole,
  totalUsers: totalUsers ?? 0,
  ticketsByStatus,
  totalTickets,
  ticketsLast7d: ticketsLast7d ?? 0,
  runner,
  deploy,
  health: {
    db: dbRoundTripMs,
    appVersion: getAppVersion() ?? "dev",
  },
};
```

**Planner note:** Add `TicketSourceMetrics` here or in `tickets.service.ts`; dashboard can receive it through `fetchDashboardStats()`. Prefer an admin-guarded SQL RPC for cycle time if practical; otherwise document client-side bounded-query tradeoff.

---

### `src/hooks/useAdminDashboard.ts` (hook, request-response cache)

**Analog:** same file.

**Dashboard query pattern** (lines 13-20):
```typescript
export function useAdminDashboard() {
  return useQuery({
    queryKey: queryKeys.admin.dashboard(),
    queryFn: fetchDashboardStats,
    // The dashboard is a health surface — keep it reasonably fresh.
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
```

**Planner note:** If source metrics are part of `fetchDashboardStats()`, no new hook is needed for the Dashboard page. For Tickets page summary, either add a dedicated hook or reuse cached dashboard data only if the query key semantics stay clean.

---

### `src/pages/admin/DashboardSection.tsx` (component, aggregate UI)

**Analog:** same file.

**Dashboard load/error/skeleton pattern** (lines 520-546):
```tsx
export default function DashboardSection() {
  const { data: stats, isLoading, error } = useAdminDashboard();

  return (
    <div className="space-y-6">
      <NeedsYouCard />
      <RunnerOpsCard />

      {error ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Dashboard stats failed to load. Retrying in the background.
          </CardContent>
        </Card>
      ) : isLoading || !stats ? (
```

**Stat card pattern** (lines 492-499, 564-599):
```tsx
function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground tabular-nums">{value}</span>
    </div>
  );
}

<Card>
  <CardHeader className="pb-3">
    <CardTitle>
      <SectionHeading>Tickets</SectionHeading>
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-3">
```

**Planner note:** Add source metrics as another quiet stat area/card, not a new admin page. Use `ticketSourceLabel()` for labels and `tabular-nums` for numeric metrics.

---

### Tests

**Service test analog:** `src/services/__tests__/tickets.service.test.ts`

**Chainable Supabase mock pattern** (lines 25-45):
```typescript
type QueryResult = { data?: unknown; error: { message: string } | null; count?: number | null }

function createQueryMock(result: QueryResult) {
  const q: Record<string, ReturnType<typeof vi.fn>> & {
    then: (resolve: (v: QueryResult) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>
  } = {
    select: vi.fn(() => q),
    order: vi.fn(() => q),
    range: vi.fn(() => q),
    eq: vi.fn(() => q),
    in: vi.fn(() => q),
    update: vi.fn(() => q),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  } as never
  return q
}
```

**Source filter assertion pattern** (lines 99-108):
```typescript
await getTickets({ status: 'new', severity: 'all', source: 'sentry' })

expect(ticketsQuery.eq).toHaveBeenCalledWith('status', 'new')
expect(ticketsQuery.eq).toHaveBeenCalledWith('source', 'sentry')
expect(ticketsQuery.eq).not.toHaveBeenCalledWith('severity', expect.anything())
```

**Dashboard aggregate test analog:** `src/services/__tests__/admin-dashboard.service.test.ts`

**Table response queue pattern** (lines 50-60, 415-472):
```typescript
function mockTables(tables: Record<string, Array<Record<string, unknown>>>) {
  const builders = new Map<string, ReturnType<typeof makeBuilder>>();
  vi.mocked(supabase.from).mockImplementation(((table: string) => {
    if (!builders.has(table)) {
      builders.set(table, makeBuilder(tables[table] ?? [{ data: [], count: 0, error: null }]));
    }
    return builders.get(table);
  }) as never);
}

const stats = await fetchDashboardStats();
expect(stats.ticketsByStatus.new).toBe(2);
expect(stats.totalTickets).toBe(5);
expect(stats.ticketsLast7d).toBe(2);
```

## Shared Patterns

### Source Labels

**Source:** `src/lib/ticket-display.ts`
**Apply to:** `TicketsSection`, `TicketTable`, `DashboardSection`, any source summary UI.

Never render `manual`, `sentry`, `nightly_qa`, `internal`, or `unknown` directly. Use `ticketSourceLabel()` everywhere.

### Service + Hook Separation

**Source:** `src/services/tickets.service.ts`, `src/hooks/useTickets.ts`, `src/services/admin-dashboard.service.ts`, `src/hooks/useAdminDashboard.ts`
**Apply to:** all frontend source metrics/filtering work.

Services perform Supabase queries and transformations. Hooks wrap services with TanStack Query. Components consume hooks only.

### Auth and Trust Boundary

**Source:** `supabase/functions/send-support-ticket/index.ts`
**Apply to:** Edge Function intake and any source-specific ticket creation path.

Browser-submitted support tickets must not choose their own `source`. Trusted server/service-role paths stamp operational sources.

### System Ticket Audit

**Source:** `supabase/migrations/20260612130000_sentry_ticket_ingestion.sql`, `/Users/admin/dev/autopilot/src/lib/db.ts`
**Apply to:** internal/watchdog and nightly QA tickets.

System tickets may have `actor_id = NULL` in events and should preserve lifecycle/audit rows. For direct service-role inserts outside an RPC, add the same created event pattern unless the DB path already does so.

### Bounded Lists and Metrics

**Source:** `src/services/tickets.service.ts`, `src/services/admin-dashboard.service.ts`
**Apply to:** Admin Tickets source summaries and dashboard metrics.

Ticket list stays paginated. Metrics should not force the list query to become unbounded with message/event payloads. Use either a compact SQL aggregate/RPC or a narrowly selected bounded query.

## No Analog Found

None. Every expected Phase 18 file has a close in-repo or cross-repo analog.

## Metadata

**Analog search scope:** `/Users/admin/dev/brain/src`, `/Users/admin/dev/brain/supabase`, `/Users/admin/dev/autopilot/src`, `/Users/admin/dev/autopilot/qa`
**Files scanned:** CodeGraph index (1,288 files) plus targeted `rg` in `/Users/admin/dev/autopilot`
**Pattern extraction date:** 2026-06-13
