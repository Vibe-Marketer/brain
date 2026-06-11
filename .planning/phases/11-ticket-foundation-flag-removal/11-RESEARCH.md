# Phase 11: Ticket Foundation + Flag Removal - Research

**Researched:** 2026-06-10
**Domain:** Supabase (Postgres migrations, RLS, triggers, Edge Functions) + React admin UI
**Confidence:** HIGH (all findings verified directly against the codebase; zero new external dependencies)

## Summary

Phase 11 is a codebase-internal phase: three new Postgres tables with RLS and an audit trigger, a pivot of the existing `send-support-ticket` Edge Function from email-only to DB-first, removal of the dead feature-flag system, and a new Tickets section in AdminTab. Every pattern needed already exists in the repo — migration structure, `has_role()` SECURITY DEFINER admin checks, touch/audit trigger pairs, the `authenticateRequest` Edge Function helper, the service+hook frontend pattern, and the CI-enforced RLS regression test. No new npm or Deno packages are required.

The main risks are (1) RLS on `ticket_events` blocking the status-transition trigger unless the trigger function is SECURITY DEFINER, (2) the reporter spoofing vector if `reporter_id` is ever taken from the request body instead of the authenticated JWT, and (3) forgetting that `supabase db push` must run before `src/types/supabase.ts` regeneration and before any verification can pass (types come from config, not the live DB).

**Primary recommendation:** Two migrations (flag drop, ticket tables) per CONTEXT.md preference; enum types for status/severity (ISC-7 probe "INSERT with invalid status fails" is satisfied natively by Postgres enums); AFTER UPDATE trigger with a SECURITY DEFINER function writing `ticket_events`; Edge Function inserts via service-role client with `reporter_id` forced from the authenticated user.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Ticket Foundation Design (accepted 2026-06-10)
- Status lifecycle enum: new → triaged → in_progress → awaiting_approval | awaiting_user → resolved | rejected | escalated (matches ISA ISC-7; Phase 14 approval semantics depend on awaiting_approval)
- Severity: critical | high | medium | low, default medium
- Tickets UI: new "Tickets" section inside the existing AdminTab (`src/components/settings/AdminTab.tsx` area) — table with status/severity/source filters + detail view with event timeline, following existing settings/AdminTab idiom (Remix icons, shadcn/ui, service+hook pattern)
- Feature-flag removal: hard-enable ALL currently-gated surfaces (Layout.tsx, sidebar-nav.tsx gates removed; AdminTab flag toggles section deleted; `useFeatureFlags` hook deleted); `feature_flags` table dropped via migration
- Existing `send-support-ticket` Edge Function pivots: INSERT into tickets/ticket_messages first (source of truth), Resend email to support@callvaultai.com becomes a side-effect of the insert
- RLS: reporter sees own tickets; ADMIN role sees all (mirror existing role model used by AdminTab / useUserRole)
- Every status transition writes a ticket_events row (DB trigger for status changes; service writes for other lifecycle events)

### Claude's Discretion
- Exact table column shapes beyond ISA ISC-1..8 (tickets: id, reporter_id, type bug|suggestion|question|task, severity, status, source manual|sentry, context jsonb, created_at/updated_at; ticket_messages; ticket_events)
- Detail-panel layout within the AdminTab idiom
- Migration naming and ordering; whether flag removal and ticket tables are one migration or two (two preferred — independent revert)

