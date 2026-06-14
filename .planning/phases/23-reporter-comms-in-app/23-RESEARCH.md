# Phase 23: Reporter Comms (In-App) - Research

**Researched:** 2026-06-14
**Domain:** Supabase ticket lifecycle, in-app notification outbox, autopilot deploy verification, customer-safe comms
**Confidence:** HIGH for codebase architecture; MEDIUM for exact implementation effort because Phase 18 left the `in_app_user` enum absent.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### D-00 - HARD GATE: only `source='in-app-user'` ever gets customer comms [LOCKED - the whole point of Phase 18->23]
NO comms fire for `sentry`, `nightly_qa`, `internal`, `manual`(non-in-app), or `unknown` sources. A Sentry/QA/internal ticket must stay customer-silent. This is Pitfall 7 - sending comms before trustworthy attribution emails customers about errors they never reported. Gate every comms path on `source = in-app-user`; fail closed (no source / uncertain -> no comms).

### D-01 - In-app status updates on ticket state change (RSP-01) [LOCKED]
An in-app reporter receives a status update when THEIR ticket moves (received / in-progress / resolved). Reuse the existing `user_notifications` outbox (no new comms vendor). Fired only when `source='in-app-user'`.

### D-02 - Resolution summary + default-deny content filter (RSP-02) [LOCKED]
On verified-stable deploy (reuse Phase 17/21 verifyDeploySha), post an auto-generated, plain-English resolution summary in-app. Pass it through a DEFAULT-DENY content filter that REDACTS: file paths, SHAs, stack traces, and the word "agent" (and AI-internal tells). Default-deny = allow only customer-safe plain language; when in doubt, redact. Aligns with brand ("AI-ready, not AI-powered" - never expose the agent/AI internals to customers).

### D-03 - Escalation = a human-readable status, never silence (RSP-03) [LOCKED]
When autopilot can't fix a ticket, the in-app reporter gets a human-readable escalation status ("we're on it, a person is looking" tone) - NOT silence and NOT a raw problem dump. Customer-facing sibling of the operator tier-2 "solutions not problems" law: the reporter sees reassurance + status, never internals.

### Claude's Discretion
Exact notification copy templates; the content-filter implementation (regex/allowlist redactor); where the comms trigger hooks into the ticket lifecycle (Edge Function vs daemon). Reuse `user_notifications`, Resend `fetch`, verifyDeploySha, ticket lifecycle events.

### Deferred Ideas (OUT OF SCOPE)
- External/email comms beyond the existing Resend outbox; comms to non-in-app sources (forbidden); FEAT lane -> v2.1.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RSP-01 | A reporter receives an in-app status update when their ticket moves (received / in-progress / resolved), only when `source = in-app-user`. | Use `ticket_events` as the lifecycle stream and insert `user_notifications` only after joining `tickets` and checking exact `source = 'in_app_user'` plus non-null `reporter_id`. [VERIFIED: supabase/migrations/20260611000002_create_ticket_tables.sql:71-83,180-195] |
| RSP-02 | Auto-generated plain-English resolution summary is posted in-app on verified-stable deploy through default-deny filtering. | Reuse autopilot `verifyDeploySha()` and only emit customer resolution summary when `deploy.verified === true`; do not trust `tickets.status = 'resolved'` alone. [VERIFIED: /Users/admin/dev/autopilot/src/lib/approval.ts:378-399,801-812] |
| RSP-03 | When autopilot cannot fix a ticket, reporter gets human-readable escalation status, not silence. | Hook the `escalated` status event or the `tier2_digest_queued` event, but insert a separate customer-safe notification, not the raw `ticket_messages` body. [VERIFIED: /Users/admin/dev/autopilot/src/runner.ts:238-245; /Users/admin/dev/autopilot/src/lib/tier2.ts:233-245] |
</phase_requirements>

## Summary

Phase 23 should be planned as a narrow comms layer on top of the existing ticket lifecycle and notification table. The existing `user_notifications` table already has the needed columns (`user_id`, `type`, `title`, `body`, `metadata`, `read_at`, `created_at`) and RLS lets each user read/update/delete their own notifications while service-role code inserts rows. [VERIFIED: supabase/migrations/20260131000004_create_notifications_table.sql:10-43] The frontend already has a TanStack Query hook for polling and mutating notifications, but no mounted UI consumer was found by `rg useNotifications`; surfacing the outbox must be part of the plan. [VERIFIED: src/hooks/useNotifications.ts:42-69; rg output in session]

