# Phase 38: Access Policy, Share-Link Key Migration, Request Flow - Pattern Map

**Mapped:** 2026-09-19
**Files analyzed:** 24 likely new or modified files
**Analogs found:** 24 / 24

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/*_phase38_access_policy_schema.sql` | migration/model | CRUD, event-driven trigger | `20260908130000_create_organization_domains_and_aliases.sql` | role-match |
| `supabase/migrations/*_phase38_access_policy_rls_rpcs.sql` | migration/middleware | request-response, transactional CRUD | `20260908130001_create_org_identity_self_serve_rpcs.sql` | exact |
| `supabase/migrations/*_phase38_share_link_uuid_bridge.sql` | migration | batch transform, dual-read CRUD | `20260210235500_shared_links_and_vault_invite_rpc.sql` | role-match |
| `supabase/migrations/*_phase38_copy_event_preservation.sql` | migration | transactional copy | `20260730160000_fix_cross_org_copy_dedup.sql` | exact |
| `src/types/supabase.ts` | generated model | schema projection | current generated file | exact |
| `src/test/rls-regression.test.ts` | integration test | real-DB CRUD | same file's cross-org and deny registries | exact |
| `src/test/access-policy.integration.test.ts` | integration test | real-DB request-response | `src/services/__tests__/data-movement.dedup.integration.test.ts` | role-match |
| `supabase/functions/share-call/__tests__/share-call.integration.test.ts` | integration test | HTTP request-response | same file's response matrix | exact |
| `src/services/__tests__/data-movement.dedup.integration.test.ts` | integration test | real-DB transactional copy | same file | exact |
| `supabase/functions/recording-access/index.ts` | controller | authenticated request-response, email | `request-email-alias-verification/index.ts` | role-match |
| `supabase/functions/share-call/index.ts` | controller | public/auth request-response | current handler | exact |
| `supabase/functions/mcp-server/tools/write/create_share_link.ts` | controller/tool | request-response CRUD | current tool | exact |
| `supabase/functions/mcp-server/tools/read/list_shared_calls.ts` | controller/tool | request-response query/transform | current tool | exact |
| `supabase/functions/mcp-server/tools/write/revoke_share_link.ts` | controller/tool | request-response CRUD | current tool | exact |
| `src/services/access-policy.service.ts` | service | typed RPC CRUD | `src/services/data-movement.service.ts` | role-match |
| `src/services/recording-access.service.ts` | service | typed RPC CRUD | `src/services/data-movement.service.ts` | role-match |
| `src/services/sharing.service.ts` | service | UUID-safe CRUD | behavior currently embedded in `src/hooks/useSharing.ts` | role-match |
| `src/hooks/useAccessPolicy.ts` | hook | query/mutation cache | `src/hooks/useNotifications.ts` | role-match |
| `src/hooks/useRecordingAccess.ts` | hook | query/mutation cache | `src/hooks/useNotifications.ts` | role-match |
| `src/hooks/useSharing.ts` | hook | query/mutation cache | current hook after extracting data access | exact |
| `src/components/settings/PrivacyAccessSettings.tsx` | component | request-response settings UI | `SettingsDetailPane.tsx` + nearby settings tabs | role-match |
| `src/components/sharing/RecordingAccessPanel.tsx` | component | interactive CRUD panel | `NotificationBell.tsx` popover | role-match |
| `src/components/call-detail/OtherRecordingCopies.tsx` | component | query + event-driven action | neutral rows in `NotificationBell.tsx` | role-match |
| `src/components/call-detail/CallDetailHeader.tsx` and `src/components/CallDetailDialog.tsx` | component | UI composition | existing Share action and dialog composition | exact |
| `src/components/notifications/NotificationBell.tsx` | component | event-driven navigation | reporter metadata discrimination in same file | exact |
| `src/components/panes/SettingsCategoryPane.tsx`, `SettingsDetailPane.tsx`, `src/pages/Settings.tsx` | component/route | navigation | current category/detail wiring | exact |
| `src/lib/query-config.ts` | config | cache key factory | existing domain query-key factories | exact |
| `src/types/sharing.ts` plus new access types | model | transform | current sharing types | role-match |

## Pattern Assignments

### Phase 38 migrations (migration/model/middleware)

**Primary analogs:** `supabase/migrations/20260908130001_create_org_identity_self_serve_rpcs.sql`, `supabase/migrations/20260730160000_fix_cross_org_copy_dedup.sql`

**Security-definer RPC pattern** (`20260908130001_create_org_identity_self_serve_rpcs.sql`, lines 36-50, 75-93):

```sql
CREATE OR REPLACE FUNCTION public.claim_organization_domain(
  p_organization_id UUID,
  p_domain TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_organization_admin_or_owner(p_organization_id, auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN');
  END IF;
  -- mutation guarded by server-derived caller identity
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_organization_domain(UUID, TEXT) TO authenticated;
```

Apply this to policy update/reset and lifecycle RPCs, with three stricter details from Phase 38 research: schema-qualify all objects, use `SET search_path = ''`, and explicitly `REVOKE EXECUTE ... FROM PUBLIC, anon` before granting `authenticated`. Never accept a caller user ID when `auth.uid()` supplies it. Return stable `{success, code}` variants rather than raw constraint errors.

**Latest copy/routing body pattern** (`20260730160000_fix_cross_org_copy_dedup.sql`, lines 443-529):

```sql
CREATE OR REPLACE FUNCTION public.route_recording_cross_org(...)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '60s'
AS $$
DECLARE
  v_source RECORD;
BEGIN
  SELECT * INTO v_source FROM recordings WHERE id = p_recording_id;
  -- membership guards and dedup remain intact
  INSERT INTO recordings (
    organization_id, owner_user_id, title, ...
  ) VALUES (
    p_target_org_id, p_user_id, v_source.title, ...
  );
END;
$$;
```

Copy the latest definitions for all three signatures from this migration and make the smallest change: add `event_id` to every target INSERT and `v_source.event_id` to its values. Preserve membership checks, dedup, workspace linking, timeouts, grants, and delete behavior.

**Schema/RLS shape:** use UUID primary keys with `gen_random_uuid()`, snake_case columns, FK delete actions, indexes for every lookup/state transition, RLS enabled immediately, comments on tables/functions, and constrained status/access values. Lifecycle clients do not directly insert/update rows; RPCs lock the request row and atomically write request/grant/audit/notification state. Audit rows are append-only. Discovery RPCs return a purpose-built minimal row containing only ordinal, opaque request target, and request state.

**Share UUID bridge:** follow expand/backfill/dual-read. Add nullable `recording_id UUID REFERENCES recordings(id)`, backfill only unambiguous owner-scoped mappings, assert ambiguity/unresolved counts, require at least one key, preserve `call_recording_id`, tokens, logs, status, and timestamps. Do not recreate link rows or drop the BIGINT column in this phase.

---

### Access and sharing services (service, typed RPC CRUD)

**Analog:** `src/services/data-movement.service.ts`

**Imports and RPC pattern** (lines 1-2, 99-109):

```ts
import { supabase } from '@/integrations/supabase/client'
import { untypedRpc } from '@/types/db-extensions'

const { error } = await untypedRpc(supabase, 'copy_recording_to_org', {
  p_recording_id: recordingIds[i],
  p_target_org_id: targetOrgId,
  p_target_workspace_id: workspace.id,
  p_delete_original: removeSource,
})
if (error) throw new Error(`Failed to copy recording: ${error.message}`)
```

New services should export pure async functions and typed input/result interfaces. They may call tables, RPCs, or Edge Functions and throw contextual errors. They must not import React, TanStack Query, toasts, or component state. Use UUIDs as the public recording identity; only use `toRecordingUuid()`/`toRecordingUuidBatch()` at a real legacy boundary.

`sharing.service.ts` takes over the Supabase work currently inside `useSharing.ts`. The current hook's lines 59-62 (`parseInt`) and lines 70-75/104-115 (`call_recording_id` reads/writes) are migration targets, not patterns to copy.

---

### Access and sharing hooks (hook, query/mutation cache)

**Analog:** `src/hooks/useNotifications.ts`

Use the same `useQuery`/`useMutation`/`useQueryClient` structure, query-key factories, optimistic cache lifecycle, `sonner` feedback, and logger error handling. The established delete lifecycle is: cancel the domain query, snapshot cached data, update optimistically, return the snapshot, restore it in `onError`, then invalidate in `onSettled` (`useNotifications.ts`, lines 193-222).

Phase 38 hooks must call the new services only. For policy changes and access lifecycle mutations, invalidate the access keys and call `invalidateCallListCaches(queryClient)` in `onSettled` where visible call-list state can change. Keep query keys UUID based and stable. Public confirmation belongs in the component before mutation, not inside the hook.

---

### Settings category and Privacy & Access settings (component/navigation)

**Analogs:** `src/components/panes/SettingsCategoryPane.tsx`, `src/components/panes/SettingsDetailPane.tsx`

**Category registration** (`SettingsCategoryPane.tsx`, lines 32-87): extend the `SettingsCategory` union and `SETTINGS_CATEGORIES` array with one entry, a Remix icon, the approved label, and no role restriction. The existing list renders it through `SelectionButton`, including keyboard handling and `aria-current` (lines 224-257).

**Detail-pane registration** (`SettingsDetailPane.tsx`, lines 43-94, 212-235):

```tsx
const AccountTab = React.lazy(() => import("@/components/settings/AccountTab"));

const CATEGORY_META: Record<SettingsCategory, { label: string; description: string; icon: ... }> = {
  account: { label: "Account", description: "Profile and preferences", icon: RiUserLine },
};

switch (category) {
  case "account":
    return <AccountTab />;
}
```

Register `PrivacyAccessSettings` in both places so the exhaustive record remains type safe. Reuse the pane's lazy loading, `Suspense` skeleton, `ErrorBoundary`, `PageHeader`, and `ScrollArea`. The settings component uses existing `RadioGroup`, `Label`, and `AlertDialog`; selecting Public opens confirmation before mutation.

---

### Recording access panel and call-detail integration (component, interactive CRUD)

**Analog:** `src/components/call-detail/CallDetailHeader.tsx`

The existing Share entry establishes placement and style (lines 193-200):

```tsx
<Button variant="hollow" size="sm" onClick={() => setShareDialogOpen(true)}>
  <RiShareLine className="h-4 w-4 mr-2" />
  SHARE
</Button>
```

Add the Access button beside Share using the same variant/size and Remix icons. Follow the current composition pattern: parent owns open state, then mounts a dedicated surface below the header (`CallDetailHeader.tsx`, lines 241-253). Show the control only to the recording owner.

For desktop, `NotificationBell.tsx` lines 153-249 are the closest Popover/ScrollArea pattern. Mobile uses the existing Dialog wrapper. Keep dismiss/revoke controls separate from row navigation, as the notification row does at lines 71-132. Use semantic tokens, visible text badges, focus rings, `aria-live="polite"`, and explicit icon-only labels. The panel must always render the exact copy-only notice from the UI spec.

---

### Anonymous other-copy discovery (component, privacy-minimized query/action)

**Analog:** the neutral bordered row and accessible action composition in `NotificationBell.tsx`, lines 71-132.

Render only the RPC's minimal projection. A row label is `Recording N`; the visible action is `Request access`, with an accessible label such as `Request access to recording 1`. Do not fetch or accept owner, provider, title, transcript, summary, or raw evidence in this component's type. Pending, granted, denied, and cooldown are visible text states. The server must enforce confirmed participation and `confirmed_count < 50`; React must not filter protected recordings.

---

### Notifications and deep-link review (component, event-driven navigation)

**Analog:** `src/components/notifications/NotificationBell.tsx`

**Metadata type guard** (lines 28-37):

```ts
export function isReporterTicketMetadata(metadata: unknown): metadata is ReporterTicketMetadata {
  if (!metadata || typeof metadata !== 'object') return false;
  const candidate = metadata as Record<string, unknown>;
  return candidate.source === 'in_app_user' && typeof candidate.ticket_id === 'string';
}
```

Add a separate access-request metadata guard keyed by a stable source/kind and UUID identifiers. Extend row navigation at lines 80-83 and 228-243 to route to the canonical call deep link with request state. Keep mark-read and dismiss independent. The owner review may display requester identity/evidence only after the owner-authorized query succeeds; requester result notifications contain no denial reason.

---

### Recording-access email Edge Function (controller, authenticated email delivery)

**Analog:** `supabase/functions/request-email-alias-verification/index.ts`

**Imports and validation** (lines 34-43, 106-108):

```ts
import { z } from 'https://esm.sh/zod@3.23.8';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { escapeHtml } from '../_shared/html-escape.ts';

const requestSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });
```

Use `authenticateRequest`, Zod, shared CORS, service-role reads, escaped HTML, and Resend HTTP delivery. Load owner address, meeting title/date, requester details, and evidence server-side from the request ID; accept none of those trusted values from the browser. Use an outbox/idempotency key so a retry cannot duplicate email. Persist request/notification first; email failure must not roll back access state. Follow the Resend request/error response at lines 281-317, but do not expose provider details or PII in logs.

---

### Share-call and MCP compatibility (controller/tool, dual-read request-response)

**Analogs:** current `share-call/index.ts`, `create_share_link.ts`, `list_shared_calls.ts`

Preserve share-call's `authenticateRequest` owner path (`share-call/index.ts`, lines 451-476), response codes, recipient checks, public safe-subset response, revoke semantics, and token identity. Replace canonical-recording lookup with UUID first and legacy `fathom_provider_id` fallback (current legacy lookup is lines 478-483).

MCP tools keep `ToolModule`, `mcpError`, and markdown `mcpOk` output. `create_share_link.ts` lines 8-16 validate input and call the shared access verifier; retain that structure, but write `recording_id` directly and stop rejecting non-Fathom recordings. `list_shared_calls.ts` lines 20-60 show the legacy batch lookup; change its selected shape/map to UUID first with fallback for legacy-only rows. Never return structured JSON from MCP tools.

---

### Real-database verification (integration test)

**Primary analogs:** `src/test/rls-regression.test.ts`, `src/services/__tests__/data-movement.dedup.integration.test.ts`, `share-call.integration.test.ts`

**Safety setup** (`rls-regression.test.ts`, lines 18-31):

```ts
import { integrationDbReachable, makeIntegrationClient } from "@/test/integration-setup";
const TEST_URL = process.env.VITE_SUPABASE_TEST_URL || "";
const TEST_ANON_KEY = process.env.VITE_SUPABASE_TEST_ANON_KEY || "";
describe.skipIf(!integrationDbReachable)(SUITE_TAG, () => { ... });
```

Use only dedicated test variables. Do not copy `share-call.integration.test.ts` lines 42-46 or 174-177 because they still contain production-named fallbacks; Phase 38 validation explicitly requires removing them.

Use service role only for fixture setup/inspection and signed-in anon clients for RLS/RPC behavior. The data-movement integration test documents why real JWTs are necessary (lines 12-18) and demonstrates create-user/authenticated-RPC fixtures (lines 51-100, 219-293). Create isolated timestamped fixtures, clean each resource in independent `try/catch` blocks, and finish with `cleanup_test_fixture_users` (lines 210-216).

Extend `CROSS_ORG_TABLES` for user-readable access tables and `CLIENT_DENY_TABLES` for service-only/outbox/audit tables (`rls-regression.test.ts`, lines 33-121). Add bespoke tests for owner/requester visibility, direct insert denial, event/content separation, 49/50 cutoff, denial cooldown, retry idempotency, old-token/new-UUID link behavior, team/coach continuity, and all three event-preserving copy RPCs.

## Shared Patterns

### Authentication and authorization

- SQL uses `auth.uid()` and ownership/evidence derived inside the transaction.
- Edge Functions use `authenticateRequest(req, supabase, corsHeaders)`.
- Services never treat client-supplied owner/requester identity as authority.
- Event discovery and recording content authorization remain separate predicates.

### Error handling

- RPCs return stable codes for expected outcomes and catch uniqueness races.
- Services throw contextual `Error` values.
- Hooks translate errors to toasts and roll back optimistic state.
- Edge Functions return explicit HTTP status and JSON error code without raw database/provider data.

### Cache behavior

- Add access key factories to `src/lib/query-config.ts`.
- Cancel, snapshot, optimistic update, rollback, and invalidate.
- Any mutation that may change visible recording lists calls `invalidateCallListCaches(queryClient)` in `onSettled`.

### Recording identity

- `recordings.id` UUID is canonical for every new API and UI type.
- Preserve `call_recording_id` only as bridge data.
- Use `toRecordingUuid()`/`toRecordingUuidBatch()` at unavoidable legacy boundaries; never `parseInt`, `Number`, or string coercion.

### UI and accessibility

- Frontend imports use `@/` aliases; type-only imports use `import type`.
- Remix icons only; `motion/react` only if state motion adds clarity.
- Semantic Tailwind tokens, `variant="hollow"` secondary controls, destructive variant for Deny/Revoke only.
- Loading skeletons, empty/error states, keyboard focus restoration, visible status text, and mobile Dialog fallback follow `38-UI-SPEC.md`.

## No Analog Found

None. Every likely file has a strong role or exact analog. The Phase 38 authorization semantics are new, so the planner must combine the migration/RPC conventions above with the locked research rules rather than infer product behavior from older access code.

## Metadata

**Analog search scope:** `src/`, `supabase/functions/`, `supabase/migrations/`, Phase 38 planning artifacts  
**Files scanned:** 40+ candidates; 14 primary analog files read  
**Pattern extraction date:** 2026-09-19  
**CodeGraph:** index current (1,417 files, 15,724 nodes); CLI exposed status only, so relationship discovery continued with direct `rg` and source reads.