### Deferred Ideas (OUT OF SCOPE)
- User-facing ticket status view / chat thread — v2 (AP-V2-02)
- Notification fan-out on ticket events — Phase 14 scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FLAG-01 | Feature-flag system removed entirely — `feature_flags` table, `useFeatureFlags` hook, gates in Layout.tsx/sidebar-nav.tsx/AdminTab toggles; gated surfaces hard-enabled | Flag inventory below (exact gate sites, test files, migrations); DROP TABLE migration pattern |
| TKT-01 | Tickets persist in DB — `tickets`/`ticket_messages`/`ticket_events` with RLS (reporter own, ADMIN all); support form writes here, email becomes side-effect | Migration + RLS patterns, `has_role()` helper, Edge Function pivot pattern, RLS regression test extension |
| TKT-02 | Admin views tickets in AdminTab — list with status/severity/source filters + detail with event timeline | UI-SPEC (11-UI-SPEC.md, approved) + AdminTab/UserTable idiom + service+hook pattern |
| TKT-03 | Admin submits ticket in-app (bug or task) with context auto-attached | Existing `support-ticket.service.ts` context capture (URL, UA, ids, app version, commit) reused |
| TKT-04 | Every status transition recorded in `ticket_events` (audit reconstructs lifecycle) | Trigger pattern (codify_* migrations), SECURITY DEFINER trigger function, ISA ISC-8 probe |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Ticket persistence + lifecycle enum | Database (migrations) | — | Enums + constraints enforce ISC-7 at the engine; nothing client-side can bypass |
| Cross-user visibility (reporter own / ADMIN all) | Database (RLS) | — | RLS is the only layer that holds against direct PostgREST queries |
| Status-transition audit (TKT-04) | Database (trigger) | API (service writes for non-status events) | DB trigger cannot be skipped by any code path; per CONTEXT decision |
| Ticket intake (support form pivot) | API (Edge Function) | — | Server sets `reporter_id` from JWT, validates with zod, owns email side-effect |
| Admin ticket submission (TKT-03) | API (Edge Function) | Frontend (dialog reusing context capture) | Same intake path; context auto-attach lives in the existing frontend service |
| Tickets list/detail UI (TKT-02) | Frontend (AdminTab section) | — | Pure read + status-change mutations via service+hook |
| Flag removal (FLAG-01) | Frontend + Database | — | Code deletion in src/, `DROP TABLE` migration in supabase/migrations/ |

## Standard Stack

### Core (all already installed — no new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | existing (`src/integrations/supabase/client`) | Frontend DB reads via RLS | Locked project pattern [VERIFIED: codebase] |
| `@tanstack/react-query` | existing | Hook layer over services | Locked service+hook pattern [VERIFIED: codebase] |
| `zod` (esm.sh `zod@3.23.8` in Deno) | existing | Edge Function input validation | Already used by `send-support-ticket` [VERIFIED: supabase/functions/send-support-ticket/index.ts] |
| Resend API | existing | Email side-effect | Already wired in `send-support-ticket` [VERIFIED: codebase] |
| vitest | ^4.0.16 | Test framework | `npm test` = `vitest run` [VERIFIED: package.json] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Postgres ENUM for status | TEXT + CHECK constraint | CHECK is easier to extend later, but ISC-7 probe + CONTEXT lock say "enum"; enum INSERT failure is the locked behavior |
| Edge Function insert (service-role) | Frontend direct insert via RLS | Direct insert can't force `reporter_id` server-side for unauthenticated-context fields and can't own the email side-effect; keep the Edge Function as intake |

**Installation:** none. Zero new packages.

## Package Legitimacy Audit

No external packages are installed by this phase. **Packages removed due to slopcheck [SLOP] verdict:** none. **Packages flagged as suspicious [SUS]:** none.

## Project Constraints (from CLAUDE.md)

