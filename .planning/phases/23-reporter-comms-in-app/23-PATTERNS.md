# Phase 23: Reporter Comms (In-App) - Pattern Map

**Mapped:** 2026-06-14
**Files analyzed:** 12 new/modified targets
**Analogs found:** 12 / 12
**Scope:** comms trigger hooks (`source = in_app_user` gate), default-deny content filter, `user_notifications` outbox reuse, in-app notification UI surfacing, and Autopilot verified-stable handoff.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/20260614xxxxxx_phase23_reporter_comms.sql` | migration/model | event-driven + CRUD | `supabase/migrations/20260611000002_create_ticket_tables.sql` + `20260612130000_sentry_ticket_ingestion.sql` + `20260131000004_create_notifications_table.sql` | exact |
| `supabase/functions/send-support-ticket/index.ts` | route/controller | request-response + CRUD | same file current intake path | exact |
| `supabase/functions/send-support-ticket/__tests__/source-stamping.test.ts` | test | static contract | same file current source-stamping test | exact |
| `src/types/supabase.ts` | generated type/config | transform | generated enum constants | exact |
| `src/lib/ticket-display.ts` | utility | transform | same file source/status/event humanizers | exact |
| `src/hooks/useNotifications.ts` | hook/provider | CRUD + polling | same file notification query/mutations | exact |
| `src/components/notifications/NotificationBell.tsx` | component | CRUD + request-response UI | `src/components/support/SupportPopover.tsx`, `src/components/ui/popover.tsx`, `src/components/ui/sidebar-nav.tsx` | role-match |
| `src/components/ui/sidebar-nav.tsx` or `src/components/layout/AppShell.tsx` | component/layout | UI composition | current `SupportPopover` mount in `SidebarNav`; AppShell sidebar layout | role-match |
| `src/components/settings/TicketDetailDialog.tsx` | component | request-response UI + guarded display | same file admin-only ticket detail gates | role-match |
| `/Users/admin/dev/autopilot/src/lib/reporter-comms.ts` | service/utility | transform + CRUD | `/Users/admin/dev/autopilot/src/lib/sentry-resolve.ts`, `approval.ts`, `db.ts` | role-match |
| `/Users/admin/dev/autopilot/src/lib/approval.ts` | service/controller | event-driven deploy verification | same file `verifyDeploySha` and post-merge status path | exact |
| `/Users/admin/dev/autopilot/src/lib/reporter-comms.test.ts` | test | unit + mock DB | `sentry-resolve.test.ts`, `approval.test.ts` | role-match |

## Pattern Assignments

### `supabase/migrations/20260614xxxxxx_phase23_reporter_comms.sql` (migration/model, event-driven + CRUD)

**Analogs:** ticket lifecycle trigger, Sentry notification fan-out, and `user_notifications` RLS.

**Existing outbox schema** (`supabase/migrations/20260131000004_create_notifications_table.sql:10-18`):
```sql
CREATE TABLE user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,  -- 'health_alert', 'system', 'info'
  title TEXT NOT NULL,
  body TEXT,
  metadata JSONB,  -- { contact_id, days_since_seen, contact_name, contact_email, etc. }
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Existing notification RLS** (`supabase/migrations/20260131000004_create_notifications_table.sql:31-43`):
```sql
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their notifications"
  ON user_notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their notifications"
  ON user_notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service can insert notifications"
  ON user_notifications FOR INSERT WITH CHECK (true);  -- Service role only
CREATE POLICY "Users can delete their notifications"
  ON user_notifications FOR DELETE USING (auth.uid() = user_id);
```

**Ticket lifecycle source and event model** (`supabase/migrations/20260611000002_create_ticket_tables.sql:42-53`, `76-83`):
```sql
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.ticket_type NOT NULL,
  severity public.ticket_severity NOT NULL DEFAULT 'medium',
  status public.ticket_status NOT NULL DEFAULT 'new',
  source public.ticket_source NOT NULL DEFAULT 'manual',
  fingerprint TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.ticket_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Status event trigger pattern to copy** (`supabase/migrations/20260611000002_create_ticket_tables.sql:180-195`):
```sql
CREATE OR REPLACE FUNCTION public.log_ticket_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.ticket_events (ticket_id, actor_id, event_type, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'status_change', OLD.status::text, NEW.status::text);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER ticket_status_audit
  AFTER UPDATE OF status ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.log_ticket_status_change();
