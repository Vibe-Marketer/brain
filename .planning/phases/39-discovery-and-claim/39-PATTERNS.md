# Phase 39: Discovery and Claim - Pattern Map

**Mapped:** 2026-09-20
**Files analyzed:** 20 proposed new/modified implementation and test areas
**Analogs found:** 20 / 20

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/<timestamp>_phase39_discovery_claim.sql` | migration/model/RPC/RLS | CRUD, request-response, event-driven | `20260919000002_phase38_access_policy_rls_rpcs.sql` + `20260905140000_create_identities_and_link_tables.sql` | exact composite |
| `supabase/functions/send-participation-claim/index.ts` | controller/service | request-response, external email | `supabase/functions/send-org-invite/index.ts` | role/data-flow match |
| `supabase/functions/participation-claim/index.ts` | controller/service | request-response, atomic CRUD | `supabase/functions/confirm-email-alias-verification/index.ts` | exact role |
| `src/types/event-discovery.ts` | model | transform | `src/types/recording-access.ts` | exact role |
| `src/services/event-discovery.service.ts` | service | request-response, transform | `src/services/recording-access.service.ts` | exact role/data-flow |
| `src/hooks/useEventDiscovery.ts` | hook | request-response, cache/event-driven | `src/hooks/useRecordingAccess.ts` | exact role/data-flow |
| `src/lib/query-config.ts` | config | cache keys/invalidation | existing `accessPolicy` and `notifications` key groups | exact in-file |
| `src/pages/Events.tsx` | page/component | request-response | protected pages in `src/App.tsx` + UI contract | role match |
| `src/components/events/*` | component | transform, event-driven | `OtherRecordingCopies.tsx` | exact privacy/action pattern |
| `src/pages/ParticipationClaim.tsx` | page/controller | request-response, auth redirect | `Login.tsx`, `ProtectedRoute.tsx`, public share entry | composite |
| `src/App.tsx` | route/config | request-response | existing public and protected route declarations | exact in-file |
| app shell navigation file(s) | component/config | event-driven | existing sidebar `SelectionButton` route entries | exact in-file |
| `src/components/settings/AccountTab.tsx` | component | request-response, CRUD | existing Verified Emails section | exact in-file |
| `src/services/identity-alias.service.ts` | service | CRUD/request-response | existing verified alias methods | exact in-file |
| `src/components/call-detail/CallParticipantsTab.tsx` | component | request-response, event-driven | existing participant cards + `RecordingAccessPanel` mutation UI | role match |
| `src/hooks/useNotifications.ts` and notification metadata | hook/model | polling, event-driven | existing recording-access notifications | exact in-file |
| `src/components/notifications/NotificationBell.tsx` | component | event-driven/navigation | `recordingAccessAction()` | exact in-file |
| `src/test/discovery-claim.integration.test.ts` | test | real-DB CRUD/RLS | `src/test/access-policy.integration.test.ts` | exact domain |
| Edge Function integration tests | test | real-DB request-response | `recording-access.integration.test.ts`, `confirm-email-alias.integration.test.ts` | exact composite |
| component/service/Playwright tests | test | request-response/navigation | existing adjacent tests and `playwright` auth flows | role match |

## Pattern Assignments

### `supabase/migrations/<timestamp>_phase39_discovery_claim.sql` (migration/model/RPC/RLS)

**Primary analog:** `supabase/migrations/20260919000002_phase38_access_policy_rls_rpcs.sql`

Use one or a short ordered series of additive migrations for tables, internal helpers, caller RPCs, RLS repairs, grants, notification ledger, and atomic claim consumption. Follow Phase 38's explicit table privileges and service-only policies:

```sql
-- 20260919000002... lines 19-29, 57-78
REVOKE INSERT, UPDATE, DELETE ON TABLE public.recording_access_requests FROM anon, authenticated;
GRANT ALL ON TABLE public.recording_access_requests TO service_role;

CREATE POLICY "Service role manages recording access requests"
  ON public.recording_access_requests FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);
```

Apply that shape to `participation_claim_invitations` and the private future-match ledger: enable and force RLS, revoke client writes, grant service role, and expose only narrow RPCs. Invitation recipient, inviter, ownership, status, and eligibility must be derived server-side from the canonical participant/recording rows.

For helpers and RPCs, copy the hardened envelope from Phase 38:

```sql
-- 20260919000002... lines 106-137
CREATE OR REPLACE FUNCTION public.phase38_user_is_verified_confirmed_participant(...)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (... schema-qualified relations ...)
$$;

REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ... TO service_role;
```

The new private current-email helper must derive the subject from `auth.uid()`, include `auth.users.email` only when `email_confirmed_at` is non-null, and union active verified aliases owned by that user. It must accept no user ID or email argument. Caller-facing discovery/count/status/consume RPCs may be granted to `authenticated`; internal predicates stay revoked from `PUBLIC`, `anon`, and `authenticated`.

**Identity analog:** `supabase/migrations/20260905140000_create_identities_and_link_tables.sql`

Reuse the existing partial uniqueness invariant, owner-scoped alias visibility, and nullable participant enrichment:

```sql
-- lines 94-101
CREATE UNIQUE INDEX IF NOT EXISTS identity_aliases_verified_unique
  ON identity_aliases(alias_type, value) WHERE verified = true;
CREATE INDEX IF NOT EXISTS idx_identity_aliases_type_value
  ON identity_aliases(alias_type, value);
```

Disconnect should deactivate verification/evidence so the current-email helper stops returning the alias immediately. It must never delete or rewrite `call_participants` evidence. Optional filling of null `identity_id` values is enrichment only and must not become the authorization source.

**Phase 38 predicates to preserve and repair:** `20260919000002...` lines 106-220.

- Redefine confirmed participation around current caller-owned verified email values plus `has_confirmed_speech`, organizer, or host evidence. Do not keep the current mandatory `call_participants.identity_id` join.
- Redefine the `<50` event-size count using distinct normalized confirmed participant emails/identities without requiring an ownership link.
- Preserve `phase38_recording_event_kind` webinar exclusion and `phase38_user_can_access_recording` as the only content-access authority.
- Replace the direct `events` participation policy branch from `20260831020000_fix_events_participation_rls_and_updated_at_trigger.sql:41-79`, because `auth.email()` alone does not meet the confirmed/current-email boundary. Preserve its owned-recording branch.

**Discovery RPC pattern:** derive and project in SQL, using bounded `limit/offset` (max 50), deduplicate by event, and order action-needed first, available second, then canonical event time descending. Return only event ID/date, the caller's own connection evidence, readable recording projections authorized by Phase 38, and Phase 38 anonymous-copy/request fields. Never return inaccessible title, owner, provider, transcript, summary, roster, source ID, participant count, or stable visible recording identifier.

**Do not modify:** `get_people_summary(UUID)` or `get_recordings_for_person(UUID,TEXT,TEXT)` in `20260309120000_call_participants.sql:342-480`. Preserve names, parameters, grants, and return shapes. Add distinctly named caller-scoped event RPCs.

**Atomic claim:** implement token lookup/row lock/state transition/alias attachment/sibling supersede in a database transaction exposed through one narrow RPC. An Edge Function sequence of separate selects and updates is not atomic enough for parallel consume. Store only SHA-256 token digest. Generic unavailable result must cover unknown, expired, replayed, revoked, superseded, and alias-conflict cases.

**Notification ledger:** unique `(user_id,event_id)` with silent baseline inserts for all currently discoverable events, then one `user_notifications` insert only when a later match first appears. Retain the ledger on disconnect/reconnect; neutralize stale actionable notifications when all current-email authority disappears.

---

### `supabase/functions/send-participation-claim/index.ts` (controller/service, email)

**Analog:** `supabase/functions/send-org-invite/index.ts`

Copy the import/auth/input/email/error skeleton:

```typescript
// lines 23-27, 197-245
import { z } from 'https://esm.sh/zod@3.23.8';
import { getCorsHeaders } from '../_shared/cors.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { escapeHtml } from '../_shared/html-escape.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const authResult = await authenticateRequest(req, supabaseClient, corsHeaders);
if (authResult instanceof Response) return authResult;

const validation = schema.safeParse(await req.json());
if (!validation.success) return new Response(..., { status: 400, ... });
```

The request schema should accept the canonical participant row ID and optional one-reminder boolean only. It must not accept recipient email, recording owner ID, invitation status, or arbitrary claim URL. Invoke an owner-authorizing database function that reads the participant and recording, enforces confirmed participation, returns the normalized email snapshot, creates/rotates the hash-only invitation, and enforces one active invitation/resend age.

Copy Resend's raw REST call and status handling from lines 256-295, plus `escapeHtml` for any rendered participant/inviter text. Generate the raw 32-byte token in the function, send it only in the email URL, never log it, and persist only its hash through the RPC. Use a Resend idempotency key. If reminder is enabled, schedule it around day 6, record its provider ID, and cancel it on claim/revoke/supersede. Do not use repository `pg_cron`; its required GUCs are known broken.

Do not copy `send-org-invite`'s client-supplied recipient/URL contract. That function is the transport/template analog only; Phase 39 authorization must be stricter.

---

### `supabase/functions/participation-claim/index.ts` (controller/service, atomic consume)

**Analog:** `supabase/functions/confirm-email-alias-verification/index.ts`

Copy authenticated Edge Function setup, Zod parsing, service client separation, generic denial, and identity/alias conflict handling:

```typescript
// confirm-email-alias-verification lines 26-38, 55-78
const authClient = createClient(supabaseUrl, supabaseAnonKey);
const authResult = await authenticateRequest(req, authClient, corsHeaders);
if (authResult instanceof Response) return authResult;
const { userId } = authResult;

const validation = confirmSchema.safeParse(await req.json());
const supabase = createClient(supabaseUrl, supabaseServiceKey);
```

The claim function accepts only the raw token, validates its bounded format, hashes it with Web Crypto, and calls the atomic consume RPC. The RPC performs all state checks and alias ownership changes. Return one generic terminal code/message for all unavailable/conflict variants. On success, cancel any scheduled reminder by stored provider ID, then return only success and cache-invalidation hints. Do not reproduce the existing function's multi-step alias writes in the Edge Function; lines 136-217 are useful semantic precedent but are race-prone for a single-use token and must move into SQL transaction logic.

---

### `src/types/event-discovery.ts` (model, transform)

**Analog:** `src/types/recording-access.ts`

Define a narrow server-safe discriminated projection: event ID/date, grouping/action state, caller connection evidence, readable copy details only when authorized, and anonymous copy ordinal/request state. Define invitation status and claim result codes. Keep raw RPC snake_case private to the service mapper and expose camelCase types to hooks/components. Avoid optional catch-all metadata that could carry restricted fields.

---

### `src/services/event-discovery.service.ts` (service, request-response/transform)

**Analog:** `src/services/recording-access.service.ts:17-155`

Copy UUID validation, typed domain errors, defensive `unknown` row parsing, RPC error mapping, and function invocation:

```typescript
type RpcRow = Record<string, unknown>

function requireUuid(value: string, label: string): string { ... }
function rpcError(error: { message?: string; code?: string } | null, operation: string): never { ... }

const { data, error } = await supabase.rpc('list_my_discovered_events', {
  p_limit: limit,
  p_offset: offset,
})
if (error) rpcError(error, 'Event discovery')
```

Validate every row and drop/reject malformed shapes; never pass raw RPC objects to React. Keep list/count/status, invite/resend, claim consume, and alias disconnect calls here. Use `supabase.functions.invoke` for Edge Functions, matching `recording-access.service.ts:127-155` and `identity-alias.service.ts:80-109`.

---

### `src/hooks/useEventDiscovery.ts` and `src/lib/query-config.ts` (hooks/cache)

**Analog:** `src/hooks/useRecordingAccess.ts:20-49,59-93,95-199`

Add stable query-key families for discovery list/count, invitation status by recording/participant, and claim state. Queries call only the service. Mutations own toasts, optimistic state where safe, and cache invalidation.

```typescript
return useMutation({
  mutationFn: (...args) => eventDiscoveryService.someMutation(...args),
  onError: (error) => { logger.error(...); toast.error(...) },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.eventDiscovery.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() })
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unread() })
    invalidateCallListCaches(queryClient)
  },
})
```

Claim and disconnect must invalidate discovery, verified aliases, notifications, access-policy/event-copy keys, and call-list caches. Invite/resend must invalidate the exact participant invitation status. Components must not call Supabase, RPCs, services, or Edge Functions directly.

---

### `src/pages/Events.tsx` and `src/components/events/*` (page/components)

**Analogs:** `src/components/call-detail/OtherRecordingCopies.tsx:19-105`; existing authenticated `Layout` routes in `src/App.tsx:103-130`; shadcn primitives under `src/components/ui/`.

Use `OtherRecordingCopies` as the privacy/action precedent: hook-owned data, explicit loading/error states, ordinal anonymous copy labels, request state/cooldown state, 44px actions, and no restricted metadata. Event cards should be semantic list articles under `h2` group headings, with action-needed group before available, then newest within each group. Accessible names may use ordinal and event date only.

Readable recording rows may show fields present in the safe projection. Restricted rows use the exact anonymous Phase 38 shape and `Request access` action. Never join event cards to calls/participants in React to enrich the response.

Use existing `Card`, `Separator`, `Badge`/`StatusBadge`, `Button`, `Skeleton`, `ScrollArea`, and Remix icons. Follow `39-UI-SPEC.md` exact copy, tokens, responsive stacking, semantic heading structure, `aria-busy`, `<time>`, live regions, focus rings, and reduced motion.

---

### `src/pages/ParticipationClaim.tsx`, `src/pages/Login.tsx`, `src/components/ProtectedRoute.tsx`, `src/App.tsx` (claim route/auth return)

**Analogs:** `Login.tsx:27-47,259-287`; `ProtectedRoute.tsx:18-29`; `App.tsx:65-83,103-130`.

Public claim entry route captures the token, writes it immediately to a dedicated `sessionStorage` key, and replaces/scrubs the URL before rendering. Signed-out users continue to login/signup without putting the token in `next`. Extend every login completion path and OAuth root return to consume the dedicated pending-claim key before generic `pendingNext`. Keep `pendingShareToken` isolated.

Add `/participation-claim/:token` as a public route and `/events` as a `ProtectedRoute` inside the standard `Layout`. On authenticated return, call claim consume once, invalidate caches, navigate with `replace` to `/events`, and focus the Events heading. Generic terminal UI must reveal no event/recording/email/account detail.

Do not simply copy current `ProtectedRoute` token interpolation (`/s/${pendingToken}`); claim tokens must not be placed back into URLs after capture.

---

### App shell navigation (component/config)

**Analog:** existing sidebar entries using `SelectionButton` and Remix line/fill pairs.

Add Events alongside primary app navigation, targeting `/events`, using only Remix icons. Preserve shell collapse/mobile behavior and existing active route treatment. Do not create a second shell or put Events under Calls filters.

---

### `src/components/settings/AccountTab.tsx` and `src/services/identity-alias.service.ts`

**Analog:** existing Verified Emails block at `AccountTab.tsx:425-507`; `identity-alias.service.ts:14-109`.

Extend the existing section with its own discovery-count skeleton/error state and persistent `We found [N] event(s)` callout plus `View events`. Add disconnect via existing `AlertDialog`; the mutation must call a server-side alias deactivation operation and invalidate discovery/alias/notification/access/call-list caches.

Keep service error parsing through `IdentityAliasError` (`identity-alias.service.ts:20-54`). The UI must not delete participant rows, identities, or events. Primary login email cannot be treated like a detachable alias unless the backend has a separate valid ownership/account-email flow.

---

### `src/components/call-detail/CallParticipantsTab.tsx` (participant invitation)

**Analog:** current participant row layout at lines 43-103, combined with mutation/status patterns in `RecordingAccessPanel` and `useRecordingAccess`.

Extend the canonical participant query/DTO to include participant row ID and server-computed invitation eligibility/status. Never infer eligibility from merged `CallSpeaker` display fields, `speaker_email`, name, transcript speaker, or calendar-only evidence. Render `Invite to claim`, optional `Send one reminder` switch, sent date/status, and `Resend invite` after seven days only when server status permits. The recording-owner check is server-side; UI hiding is convenience only.

Preserve existing identity evidence badge and participant card layout. Keep one active mutation per participant row and render server state after races.

---

### Notifications (`src/hooks/useNotifications.ts`, metadata guard, `NotificationBell.tsx`)

**Analog:** `useNotifications.ts:52-69,83-124`; `NotificationBell.tsx:34-61,93-126`.

Reuse `user_notifications`, the existing polling/read mutations, and `NotificationBell`. Add a strict metadata guard for future event-match notifications, parallel to `isRecordingAccessNotificationMetadata`, with a privacy-safe kind and event identifier/action only. Add an Events action mapper returning `/events`; do not include or render event title, owner, provider, roster, email, or recording details.

The notification production/idempotency logic belongs server-side in the migration/RPC, not in `useNotifications`. Hook polling may invoke an idempotent caller sync seam before fetching, but the same transaction must enforce ledger uniqueness and one notification per user/event.

---

## Test Pattern Assignments

### `src/test/discovery-claim.integration.test.ts`

**Analog:** `src/test/access-policy.integration.test.ts` plus `src/test/rls-regression.test.ts`.

Use real TEST Supabase only, authenticated clients with actual JWTs for RLS, service role only for fixture setup/cleanup, sequential execution, and checked cleanup errors. Cover confirmed primary, verified alias, unverified/name/org/domain/calendar-only denial; disconnect revocation; direct `events` table policy; safe projection fields; webinar/50-cap; pagination/order; silent baseline then one future notification; legacy people RPC shape regression; and Phase 38 request/content boundary.

Capture mutated state before the first mutation and restore exact original values. Use `cleanup_test_fixture_users` for auth fixture teardown. Do not mock Supabase.

### Edge Function integration tests

**Analogs:** `supabase/functions/recording-access/__tests__/recording-access.integration.test.ts`; `supabase/functions/confirm-email-alias-verification/__tests__/confirm-email-alias.integration.test.ts`.

Test owner versus non-owner invitation, canonical participant-only inputs, missing/weak evidence, existing owner alias, one active invite, seven-day resend, one optional reminder, provider failure persistence, and generic responses. For consume, test valid, expired, unknown, replay, revoked, superseded, parallel double-submit, and alias conflict. Assert one winner under parallel consume and raw token absence from database/loggable return objects.

### Service/component/E2E tests

- `src/services/__tests__/event-discovery.service.test.ts`: copy recording-access service parser tests; malformed RPC rows, bounded pagination, ordering preservation, and error-code mapping.
- `src/components/events/*.test.tsx`: copy `OtherRecordingCopies.test.tsx`; privacy-safe card projection, loading/error/empty, grouping/order, readable plus restricted copies, request states.
- `AccountTab.test.tsx`: count/loading/error/View events/disconnect confirmation and cache-driven removal.
- `CallParticipantsTab.test.tsx`: canonical eligibility, owner action, sent date, reminder toggle, resend threshold, transcript-only suppression.
- `NotificationBell.test.tsx`: future-event metadata guard and `/events` navigation without private labels.
- `playwright/discovery-claim.spec.ts`: public token capture and URL scrub, password login, signup, OAuth/root return, wrong-primary account flow, automatic completion, generic terminal state, final Events focus.

## Shared Patterns

### Authentication and authorization

**Source:** `supabase/functions/_shared/auth.ts`, used by `confirm-email-alias-verification/index.ts:60-63` and `send-org-invite/index.ts:219-223`.

Every new authenticated Edge Function calls `authenticateRequest`. Database authority comes from `auth.uid()` inside narrow RPCs. Browser-supplied ownership, recipient email, status, or eligibility is never trusted.

### Error handling and privacy

**Sources:** `identity-alias.service.ts:20-54`; `recording-access.service.ts:21-56`; `confirm-email-alias-verification/index.ts:91-134`.

Use machine-readable internal codes for expected UI states, but collapse all claim-token terminal cases to identical user-facing copy. Log operation names and safe IDs only; never log raw claim tokens, recipient emails in token errors, or inaccessible event data.

### Cache invalidation

**Source:** `useRecordingAccess.ts:20-33,132-135,194-197`; `src/lib/query-config.ts:358-363`.

Every Phase 39 mutation invalidates its own keys on `onSettled`. Claim/disconnect additionally invalidate aliases, discovery, notifications, Phase 38 access/event copies, and `invalidateCallListCaches(queryClient)`.

### Content boundary

**Source:** `phase38_user_can_access_recording` in `20260919000002...:222-267`; anonymous copy RPC at lines 424-486; verified by Phase 38.

Discovery proves event existence and request eligibility only. It never grants content. All readable recording fields must remain behind Phase 38 access evaluation.

### Guarded Supabase rollout

**Source:** Phase 38 rollout summary and repository Supabase rules.

Sequence implementation and rollout as follows:

1. Author Wave 0 real-DB tests and additive migrations; apply migrations to TEST only.
2. Regenerate `src/types/supabase.ts` from the linked TEST schema and run zero-new-error type check.
3. Deploy Phase 39 Edge Functions to TEST with `--use-api` and run focused integration suites sequentially.
4. Run Phase 38 access regressions and global RLS regression to prove boundaries remain intact.
5. Implement service/hooks/UI against the tested contract; run unit/component/Playwright/build gates.
6. Apply additive migrations/functions to production only through the approved prod-ref guard, pending-change review, migration/function inventory, canary, introspection, and cleanup process.
7. Keep frontend/application source on `v2.2-event-resolution`; do not merge or push `main` until the explicit milestone release decision.

Backend migration and function rollout may precede the frontend because production currently has no event/identity rows, but server contracts and probes must still pass. Avoid any destructive backfill or historical participant rewrite.

## Files That Must Not Be Copied Blindly

| Source | Why |
|---|---|
| `send-org-invite/index.ts` | It trusts caller-supplied recipient and invite URL after validation; Phase 39 must derive both recipient and claim lifecycle server-side. |
| `confirm-email-alias-verification/index.ts` | Its separate select/update/delete sequence is acceptable for OTP but insufficient for atomic single-use claim under concurrent requests. |
| `user_participates_in_event(p_event_id,p_email)` | It accepts arbitrary email evidence and underlies the too-permissive direct event policy. Replace the policy branch with current confirmed caller emails. |
| current Phase 38 participant helpers | They require `identity_id`; live data has zero participant links. Preserve evidence semantics while changing the ownership lookup. |
| `CallParticipantsTab` merged `CallSpeaker` list | It blends transcript/invitee/contact display data and lacks canonical participant ID. Invitation must use a server-validated participant row. |
| `ProtectedRoute` pending share-token redirect | It reintroduces token into a route. Claim tokens must be scrubbed once and consumed from session storage. |
| legacy people RPCs | They are org-scoped public contracts. Do not overload or change their signatures/result shapes. |

## Sequencing Dependencies

1. Database helpers/RLS repair and Phase 38 predicate repair must land together; otherwise direct table access and RPC access disagree.
2. Invitation table + atomic creation/consume RPCs precede Edge Functions.
3. Safe discovery/count/status RPC contracts precede generated types, service, hooks, and UI.
4. Participant query must expose canonical participant IDs and server status before invitation controls render.
5. Notification baseline/uniqueness ledger must exist before enabling future-match production writes.
6. Claim redirect handling must cover password, signup, and OAuth/root paths before public claim links are sent.
7. TEST real-DB proof and Phase 38 regression proof precede production additive rollout.
8. Production backend proof precedes the eventual deliberate feature-branch merge to `main`.

## No Analog Found

No proposed Phase 39 area lacks a usable repository analog. The atomic token-consume transaction and future-match baseline ledger are new compositions, but their security envelope, service-only table pattern, notification table, and client boundaries all have direct precedents above.

## Metadata

**Analog search scope:** `src/`, `supabase/migrations/`, `supabase/functions/`, `playwright/`, Phase 34/38 planning artifacts
**Strong analog files read:** 16
**Pattern extraction date:** 2026-09-20
**CodeGraph:** no callable CodeGraph tool was exposed in this agent session; direct indexed searches and source reads were used.
