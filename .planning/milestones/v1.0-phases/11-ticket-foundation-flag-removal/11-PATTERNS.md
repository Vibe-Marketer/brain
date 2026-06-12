# Phase 11: Ticket Foundation + Flag Removal - Pattern Map

**Mapped:** 2026-06-10
**Files analyzed:** 14 new/modified files
**Analogs found:** 13 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/{ts}_drop_feature_flags.sql` | migration | DDL | `supabase/migrations/20260610013718_drop_obsidian_token_type.sql` (drop-style) | role-match |
| `supabase/migrations/{ts}_create_ticket_tables.sql` | migration | DDL | `supabase/migrations/20260302000000_feature_flags.sql` + consolidated-schema RLS idiom + `20260528070300_codify_ai_processing_jobs_updated_at.sql` (trigger) | exact |
| `supabase/functions/send-support-ticket/index.ts` (pivot) | edge function | request-response | itself (modify in place) | exact |
| `src/services/tickets.service.ts` | service | CRUD | `src/services/personal-tags.service.ts` | exact |
| `src/hooks/useTickets.ts` | hook | CRUD via TanStack Query | `src/hooks/usePersonalTags.ts` | exact |
| `src/components/settings/TicketTable.tsx` | component | request-response (render) | `src/components/settings/UserTable.tsx` | exact |
| `src/components/settings/TicketDetailDialog.tsx` | component (dialog) | request-response | `src/components/support/SupportTicketDialog.tsx` (dialog shell) | role-match |
| `src/components/settings/NewTicketDialog.tsx` | component (dialog/form) | request-response | `src/components/support/SupportTicketDialog.tsx` | exact |
| `src/components/settings/AdminTab.tsx` (modify) | component | CRUD | itself — section idiom at lines 254-456 | exact |
| `src/components/Layout.tsx` (modify) | component | — | itself — gate at lines 24, 37, 173 | exact |
| `src/components/ui/sidebar-nav.tsx` (modify) | component | — | itself — gate at lines 35, 124, 127-131 | exact |
| `src/hooks/useFeatureFlags.ts` | hook | — | DELETE (no replacement) | n/a |
| `src/test/rls-regression.test.ts` (modify) | test | integration | itself — CROSS_ORG_TABLES at lines 39-69 | exact |
| `src/types/supabase.ts` (regen/extend) | types | — | itself | exact |

## Pattern Assignments

### `{ts}_create_ticket_tables.sql` (migration, DDL)

**Analog:** `supabase/migrations/20260302000000_feature_flags.sql` (table + RLS), `supabase/migrations/00000000000000_consolidated_schema.sql:319-334, 516` (admin policy), `supabase/migrations/20260528070300_codify_ai_processing_jobs_updated_at.sql` (trigger pair)

**Admin policy pattern** (consolidated_schema.sql:516):
```sql
USING (public.has_role(auth.uid(), 'ADMIN'));
```

**SECURITY DEFINER function pattern** (consolidated_schema.sql:319-331):
```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
```

**Trigger pair pattern** (codify_ai_processing_jobs_updated_at.sql:12-28):
```sql
CREATE OR REPLACE FUNCTION public.update_ai_processing_jobs_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS ai_processing_jobs_updated_at ON public.ai_processing_jobs;
CREATE TRIGGER ai_processing_jobs_updated_at
  BEFORE UPDATE ON public.ai_processing_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_ai_processing_jobs_updated_at();
```
(For the status-audit trigger add `SECURITY DEFINER SET search_path = public` — see RESEARCH.md Pattern 2.)

**File structure:** sectioned header comments (TABLE / INDEXES / RLS / POLICIES / COMMENTS) per supabase/CLAUDE.md migration template.

### `{ts}_drop_feature_flags.sql` (migration, DDL)

**Pattern:** new migration with `DROP TABLE IF EXISTS public.feature_flags;` — never edit historical migrations (`20260302000000`, `20260310160001` stay untouched). Header comment cites FLAG-01.

### `src/services/tickets.service.ts` (service, CRUD)

**Analog:** `src/services/personal-tags.service.ts`

**Imports + fetch pattern** (lines 1-27):
```typescript
import { supabase } from '@/integrations/supabase/client'