- npm only; Remix icons only (`@remixicon/react`); no AI/RAG code in frontend (AI-02); no "AI-powered" copy [VERIFIED: /CLAUDE.md]
- Service + Hook separation: `src/services/*.service.ts` pure async, `src/hooks/use*.ts` TanStack Query wrappers [VERIFIED: /CLAUDE.md, src/CLAUDE.md]
- Conventional commits scoped `feat(11-xx):` [VERIFIED: CONTEXT.md]
- Edge Functions: kebab-case folders, `authenticateRequest` shared helper (never inline auth), zod validation, CORS preflight, no secrets in responses [VERIFIED: supabase/CLAUDE.md]
- All new tables MUST enable RLS and follow the migration file structure (`YYYYMMDDHHMMSS_name.sql`, sectioned: TABLE / INDEXES / RLS / POLICIES / COMMENTS) [VERIFIED: supabase/CLAUDE.md]
- Edge Function deploys MUST use `--use-api` (Docker not running on this machine) [VERIFIED: supabase/CLAUDE.md]
- Integration tests require a dedicated test project (`VITE_SUPABASE_TEST_URL` etc.); excluded from `npm test` unless `VITEST_INTEGRATION_OK=true`; `npm run test:integration` is the only approved entry point [VERIFIED: supabase/CLAUDE.md]
- New user-facing tables must be appended to `CROSS_ORG_TABLES` in `src/test/rls-regression.test.ts` [VERIFIED: supabase/CLAUDE.md + CONTEXT.md]
- Vercel AI SDK rule and dev-browser verification rules apply to execution, not planning

## Architecture Patterns

### System Architecture Diagram

```
SupportTicketDialog (end user)      AdminTab New-Ticket dialog (TKT-03)
        │  submitSupportTicket()             │ (same service, type/severity params)
        ▼                                    ▼
   send-support-ticket Edge Function ────────┐
        │ authenticateRequest (JWT)          │
        │ zod validate                       │
        │ service-role INSERT ──► tickets + ticket_messages   (source of truth)
        │                              │
        │                              ├─ AFTER UPDATE OF status trigger ──► ticket_events (TKT-04)
        │                              └─ service-role INSERT 'created' event
        └─ Resend email (side-effect; failure logged, never fails the request)

AdminTab Tickets section (TKT-02)
   useTickets/useTicketDetail (TanStack Query)
        │
   tickets.service.ts ──► supabase-js (user JWT) ──► RLS: reporter own / has_role(uid,'ADMIN') all
```

### Pattern 1: Migration structure + RLS with admin override

**What:** New-table migrations follow the sectioned template; admin visibility uses the existing `public.has_role(_user_id, _role)` SECURITY DEFINER function (prevents RLS recursion).
**When to use:** All three ticket tables.
**Example (verbatim from codebase):**

```sql
-- Source: supabase/migrations/00000000000000_consolidated_schema.sql:319 + :516
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

-- Existing admin-policy idiom:
-- USING (public.has_role(auth.uid(), 'ADMIN'));
```

Recommended policy set for `tickets`:
- SELECT: `USING (reporter_id = auth.uid() OR public.has_role(auth.uid(), 'ADMIN'))`
- INSERT: `WITH CHECK (reporter_id = auth.uid())` (Edge Function uses service-role and bypasses anyway; policy covers any future direct insert)
- UPDATE: `USING (public.has_role(auth.uid(), 'ADMIN')) WITH CHECK (public.has_role(auth.uid(), 'ADMIN'))` (status transitions are admin-only this phase)
- No DELETE policy (tickets are never deleted; audit integrity)

`ticket_messages` / `ticket_events`: visibility via `EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND (t.reporter_id = auth.uid() OR public.has_role(auth.uid(), 'ADMIN')))`.

### Pattern 2: Status-transition audit trigger (TKT-04 / ISC-8)

**What:** `AFTER UPDATE OF status` trigger on `tickets` inserting a `ticket_events` row. The trigger function MUST be `SECURITY DEFINER` so the RLS policies on `ticket_events` (which have no INSERT policy for `authenticated`) do not block the write when an admin updates status via the anon-key client.
**Example (idiom from existing codify migrations):**

```sql
-- Source idiom: supabase/migrations/20260528070300_codify_ai_processing_jobs_updated_at.sql
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

DROP TRIGGER IF EXISTS ticket_status_audit ON public.tickets;
CREATE TRIGGER ticket_status_audit
  AFTER UPDATE OF status ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.log_ticket_status_change();
```

Note: `auth.uid()` is NULL under the service-role client — `actor_id` must be nullable (system/agent transitions in later phases will be NULL or a dedicated actor value). Pair with the standard `updated_at` touch trigger (same codify idiom).

### Pattern 3: Edge Function DB-first pivot