The biggest planning blocker is source attribution: the locked phase context says comms only for `source='in-app-user'`, but the current generated enum only contains `manual | sentry | unknown | nightly_qa | internal`, and `send-support-ticket` still stamps person-reported tickets as `manual`. [VERIFIED: src/types/supabase.ts:5752-5755,5890-5895; supabase/functions/send-support-ticket/index.ts:186-193] Because D-00 requires fail-closed comms, Phase 23 must first add the real DB enum value `in_app_user` and stamp new in-app support tickets with that value. Do not backfill ambiguous historical `manual` rows. [VERIFIED: supabase/migrations/20260613180500_source_attribution_backfill_metrics.sql:23-29]

**Primary recommendation:** Plan Wave 0 as a source-gate correction (`ticket_source += in_app_user`, `send-support-ticket` stamps `in_app_user`, generated types/tests updated), then implement DB-backed in-app notification inserts from ticket lifecycle events and autopilot verified-stable hooks, never from raw customer-visible `ticket_messages`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Source gate (`in_app_user`) | Database / Edge Function | Frontend types | DB enum and server-side intake stamp are the authority; browser input must not be allowed to provide or spoof `source`. [VERIFIED: supabase/functions/send-support-ticket/index.ts:20-34,133-139,186-193] |
| Received / in-progress status notification | Database | Frontend UI | Status changes already flow through `tickets` and `ticket_events`; a DB function/trigger can fail closed in one place. [VERIFIED: supabase/migrations/20260611000002_create_ticket_tables.sql:180-195] |
| Verified-stable resolution summary | Autopilot | Database / frontend UI | Only autopilot currently knows the pushed SHA and calls `verifyDeploySha`; Brain owns schema and the visible outbox. [VERIFIED: docs/architecture/autopilot-brain-ownership.md:31-49] |
| Content filter | Shared pure TypeScript in autopilot, mirrored tests in brain if SQL/RPC used | Database metadata | The summary is generated near autopilot deploy evidence; filtering must happen before any customer-visible DB write. [VERIFIED: /Users/admin/dev/autopilot/src/lib/approval.ts:801-812] |
| Escalation-not-silence | Database lifecycle trigger plus autopilot event | Frontend UI | Escalation status is a ticket state/event; customer copy must be separate from internal tier-2 messages. [VERIFIED: /Users/admin/dev/autopilot/src/lib/tier2.ts:233-245] |

## Project Constraints (from AGENTS.md)

- Direct-main workflow: commit and push to `origin/main`; no feature branches or PRs unless explicitly asked. [VERIFIED: AGENTS.md]
- Use CodeGraph before broad grep for code structure; final claims still require source reads and tests. [VERIFIED: AGENTS.md]
- Package manager is npm only; banned package managers are pnpm, bun, yarn. [VERIFIED: AGENTS.md]
- Frontend stack is React 18, Vite 5, react-router-dom v6, TanStack Query, Zustand v5, Tailwind, shadcn/ui, Remix Icons, and `motion/react`. [VERIFIED: AGENTS.md; package.json]
- Banned UI libraries include Lucide, FontAwesome, and `framer-motion`. [VERIFIED: AGENTS.md]
- Service + hook separation is locked for frontend data access. [VERIFIED: CLAUDE.md; .planning/codebase/ARCHITECTURE.md]
- Edge Functions must use shared `authenticateRequest(req, supabase, corsHeaders)` for auth. [VERIFIED: supabase/CLAUDE.md]
- Integration tests must use a real dedicated Supabase test project, never mocked Supabase and never production fallback. [VERIFIED: supabase/CLAUDE.md]
- All AI/LLM work belongs in Edge Functions or daemon/backend contexts, never frontend components. [VERIFIED: CLAUDE.md]
- Brand rule: never expose AI internals or use positive "AI-powered" customer copy. [VERIFIED: CLAUDE.md]
- No new comms vendor and zero new npm packages for this roadmap. [VERIFIED: .planning/ROADMAP.md]

## Standard Stack

### Core

| Library / System | Version | Purpose | Why Standard |
|------------------|---------|---------|--------------|
| Supabase Postgres | project-backed | Ticket source, lifecycle, RLS, and outbox persistence | `tickets`, `ticket_events`, `ticket_messages`, and `user_notifications` already exist and are the shared Brain/autopilot contract. [VERIFIED: docs/architecture/autopilot-brain-ownership.md:43-49] |
| Supabase Edge Functions | Deno 2.6.10 local | Authenticated ticket intake and possible RPC wrapper | Current support intake authenticates with shared auth and uses service-role for server-authoritative writes. [VERIFIED: supabase/functions/send-support-ticket/index.ts:1-5,133-139,167-193] |
| `@supabase/supabase-js` | 2.84.0 | Frontend/daemon DB client | Already used by frontend, Edge Functions, and autopilot service client. [VERIFIED: package.json; /Users/admin/dev/autopilot/src/lib/db.ts:1-83] |
| TanStack Query | 5.90.10 | Notification polling and mutations | Existing `useNotifications` uses query keys, polling, optimistic read/delete mutations. [VERIFIED: src/hooks/useNotifications.ts:42-69,83-221] |
| Vitest | 4.0.16 | Unit and integration test runner | Existing ticket, notification-adjacent, migration, and autopilot tests are Vitest-based. [VERIFIED: package.json] |