export async function getPersonalTags(organizationId: string): Promise<PersonalTag[]> {
  const { data, error } = await untypedFrom(supabase, 'personal_tags')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true })
  if (error) throw new Error(`Failed to fetch personal tags: ${error.message}`)
  return data as PersonalTag[]
}
```
Notes: after types regen, `supabase.from('tickets')` is typed directly — `untypedFrom` only needed if hand-extension lags. Error style: `throw new Error('Failed to … : ' + error.message)`. Tickets list query: `.select('*')` ordered `created_at desc`; detail query joins `ticket_messages` + `ticket_events` (two queries or `select` with embedded resources). Status update: `.update({ status }).eq('id', ticketId)` — admin JWT, RLS enforces.

**Submit pattern** (intake goes through the Edge Function, not direct insert): copy `src/services/support-ticket.service.ts:31-55` —
```typescript
const { error } = await supabase.functions.invoke('send-support-ticket', { body: payload });
if (error) throw error;
```
and its context capture (lines 23-29, 33-47): `window.location.href`, `navigator.userAgent`, `VITE_APP_VERSION`, `VITE_COMMIT_SHA`.

### `src/hooks/useTickets.ts` (hook, TanStack Query)

**Analog:** `src/hooks/usePersonalTags.ts`

**Query pattern** (lines 14-21):
```typescript
export function usePersonalTags(organizationId: string | null) {
  const { session } = useAuth()
  return useQuery<PersonalTag[]>({
    queryKey: ['personal_tags', organizationId],
    queryFn: () => getPersonalTags(organizationId!),
    enabled: !!session && !!organizationId,
  })
}
```

**Mutation pattern** (lines 32-43):
```typescript
export function useAssignTagToRecording() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ recordingId, tagId }) => assignTagToRecording(recordingId, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal_tag_assignments'] })
      toast.success('Tag assigned')
    },
    onError: (error: Error) => toast.error(error.message)
  })
}
```
Apply: `useTickets(filters)`, `useTicketDetail(ticketId)`, `useCreateTicket()`, `useUpdateTicketStatus()` (invalidate `['tickets']` + `['ticket', id]`; toasts per UI-SPEC copy).

### `src/components/settings/TicketTable.tsx` (component, table render)

**Analog:** `src/components/settings/UserTable.tsx`

**Structure** (lines 1-80+): `React.memo` component; imports `Table/TableBody/TableCell/TableHead/TableHeader/TableRow` from `@/components/ui/table`, Remix icons, `useTableSort` hook with `SortButton` helper; `Badge`/`StatusBadge` for status cells; `formatDate` local helper. Copy the `SortButton` pattern verbatim (UserTable.tsx:77-80+). Status/severity badges per UI-SPEC mapping (StatusBadge variants).

### `src/components/settings/NewTicketDialog.tsx` + `TicketDetailDialog.tsx` (dialogs)

**Analog:** `src/components/support/SupportTicketDialog.tsx`

**Dialog shell pattern** (lines 64-111): controlled `open`/`onOpenChange` props, `DialogContent` (`sm:max-w-lg` form / `sm:max-w-2xl` detail per UI-SPEC), `DialogHeader/Title/Description`, form with `space-y-4`, labeled fields, `DialogFooter` submit disabled while `isSubmitting`, `toast.success/error` on result, `resetForm()` on success.

### `src/components/settings/AdminTab.tsx` (modify)

**Analog:** itself.
- **Section idiom to copy** (lines 259-268, 378-387): heading block (`<h2 className="font-semibold text-foreground">` + `<p className="mt-1 text-sm text-muted-foreground">`) + `space-y-4` content + `<Separator className="my-16" />` between sections.
- **Filter row idiom** (lines 390-419): `Label` + `Select` at `sm:w-40`, `SelectItem value="all"` first.
- **Empty/loading idiom** (lines 226-252, 423-429): centered `RiLoader2Line` spinner `py-12`; dashed-border empty container.
- **DELETE:** FeatureFlag interface (50-57), flag state (77-79), `loadFeatureFlags` (162-174), `handleToggleFlag` (206-224), Feature Flags JSX section (331-374), `Switch` import if unused.
- **Do NOT copy** the inline-supabase data loading style — new Tickets section uses services/hooks.

### `src/components/Layout.tsx` + `src/components/ui/sidebar-nav.tsx` (modify)

Gate removal sites (grep-verified): `Layout.tsx:24` (import), `:37` (hook call), `:173` (`{isFeatureEnabled('debug_panel') && <DebugPanel />}` → `<DebugPanel />`); `sidebar-nav.tsx:35` (import), `:124` (hook call), `:127-131` (`import`/`rules` visibility callbacks → always `true`, remove `isFeatureEnabled` from the `useMemo`/`useCallback` deps). Companion tests: `src/components/__tests__/Layout.test.tsx`, `src/components/ui/__tests__/sidebar-nav.test.tsx` mock `useFeatureFlags` — strip mocks and flag-dependent assertions.

### `src/test/rls-regression.test.ts` (modify)

**Pattern** (lines 39-69): `CROSS_ORG_TABLES` ReadonlyArray with `filterColumn` string-literal union — extend union with `"reporter_id"` and `"ticket_id"`, append:
```typescript
{ table: "tickets", filterColumn: "reporter_id" },
{ table: "ticket_messages", filterColumn: "ticket_id" },
{ table: "ticket_events", filterColumn: "ticket_id" },
```
Seed one ticket per org user in `beforeAll` (service-role admin client), capture ids; follow the existing fixture + try/catch-per-step `afterAll` cleanup contract (supabase/CLAUDE.md).

### `supabase/functions/send-support-ticket/index.ts` (pivot in place)

**Keep:** `getCorsHeaders`/OPTIONS preflight (lines 75-81), `authenticateRequest` (lines 95-97), `supportTicketSchema` zod validation (lines 11-21, extend with optional `type`/`severity`), `escapeHtml` email builders (lines 23-72).
**Add:** service-role client (`SUPABASE_SERVICE_ROLE_KEY` per supabase/CLAUDE.md template step 2); INSERT tickets (reporter_id = authenticated userId — never body) + first ticket_messages row + `created` ticket_events row; wrap Resend `fetch` in its own try/catch so email failure logs but returns success; response `{ success: true, ticketId }`.

## Shared Patterns

### Admin gating (frontend)
**Source:** `src/hooks/useUserRole.ts` via `AdminTab.tsx:60, 234-244`
**Apply to:** Tickets section (already inside AdminTab's `isAdmin` gate — no extra gate needed)

### Toasts
**Source:** `sonner` — `toast.success()/toast.error()` (AdminTab, SupportTicketDialog, usePersonalTags)
**Apply to:** all ticket mutations; copy strings from 11-UI-SPEC.md Copywriting Contract.

### Error handling (services)
**Source:** `personal-tags.service.ts` — throw `new Error('Failed to X: ' + error.message)`; hooks surface via `onError: (e) => toast.error(e.message)`.

### Icons
Remix only: `RiLoader2Line` (loading), `RiAddLine` (New Ticket CTA), `RiTicketLine`/`RiCustomerService2Line` (empty state), `RiSearchLine` if search added later.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| status-audit DB trigger (SECURITY DEFINER INSERT into second table) | migration trigger | event-driven | existing triggers are touch-only; use RESEARCH.md Pattern 2 (synthesized from codify idiom + has_role SECURITY DEFINER idiom) |

## Metadata

**Analog search scope:** `src/services/`, `src/hooks/`, `src/components/settings/`, `src/components/support/`, `src/components/ui/`, `src/test/`, `supabase/migrations/`, `supabase/functions/`
**Files scanned:** ~25
**Pattern extraction date:** 2026-06-10