**What:** `send-support-ticket` keeps its exact contract (`authenticateRequest`, zod schema, CORS) and adds: (1) service-role client INSERT into `tickets` (+ first `ticket_messages` row, + `created` event), `reporter_id` forced from `authResult.userId` — NEVER from the body; (2) Resend send wrapped so failure logs but does not fail the request; (3) response returns `{ success: true, ticketId }`.
**Why service-role for the insert:** the function already authenticates the JWT; service-role avoids needing INSERT policies broad enough for context fields, and the `reporter_id = authenticated userId` invariant is enforced in code at the single intake point. This mirrors the repo-wide Edge Function pattern (service-role after `authenticateRequest`) [VERIFIED: supabase/CLAUDE.md template].

### Pattern 4: Service + hook frontend layer

```typescript
// Source idiom: src/services/*.service.ts + src/hooks/* (locked pattern, /CLAUDE.md)
// src/services/tickets.service.ts — pure async, supabase client, no React
// src/hooks/useTickets.ts — useQuery(queryKeys...), useMutation with optimistic update for status change
```

AdminTab currently does inline supabase calls (legacy); new Tickets section MUST use the service+hook pattern per locked decision — do not copy AdminTab's inline-query style, copy its visual idiom only.

### Recommended file layout

```
supabase/migrations/
  {ts1}_drop_feature_flags.sql          # FLAG-01 (independent revert)
  {ts2}_create_ticket_tables.sql        # TKT-01/04: tables + enums + indexes + RLS + triggers
supabase/functions/send-support-ticket/index.ts   # pivot (modify in place)
src/services/tickets.service.ts
src/hooks/useTickets.ts
src/components/settings/TicketTable.tsx           # mirrors UserTable
src/components/settings/TicketDetailDialog.tsx
src/components/settings/NewTicketDialog.tsx       # TKT-03 (admin)
src/components/settings/AdminTab.tsx              # remove flags section, add Tickets section
src/components/Layout.tsx / src/components/ui/sidebar-nav.tsx  # gate removal
src/types/supabase.ts                             # regenerate after db push
```

### Anti-Patterns to Avoid

- **Inline supabase queries in components:** AdminTab's legacy style — new code goes through services/hooks (locked).
- **Reading `reporter_id` from the request body:** spoofing vector; always from `authResult.userId`.
- **Email failure failing the ticket insert:** email is a side-effect; the DB row is the system of record (locked decision).
- **`USING (true)` policies:** the documented #1 cause of RLS regression failures [VERIFIED: supabase/CLAUDE.md].
- **Editing v1 flags tests instead of deleting them:** `Layout.test.tsx` and `sidebar-nav.test.tsx` mock `useFeatureFlags` — those mocks must be removed with the hook or `npm test` breaks.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Admin check in SQL | per-policy subquery on user_roles | `public.has_role(auth.uid(), 'ADMIN')` | SECURITY DEFINER, prevents RLS recursion, repo-wide idiom |
| JWT parsing in Edge Function | inline header parsing | `authenticateRequest` from `_shared/auth.ts` | Phase 37 helper; regression-pinned contract |
| updated_at maintenance | app-side timestamps | touch trigger (codify idiom) | Engine-enforced, matches every other table |
| Context capture for tickets | new capture code | existing `support-ticket.service.ts` payload builder | Already captures URL, UA, user/org/workspace ids, app version, commit |
| Cross-user isolation proof | ad-hoc manual checks | `src/test/rls-regression.test.ts` CROSS_ORG_TABLES extension | CI-enforced, names leaking table on failure |

**Key insight:** every mechanism this phase needs already has a proven in-repo instance; the work is composition, not invention.

## FLAG-01 Removal Inventory (grep-verified)