### Supporting

| Library / System | Version | Purpose | When to Use |
|------------------|---------|---------|-------------|
| Resend raw `fetch` | API call only, no SDK | Existing support/admin email side effect | Reuse only for existing email paths; Phase 23 customer comms are in-app only. [VERIFIED: supabase/functions/send-support-ticket/index.ts:7-9,84-109,241-250] |
| Zod | 3.25.76 frontend / 3.23.8 Edge import | Edge Function input validation | Keep browser input schemas closed; do not add client-supplied `source`. [VERIFIED: supabase/functions/send-support-ticket/index.ts:20-34] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DB trigger/function on `ticket_events` | Add notification writes in every caller (`send-support-ticket`, autopilot claim, approval, tier2) | Duplicates the gate in multiple code paths and risks silent gaps when new status writers appear. Use DB lifecycle centralization for RSP-01/RSP-03. [VERIFIED: multiple status writers found by rg] |
| `ticket_messages` as customer comms | Post sanitized customer messages in the ticket thread | Existing RLS lets reporters see ticket messages on their own tickets, while autopilot already writes internal `author_type='agent'` messages; mixing customer comms here risks leaks unless a separate visibility model is added. Use `user_notifications` for Phase 23. [VERIFIED: supabase/migrations/20260611000002_create_ticket_tables.sql:123-155; /Users/admin/dev/autopilot/src/lib/db.ts:115-132] |
| New email/push/SMS vendor | Resend SDK, Twilio, SendGrid | Out of scope and explicitly forbidden; in-app only. [VERIFIED: .planning/REQUIREMENTS.md Out of Scope] |

**Installation:**

```bash
# No install. Phase 23 should add zero npm packages.
```

## Package Legitimacy Audit

No external packages should be installed for this phase. The GSD package-legitimacy gate is not applicable because the standard stack is already present in `package.json` and the locked roadmap requires zero new npm packages. [VERIFIED: package.json; .planning/ROADMAP.md]

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| none | npm | n/a | n/a | n/a | n/a | No install |