```

**Notification insert pattern to copy, but change audience from ADMIN fan-out to exact reporter** (`supabase/migrations/20260612130000_sentry_ticket_ingestion.sql:89-106`):
```sql
IF p_severity IN ('critical', 'high') THEN
  INSERT INTO public.user_notifications (user_id, type, title, body, metadata)
  SELECT
    ur.user_id,
    'system',
    p_notify_title,
    p_notify_body,
    jsonb_build_object(
      'ticket_id', v_ticket_id,
      'source', 'sentry',
      'severity', p_severity::text
    )
  FROM public.user_roles ur
  WHERE ur.role = 'ADMIN';
END IF;
```

**Apply to Phase 23:**
- Add enum value `in_app_user` in a standalone enum migration before any use.
- Add a trigger/function such as `notify_in_app_reporter_from_event()` on `ticket_events`.
- Join `tickets` by `NEW.ticket_id`.
- Fail closed unless `ticket.source = 'in_app_user'` and `ticket.reporter_id IS NOT NULL`.
- Insert into `user_notifications` with `type = 'info'`, title/body from locked templates, and metadata `ticket_id`, `kind`, `source: "in_app_user"`.
- Use `WHERE NOT EXISTS` or a unique expression/index for idempotency by `(user_id, metadata->>'ticket_id', metadata->>'kind')`.
- Do not notify for `manual`, `sentry`, `nightly_qa`, `internal`, `unknown`, NULL, or ambiguous source.

### `supabase/functions/send-support-ticket/index.ts` (route/controller, request-response + CRUD)

**Analog:** current support intake.

**Imports/auth/CORS pattern** (`supabase/functions/send-support-ticket/index.ts:1-5`, `111-136`):
```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { escapeHtml } from '../_shared/html-escape.ts';

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const authResult = await authenticateRequest(req, supabase, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;
```

**Closed browser schema pattern: no client-supplied source** (`supabase/functions/send-support-ticket/index.ts:20-34`):
```typescript
const supportTicketSchema = z.object({
  message: z.string().trim().min(1).max(5000),
  type: z.enum(['bug', 'suggestion', 'question', 'task']).default('bug'),
  severity: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  replyEmail: z.string().trim().email().max(254).optional(),
  url: z.string().trim().max(2000).optional(),
  userAgent: z.string().trim().max(1000).optional(),
  userId: z.string().trim().max(128).optional(),
  organizationId: z.string().trim().max(128).optional(),
  workspaceId: z.string().trim().max(128).optional(),
  appVersion: z.string().trim().max(100).optional(),
  commit: z.string().trim().max(100).optional(),
  attachments: z.array(attachmentSchema).max(2).optional(),
});
```

**Insert boundary pattern to modify** (`supabase/functions/send-support-ticket/index.ts:186-196`):
```typescript
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

**Apply to Phase 23:**
- Keep `source` out of `supportTicketSchema`.
- Change only the server-authoritative stamp to `source: 'in_app_user'`.
- Leave DB-first/email-side-effect ordering intact.
- Do not backfill existing `manual` tickets.

### `supabase/functions/send-support-ticket/__tests__/source-stamping.test.ts` (test, static contract)

**Analog:** current static source trust-boundary test.

**Schema denial pattern** (`supabase/functions/send-support-ticket/__tests__/source-stamping.test.ts:31-39`):
```typescript
it('does not expose source in the browser request schema', () => {
  const source = readSource();
  const schemaBlock = extractObjectBlock(source, 'const supportTicketSchema = z.object');

  expect(schemaBlock).not.toMatch(/\bsource\s*:/);
  expect(schemaBlock).toContain('message:');
  expect(schemaBlock).toContain('severity:');
});
```

**Stamp assertion to update** (`supabase/functions/send-support-ticket/__tests__/source-stamping.test.ts:41-48`):
```typescript
it('stamps person-reported tickets as manual at the insert boundary', () => {
  const source = readSource();
  const insertBlock = extractObjectBlock(source, '.insert({');

  expect(insertBlock).toMatch(/\bsource:\s*['"]manual['"]/);
  expect(insertBlock).not.toMatch(/\bsource:\s*payload\.source\b/);
  expect(insertBlock).not.toMatch(/\bsource:\s*rawBody\.source\b/);
});
```

**Apply to Phase 23:**
- Rename assertion to `stamps in-app reported tickets as in_app_user at the insert boundary`.
- Expect `source: 'in_app_user'`.
- Keep the two negative assertions against `payload.source` and `rawBody.source`.
- Keep auth-before-body parse assertion (`lines 50-57`) unchanged.

### `src/types/supabase.ts` (generated type/config, transform)

**Analog:** generated enum and constants.

**Current enum gap** (`src/types/supabase.ts:5752-5755`, `5890-5895`):
```typescript
Enums: {
  app_role: "FREE" | "PRO" | "TEAM" | "ADMIN"
  ticket_severity: "critical" | "high" | "medium" | "low"
  ticket_source: "manual" | "sentry" | "unknown" | "nightly_qa" | "internal"
```

```typescript
export const Constants = {
  public: {
    Enums: {
      app_role: ["FREE", "PRO", "TEAM", "ADMIN"],
      ticket_severity: ["critical", "high", "medium", "low"],
      ticket_source: ["manual", "sentry", "unknown", "nightly_qa", "internal"],
```

**Apply to Phase 23:**
- Regenerate types after migration or update generated output with the same generated shape.
- Add `in_app_user` to both `Enums.public.ticket_source` union and `Constants.public.Enums.ticket_source`.
- Planner should treat direct hand-edit as acceptable only if local Supabase typegen is unavailable; verify with `npm run build`.

### `src/lib/ticket-display.ts` (utility, transform)

**Analog:** existing source/status/event humanizers.

**Status badge and source label pattern** (`src/lib/ticket-display.ts:17-27`, `106-129`):
```typescript
export const ticketStatusBadge: Record<TicketStatus, { variant: BadgeVariant; label: string }> = {
  new: { variant: "new", label: "New" },
  triaged: { variant: "info", label: "Triaged" },
  in_progress: { variant: "active", label: "In Progress" },
  awaiting_approval: { variant: "warning", label: "Awaiting Approval" },
  awaiting_user: { variant: "default", label: "Awaiting User" },
  resolved: { variant: "success", label: "Resolved" },
  rejected: { variant: "inactive", label: "Rejected" },
  escalated: { variant: "error", label: "Escalated" },
};
```

```typescript
const TICKET_SOURCE_LABELS = {
  manual: "Reported by a person",
  sentry: "Found by Sentry",
  nightly_qa: "Found by nightly QA",
  internal: "Internal watchdog",
  unknown: "Unknown source",
} as const satisfies Record<TicketSource, string>;

const LEGACY_TICKET_SOURCE_LABELS: Record<string, string> = {
  in_app_user: "Reported by a person",
};

export function ticketSourceLabel(source: string | null | undefined): string {
  if (!source) return "Unknown source";
  return TICKET_SOURCE_LABELS[source as TicketSource] ?? LEGACY_TICKET_SOURCE_LABELS[source] ?? "Unknown source";
}
```

**Admin/operator event language to avoid for reporter copy** (`src/lib/ticket-display.ts:164-190`):
```typescript
export function describeTicketEvent(event: {
  event_type: string;
  old_value?: string | null;
  new_value?: string | null;
}): string {
  switch (event.event_type) {
    case "created":
      return "Ticket opened";
    case "status_change":
      return `Status changed from ${humanizeStatus(event.old_value)} to ${humanizeStatus(event.new_value)}`;
    case "run_started":
      return "Autopilot started working on a fix";
```

**Apply to Phase 23:**
- Move `in_app_user` from legacy fallback into `TICKET_SOURCE_LABELS` after type update.
- Do not use `describeTicketEvent()` for reporter comm body text because it says "Autopilot".
- If adding reporter helpers, keep them separate, e.g. `reporterNotificationKindFromMetadata()` and `reporterStatusBadge`.
- For reporter escalated status, use `warning`, not current admin `error`, per `23-UI-SPEC.md`.

### `src/hooks/useNotifications.ts` (hook/provider, CRUD + polling)

**Analog:** existing outbox hook.

**Query pattern** (`src/hooks/useNotifications.ts:52-69`):
```typescript
const { data: notifications = [], isLoading, refetch } = useQuery({
  queryKey: queryKeys.notifications.list(),
  queryFn: async () => {
    const user = await requireUser();

    const { data, error } = await supabase
      .from("user_notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    return (data || []) as UserNotification[];
  },
  staleTime: 1000 * 60,
  refetchInterval: 1000 * 60 * 5,
});
```

**Optimistic mutation pattern** (`src/hooks/useNotifications.ts:83-124`):
```typescript
const markAsReadMutation = useMutation({
  mutationFn: async (notificationId: string) => {
    const { error } = await supabase
      .from("user_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId);

    if (error) throw error;
  },
  onMutate: async (notificationId) => {
    await queryClient.cancelQueries({ queryKey: queryKeys.notifications.list() });
    const previousNotifications = queryClient.getQueryData<UserNotification[]>(
      queryKeys.notifications.list()
    );
```

**Query key pattern** (`src/lib/query-config.ts:143-148`):
```typescript
notifications: {
  all: ['notifications'] as const,
  list: () => ['notifications', 'list'] as const,
  unread: () => ['notifications', 'unread'] as const,
},
```

**Apply to Phase 23:**
- Prefer reusing this hook unchanged for panel data/mutations.
- Add a typed metadata guard only if the component needs safe ticket actions:
  - `metadata.source === "in_app_user"`
  - `metadata.kind` in locked set
  - `typeof metadata.ticket_id === "string"`
- UI must not infer reporter-safe ticket links from missing or ambiguous metadata.

### `src/components/notifications/NotificationBell.tsx` (component, CRUD + request-response UI)

**Analogs:** `SupportPopover`, shadcn `Popover`, existing `Button`, `Badge`, `ScrollArea`, `Separator`.

**Popover composition pattern** (`src/components/support/SupportPopover.tsx:123-170`):
```tsx
<Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger asChild>
    <button
      type="button"
      className={cn(
        'relative flex items-center rounded-lg',
        'text-muted-foreground hover:bg-muted/70 transition-colors duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
      aria-label="Support"
    >
      <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-card border border-border" aria-hidden="true">
        <RiCustomerService2Line className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </div>
    </button>
  </PopoverTrigger>
  <PopoverContent align="start" side="right" className="w-72 p-2">
```

**Shared popover primitive** (`src/components/ui/popover.tsx:10-25`):
```tsx
const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out ...",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
```

**Icon-only button sizing** (`src/components/ui/button.tsx:96-101`):
```typescript
size: {
  default: "h-10 px-6 text-sm min-w-[120px]",
  sm: "h-9 px-5 text-sm min-w-[100px]",
  lg: "h-11 px-7 text-base min-w-[135px]",
  icon: "h-8 w-8 p-0 min-w-0 rounded-md [&_svg]:size-4",
},
```

**Scrollable panel primitives** (`src/components/ui/scroll-area.tsx:6-16`, `src/components/ui/separator.tsx:9-16`):
```tsx
const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root ref={ref} className={cn("relative overflow-hidden", className)} {...props}>
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
));
```

```tsx
const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn("shrink-0 bg-border", orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]", className)}
    {...props}
  />
));
```

**Apply to Phase 23:**
- Import Remix icon `RiNotification3Line` from `@remixicon/react`; do not use Lucide.
- Use `useNotifications()` directly in the component.
- Use `PopoverContent align="end"` if mounted in a page/top utility area; use `side="right"` if mounted in the sidebar rail.
- Render unread badge/dot only when `unreadCount > 0`; display `9+` above 9.
- On row click, call `markAsRead(notification.id)`.
- `View report` action must only render when metadata passes the explicit in-app reporter guard.
- Do not toast each reporter comm by default.

### `src/components/ui/sidebar-nav.tsx` or `src/components/layout/AppShell.tsx` (component/layout, UI composition)

**Analog:** current global support entry point.

**Where global utility currently mounts** (`src/components/ui/sidebar-nav.tsx:237-240`):
```tsx
{/* Bottom section — pinned to bottom */}
<div className="mt-auto flex flex-col gap-0.5 pt-2 px-2">
  <SupportPopover isCollapsed={isCollapsed} />
```

**AppShell desktop rail composition** (`src/components/layout/AppShell.tsx:308-349`):
```tsx
{!isMobile && (
<div ref={containerRef} className="h-full flex gap-2 overflow-hidden">
  {/* PANE 1: Navigation Rail (Sidebar) */}
  {showNavRail && (
    <nav
      role="navigation"
      aria-label="Main navigation"
      tabIndex={0}
      className={cn(
        "relative flex-shrink-0 bg-card rounded-2xl border border-border/60 shadow-sm",
        "flex flex-col py-2 h-full z-10",
        "transition-all duration-500 ease-in-out",
        isSidebarExpanded ? "w-[220px]" : "w-[72px] items-center"
      )}
    >
      <SidebarNav
        isCollapsed={!isSidebarExpanded}
        className="w-full flex-1 relative z-10"
        onSettingsClick={onSettingsClick}
      />
```

**Mobile nav overlay also uses `SidebarNav`** (`src/components/layout/AppShell.tsx:231-255`):
```tsx
{isMobile && showMobileNav && (
  <nav
    className={cn(
      "fixed top-0 left-0 bottom-0 w-[280px] bg-card rounded-r-2xl border-r border-border/60 shadow-lg z-50 flex flex-col py-2",
      "animate-in slide-in-from-left duration-300"
    )}
  >
    <SidebarNav
      isCollapsed={false}
      className="w-full flex-1"
      onSettingsClick={onSettingsClick}
    />
  </nav>
)}
```

**Apply to Phase 23:**
- The UI spec asks for top-bar utility mounting, but the current shell has a navigation rail and page headers, not a universal top bar. Closest current pattern is the global bottom utility area in `SidebarNav`.
- If planner insists on a top utility area, it must first identify or create a real shell-level header in `AppShell`; otherwise mount `NotificationBell` next to `SupportPopover` for all pages and mobile nav.
- Keep no-layout-shift sizing: fixed icon box, fixed unread badge area, no text expansion in collapsed mode.

### `src/components/settings/TicketDetailDialog.tsx` (component, guarded display)

**Analog:** existing role-gated ticket detail and admin evidence sections.

**Admin-only gate pattern** (`src/components/settings/TicketDetailDialog.tsx:176-190`, `219-227`):
```tsx
export function TicketDetailDialog({ open, onOpenChange, ticketId }: TicketDetailDialogProps) {
  const { data: detail, isLoading } = useTicketDetail(open ? ticketId : null);
  const updateStatus = useUpdateTicketStatus();
  const { isAdmin } = useUserRole();
  const approveTicket = useApproveTicket();
  const rejectTicket = useRejectTicket();
  const updateQueueControls = useUpdateTicketQueueControls();

  const ticket = detail?.ticket;
  const runTicketId = isAdmin && open ? (ticket?.id ?? ticketId) : null;
  const { data: runnerRuns = [] } = useRunnerRunsForTicket(runTicketId);
```

```tsx
// Admin-only surfaces. Reporter-facing rendering is byte-identical to 15-03
// because every block below gates on isAdmin (the same role the status
// Select already implicitly trusts — the server is the real control).
const hasAgentEvidence = (detail?.messages ?? []).some(
  (message) => message.author_type === "agent",
);
const hasRunEvidence = isAdmin && runnerRuns.length > 0;
const isAwaitingApproval = ticket?.status === "awaiting_approval";
const showApprovalBar = isAdmin && isAwaitingApproval;
```

**Admin controls and evidence pattern** (`src/components/settings/TicketDetailDialog.tsx:318-420`):
```tsx
{/* Admin queue controls: priority quick-set + URGENT toggle (14-04) */}
{isAdmin && (
  <div className="flex flex-wrap items-center gap-4">
    ...
  </div>
)}

{/* Admin approval bar — awaiting_approval tickets only (14-04, APPR-02) */}
{showApprovalBar && (
  <div className="rounded-lg border border-border bg-muted/30 p-3">
    ...
  </div>
)}

{(hasAgentEvidence || hasRunEvidence) && (
  <TicketEvidence
    messages={detail.messages}
    runnerRuns={hasRunEvidence ? runnerRuns : []}
    events={detail.events}
  />
)}
```

**Reporter-unsafe escalation copy to avoid** (`src/components/settings/TicketDetailDialog.tsx:443-463`):
```tsx
<span className="font-semibold">The autopilot got stuck and couldn't fix this on its own.</span>{" "}
You don't need to fix it yourself — hand it to a developer or an agent (just say
"work this ticket"). What it ran into: {escalationReason(message.body)}.
...
<summary className="cursor-pointer select-none text-xs text-muted-foreground">
  Technical details (for a developer)
</summary>
<pre className="mt-1 max-h-64 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap text-foreground">
  {stripAnsi(message.body)}
</pre>
```

**Apply to Phase 23:**
- Do not reuse admin messages/evidence for reporters.
- If `View report` opens this dialog for non-admin reporters, add a reporter mode:
  - read-only status badge
  - safe updates only from sanitized `user_notifications` or reporter-safe lifecycle labels
  - no raw `ticket_messages` with `author_type='agent'`
  - no runner runs, approval bar, priority, urgent, context fields, stack output, paths, SHAs.
- Keep RLS as the authority, but UI still must fail closed on source metadata.

### `/Users/admin/dev/autopilot/src/lib/reporter-comms.ts` (service/utility, transform + CRUD)

**Cross-repo boundary:** Brain and Autopilot share no code; integration is through Supabase only. Schema/RLS/RPCs live in Brain migrations; Autopilot helper writes through the service-role DB client.

**Ownership rule** (`docs/architecture/autopilot-brain-ownership.md:31-49`):
```markdown
| DB schema (tables, RLS, RPCs) | **brain** | `supabase/migrations/*` — single source of truth for both repos |
| The autonomous fix agent (claim→fix→gate→merge) | **autopilot** | `src/runner.ts` et al. |

## The seam: shared Supabase tables
- `tickets` — the work queue. Brain's UI + crawler create rows; autopilot claims/updates them.
- `runner_state` — singleton heartbeat + `kill_switch`. Brain's toggle flips it; autopilot reads it.
- `runner_runs` — per-run ledger (status, diff, test result, gate verdict, duration, cost). Autopilot writes; brain's AdminTab reads.
- `qa_runs` — nightly QA crawl summaries.
```

**Service-role DB client pattern** (`/Users/admin/dev/autopilot/src/lib/db.ts:71-88`):
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

**Direct notification insert pattern** (`/Users/admin/dev/autopilot/src/lib/sentry-resolve.ts:148-163`):
```typescript
const { error } = await input.db.from("user_notifications").insert({
  user_id: ADMIN_USER_ID,
  type: "health_alert",
  title: "Sentry fingerprint frozen",
  body: `${digest.summary}\n\n1. ${digest.decisions[0]!.label} (recommended)\n2. ${digest.decisions[1]!.label}`,
  metadata: {
    source: "autopilot-sentry-resolve",
    paged_at: (input.now ?? new Date()).toISOString(),
    ticket_id: input.ticketId,
    fingerprint: input.fingerprint,
    category: input.category,
    reason: input.reason,
    attempts,
  },
});
if (error) console.error(`[sentry-resolve] freeze page insert failed: ${error.message}`);
```

**Apply to Phase 23:**
- Create pure functions:
  - `sanitizeReporterSummary(raw: string): { ok: boolean; text: string; redactions: string[] }`
  - `notifyReporterResolvedIfInAppUser(db, { ticketId, rawSummary, mergedSha })`
- Helper must fetch `tickets.id, source, reporter_id` first and return without insert unless `source === "in_app_user"` and `reporter_id` is a string.
- Insert `type: "info"`, title `Your report was resolved`, sanitized/fallback body, metadata `{ source: "in_app_user", kind: "resolved", ticket_id, summary_redacted }`.
- Do not import Brain code into Autopilot.

### `/Users/admin/dev/autopilot/src/lib/approval.ts` (service/controller, event-driven deploy verification)

**Analog:** verified-stable deploy gate and post-merge status update.

**Verified deploy function** (`/Users/admin/dev/autopilot/src/lib/approval.ts:378-400`):
```typescript
export async function verifyDeploySha(
  expectedSha: string,
  fetchSha: () => string | null = fetchProdDeployedSha,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  maxWaitSec = 900,
  intervalSec = 30
): Promise<DeployShaResult> {
  const deadline = Date.now() + maxWaitSec * 1000;
  let observed: string | null = null;
  do {
    observed = fetchSha();
    if (observed && observed.startsWith(expectedSha.slice(0, 12))) {
      return { verified: true, observed, detail: `production bundle SHA matches pushed SHA ${expectedSha.slice(0, 12)}` };
    }
```

**Post-merge hook location** (`/Users/admin/dev/autopilot/src/lib/approval.ts:801-822`):
```typescript
// 4. Deploy-SHA verification → append to evidence; status → resolved.
appendFileSync(`${config.paths.logsDir}/approval-merges.log`, `${mergedAt.toISOString()} ${appr.ticketId} merged ${mergedSha}\n`);
const deploy = await verifyDeploySha(mergedSha);
const deployLine = deploy.verified
  ? `Deploy-SHA VERIFIED — production serving \`${mergedSha.slice(0, 12)}\` (${deploy.detail}).`
  : `Deploy-SHA UNVERIFIED — ${deploy.detail}. Merge/push succeeded; production may still be building.`;
await writeAgentMessage(
  db,
  appr.ticketId,
  `## Deploy\n\nMerged to main at \`${mergedSha}\` (ff-only) and pushed.\n\n${deployLine}`
);
await db.from("tickets").update({ status: "resolved" }).eq("id", appr.ticketId).select("id");
```

**Apply to Phase 23:**
- Call reporter comms helper only when `deploy.verified === true`.
- Call before or after status update is acceptable if helper does its own source/reporter fetch; prefer before status update if planner wants notification failure independent from DB status trigger.
- Do not use `status = resolved` alone as the verified-stable signal.
- Keep existing `writeAgentMessage` evidence unchanged; the customer comm must not reuse that raw deploy text.

### `/Users/admin/dev/autopilot/src/runner.ts` and `/Users/admin/dev/autopilot/src/lib/tier2.ts` (service/controller, escalation event-driven)

**Analogs:** escalation status and Tier-2 event/message.

**Runner escalation status update** (`/Users/admin/dev/autopilot/src/runner.ts:224-246`):
```typescript
async function escalate(
  db: DbLike,
  ticket: RunnerTicket,
  note: string,
  runId: string | null
): Promise<void> {
  const category = buildFixCategory(ticket);
  const trust = await evaluateCategoryTrust(db, {
    category,
    runId,
    ticketId: ticket.id,
  });
  const route = await enqueueTier2Escalation(db, {
    ticketId: ticket.id,
    runId,
    category,
    trust,
    note,
  });

  await writeEvent(db, ticket.id, "tier2_escalation_routed", null, route.action);
  await db.from("tickets").update({ status: "escalated" }).eq("id", ticket.id).select("id");
}
```

**Tier-2 internal digest event/message** (`/Users/admin/dev/autopilot/src/lib/tier2.ts:233-246`):
```typescript
await db.from("ticket_events").insert({
  ticket_id: input.ticketId,
  actor_id: null,
  event_type: route.action === "auto_fix" ? "tier2_auto_fix_queued" : "tier2_digest_queued",
  old_value: null,
  new_value: route.action,
});
await db.from("ticket_messages").insert({
  ticket_id: input.ticketId,
  author_type: "agent",
  author_id: null,
  body: renderTier2Digest(digest, route),
});
return route;
```

**Apply to Phase 23:**
- Prefer DB trigger on `status_change -> escalated` for reporter reassurance, because `runner.ts` already sets ticket status.
- Do not surface `renderTier2Digest()` body to reporters.
- If planner adds an Autopilot explicit helper for escalation, it must still fetch/gate `source === "in_app_user"` and use fixed safe body `We are taking a closer look and will keep tracking this for you.`

### `/Users/admin/dev/autopilot/src/lib/reporter-comms.test.ts` (test, unit + mock DB)

**Analogs:** mock DB notification tests.

**Notification insert count pattern** (`/Users/admin/dev/autopilot/src/lib/sentry-resolve.test.ts:263-294`):
```typescript
test("the fourth real attempt freezes one fingerprint and pages exactly once", async () => {
  const { db, calls } = makeMockDb(...);

  for (let i = 0; i < 5; i += 1) {
    await recordSentryFixAttemptAndMaybeFreeze({
      db,
      ticketId: TICKET,
      fingerprint: FINGERPRINT,
      category: CATEGORY,
      reason: "runner_attempt",
      now: NOW,
    });
  }

  const pages = calls.filter((call) => call.table === "user_notifications" && call.method === "insert");
  expect(pages).toHaveLength(1);
  const page = pages[0]!.args[0] as Record<string, unknown>;
  expect(page.type).toBe("health_alert");
  const metadata = page.metadata as Record<string, unknown>;
  expect(metadata.source).toBe("autopilot-sentry-resolve");
});
```

**Escalation notification assertion style** (`/Users/admin/dev/autopilot/src/lib/approval.test.ts:708-735`):
```typescript
test("retry cap exceeded escalates and pages without requeue cleanup", async () => {
  const { db, calls } = makeMockDb([
    { data: [{ attempts: 3 }], error: null },
    { data: [], error: null },
    { data: [{ id: TICKET }], error: null },
    { data: [], error: null },
  ]);
  ...
  expect(calls.some((c) => c.table === "user_notifications" && c.method === "insert")).toBeTrue();
});
```

**Apply to Phase 23:**
- Tests must prove:
  - no insert for `manual`, `sentry`, `nightly_qa`, `internal`, `unknown`, missing ticket, missing reporter.
  - insert for exact `source: "in_app_user"` and reporter id.
  - content filter falls back/redacts on file paths, SHAs, stack traces, `agent`, `Autopilot`, `Codex`, `Claude`, `LLM`, `prompt`, `token`, backticks/code fences.
  - verified deploy hook does not call reporter helper when `deploy.verified === false`.

## Shared Patterns

### Source Gate: Fail Closed

**Source:** Phase 23 locked decision + ticket source enum.

**Apply to:** SQL trigger/function, Autopilot reporter helper, UI ticket action guard.

Pattern:
```text
IF source != 'in_app_user' OR reporter_id IS NULL:
  return without notification
```

Do not treat `manual` as in-app. Current generated enum lacks `in_app_user`; add it before using it.

### Outbox Reuse

**Source:** `user_notifications` table/hook.

**Apply to:** all in-app customer comms.

Use:
```sql
INSERT INTO public.user_notifications (user_id, type, title, body, metadata)
VALUES (..., 'info', ..., ..., jsonb_build_object('ticket_id', ..., 'kind', ..., 'source', 'in_app_user'));
```

Avoid:
- new table
- new vendor
- email blasts
- `ticket_messages` as customer comms

### Default-Deny Customer Copy

**Source:** Phase 23 D-02 and existing `stripAnsi` terminal-output cleanup.

**Existing cleanup analog** (`src/lib/ticket-display.ts:52-57`):
```typescript
/** Strip ANSI escape codes (terminal colors) so captured output reads clean. */
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]/g;
export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, "");
}
```

Phase 23 must go stricter:
- Reject or redact file paths, SHAs, stack traces, code fences, backticks.
- Reject or redact `agent`, `Autopilot`, `Codex`, `Claude`, `LLM`, `model`, `prompt`, `token`, `runner`, `worktree`, `branch`, `diff`, `push-gate`, `Sentry`, `stack`, `trace`, `deploy SHA`.
- If any internal content is detected, use fixed fallback: `This has been fixed and verified in the live app. Thanks for reporting it.`

### Frontend Service + Hook Separation

**Source:** `src/CLAUDE.md` and existing tickets/notifications.

**Apply to:** any new ticket/notification data access.

Follow:
- services = pure async Supabase functions (`src/services/*.service.ts`)
- hooks = TanStack wrappers (`src/hooks/use*.ts`)
- components consume hooks, not raw Supabase, unless extending current `useNotifications` component behavior only.

### Reporter UI Safety

**Source:** `23-UI-SPEC.md`, `TicketDetailDialog` admin gates.

Apply:
- `RiNotification3Line` from Remix Icons.
- shadcn/Radix Popover, ScrollArea, Separator, Badge/Button primitives.
- unread state uses text/badge and dot, not color alone.
- no reporter-facing use of raw `ticket_messages`, `TicketEvidence`, runner logs, approval controls, priority/urgent controls, paths, SHAs, or internal agent/Autopilot language.

## Anti-Patterns

- Do not send notifications for `manual` tickets.
- Do not let browser payload set `source`.
- Do not infer reporter safety from `reporter_id` alone; source must be exact `in_app_user`.
- Do not use `tickets.status = 'resolved'` alone for resolution summary; only `verifyDeploySha(...).verified === true`.
- Do not leak Autopilot deploy evidence into customer text.
- Do not add Lucide, FontAwesome, `framer-motion`, pnpm, bun, yarn, or new comms packages.
- Do not import Brain modules into Autopilot; coordinate through Supabase schema and rows only.

## PATTERN MAPPING COMPLETE