| Artifact | Location | Action |
|----------|----------|--------|
| `useFeatureFlags` hook | `src/hooks/useFeatureFlags.ts` | DELETE |
| Layout gate | `src/components/Layout.tsx:24,37,173` — `isFeatureEnabled('debug_panel') && <DebugPanel />` | hard-enable `<DebugPanel />` (CONTEXT locks "hard-enable ALL currently-gated surfaces") |
| Sidebar gates | `src/components/ui/sidebar-nav.tsx:35,124,127-131` — `import`/`rules` items gated on `beta_imports` | remove gate; items always visible |
| AdminTab flags section | `src/components/settings/AdminTab.tsx:50-57,77-79,162-174,206-224,331-374` (FeatureFlag interface, state, loaders, toggle handler, JSX section) | DELETE; `Switch` import removed if unused |
| Tests mocking the hook | `src/components/__tests__/Layout.test.tsx`, `src/components/ui/__tests__/sidebar-nav.test.tsx` | remove mocks/assertions tied to flags |
| `feature_flags` table | created `20260302000000_feature_flags.sql`, seeded `20260310160001_enable_beta_imports.sql` | new migration: `DROP TABLE IF EXISTS public.feature_flags;` (do NOT edit old migrations) |
| Generated types | `src/types/supabase.ts` `feature_flags` entry | regenerate/hand-remove with ticket-table regen |

Acceptance grep: `rg -n "feature_flags|useFeatureFlags|isFeatureEnabled" src/ supabase/functions/` returns 0 hits after removal (migrations dir excluded — historical migrations stay).

## Common Pitfalls

### Pitfall 1: Trigger insert blocked by ticket_events RLS
**What goes wrong:** status update succeeds but no event row appears, or the UPDATE errors with policy violation.
**Why:** trigger functions run with caller privileges by default; `ticket_events` deliberately has no INSERT policy for `authenticated`.
**How to avoid:** `SECURITY DEFINER` + `SET search_path = public` on the trigger function (matches `has_role` idiom).
**Warning signs:** ISC-8 probe (UPDATE status → SELECT ticket_events) returns no new row.

### Pitfall 2: Verification false-positive without `supabase db push`
**What goes wrong:** build + tests pass while the live DB lacks the tables (types are file-based).
**How to avoid:** [BLOCKING] `supabase db push` task after migrations, before types regen and any probe. Non-TTY: `SUPABASE_ACCESS_TOKEN` env var must be set.

### Pitfall 3: Enum churn
**What goes wrong:** `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block in some migration runners; getting the enum right now avoids Phase 12-15 migrations.
**How to avoid:** create `ticket_status` with all eight locked values, `ticket_type` with bug|suggestion|question|task, `ticket_severity` with critical|high|medium|low, `ticket_source` with manual|sentry now. `fingerprint` column (nullable, unique-when-not-null via partial unique index: `CREATE UNIQUE INDEX ... ON tickets(fingerprint) WHERE fingerprint IS NOT NULL`) ships now per CONTEXT.

### Pitfall 4: RLS regression test type union
**What goes wrong:** `CROSS_ORG_TABLES` `filterColumn` is a closed string-literal union (`organization_id | org_id | user_id | recording_id | workspace_id | folder_id`); tickets pivot on `reporter_id`.
**How to avoid:** extend the union with `"reporter_id"` and `"ticket_id"` when appending `tickets`, `ticket_messages`, `ticket_events` rows; seed one ticket per org-user in the fixture so the cross-user probe is meaningful (ISC-4/5/6).

### Pitfall 5: Edge function deploy hang
**What goes wrong:** `supabase functions deploy send-support-ticket` hangs (Docker bundling).
**How to avoid:** always `--use-api` [VERIFIED: supabase/CLAUDE.md].

### Pitfall 6: Hard-enabling debug_panel
**What goes wrong:** `debug_panel` gate removal exposes `<DebugPanel />` to all users — locked decision says hard-enable ALL gated surfaces, so this is intentional, but the executor may second-guess and silently keep a gate.
**How to avoid:** plan task states explicitly: DebugPanel renders unconditionally (or behind existing non-flag dev conditions if any are already present in the component itself — do not invent a new gate).

## Code Examples

### Tickets table shape (discretion area, ISA ISC-1..3 + CONTEXT + Phase-12/15 forward-compat)

```sql
-- Source: synthesized from CONTEXT.md locked columns + supabase/CLAUDE.md migration template
CREATE TYPE public.ticket_status AS ENUM ('new','triaged','in_progress','awaiting_approval','awaiting_user','resolved','rejected','escalated');
CREATE TYPE public.ticket_type AS ENUM ('bug','suggestion','question','task');
CREATE TYPE public.ticket_severity AS ENUM ('critical','high','medium','low');
CREATE TYPE public.ticket_source AS ENUM ('manual','sentry');

CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.ticket_type NOT NULL,
  severity public.ticket_severity NOT NULL DEFAULT 'medium',
  status public.ticket_status NOT NULL DEFAULT 'new',
  source public.ticket_source NOT NULL DEFAULT 'manual',
  fingerprint TEXT,            -- Phase 12 dedup; partial unique index WHERE NOT NULL
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('user','agent','admin')),
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,   -- Phase 15 screenshots/console buffer
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.ticket_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- NULL = system/service-role
  event_type TEXT NOT NULL,            -- 'created' | 'status_change' | future lifecycle events
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Types regeneration

```bash
# After supabase db push (project is linked; Docker not required for gen types --linked)
supabase gen types typescript --linked > src/types/supabase.ts
# Fallback if CLI/link unavailable: hand-extend src/types/supabase.ts with the three tables + enums and delete feature_flags
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Email-only support tickets (Resend) | DB-first tickets, email side-effect | this phase | Tickets findable in-app next day (canonical motivation) |
| feature_flags table + role-array gating | no flag system; surfaces hard-enabled | this phase | AdminTab surface cleared for Tickets section |

**Deprecated/outdated:** `useFeatureFlags` and all `isFeatureEnabled` call sites — removed, not migrated.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `supabase gen types typescript --linked` works without Docker on this machine | Code Examples | Low — fallback is hand-extending `src/types/supabase.ts` (CONTEXT explicitly allows "regenerate or hand-extend") |
| A2 | No other surface reads `feature_flags` beyond the 6 grep-verified locations | FLAG-01 Inventory | Low — acceptance grep at task level catches stragglers |

## Open Questions

1. **Should admin status changes go through the Edge Function or direct RLS UPDATE?**
   - What we know: UPDATE policy can be admin-only via `has_role`; trigger fires either way; `auth.uid()` populates `actor_id` only on the JWT path.
   - Recommendation: direct supabase-js UPDATE from `tickets.service.ts` (admin JWT) — keeps actor attribution and avoids a second Edge Function. The Edge Function stays intake-only.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| supabase CLI | db push, gen types, functions deploy | ✓ (used routinely per supabase/CLAUDE.md) | — | none needed |
| Docker | local stack | ✗ (documented as not running) | — | `--use-api` deploys; linked-project push; free-tier test project for integration tests |
| Supabase test project env (`VITE_SUPABASE_TEST_URL` etc.) | RLS regression run | unknown at plan time | — | test skips cleanly via `describe.skipIf`; CI runs it when secrets configured |
| Resend (`RESEND_API_KEY`) | email side-effect | ✓ (existing function works) | — | insert succeeds regardless (side-effect isolation) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** Docker (use `--use-api` / linked push), local test DB (CI-gated integration suite).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.16 |
| Config file | vitest.config.ts (integration tests excluded by default) |
| Quick run command | `npx vitest run <file>` |
| Full suite command | `npm test` (unit) + `npm run build`; `npm run test:integration` (gated, needs test project) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FLAG-01 | No dead flag references; build/tests green | static + unit | `rg -n "useFeatureFlags\|isFeatureEnabled\|feature_flags" src/ → 0 hits; npm test; npm run build` | ✅ (existing suite) |
| TKT-01 | Cross-user RLS isolation on 3 tables | integration | `npx vitest run src/test/rls-regression.test.ts` (extended CROSS_ORG_TABLES) | ❌ Wave 0 — extend existing file |
| TKT-01 | Edge Function inserts before email | unit (Deno) / contract | service unit test for tickets.service.ts; Edge Function behavior verified via deploy + probe at execute time | ❌ Wave 0 |
| TKT-02/03 | Filters render, detail timeline renders, submit dialog works | component test + dev-browser verification at execution | `npx vitest run src/components/settings/__tests__/TicketTable.test.tsx` | ❌ Wave 0 |
| TKT-04 | UPDATE status → ticket_events row | integration (test project) | extend rls-regression or dedicated `tickets-audit.integration.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched test files>` + `npm run build`
- **Per wave merge:** `npm test`
- **Phase gate:** `npm test` + `npm run build` green; integration suite green where env available before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/test/rls-regression.test.ts` — extend CROSS_ORG_TABLES + fixtures for tickets/ticket_messages/ticket_events (covers TKT-01, ISC-4/5/6)
- [ ] `src/services/__tests__/tickets.service.test.ts` — service unit tests (mocked supabase client)
- [ ] `src/components/settings/__tests__/` — tickets UI component tests
- [ ] Framework install: none — vitest present

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `authenticateRequest` shared helper (Edge Function); Supabase Auth JWT |
| V3 Session Management | no (delegated) | Supabase Auth |
| V4 Access Control | yes | RLS (reporter own / `has_role(uid,'ADMIN')` all); admin-only UPDATE; AdminTab `isAdmin` gate |
| V5 Input Validation | yes | zod schema in Edge Function (existing `supportTicketSchema`, extended with type/severity) |
| V6 Cryptography | no | none introduced |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Reporter spoofing (body-supplied reporter_id) | Spoofing | `reporter_id` set server-side from `authResult.userId` only |
| Cross-user ticket reads | Information Disclosure | RLS policies + CROSS_ORG_TABLES regression probe (ISC-4/5/6) |
| Unauthorized status tampering | Tampering | UPDATE policy admin-only via `has_role`; no DELETE policy |
| Audit-trail bypass | Repudiation | DB trigger (cannot be skipped by app code); events table has no UPDATE/DELETE policies |
| Oversized payload / context JSON abuse | DoS | zod `.max()` limits (existing 5000-char message cap; cap context fields) |
| HTML injection via ticket body in email | Injection (XSS) | existing `escapeHtml` in send-support-ticket retained |