**Packages removed due to [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
In-app support form
  -> send-support-ticket Edge Function
  -> tickets(source='in_app_user') + ticket_events('created')
  -> comms trigger/function checks exact source + reporter_id
  -> user_notifications(type='info'|'system', metadata ticket id/kind)
  -> frontend notification surface via useNotifications

Autopilot claim/update
  -> tickets.status='in_progress'
  -> DB status audit writes ticket_events('status_change')
  -> comms trigger/function checks exact source + reporter_id
  -> user_notifications "we are working on it"

Autopilot merge/deploy
  -> verifyDeploySha(mergedSha)
  -> if verified, build customer summary -> default-deny filter
  -> Brain-owned RPC or DB insert to user_notifications
  -> optionally mark comms metadata/idempotency event

Autopilot escalation
  -> ticket status='escalated' and/or tier2 event
  -> comms trigger/function checks exact source + reporter_id
  -> user_notifications "we are taking a closer look"
```

### Recommended Project Structure

```text
supabase/migrations/
  20260614xxxxxx_phase23_reporter_comms.sql      # enum, trigger/function, notification idempotency
supabase/functions/send-support-ticket/
  index.ts                                       # stamp source='in_app_user'
  __tests__/source-stamping.test.ts              # update locked source assertion
src/hooks/
  useNotifications.ts                            # extend type union if needed
src/components/
  notifications/                                 # notification bell/panel if no existing consumer is found
src/lib/
  ticket-display.ts                              # add first-class in_app_user label after enum/typegen
  __tests__/ticket-display.test.ts
/Users/admin/dev/autopilot/src/lib/
  reporter-comms.ts                              # pure filter + outbox helper, or approval hook helper
  approval.ts                                    # call helper only after deploy.verified
```

### Pattern 1: DB-Centralized Lifecycle Notification

**What:** Add a Postgres function such as `notify_in_app_reporter_from_event()` triggered after insert on `ticket_events`, joining `tickets` by `ticket_id`, then returning early unless `ticket.source = 'in_app_user'` and `ticket.reporter_id IS NOT NULL`. [VERIFIED: supabase/migrations/20260611000002_create_ticket_tables.sql:76-83,180-195]

**When to use:** Use for `created`, `status_change -> in_progress`, and `status_change -> escalated`. Do not use it for verified-stable resolution summary because the deploy verification signal lives in autopilot. [VERIFIED: /Users/admin/dev/autopilot/src/lib/approval.ts:378-399,801-812]

**Example:**

```sql
-- Research sketch, not final migration.
IF ticket_row.source <> 'in_app_user' OR ticket_row.reporter_id IS NULL THEN
  RETURN NEW;
END IF;

IF NEW.event_type = 'created' THEN
  v_kind := 'received';
ELSIF NEW.event_type = 'status_change' AND NEW.new_value = 'in_progress' THEN
  v_kind := 'in_progress';
ELSIF NEW.event_type = 'status_change' AND NEW.new_value = 'escalated' THEN
  v_kind := 'escalated';
ELSE
  RETURN NEW;
END IF;

INSERT INTO public.user_notifications (user_id, type, title, body, metadata)
SELECT ticket_row.reporter_id, 'info', v_title, v_body,
       jsonb_build_object('ticket_id', ticket_row.id, 'kind', v_kind, 'source', 'in_app_user')
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_notifications n
  WHERE n.user_id = ticket_row.reporter_id
    AND n.metadata->>'ticket_id' = ticket_row.id::text
    AND n.metadata->>'kind' = v_kind
);
```

### Pattern 2: Verified-Stable Resolution Summary Hook

**What:** Add an autopilot helper called only after `const deploy = await verifyDeploySha(mergedSha)` returns `verified: true`. The helper should fetch the ticket row, fail closed unless `source === 'in_app_user'`, generate/sanitize copy, and insert a `user_notifications` row through the existing service-role DB client or a Brain RPC. [VERIFIED: /Users/admin/dev/autopilot/src/lib/approval.ts:378-399,801-812]

**When to use:** Use for RSP-02 and the customer-facing "resolved" status. The current approval path sets `tickets.status='resolved'` even when the deploy SHA is unverified, so `status='resolved'` is not a sufficient customer-stable trigger. [VERIFIED: /Users/admin/dev/autopilot/src/lib/approval.ts:803-812]

**Example:**

```typescript
if (deploy.verified) {
  await notifyReporterResolvedIfInAppUser({
    db,
    ticketId: appr.ticketId,
    mergedSha,
    rawSummary: buildRawResolutionSummary(...),
  });
}
await db.from("tickets").update({ status: "resolved" }).eq("id", appr.ticketId).select("id");
```

### Pattern 3: Default-Deny Customer Copy Filter

**What:** Implement a pure function that produces one of two outcomes: `{ ok: true, text }` only when the text survives the allowlist, or `{ ok: false, text: FALLBACK_COPY, redactions }` when anything looks internal. The fallback text should be a safe template, not a partially leaked raw summary. [VERIFIED: D-02]

**Filter rules to plan:**

- Reject or redact file paths: POSIX absolute/relative paths, `/Users/...`, `src/...`, `supabase/functions/...`, `*.ts:12`, stack frame path segments. [VERIFIED: D-02]
- Reject or redact SHAs: 7 to 40 hex chars near words like `commit`, `sha`, `merged`, or inside backticks. [VERIFIED: D-02]
- Reject stack traces: code fences, `Error:`, `TypeError:`, `ReferenceError:`, `at function (...)`, line/column frames, ANSI output. [VERIFIED: src/lib/ticket-display.ts:52-56]
- Reject internal tells: the word `agent`, plus `Autopilot`, `Codex`, `Claude`, `LLM`, `model`, `prompt`, `token`, `runner`, `worktree`, `branch`, `diff`, `push-gate`, `Sentry`, `stack`, `trace`, `deploy SHA`. [VERIFIED: D-02 and brand constraints]
- Allow only short plain-English sentences, normal punctuation, product-safe status terms, and no backticks/code formatting. [VERIFIED: D-02]

**Safe customer templates:**

- Received: `We received your report and are tracking it.`
- In progress: `We are working on your report now.`
- Verified resolved: `This has been fixed and verified in the live app.`
- Escalated: `We are taking a closer look and will keep tracking this for you.`
- Filter fallback: `This has been fixed and verified in the live app. Thanks for reporting it.`

### Anti-Patterns to Avoid

- **Treating `manual` as in-app:** Current `manual` rows are ambiguous and D-00 forbids uncertain comms. Add `in_app_user`; do not send customer notifications for `manual`. [VERIFIED: supabase/functions/send-support-ticket/index.ts:186-193; src/types/supabase.ts:5752-5755]
- **Using `ticket_messages` as the outbox:** Existing internal daemon messages use `author_type='agent'` and reporters have RLS visibility to their ticket messages. Customer comms need a separate, sanitized outbox. [VERIFIED: supabase/migrations/20260611000002_create_ticket_tables.sql:123-155; /Users/admin/dev/autopilot/src/lib/db.ts:115-132]
- **Sending resolved summary on `status='resolved'` alone:** Current autopilot marks resolved even when deploy verification is unverified. Use `deploy.verified`. [VERIFIED: /Users/admin/dev/autopilot/src/lib/approval.ts:803-812]
- **Client-supplied source:** `send-support-ticket` must keep `source` out of the Zod request schema and stamp it server-side. [VERIFIED: supabase/functions/send-support-ticket/index.ts:20-34,186-193]
- **New comms vendor:** No Resend SDK, Twilio, SMS, push vendor, or email blast. [VERIFIED: .planning/REQUIREMENTS.md Out of Scope]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ticket lifecycle detection | Ad hoc listeners in every writer | Existing `ticket_events` and DB trigger/function | Status changes already produce audit rows across admin/service-role paths. [VERIFIED: supabase/migrations/20260611000002_create_ticket_tables.sql:180-195] |
| In-app outbox storage | New table or queue engine | `user_notifications` | Existing RLS and hook already match in-app notifications. [VERIFIED: supabase/migrations/20260131000004_create_notifications_table.sql:10-43] |
| Email delivery | New SDK/vendor | Existing Resend raw `fetch`, only where email already exists | Phase is in-app only; Resend is already used for support emails. [VERIFIED: supabase/functions/send-support-ticket/index.ts:84-109] |
| Verified-stable detection | New deploy polling logic | `verifyDeploySha()` | Autopilot already has tested deploy SHA polling. [VERIFIED: /Users/admin/dev/autopilot/src/lib/approval.ts:378-399] |
| Customer technical summary | Raw runner transcript summarization | Default-deny sanitizer + safe fallback templates | Raw evidence includes paths, SHAs, and internal language by design. [VERIFIED: D-02] |

**Key insight:** The hard part is not sending a notification; it is refusing to send one unless provenance and content are safe.

## Common Pitfalls

### Pitfall 1: The Locked Gate Does Not Exist Yet
**What goes wrong:** The planner assumes `source='in_app_user'` exists and builds comms on it.  
**Why it happens:** Phase 18 added `unknown`, `nightly_qa`, and `internal`, but not `in_app_user`; generated types confirm absence. [VERIFIED: supabase/migrations/20260613180000_extend_ticket_source_enum.sql:9-11; src/types/supabase.ts:5752-5755]  
**How to avoid:** Wave 0 must add enum value, regenerate types, and change `send-support-ticket` source stamp.  
**Warning signs:** Tests still expecting `source: 'manual'` in `send-support-ticket` source-stamping test. [VERIFIED: supabase/functions/send-support-ticket/__tests__/source-stamping.test.ts]

### Pitfall 2: Ambiguous Historical `manual` Backfill
**What goes wrong:** Existing person-owned `manual` tickets get treated as in-app and customers receive messages for tickets that may not match the new gate.  
**Why it happens:** Current source model used `manual` for person-reported tickets; D-00 forbids `manual(non-in-app)`. [VERIFIED: supabase/functions/send-support-ticket/index.ts:186-193]  
**How to avoid:** Do not backfill broad `manual` rows. Only new tickets stamped `in_app_user` qualify. If later backfill is desired, require a separate data audit with explicit markers.  
**Warning signs:** Migration contains `WHERE source = 'manual' AND reporter_id IS NOT NULL`.

### Pitfall 3: Customer Visibility Through `ticket_messages`
**What goes wrong:** Internal messages written by autopilot become visible to reporters if the UI later surfaces ticket threads.  
**Why it happens:** RLS on `ticket_messages` mirrors parent ticket visibility; autopilot writes `author_type='agent'`. [VERIFIED: supabase/migrations/20260611000002_create_ticket_tables.sql:123-155; /Users/admin/dev/autopilot/src/lib/db.ts:115-132]  
**How to avoid:** Keep Phase 23 comms in `user_notifications`; add a future `visibility` column before using `ticket_messages` for customer messaging.  
**Warning signs:** Code inserts a sanitized customer update into `ticket_messages` without addressing existing internal messages.

### Pitfall 4: Resolved Before Verified
**What goes wrong:** A customer sees "resolved" while production is still building or SHA verification failed.  
**Why it happens:** Current approval path writes `tickets.status='resolved'` after `verifyDeploySha()` regardless of `deploy.verified`. [VERIFIED: /Users/admin/dev/autopilot/src/lib/approval.ts:803-812]  
**How to avoid:** Customer resolution summary and resolved notification must be tied to `deploy.verified === true`, not status alone.  
**Warning signs:** DB trigger sends a `resolved` notification from any `status_change -> resolved`.

### Pitfall 5: Repeated In-Progress Spam
**What goes wrong:** Requeue/claim cycles repeatedly notify the same reporter that work started.  
**Why it happens:** Tickets can return to `new` and later become `in_progress` again. [VERIFIED: /Users/admin/dev/autopilot/src/lib/claim.ts:220-229,259-330]  
**How to avoid:** Use idempotency by `(ticket_id, notification_kind)` in metadata or a partial unique index/existence check.  
**Warning signs:** Notification trigger inserts without checking existing metadata.

## Code Examples

### Existing In-App Notification Read Path

```typescript
const { data, error } = await supabase
  .from("user_notifications")
  .select("*")
  .eq("user_id", user.id)
  .order("created_at", { ascending: false })
  .limit(50);
```

Source: [VERIFIED: src/hooks/useNotifications.ts:52-65]

### Existing Status Audit Trigger

```sql
IF NEW.status IS DISTINCT FROM OLD.status THEN
  INSERT INTO public.ticket_events (ticket_id, actor_id, event_type, old_value, new_value)
  VALUES (NEW.id, auth.uid(), 'status_change', OLD.status::text, NEW.status::text);
END IF;
```

Source: [VERIFIED: supabase/migrations/20260611000002_create_ticket_tables.sql:180-187]

### Existing Verified Deploy Hook

```typescript
const deploy = await verifyDeploySha(mergedSha);
const deployLine = deploy.verified
  ? `Deploy-SHA VERIFIED ...`
  : `Deploy-SHA UNVERIFIED ...`;
await writeAgentMessage(db, appr.ticketId, `## Deploy\n\n...${deployLine}`);
await db.from("tickets").update({ status: "resolved" }).eq("id", appr.ticketId).select("id");
```

Source: [VERIFIED: /Users/admin/dev/autopilot/src/lib/approval.ts:801-812]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Support email as primary record | `tickets` DB row first; Resend email side effect | Phase 11 | Phase 23 should reuse DB/outbox, not create another side-effect-first comms path. [VERIFIED: supabase/functions/send-support-ticket/index.ts:163-167,241-250] |
| Source `manual` for person reports | Operational sources split into `sentry`, `nightly_qa`, `internal`, `unknown`, but `in_app_user` is still missing | Phase 18 | Phase 23 must complete the customer source gate before customer comms. [VERIFIED: supabase/migrations/20260613180000_extend_ticket_source_enum.sql:9-11] |
| Resolve-on-merge | Verify production SHA and apply quiet-window for Sentry closeout | Phase 21 shape | Customer resolution summary should reuse verified-stable signal. [VERIFIED: /Users/admin/dev/autopilot/src/lib/sentry-resolve.ts:191-221,264-315] |

**Deprecated/outdated:**
- `manual` as customer-comms source: keep as admin/person legacy display only; do not use as customer notification gate. [VERIFIED: D-00]
- Raw `agent`/Autopilot copy in customer comms: banned by brand and D-02. [VERIFIED: D-02; CLAUDE.md]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A future UI notification bell/panel should be added because no current `useNotifications` consumer was found by `rg`. | Summary / Validation Architecture | If a hidden dynamic import exists, planner may duplicate UI; executor should run another exact search before implementation. |
| A2 | The DB enum spelling should be `in_app_user`, not `in-app-user`, because Postgres enum values and existing legacy display helper use underscores. | Summary / Open Questions | If product insists on hyphen spelling, migrations/types/tests need different values and SQL quoting. |

## Open Questions

1. **Should Phase 23 use `manual` as the customer gate? RESOLVED: No.**
   - What we know: `manual` is current intake stamp, but D-00 explicitly forbids `manual(non-in-app)` and generated types lack `in_app_user`. [VERIFIED: supabase/functions/send-support-ticket/index.ts:186-193; src/types/supabase.ts:5752-5755]
   - Decision: Add `in_app_user` enum value and stamp new in-app support tickets with it. Customer comms check exact `source = 'in_app_user'`; `manual` stays silent.

2. **Should historical `manual` tickets be backfilled to `in_app_user`? RESOLVED: No broad backfill.**
   - What we know: Phase 18 backfills were narrow and marker-based; D-00 says uncertain means no comms. [VERIFIED: supabase/migrations/20260613180500_source_attribution_backfill_metrics.sql:8-29]
   - Decision: No broad backfill. A separately audited migration can later backfill only rows with a trustworthy marker.

3. **Should resolution notifications fire from `status='resolved'`? RESOLVED: No, not by itself.**
   - What we know: Current approval code sets status resolved even when deploy SHA is unverified. [VERIFIED: /Users/admin/dev/autopilot/src/lib/approval.ts:803-812]
   - Decision: Customer resolved summary fires only from `verifyDeploySha().verified === true`; generic status trigger should skip `resolved` or require a metadata flag/event from the verified hook.

4. **Should customer comms be inserted into `ticket_messages`? RESOLVED: No for Phase 23.**
   - What we know: `ticket_messages` RLS exposes parent ticket messages to reporters, and autopilot writes internal messages there. [VERIFIED: supabase/migrations/20260611000002_create_ticket_tables.sql:123-155; /Users/admin/dev/autopilot/src/lib/db.ts:115-132]
   - Decision: Use `user_notifications` only. Add a future `visibility` model before customer ticket threads use daemon-authored messages.

5. **Should Phase 23 add email delivery? RESOLVED: No.**
   - What we know: Existing Resend raw fetch is only a support/admin email side-effect, and RSP-04 multi-channel comms is deferred. [VERIFIED: supabase/functions/send-support-ticket/index.ts:84-109; .planning/REQUIREMENTS.md]
   - Decision: In-app only. No Resend SDK and no new vendor.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | npm scripts, Vitest | yes | v26.0.0 | none needed |
| npm | package scripts | yes | 11.12.1 | none, npm only |
| Supabase CLI | migrations/typegen/deploy | yes | 2.101.0 | Supabase dashboard only for emergency manual checks |
| Deno | Edge Function tests | yes | 2.6.10 | Supabase Edge runtime |
| psql | direct DB inspection | no | n/a | Supabase CLI / supabase-js integration tests |
| GSD research-plan/classify-confidence seam | documentation lookup protocol | no | unknown command | Codebase-only research with source reads; note limitation |

**Missing dependencies with no fallback:** none for planning.  
**Missing dependencies with fallback:** `psql` absent; use Supabase CLI or test clients.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.16 plus real Supabase integration tests |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- src/lib/__tests__/ticket-display.test.ts supabase/functions/send-support-ticket/__tests__/source-stamping.test.ts` |
| Full suite command | `npm test` |
| Integration command | `npm run test:integration -- src/test/tickets-audit.integration.test.ts supabase/functions/sentry-webhook/__tests__/sentry-webhook.integration.test.ts` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| RSP-01 | `created` and `in_progress` lifecycle events insert exactly one notification for `in_app_user` reporter and zero for `manual/sentry/nightly_qa/internal/unknown/null`. | integration + SQL migration unit smoke | `npm run test:integration -- src/test/tickets-audit.integration.test.ts` plus new Phase 23 integration file | no - Wave 0 |
| RSP-01 | `send-support-ticket` stamps `in_app_user` server-side and request schema does not accept source. | unit/source test | `npm test -- supabase/functions/send-support-ticket/__tests__/source-stamping.test.ts` | yes, needs update |
| RSP-02 | Content filter redacts or falls back for paths, SHAs, stack traces, and banned internal terms. | unit | `npm test -- src/lib/__tests__/reporter-comms-filter.test.ts` and autopilot test equivalent | no - Wave 0 |
| RSP-02 | Verified-stable hook sends summary only when `verifyDeploySha().verified === true`. | autopilot unit | `cd /Users/admin/dev/autopilot && npm test -- src/lib/approval.test.ts src/lib/reporter-comms.test.ts` | no - Wave 0 |
| RSP-03 | Escalated in-app-user ticket gets human-readable status notification; non-in-app sources stay silent. | integration/unit | `npm run test:integration -- src/test/reporter-comms.integration.test.ts` | no - Wave 0 |
| RSP-03 | Tier-2/internal message bodies are never copied into `user_notifications`. | unit | `npm test -- src/lib/__tests__/reporter-comms-filter.test.ts` | no - Wave 0 |