## Sources

### Primary (HIGH confidence — all codebase)
- `supabase/CLAUDE.md` — migration template, RLS patterns, Edge Function template, deploy/test rules
- `supabase/migrations/00000000000000_consolidated_schema.sql` — `has_role`, admin policy idiom, `app_role` enum
- `supabase/migrations/20260302000000_feature_flags.sql` + `20260310160001_enable_beta_imports.sql` — flag system to drop
- `supabase/migrations/20260528070300_codify_ai_processing_jobs_updated_at.sql` — trigger idiom
- `supabase/functions/send-support-ticket/index.ts` — function to pivot
- `src/services/support-ticket.service.ts`, `src/components/support/SupportTicketDialog.tsx` — context capture + form
- `src/hooks/useFeatureFlags.ts`, `src/components/Layout.tsx`, `src/components/ui/sidebar-nav.tsx`, `src/components/settings/AdminTab.tsx` — removal sites
- `src/test/rls-regression.test.ts` — CROSS_ORG_TABLES contract
- `.planning/phases/11-ticket-foundation-flag-removal/11-UI-SPEC.md` — approved UI contract
- `~/.claude/PAI/MEMORY/WORK/20260610-autonomous-admin-center/ISA.md` §A ISC-1..8 — probe definitions

### Secondary / Tertiary
- none (no web research required; zero new dependencies)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; all existing
- Architecture: HIGH — every pattern has a verified in-repo instance
- Pitfalls: HIGH — derived from documented incidents (RLS leak guidance, Docker deploy hang, integration-test prod incident)

**Research date:** 2026-06-10
**Valid until:** 2026-07-10 (stable, internal codebase)