### Sampling Rate

- **Per task commit:** targeted unit/source tests for touched area.
- **Per wave merge:** `npm test -- src/lib/__tests__/ticket-display.test.ts supabase/functions/send-support-ticket/__tests__/source-stamping.test.ts` plus autopilot targeted tests when autopilot changes are touched.
- **Phase gate:** `npm test`, relevant `npm run test:integration` with dedicated test-project env if available, and a browser screenshot for the notification surface if UI is added.

### Wave 0 Gaps

- [ ] `supabase/migrations/*_phase23_reporter_comms.sql` - adds `in_app_user`, notification function/trigger, idempotency.
- [ ] `src/test/reporter-comms.integration.test.ts` - real DB source-gate and notification fan-out coverage.
- [ ] `src/lib/reporter-comms-filter.ts` or autopilot equivalent - default-deny filter.
- [ ] `src/lib/__tests__/reporter-comms-filter.test.ts` and `/Users/admin/dev/autopilot/src/lib/reporter-comms.test.ts` - banned content and safe fallback coverage.
- [ ] Notification UI component test if a bell/panel is added, because current hook has no discovered consumer.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | `authenticateRequest` for Edge Function intake; service-role only for backend inserts. [VERIFIED: supabase/functions/send-support-ticket/index.ts:133-139] |
| V3 Session Management | yes | Supabase Auth sessions, RLS on notification reads by `auth.uid()`. [VERIFIED: supabase/migrations/20260131000004_create_notifications_table.sql:36-43] |
| V4 Access Control | yes | Exact `source='in_app_user'` and `reporter_id` gate; no notifications to system/internal sources. [VERIFIED: D-00] |
| V5 Input Validation | yes | Zod schemas; no client-supplied `source`; content filter default-deny. [VERIFIED: supabase/functions/send-support-ticket/index.ts:20-34] |
| V6 Cryptography | no direct new crypto | Existing auth/token infrastructure only; no new cryptographic primitive. |
| V8 Data Protection | yes | Redact paths, SHAs, stack traces, and internal operational text before customer visibility. [VERIFIED: D-02] |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Source spoofing by browser body | Spoofing | Keep `source` absent from request schema; server stamps `in_app_user`. |
| Information disclosure from internal summaries | Information Disclosure | Default-deny filter with fallback template; unit tests for banned patterns. |
| Customer comms to Sentry/QA/internal tickets | Information Disclosure / Privacy | DB-level exact source gate; test every non-in-app source stays silent. |
| Duplicate notification spam | Denial of Service / UX harm | Idempotency by ticket/kind in metadata or partial unique index/existence guard. |
| RLS bypass assumptions | Elevation of Privilege | Real integration tests against dedicated test Supabase project; never mocked Supabase. |

## Sources

### Primary (HIGH confidence)

- `supabase/migrations/20260131000004_create_notifications_table.sql` - `user_notifications` schema and RLS.
- `src/hooks/useNotifications.ts` - current frontend notification query/mutation hook.
- `supabase/migrations/20260611000002_create_ticket_tables.sql` - ticket schema, RLS, status audit trigger.
- `supabase/functions/send-support-ticket/index.ts` - authenticated support ticket intake, current `manual` source stamp, Resend raw fetch path.
- `src/types/supabase.ts` - generated `ticket_source` enum currently lacks `in_app_user`.
- `src/lib/ticket-display.ts` - existing humanizers and legacy `in_app_user` label.
- `/Users/admin/dev/autopilot/src/lib/approval.ts` - `verifyDeploySha()` and approval path.
- `/Users/admin/dev/autopilot/src/lib/sentry-resolve.ts` - verified-stable plus quiet-window sweep shape.
- `docs/architecture/autopilot-brain-ownership.md` - Brain/autopilot DB seam.

### Secondary (MEDIUM confidence)

- `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/design/escalation-tier2-solutions-not-problems.md` - locked phase intent and roadmap constraints.
- `AGENTS.md`, `CLAUDE.md`, `src/CLAUDE.md`, `supabase/CLAUDE.md`, `docs/CLAUDE.md` - operating, stack, and verification rules.

### Tertiary (LOW confidence)

- None used for implementation recommendations. The `gsd-tools query research-plan` and `classify-confidence` seams were attempted, but this local install returned `Unknown command`; no web/package recommendations were needed.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries/systems are already installed and source-verified.
- Architecture: HIGH - lifecycle, outbox, RLS, and autopilot deploy paths were read directly.
- Pitfalls: HIGH - the `in_app_user` enum gap and resolved-before-verified risk are directly visible in code.
- UI surfacing: MEDIUM - exact search found no `useNotifications` consumer, but executor should re-run search before implementation.

**Graph status:** CodeGraph was healthy for navigation (1,312 files indexed). GSD Graphify exists but is stale by 346 hours and 579 commits, so it was not used as evidence.

**Research date:** 2026-06-14  
**Valid until:** 2026-07-14 for codebase architecture, or until the ticket source enum/intake path changes.

## RESEARCH COMPLETE
